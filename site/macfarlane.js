const CLUBS = [
  { id: "Outrigger Canoe Club", label: "Outrigger", color: "#d3262e", text: "#fff" },
  { id: "Lanikai Canoe Club", label: "Lanikai", color: "#168447", text: "#fff" },
  { id: "Keahiakahoe Canoe Club", label: "Keahiakahoe", color: "#181818", text: "#fff" },
  { id: "Hui Nalu Canoe Club", label: "Hui Nalu", color: "#f0cf24", text: "#171717" },
];
const MAX_POINTS = 177;
const POINT_DELAY = 72;
const EVENT_PAUSE = 360;
const chart = document.querySelector("#race-chart");
const title = document.querySelector("#race-title");
const status = document.querySelector("#race-status");
const progress = document.querySelector("#race-progress-bar");
const playButton = document.querySelector("#play-button");
const replayButton = document.querySelector("#replay-button");
const yearSelect = document.querySelector("#mac-year");
const compositionChart = document.querySelector("#composition-chart");
const compositionLegend = document.querySelector("#composition-legend");
const laneChart = document.querySelector("#lane-chart");
const laneSummary = document.querySelector("#lane-summary");
const laneSource = document.querySelector("#lane-source");
const CATEGORIES = [
  { id: "youth", label: "Youth", color: "#ef8354" },
  { id: "novice", label: "Novice", color: "#4f86c6" },
  { id: "open", label: "Open", color: "#264653" },
  { id: "masters", label: "Masters", color: "#8f6bb3" },
  { id: "mixed", label: "Mixed", color: "#2a9d8f" },
];
let events = [];
let insights = null;
let scores = Object.fromEntries(CLUBS.map((club) => [club.id, 0]));
let running = false;
let paused = false;
let runToken = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function render() {
  const ordered = [...CLUBS].sort((a, b) => scores[b.id] - scores[a.id] || CLUBS.indexOf(a) - CLUBS.indexOf(b));
  ordered.forEach((club, rank) => {
    const row = chart.querySelector(`[data-club="${club.id}"]`);
    row.style.transform = `translateY(${rank * 92}px)`;
    row.querySelector(".race-bar-fill").style.width = `${(scores[club.id] / MAX_POINTS) * 100}%`;
    row.querySelector(".race-score").textContent = scores[club.id];
  });
}

function makeChart() {
  chart.innerHTML = CLUBS.map((club) => `<div class="race-row" data-club="${club.id}"><div class="race-club">${club.label}</div><div class="race-bar-track"><div class="race-bar-fill" style="background:${club.color};color:${club.text}"><span class="race-score">0</span></div></div></div>`).join("");
  render();
}

async function waitWhilePaused(token) {
  while (paused && token === runToken) await sleep(80);
}

async function runRace() {
  if (running) {
    paused = !paused;
    playButton.textContent = paused ? "Resume" : "Pause";
    return;
  }
  const token = ++runToken;
  running = true;
  paused = false;
  playButton.textContent = "Pause";
  status.textContent = `${events.length} official events · 0–177 points`;
  scores = Object.fromEntries(CLUBS.map((club) => [club.id, 0]));
  render();
  for (let eventIndex = 0; eventIndex < events.length && token === runToken; eventIndex += 1) {
    const event = events[eventIndex];
    title.textContent = event.name;
    progress.style.width = `${((eventIndex + 1) / events.length) * 100}%`;
    const remaining = { ...event.points };
    while (Object.values(remaining).some((points) => points > 0) && token === runToken) {
      await waitWhilePaused(token);
      CLUBS.forEach((club) => {
        if (remaining[club.id] > 0) { scores[club.id] += 1; remaining[club.id] -= 1; }
      });
      render();
      await sleep(POINT_DELAY);
    }
    await sleep(EVENT_PAUSE);
  }
  if (token === runToken) {
    title.textContent = "Final standings";
    status.textContent = "Official events complete · unofficial events excluded";
    running = false;
    playButton.textContent = "Play again";
  }
}

function replay() {
  runToken += 1;
  running = false;
  paused = false;
  scores = Object.fromEntries(CLUBS.map((club) => [club.id, 0]));
  title.textContent = "Ready to race";
  progress.style.width = "0%";
  playButton.textContent = "Play";
  render();
  runRace();
}

async function load() {
  makeChart();
  const response = await fetch("data/results.json?v=refresh-2026-1198");
  if (!response.ok) throw new Error(`Results request failed (${response.status})`);
  const rows = await response.json();
  const selected = rows.filter((row) => row.season === 2026 && row.race_id === "1197" && row.status !== "UnO" && CLUBS.some((club) => club.id === row.club));
  const grouped = new Map();
  selected.forEach((row) => {
    if (!grouped.has(row.event_number)) grouped.set(row.event_number, { number: row.event_number, name: row.event_name, points: Object.fromEntries(CLUBS.map((club) => [club.id, 0])) });
    grouped.get(row.event_number).points[row.club] = Math.max(0, Math.round(row.points));
  });
  events = [...grouped.values()].sort((a, b) => a.number - b.number);
  const insightResponse = await fetch("data/macfarlane.json?v=1");
  if (!insightResponse.ok) throw new Error(`Macfarlane analysis request failed (${insightResponse.status})`);
  insights = await insightResponse.json();
  renderInsights(yearSelect.value);
  status.textContent = `${events.length} official events · 0–177 points`;
  runRace();
}

function renderComposition(data) {
  const maxTotal = Math.max(...data.composition.map((club) => club.total));
  compositionLegend.innerHTML = CATEGORIES.map((category) => `<span><i style="background:${category.color}"></i>${category.label}</span>`).join("");
  compositionChart.innerHTML = data.composition.map((club) => {
    const label = CLUBS.find((item) => item.id === club.club)?.label ?? club.club;
    const segments = CATEGORIES.map((category) => {
      const points = club[category.id];
      if (!points) return "";
      return `<span class="composition-segment" style="width:${(points / club.total) * 100}%;background:${category.color}" title="${category.label}: ${points} points"><b>${points}</b></span>`;
    }).join("");
    return `<div class="composition-row"><div class="composition-label"><strong>${label}</strong><span>${club.total} pts</span></div><div class="composition-scale"><div class="composition-bar" style="width:${(club.total / maxTotal) * 100}%">${segments}</div></div></div>`;
  }).join("");
}

function renderLanes(data, year) {
  const ranked = [...data.lanes].sort((a, b) => b.finish_percentile - a.finish_percentile);
  const best = ranked[0];
  laneSummary.textContent = `Lane ${best.lane} produced the strongest ${year} results, averaging the ${best.finish_percentile}th finish percentile across ${best.finishes} completed races.`;
  laneSource.href = data.source_url;
  laneChart.innerHTML = data.lanes.map((lane) => `
    <div class="lane-column ${lane.lane === best.lane ? "is-best" : ""}">
      <div class="lane-value">${lane.finish_percentile}</div>
      <div class="lane-meter"><span style="height:${lane.finish_percentile}%"></span></div>
      <strong>Lane ${lane.lane}</strong>
      <small>${lane.wins} wins · ${lane.podiums} podiums</small>
      <small>${lane.average_place} avg place · ${lane.dqs} DQ</small>
    </div>`).join("");
}

function renderInsights(year) {
  if (!insights) return;
  const data = insights.years[year];
  renderComposition(data);
  renderLanes(data, year);
}

playButton.addEventListener("click", runRace);
replayButton.addEventListener("click", replay);
yearSelect.addEventListener("change", () => renderInsights(yearSelect.value));
load().catch((error) => { title.textContent = "Unable to load the race"; status.textContent = error.message; });
