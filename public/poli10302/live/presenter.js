if (location.protocol !== "file:" && window.top === window) {
  const deck = window.Reveal;
  const status = document.createElement("output");
  status.className = "presenter-status";
  status.textContent = "Follow-along connecting…";
  document.body.append(status);
  let publishing = false;
  let lastSent;

  async function publish() {
    const id = deck.getCurrentSlide()?.id;
    if (!id || publishing || id === lastSent) return;
    publishing = true;
    try {
      const response = await fetch("api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        signal: AbortSignal.timeout(6000)
      });
      if (!response.ok) throw new Error("Lecture unavailable");
      lastSent = id;
      status.textContent = "Follow-along live";
    } catch {
      status.textContent = "Follow-along offline";
    } finally {
      publishing = false;
    }
    if (lastSent === id && deck.getCurrentSlide()?.id !== id) void publish();
  }

  deck.on("slidechanged", publish);
  deck.on("ready", publish);
  if (deck.isReady()) void publish();
  showPollResults();

  // Retry unsent slide changes if the network drops.
  setInterval(publish, 3000);
}

function showPollResults() {
  const options = document.querySelector("#class-poll .poll-options");
  if (!options) return;
  const summary = document.querySelector("#class-poll .poll-summary");
  const actions = document.querySelector("#class-poll .poll-actions");
  const reveal = actions.querySelector('[data-action="reveal"]');
  const simulate = actions.querySelector('[data-action="simulate"]');
  const reset = actions.querySelector('[data-action="reset"]');
  const rows = [...options.children].map(option => {
    const label = document.createElement("span");
    label.textContent = option.textContent;
    option.replaceChildren(label);
    option.insertAdjacentHTML("beforeend", '<span class="poll-result-track" aria-hidden="true"><span class="poll-result-live"></span><span class="poll-result-demo"></span></span><span class="poll-result-count"></span>');
    return { row: option, text: label.textContent, label, track: option.querySelector(".poll-result-track"),
      count: option.querySelector(".poll-result-count") };
  });
  actions.hidden = false;
  let state;
  let pending = false;
  let refreshing = false;
  let failure = "";

  function render() {
    const onPoll = state?.id === "class-poll";
    const results = state?.results;
    reveal.disabled = pending || !state?.open;
    simulate.disabled = pending || !state?.open || Boolean(state.simulated);
    reset.disabled = pending || !onPoll;
    options.classList.toggle("has-results", Boolean(results));
    const liveTotal = results ? Object.values(results.live).reduce((sum, count) => sum + count, 0) : 0;
    const demoTotal = results?.demo ? Object.values(results.demo).reduce((sum, count) => sum + count, 0) : 0;
    const total = liveTotal + demoTotal || 1;
    for (const { row, text, label, track, count } of rows) {
      const choice = row.dataset.choice;
      row.classList.toggle("poll-result", Boolean(results));
      const labelText = results?.answer === choice ? `${text} · Correct answer` : text;
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
    const label = failure || (results ? `Answer revealed · ${liveTotal} live · ${demoTotal} simulated`
      : onPoll ? `${state.voted} ${state.voted === 1 ? "student has" : "students have"} voted`
      : "Use a show of hands if the live poll is unavailable.");
    if (summary.textContent !== label) summary.textContent = label;
  }

  async function refresh() {
    if (refreshing || pending || window.Reveal.getCurrentSlide()?.id !== "class-poll") return;
    refreshing = true;
    try {
      const response = await fetch("api/instructor", { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error("Poll unavailable");
      if (!pending) {
        state = await response.json();
        failure = "";
      }
    } catch {
      state = null;
      failure = "Live poll unavailable. Use a show of hands.";
    } finally {
      refreshing = false;
      render();
    }
  }

  async function changePoll(action) {
    if (pending || state?.id !== "class-poll") return;
    pending = true;
    render();
    try {
      const response = await fetch("api/poll-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, round: state.round }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error("Poll update rejected");
      state = null;
    } catch {
      failure = "Poll update could not be confirmed. Please try again.";
    } finally {
      pending = false;
      render();
      void refresh();
    }
  }

  render();
  window.Reveal.on("slidechanged", refresh);
  setInterval(refresh, 1500);
  reveal.addEventListener("click", () => changePoll("reveal"));
  simulate.addEventListener("click", () => changePoll("simulate"));
  reset.addEventListener("click", () => changePoll("reset"));
}
