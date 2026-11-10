if (location.protocol !== "file:" && window.top === window) {
  const deck = window.Reveal;
  const status = document.createElement("output");
  status.className = "presenter-status";
  status.textContent = "Follow-along connecting…";
  document.body.append(status);
  let publishing;
  let lastSent;
  let startFresh = false;
  const entry = new URL(location.href);
  if (entry.searchParams.get("new") === "1" && entry.hash === "#/join") {
    entry.searchParams.delete("new");
    history.replaceState(history.state, "", entry);
    startFresh = window.confirm("Start a fresh poll round? This clears the previous round’s votes.");
  }

  async function sendSlide(id) {
    const newRound = startFresh && id === "join";
    try {
      const response = await fetch("api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, newRound }),
        signal: AbortSignal.timeout(6000)
      });
      if (!response.ok) throw new Error("Lecture unavailable");
      if (newRound) startFresh = false;
      lastSent = id;
      status.textContent = "Follow-along live";
      return true;
    } catch {
      status.textContent = "Follow-along offline";
      return false;
    }
  }

  async function publish() {
    const id = deck.getCurrentSlide()?.id;
    if (!id) return false;
    if (publishing) {
      const current = publishing;
      const sent = await current.promise;
      if (deck.getCurrentSlide()?.id !== id) return false;
      return current.id === id ? sent : publish();
    }
    if (id === lastSent) return true;
    publishing = { id, promise: sendSlide(id).finally(() => { publishing = null; }) };
    return publishing.promise;
  }

  deck.on("slidechanged", publish);
  deck.on("ready", publish);
  if (deck.isReady()) void publish();
  showPollResults(deck, publish);

  // Retry unsent slide changes if the network drops.
  setInterval(publish, 3000);
}

function showPollResults(deck, publish) {
  const options = document.querySelector("#class-poll .poll-options");
  if (!options) return;
  const slide = options.closest("section");
  const summary = document.querySelector("#class-poll .poll-summary");
  const rows = [...options.children].map(option => {
    const label = document.createElement("span");
    label.textContent = option.textContent;
    option.replaceChildren(label);
    option.insertAdjacentHTML("beforeend", '<span class="poll-result-track" aria-hidden="true"><span class="poll-result-live"></span><span class="poll-result-demo"></span></span><span class="poll-result-count"></span>');
    return { row: option, text: label.textContent, label, track: option.querySelector(".poll-result-track"),
      count: option.querySelector(".poll-result-count") };
  });
  let state;
  let pending = false;
  let refreshing;
  let advanceAfterFailure = false;
  let failure = "";

  function render() {
    const onPoll = state?.id === "class-poll";
    const results = state?.results;
    options.classList.toggle("has-results", Boolean(results));
    const liveTotal = results ? Object.values(results.live).reduce((sum, count) => sum + count, 0) : 0;
    const demoTotal = results?.demo ? Object.values(results.demo).reduce((sum, count) => sum + count, 0) : 0;
    const total = liveTotal + demoTotal || 1;
    for (const { row, text, label, track, count } of rows) {
      const choice = row.dataset.choice;
      row.classList.toggle("poll-result", Boolean(results));
      const labelText = results?.answer === choice ? `${text} ✅` : text;
      if (label.textContent !== labelText) label.textContent = labelText;
      track.hidden = count.hidden = !results;
      if (!results) continue;
      const live = results.live[choice];
      const demo = results.demo?.[choice] ?? 0;
      track.firstElementChild.style.width = `${100 * live / total}%`;
      track.lastElementChild.style.width = `${100 * demo / total}%`;
      const tally = demoTotal ? `${live} live · ${demo} simulated` : `${live} live`;
      if (count.textContent !== tally) count.textContent = tally;
    }
    const label = failure || (results ? `Answer revealed · ${liveTotal} live${demoTotal ? ` · ${demoTotal} simulated` : ""}`
      : onPoll ? `${state.voted} ${state.voted === 1 ? "student has" : "students have"} voted`
      : "Use a show of hands if the live poll is unavailable.");
    if (summary.textContent !== label) summary.textContent = label;
  }

  async function readState() {
    const response = await fetch("api/instructor", { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error("Poll unavailable");
    return response.json();
  }

  async function refresh() {
    if (refreshing || pending || deck.getCurrentSlide() !== slide) return;
    const request = readState();
    refreshing = request;
    try {
      const snapshot = await request;
      if (refreshing === request) {
        state = snapshot;
        if (!advanceAfterFailure || snapshot.revealed) failure = "";
      }
    } catch {
      if (refreshing === request && !advanceAfterFailure) {
        state = null;
        failure = "Live poll unavailable. Use a show of hands.";
      }
    } finally {
      if (refreshing === request) refreshing = null;
      render();
    }
  }

  async function revealPoll() {
    pending = true;
    refreshing = null;
    render();
    try {
      if (!await publish()) throw new Error("Poll not live");
      state = await readState();
      if (deck.getCurrentSlide() !== slide) return;
      if (state.id !== slide.id) throw new Error("Poll not live");
      if (state.revealed) return;
      const response = await fetch("api/poll-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reveal", round: state.round }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error("Poll update rejected");
      state = await readState();
      advanceAfterFailure = false;
      failure = "";
    } catch {
      if (deck.getCurrentSlide() === slide) {
        advanceAfterFailure = true;
        failure = "Live reveal unavailable. Press forward to advance.";
      }
    } finally {
      pending = false;
      render();
    }
  }

  slide.addEventListener("presenter-forward", event => {
    if (!event.detail.repeat && !pending && (state?.revealed || advanceAfterFailure)) return;
    event.preventDefault();
    if (!event.detail.repeat && !pending) void revealPoll();
  });

  render();
  deck.on("slidechanged", () => {
    advanceAfterFailure = false;
    failure = "";
    void refresh();
  });
  setInterval(refresh, 1500);
}
