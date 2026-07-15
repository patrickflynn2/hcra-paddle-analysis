const statusLabels = {
  chasing: "Chasing cutoff",
  protecting: "Protecting spot",
  "needs-help": "Needs help",
  safe: "Safe",
  unknown: "Review",
};

const statusDefinitions = {
  chasing: "Currently outside the top five, but can reach the cutoff with a strong OHCRA Championship result.",
  protecting: "Currently inside the top five, but not mathematically safe yet. The final race can still affect qualification or seed.",
  "needs-help": "Currently outside the top five and likely needs both a strong finish and help from other crews.",
  safe: "Mathematically safe for a top-five state qualifying spot before the final race.",
};

const statusOrder = ["chasing", "needs-help", "protecting", "safe"];
const programOrder = ["Youth", "Novice", "Open", "Masters", "Mixed"];
let qualificationData = null;
let selectedStatus = "all";
let selectedProgram = "all";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusClass(status) {
  return `status-${status}`;
}

function renderSummary(data) {
  const counts = data.watch.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  document.querySelector("#qualify-intro").textContent =
    `Standings are current as of ${data.metadata.as_of}. This page isolates ${data.metadata.events} Outrigger crews and evaluates the final OHCRA Championships race using the top-five state qualification cutoff.`;

  document.querySelector("#qualification-summary").innerHTML = `
    <article><span>${data.metadata.events}</span><small>Outrigger crews listed</small></article>
    <article><span>${(counts.chasing ?? 0) + (counts["needs-help"] ?? 0)}</span><small>outside top five</small></article>
    <article><span>${(counts.protecting ?? 0)}</span><small>inside but live</small></article>
    <article><span>${counts.safe ?? 0}</span><small>mathematically safe</small></article>
  `;
}

function renderStatusDefinitions(data) {
  const activeStatuses = statusOrder.filter((status) => data.watch.some((item) => item.status === status));
  document.querySelector("#qualification-status-definitions").innerHTML = activeStatuses
    .map(
      (status) => `
        <article class="status-definition ${statusClass(status)}">
          <strong>${statusLabels[status]}</strong>
          <p>${statusDefinitions[status]}</p>
        </article>
      `
    )
    .join("");
}

function renderFilters(data) {
  const statuses = ["all", ...statusOrder.filter((status) => data.watch.some((item) => item.status === status))];
  document.querySelector("#qualify-filter-row").innerHTML = statuses
    .map((status) => {
      const label = status === "all" ? "All crews" : statusLabels[status];
      return `<button class="dq-filter-button" type="button" data-qualify-status="${status}" aria-pressed="${status === selectedStatus}">${label}</button>`;
    })
    .join("");

  const programs = programOrder.filter((program) => data.watch.some((item) => item.program === program));
  document.querySelector("#qualify-program-filter").innerHTML =
    `<option value="all">All programs</option>` +
    programs.map((program) => `<option value="${program}" ${program === selectedProgram ? "selected" : ""}>${program}</option>`).join("");
}

function standingsTable(item) {
  return `
    <div class="club-matrix-wrap qualify-standings-wrap">
      <table class="club-matrix qualify-standings">
        <thead>
          <tr><th>Rank</th><th>Club</th><th>Total</th><th>R1-R5</th></tr>
        </thead>
        <tbody>
          ${item.standings
            .slice(0, Math.max(6, item.rank + 1))
            .map(
              (row) => `
                <tr class="${row.club === "Outrigger Canoe Club" ? "out-row" : ""}">
                  <td>${row.rank}</td>
                  <td>${escapeHtml(row.club)}</td>
                  <td><strong>${row.total}</strong></td>
                  <td>${row.scores.slice(0, 5).map((score) => score || "-").join(" / ")}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function filteredItems(data) {
  return data.watch
    .filter((item) => selectedStatus === "all" || item.status === selectedStatus)
    .filter((item) => selectedProgram === "all" || item.program === selectedProgram)
    .sort((a, b) => a.event_number - b.event_number);
}

function renderCards(data) {
  renderFilters(data);
  const items = filteredItems(data);

  document.querySelector("#qualification-count").textContent =
    `${items.length} of ${data.watch.length} Outrigger crews shown`;

  document.querySelector("#qualification-grid").innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="qualification-card ${statusClass(item.status)}">
              <div class="qualification-card-head">
                <div>
                  <small>Event ${item.event_number} · ${item.program}</small>
                  <h3>${escapeHtml(item.event_name)}</h3>
                </div>
                <span>${statusLabels[item.status] ?? item.status}</span>
              </div>
              <div class="qualification-metrics">
                <div><strong>${item.rank}</strong><small>current rank</small></div>
                <div><strong>${item.total}</strong><small>points</small></div>
                <div><strong>${item.field_size}</strong><small>crews</small></div>
              </div>
              <div class="qualification-copy">
                <h4>${escapeHtml(item.headline)}</h4>
                <p>${escapeHtml(item.qualification_note)}</p>
                <p>${escapeHtml(item.seed_note)}</p>
              </div>
              ${standingsTable(item)}
            </article>
          `
        )
        .join("")
    : `<article class="qualification-card"><p>No crews match these filters.</p></article>`;
}

async function init() {
  const response = await fetch("data/qualification.json?v=qualify-2026-3");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  qualificationData = await response.json();

  renderSummary(qualificationData);
  renderStatusDefinitions(qualificationData);
  renderCards(qualificationData);

  document.querySelector("#qualify-filter-row").addEventListener("click", (event) => {
    const button = event.target.closest("[data-qualify-status]");
    if (!button) return;
    selectedStatus = button.dataset.qualifyStatus;
    renderCards(qualificationData);
  });

  document.querySelector("#qualify-program-filter").addEventListener("change", (event) => {
    selectedProgram = event.target.value;
    renderCards(qualificationData);
  });
}

init().catch(() => {
  document.querySelector("#qualify-hero-copy").textContent =
    "Qualification data is missing. Run scripts/build_qualification_data.py.";
});

