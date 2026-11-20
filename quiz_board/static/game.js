// Quiz Board game logic. Runs entirely in the browser; the server only
// supplies the board. Progress is saved in localStorage so an accidental
// refresh doesn't lose the game.
(function () {
  "use strict";

  const data = JSON.parse(document.getElementById("game-data").textContent);
  const board = data.board;
  const teams = data.teams;

  // A key unique to this quiz so different quizzes don't share saved progress
  const storageKey = "quiz-board:" + hash(JSON.stringify(data));

  function hash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // state.results["c-q"] = { teamIndex: "right" | "wrong" }
  // state.adjust[teamIndex] = manual +/- points
  let state = load() || fresh();
  let current = null; // { c, q } of the open question

  const el = id => document.getElementById(id);
  const boardEl = el("board");
  const scoresEl = el("scores");
  const modal = el("modal");
  const answerEl = el("modal-answer");
  const teamsEl = el("modal-teams");
  const revealBtn = el("reveal");

  function fresh() {
    return { results: {}, adjust: teams.map(() => 0) };
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && saved.results && Array.isArray(saved.adjust)) return saved;
    } catch (e) { /* storage unavailable: play without saving */ }
    return null;
  }

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function key(c, q) { return c + "-" + q; }

  function scores() {
    const totals = state.adjust.slice();
    for (const [k, result] of Object.entries(state.results)) {
      const [c, q] = k.split("-").map(Number);
      const points = board[c].questions[q].points;
      for (const [t, verdict] of Object.entries(result)) {
        if (verdict === "right") totals[t] += points;
        if (verdict === "wrong") totals[t] -= points;
      }
    }
    return totals;
  }

  function totalQuestions() {
    return board.reduce((n, c) => n + c.questions.length, 0);
  }

  // ---------- Rendering ----------

  function renderBoard() {
    boardEl.innerHTML = "";
    const rows = Math.max(...board.map(c => c.questions.length));
    boardEl.style.setProperty("--rows", rows);

    board.forEach((category, c) => {
      const head = document.createElement("div");
      head.className = "cat";
      head.textContent = category.name;
      head.style.gridColumn = c + 1;
      head.style.gridRow = 1;
      boardEl.appendChild(head);

      category.questions.forEach((question, q) => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "tile";
        tile.style.gridColumn = c + 1;
        tile.style.gridRow = q + 2;
        const used = key(c, q) in state.results;
        if (used) tile.classList.add("used");
        tile.textContent = question.points;
        tile.setAttribute("aria-label",
          category.name + " for " + question.points + (used ? " (already played)" : ""));
        tile.addEventListener("click", () => openQuestion(c, q));
        boardEl.appendChild(tile);
      });
    });
  }

  function renderScores() {
    const totals = scores();
    scoresEl.innerHTML = "";
    teams.forEach((name, t) => {
      const card = document.createElement("div");
      card.className = "score";
      card.innerHTML =
        '<span class="team-name"></span>' +
        '<span class="team-score"></span>' +
        '<span class="adjust">' +
        '<button type="button" class="tool small" data-delta="-100" aria-label="Minus 100">−</button>' +
        '<button type="button" class="tool small" data-delta="100" aria-label="Plus 100">+</button>' +
        "</span>";
      card.querySelector(".team-name").textContent = name;
      card.querySelector(".team-score").textContent = totals[t];
      card.querySelectorAll("[data-delta]").forEach(btn => {
        btn.addEventListener("click", () => {
          state.adjust[t] += Number(btn.dataset.delta);
          save();
          renderScores();
        });
      });
      scoresEl.appendChild(card);
    });
  }

  function renderTeamButtons() {
    const { c, q } = current;
    const result = state.results[key(c, q)] || {};
    const points = board[c].questions[q].points;
    teamsEl.innerHTML = "";
    teams.forEach((name, t) => {
      const row = document.createElement("div");
      row.className = "team-row";
      const label = document.createElement("span");
      label.textContent = name;
      row.appendChild(label);

      for (const [verdict, text] of [["right", "✓ +" + points], ["wrong", "✗ −" + points]]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "verdict " + verdict + (result[t] === verdict ? " on" : "");
        btn.textContent = text;
        btn.setAttribute("aria-pressed", result[t] === verdict);
        btn.addEventListener("click", () => {
          const r = state.results[key(c, q)] || (state.results[key(c, q)] = {});
          if (r[t] === verdict) delete r[t]; else r[t] = verdict;
          save();
          renderTeamButtons();
          renderScores();
        });
        row.appendChild(btn);
      }
      teamsEl.appendChild(row);
    });
  }

  // ---------- Question flow ----------

  function openQuestion(c, q) {
    current = { c, q };
    const question = board[c].questions[q];
    el("modal-label").textContent = board[c].name + " · " + question.points;
    el("modal-question").textContent = question.question;
    answerEl.textContent = question.answer;
    // A tile that was already played opens with its answer and results showing,
    // so mistakes in scoring can be fixed.
    const replay = key(c, q) in state.results;
    showAnswer(replay);
    modal.hidden = false;
    revealBtn.focus();
  }

  function showAnswer(show) {
    answerEl.hidden = !show;
    teamsEl.hidden = !show;
    revealBtn.hidden = show;
    if (show) {
      // Opening the answer marks the tile as played even if nobody scores
      if (!(key(current.c, current.q) in state.results)) {
        state.results[key(current.c, current.q)] = {};
        save();
      }
      renderTeamButtons();
      el("close").focus();
    }
  }

  function closeQuestion() {
    modal.hidden = true;
    current = null;
    renderBoard();
    renderScores();
    if (Object.keys(state.results).length === totalQuestions()) showFinal();
  }

  function showFinal() {
    const totals = scores();
    const order = teams.map((name, t) => ({ name, score: totals[t] }))
      .sort((a, b) => b.score - a.score);
    const best = order[0].score;
    const leaders = order.filter(x => x.score === best).map(x => x.name);
    el("final-winner").textContent = leaders.length > 1
      ? "It's a tie: " + leaders.join(" & ") + "!"
      : leaders[0] + " wins!";
    const list = el("final-list");
    list.innerHTML = "";
    for (const entry of order) {
      const li = document.createElement("li");
      li.textContent = entry.name + " — " + entry.score;
      list.appendChild(li);
    }
    el("final").hidden = false;
  }

  // ---------- Controls ----------

  revealBtn.addEventListener("click", () => showAnswer(true));
  el("close").addEventListener("click", closeQuestion);
  el("final-close").addEventListener("click", () => { el("final").hidden = true; });

  el("restart").addEventListener("click", () => {
    if (confirm("Restart the quiz? All scores will be cleared.")) {
      state = fresh();
      save();
      renderBoard();
      renderScores();
    }
  });

  el("fullscreen").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  });

  document.addEventListener("keydown", event => {
    if (modal.hidden) return;
    if (event.key === "Escape") closeQuestion();
    else if (event.key === " " && !revealBtn.hidden) {
      event.preventDefault();
      showAnswer(true);
    }
  });

  renderBoard();
  renderScores();
})();
