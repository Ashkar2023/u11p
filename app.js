"use strict";

const app = document.querySelector("#app");

const state = {
  data: null,
  teamsById: new Map(),
  playersById: new Map(),
  view: "matches",
  selectedMatchId: null,
  month: "all",
};

const formatDate = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const formatMonth = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

function dateFromString(date) {
  return new Date(`${date}T00:00:00`);
}

function teamName(id) {
  return state.teamsById.get(id) ?? "Unknown team";
}

function playerName(id) {
  return state.playersById.get(id) ?? "Unknown";
}

function getSortedMatches() {
  return [...state.data.matches].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  );
}

function getWinnerId(match) {
  const [first, second] = match.teams;
  if (!first || !second || first.score === second.score) return null;
  return first.score > second.score ? first.teamId : second.teamId;
}

function getTeamWins() {
  const wins = new Map(state.data.teams.map((team) => [team.id, 0]));
  state.data.matches.forEach((match) => {
    const winnerId = getWinnerId(match);
    if (winnerId !== null) wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1);
  });
  return wins;
}

function getTopScorers() {
  const totals = new Map();

  state.data.matches.forEach((match) => {
    if (!Array.isArray(match.goals)) return;

    match.goals.forEach((goal) => {
      if (goal.playerId === 0 || goal.playerId == null || goal.ownGoal === true) return;

      const current = totals.get(goal.playerId) ?? { goals: 0, penalties: 0 };
      current.goals += Number(goal.count) || 0;
      current.penalties += Number(goal.penaltiesCount) || 0;
      totals.set(goal.playerId, current);
    });
  });

  return [...totals.entries()]
    .map(([playerId, totalsForPlayer]) => ({
      playerId,
      name: playerName(playerId),
      ...totalsForPlayer,
    }))
    .sort((a, b) => b.goals - a.goals || b.penalties - a.penalties || a.name.localeCompare(b.name));
}

function monthKey(date) {
  return date.slice(0, 7);
}

function setActiveNav(view) {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
}

function renderMatchCard(match) {
  const [first, second] = match.teams;
  const winnerId = getWinnerId(match);

  return `
    <button class="match-card" type="button" data-match-id="${match.id}"
      aria-label="Open ${teamName(first.teamId)} versus ${teamName(second.teamId)}, ${first.score} to ${second.score}">
      <time class="match-date" datetime="${match.date}">${formatDate.format(dateFromString(match.date))}</time>
      <span class="match-row">
        <span class="team ${winnerId === first.teamId ? "is-winner" : ""}">${teamName(first.teamId)}</span>
        <span class="score" aria-label="${first.score} to ${second.score}">${first.score} - ${second.score}</span>
        <span class="team ${winnerId === second.teamId ? "is-winner" : ""}">${teamName(second.teamId)}</span>
      </span>
    </button>
  `;
}

function renderMatches() {
  const matches = getSortedMatches();
  const months = [...new Set(matches.map((match) => monthKey(match.date)))];
  const visibleMatches = state.month === "all"
    ? matches
    : matches.filter((match) => monthKey(match.date) === state.month);
  const wins = getTeamWins();

  setActiveNav("matches");
  app.innerHTML = `
    <section aria-labelledby="matches-title">
      <div class="page-header">
        <div>
          <p class="eyebrow">Fixtures archive</p>
          <h1 id="matches-title">Recent matches</h1>
        </div>
        <label class="select-wrap">
          <span class="visually-hidden">Filter by month</span>
          <select id="month-filter">
            <option value="all">All months</option>
            ${months
              .map(
                (month) => `<option value="${month}" ${state.month === month ? "selected" : ""}>
                  ${formatMonth.format(dateFromString(`${month}-01`))}
                </option>`,
              )
              .join("")}
          </select>
        </label>
      </div>

      <div class="summary-grid" aria-label="Team wins">
        ${state.data.teams
          .map(
            (team) => `
              <div class="summary-card">
                <strong class="summary-value">${wins.get(team.id) ?? 0}</strong>
                <span class="summary-label">${team.name} wins</span>
              </div>
            `,
          )
          .join("")}
        <div class="summary-card">
          <strong class="summary-value">${state.data.matches.length}</strong>
          <span class="summary-label">Matches played</span>
        </div>
      </div>

      ${
        visibleMatches.length
          ? `<div class="match-list">${visibleMatches.map(renderMatchCard).join("")}</div>`
          : `<div class="empty-state"><p>No matches found for this month.</p></div>`
      }
    </section>
  `;
}

