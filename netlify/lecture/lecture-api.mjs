import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const pollSlide = "class-poll";
const answer = "riders";
const demoCounts = { riders: 6, everyone: 4, "cannot-tell": 2 };
const emptySession = { id: null, round: null, votes: {}, revealed: false, simulated: false };

export function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

export function isLecturer(request, passwordHash) {
  const auth = request.headers.get("authorization") || "";
  const credentials = /^Basic ([a-zA-Z0-9+/=]+)$/i.exec(auth);
  if (!credentials || !/^[a-f0-9]{64}$/.test(passwordHash)) return false;
  const value = Buffer.from(credentials[1], "base64").toString("utf8");
  if (!value.startsWith("lecturer:")) return false;
  return timingSafeEqual(Buffer.from(hashPassword(value.slice(9)), "hex"), Buffer.from(passwordHash, "hex"));
}

export function denied() {
  return new Response(null, {
    status: 401,
    headers: { "Cache-Control": "no-store", "WWW-Authenticate": 'Basic realm="POLI10302 lecturer"' }
  });
}

function json(data, status = 200, cache = false) {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (cache) headers["Netlify-CDN-Cache-Control"] = "public, s-maxage=2, durable";
  return Response.json(data, { status, headers });
}

async function change(store, key, initial, update) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const entry = await store.getWithMetadata(key, { type: "json" });
    const { next, reply } = update(entry?.data ?? initial);
    if (!next) return reply;
    const condition = entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true };
    if ((await store.setJSON(key, next, condition)).modified) return reply;
    await delay(10 + Math.random() * Math.min(350, 20 * (attempt + 1)));
  }
  return json({ error: "busy" }, 503);
}

async function snapshot(store, instructor) {
  const session = (await store.getWithMetadata("session", { type: "json" }))?.data ?? emptySession;
  const onPoll = session.id === pollSlide;
  const state = { id: session.id, round: session.round, open: onPoll && !session.revealed,
    revealed: onPoll && session.revealed, voted: onPoll ? Object.keys(session.votes).length : 0 };
  if (!onPoll) return state;

  if (instructor) state.simulated = session.simulated;
  if (state.revealed) {
    const live = { riders: 0, everyone: 0, "cannot-tell": 0 };
    for (const choice of Object.values(session.votes)) live[choice] += 1;
    state.results = { answer, live, demo: session.simulated ? demoCounts : null };
  }
  return state;
}

function voterId(value) {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}

export async function lectureApi(request, store, passwordHash) {
  const action = new URL(request.url).pathname.split("/").at(-1);
  const instructor = ["instructor", "control", "poll-demo"].includes(action);
  if (instructor && !isLecturer(request, passwordHash)) return denied();

  if (request.method === "GET" && ["state", "instructor"].includes(action)) {
    const state = await snapshot(store, instructor);
    return json(state, 200, !instructor && !state.revealed);
  }
  if (request.method !== "POST") return json({ error: "method" }, 405);
  if (request.headers.get("content-type") !== "application/json") return json({ error: "format" }, 415);
  const raw = await request.text();
  if (raw.length > 256) return json({ error: "size" }, 413);
  let data;
  try { data = JSON.parse(raw); } catch { return json({ error: "format" }, 400); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "format" }, 400);

  if (action === "control") {
    const { id, newRound } = data;
    if (typeof id !== "string" || !/^[a-z][a-z0-9_-]{0,79}$/.test(id)) return json({ error: "slide" }, 400);
    if (newRound === true && id !== "join") return json({ error: "slide" }, 400);
    if (newRound === true) {
      return change(store, "session", emptySession, () => ({
        next: { ...emptySession, id, round: randomBytes(8).toString("hex") },
        reply: json({ id })
      }));
    }
    return change(store, "session", emptySession, session => ({
      next: id === session.id ? null : { ...session, id, round: session.round ?? randomBytes(8).toString("hex") },
      reply: json({ id })
    }));
  }

  if (action === "vote") {
    const { voter, choice } = data;
    if (!voterId(voter) || typeof choice !== "string" || !Object.hasOwn(demoCounts, choice)) return json({ error: "vote" }, 400);
    return change(store, "session", emptySession, session => {
      if (!session.round || data.round !== session.round) return { reply: json({ error: "round" }, 409) };
      if (Object.hasOwn(session.votes, voter)) {
        return { reply: json({ hasVoted: true }, session.votes[voter] === choice ? 200 : 409) };
      }
      if (session.id !== pollSlide || session.revealed) return { reply: json({ error: "closed" }, 409) };
      if (Object.keys(session.votes).length >= 2000) return { reply: json({ error: "full" }, 429) };
      return { next: { ...session, votes: { ...session.votes, [voter]: choice } }, reply: json({ hasVoted: true }) };
    });
  }

  if (action === "poll-demo") {
    if (!["simulate", "reveal", "reset"].includes(data.action)) return json({ error: "action" }, 400);
    return change(store, "session", emptySession, session => {
      if (session.id !== pollSlide || session.round !== data.round) return { reply: json({ error: "round" }, 409) };
      const next = { ...session };
      if (data.action === "reset") {
        Object.assign(next, emptySession, { id: pollSlide, round: randomBytes(8).toString("hex") });
      } else if (data.action === "reveal") {
        next.revealed = true;
      } else if (!next.revealed) {
        next.simulated = true;
      }
      return { next, reply: json({ round: next.round }) };
    });
  }

  return json({ error: "route" }, 404);
}
