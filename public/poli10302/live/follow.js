const slides = [...document.querySelectorAll("#lecture-content > section.level2")];
const controls = document.querySelector(".follow-controls");
const connection = document.querySelector("#connection");
const position = document.querySelector("#position");
const toggle = document.querySelector("#follow-toggle");
const slideControls = document.querySelector(".slide-controls");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");

if (slides.length) {
  let current = 0;
  let liveIndex = null;
  let following = location.protocol !== "file:";

  function showSlide(index) {
    slides[current].hidden = true;
    current = index;
    const slide = slides[index];
    slide.hidden = false;
    position.textContent = `Slide ${index + 1} of ${slides.length} · ${slide.querySelector("h2").textContent}`;
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
  }

  function updateControls() {
    toggle.textContent = following ? "Browse slides" : "Follow live";
    slideControls.hidden = following;
  }

  function jumpTo(index) {
    if (index === current) return;
    showSlide(index);
    window.scrollTo(0, 0);
  }

  slides.forEach(slide => { slide.hidden = true; });
  showSlide(0);
  updateControls();
  controls.hidden = false;
  previous.addEventListener("click", () => jumpTo(current - 1));
  next.addEventListener("click", () => jumpTo(current + 1));
  toggle.addEventListener("click", () => {
    following = !following;
    updateControls();
    if (following && liveIndex !== null) jumpTo(liveIndex);
  });

  if (location.protocol === "file:") {
    connection.textContent = "Self-paced slides";
    toggle.hidden = true;
  } else {
    const updatePoll = setupStudentPoll();
    async function refresh() {
      try {
        const response = await fetch("api/state", { signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error("Lecture unavailable");
        const state = await response.json();
        liveIndex = slides.findIndex(slide => slide.id === state.id);
        const label = liveIndex >= 0 ? "Live lecture connected"
          : state.id === null ? "Waiting for the lecturer" : "Slide unavailable. Reload for the latest slides.";
        if (connection.textContent !== label) connection.textContent = label;
        if (liveIndex < 0) liveIndex = null;
        if (following && liveIndex !== null) jumpTo(liveIndex);
        updatePoll(state);
      } catch {
        updatePoll(null);
        connection.textContent = "Live connection interrupted. Reconnecting…";
      } finally {
        setTimeout(refresh, 2100 + Math.random() * 700);
      }
    }
    void refresh();
  }
}

function setupStudentPoll() {
  const options = document.querySelector("#class-poll .poll-options");
  if (!options) return () => {};
  const status = document.querySelector("#class-poll .poll-status");
  const progress = document.querySelector("#class-poll .poll-progress");
  const form = document.createElement("form");
  form.className = "student-poll";
  form.hidden = true;
  form.innerHTML = '<fieldset><legend>Choose one answer</legend></fieldset><button type="submit">Submit vote</button>';
  const fieldset = form.querySelector("fieldset");
  const button = form.querySelector("button");
  const rows = [...options.children].map(option => {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    const result = document.createElement("span");
    result.className = "poll-answer";
    label.className = "poll-choice";
    radio.type = "radio";
    radio.name = "choice";
    radio.value = option.dataset.choice;
    radio.required = true;
    label.append(radio, option.textContent);
    fieldset.append(label);
    option.append(result);
    return { choice: radio.value, result };
  });
  options.after(form);

  let poll;
  let lastRound;
  let receipt;
  let sending = false;
  let voter;
  let failure = "";

  function saved(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch {
      // The current page still retains the vote when browser storage is unavailable.
    }
  }

  function voterKey() {
    voter ??= saved("poli10302-preview-voter");
    if (!/^[0-9a-f]{32}$/.test(voter)) {
      voter = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
      saved("poli10302-preview-voter", voter);
    }
    return voter;
  }

  function update(state) {
    if (state?.round && state.round !== lastRound) {
      lastRound = state.round;
      failure = "";
      form.reset();
    }
    poll = state;
    const onPoll = state?.id === "class-poll";
    const voted = Boolean(state?.round && (receipt === state.round || saved("poli10302-poll-receipt") === state.round));
    form.hidden = !state?.open || voted;
    options.hidden = Boolean(state?.open);
    button.disabled = sending;
    progress.hidden = !onPoll;
    const count = onPoll ? `${state.voted} ${state.voted === 1 ? "student has" : "students have"} voted` : "";
    if (progress.textContent !== count) progress.textContent = count;
    const label = !state ? "Live voting is unavailable. Discuss your answer with a neighbour."
      : state.revealed ? "The lecturer has revealed the answer."
      : !state.open ? "Voting opens when the lecturer reaches this slide."
      : voted ? "Vote recorded."
      : failure || "The poll is open. You can submit one answer.";
    if (status.textContent !== label) status.textContent = label;
    for (const { choice, result } of rows) {
      const results = state?.results;
      const resultLabel = results
        ? `${choice === results.answer ? " ✅" : ""} · ${results.live[choice]} live${results.demo ? ` · ${results.demo[choice]} simulated` : ""}`
        : "";
      if (result.textContent !== resultLabel) result.textContent = resultLabel;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!poll?.open || sending || form.hidden) return;
    const round = poll.round;
    const choice = new FormData(form).get("choice");
    sending = true;
    button.disabled = true;
    failure = "";
    try {
      const response = await fetch("api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, choice, voter: voterKey() }),
        signal: AbortSignal.timeout(8000)
      });
      const reply = await response.json();
      if (!reply.hasVoted) throw new Error("Vote not accepted");
      receipt = round;
      saved("poli10302-poll-receipt", round);
    } catch {
      failure = "Vote could not be confirmed. You can retry the same answer.";
    } finally {
      sending = false;
      update(poll);
    }
  });
  return update;
}