function renderGoalRow(goal) {
  const penalties = Number(goal.penaltiesCount) || 0;
  const count = Number(goal.count) || 0;

  return `
    <li class="scorer-row">
      <span>${playerName(goal.playerId)}</span>
      <span class="scorer-meta">
        <span class="goal-count">${count} ${count === 1 ? "goal" : "goals"}</span>
        ${penalties ? `<span class="badge" title="${penalties} penalty ${penalties === 1 ? "goal" : "goals"}">${penalties} (P)</span>` : ""}
        ${goal.ownGoal === true ? `<span class="badge own-goal">(OG)</span>` : ""}
      </span>
    </li>
  `;
}

function renderTeamGoals(match, team) {
  const goals = Array.isArray(match.goals)
    ? match.goals.filter((goal) => goal.teamId === team.teamId)
    : [];

  return `
    <section class="panel" aria-labelledby="team-${team.teamId}-goals">
      <div class="panel-header">
        <h2 id="team-${team.teamId}-goals">${teamName(team.teamId)}</h2>
        <span class="panel-score">${team.score}</span>
      </div>
      ${
        match.goals === null
          ? `<p class="no-data">No data</p>`
          : goals.length
            ? `<ul class="scorer-list">${goals.map(renderGoalRow).join("")}</ul>`
            : `<p class="no-data">No goals recorded</p>`
      }
    </section>
  `;
}

function renderMatchDetail() {
  const match = state.data.matches.find((item) => item.id === state.selectedMatchId);
  if (!match) {
    state.view = "matches";
    renderMatches();
    return;
  }

  const [first, second] = match.teams;
  const winnerId = getWinnerId(match);
  setActiveNav("");

  app.innerHTML = `
    <article aria-labelledby="detail-title">
      <button class="back-button" type="button" data-view="matches" aria-label="Back to matches">
        <span aria-hidden="true">←</span> All matches
      </button>

      <div class="detail-scoreboard">
        <p class="eyebrow">Final score</p>
        <time datetime="${match.date}">${formatDate.format(dateFromString(match.date))}</time>
        <div class="match-row">
          <span id="detail-title" class="team ${winnerId === first.teamId ? "is-winner" : ""}">${teamName(first.teamId)}</span>
          <strong class="score">${first.score} - ${second.score}</strong>
          <span class="team ${winnerId === second.teamId ? "is-winner" : ""}">${teamName(second.teamId)}</span>
        </div>
      </div>

      <div class="details-grid">
        ${match.teams.map((team) => renderTeamGoals(match, team)).join("")}
      </div>
    </article>
  `;
}

function renderStats() {
  const scorers = getTopScorers();
  setActiveNav("stats");

  app.innerHTML = `
    <section aria-labelledby="stats-title">
      <div class="page-header">
        <div>
          <p class="eyebrow">Leaderboard</p>
          <h1 id="stats-title">Top scorers</h1>
        </div>
      </div>
      <p class="stats-note">Own goals and unknown players are excluded. Penalties are included in goal totals.</p>

      <div class="panel">
        ${
          scorers.length
            ? `<ol class="leaderboard">
                ${scorers
                  .map(
                    (scorer) => `
                      <li class="leader-row">
                        <span class="leader-player">
                          <span class="leader-name">${scorer.name}</span>
                        </span>
                        <span class="leader-meta">
                          ${scorer.penalties ? `<span class="penalty-note">${scorer.penalties} P</span>` : ""}
                          <strong class="leader-total">${scorer.goals}</strong>
                        </span>
                      </li>
                    `,
                  )
                  .join("")}
              </ol>`
            : `<div class="empty-state"><p>No scorer data available yet.</p></div>`
        }
      </div>
    </section>
  `;
}

function render() {
  if (!state.data) return;
  if (state.view === "detail") renderMatchDetail();
  else if (state.view === "stats") renderStats();
  else renderMatches();
}

function changeView(view) {
  state.view = view;
  state.selectedMatchId = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  app.focus({ preventScroll: true });
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    changeView(viewButton.dataset.view);
    return;
  }

  const matchButton = event.target.closest("[data-match-id]");
  if (matchButton) {
    state.selectedMatchId = Number(matchButton.dataset.matchId);
    state.view = "detail";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    app.focus({ preventScroll: true });
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("#month-filter")) {
    state.month = event.target.value;
    renderMatches();
  }
});

async function loadData() {
  try {
    const response = await fetch("./data.json");
    if (!response.ok) throw new Error(`Could not load data (${response.status})`);

    const data = await response.json();
    if (!Array.isArray(data.teams) || !Array.isArray(data.players) || !Array.isArray(data.matches)) {
      throw new Error("data.json has an unexpected structure");
    }

    state.data = data;
    state.teamsById = new Map(data.teams.map((team) => [team.id, team.name]));
    state.playersById = new Map(data.players.map((player) => [player.id, player.name]));
    render();
  } catch (error) {
    console.error(error);
    app.innerHTML = `
      <div class="status-card is-error" role="alert">
        <p>Could not load match data. Serve this folder with a local web server and try again.</p>
      </div>
    `;
  }
}

loadData();
