const eventOrder = ["Men Novice B", "Men Novice A", "Women Novice B", "Women Novice A"];

const labelMap = {
  first_year_a: "First-year A",
  second_year_a: "Second-year A",
  prior_a_history: "Prior A history",
  prior_b_history: "Prior B history",
  unknown: "Unknown",
};

const rosterLabels = [
  ["first_year_a", "First-year A"],
  ["second_year_a", "Second-year A"],
  ["prior_history", "Prior history"],
  ["unknown", "Unknown"],
];

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
let allRosterEntries = [];
let rosterEntries = [];

function fmt(value) {
  return numberFormat.format(value);
}

function seconds(value) {
  return value == null ? "n/a" : `${fmt(value)}s`;
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function yearCard(item) {
  const fastest = item.fastest_winner;
  const closest = item.closest_race;
  return `
    <article class="year-card">
      <div class="year-card-top">
        <h4>${item.season}</h4>
        <span>${item.races} races</span>
      </div>
      <dl>
        <div><dt>Avg field</dt><dd>${fmt(item.average_entries)}</dd></div>
        <div><dt>Avg margin</dt><dd>${seconds(item.average_margin_seconds)}</dd></div>
        <div><dt>Closest</dt><dd>${seconds(item.closest_margin_seconds)}</dd></div>
        <div><dt>Most wins</dt><dd>${item.most_wins_club} (${item.most_wins})</dd></div>
      </dl>
      <p>Fastest listed winner: ${fastest.winner}, ${fastest.winning_time} at ${fastest.race_name}.</p>
      <p>Closest race: ${closest.winner} over ${closest.runner_up} by ${seconds(closest.margin_seconds)}.</p>
    </article>
  `;
}


function evidenceGender(eventName) {
  if (eventName.startsWith("Men ")) return "Men";
  if (eventName.startsWith("Women ")) return "Women";
  return "Other";
}

function filterOption(value, label = value) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function populateEvidenceFilters(entries) {
  const genders = [...new Set(entries.map((entry) => evidenceGender(entry.event)))].sort();
  const clubs = [...new Set(entries.map((entry) => entry.club))].sort((a, b) => a.localeCompare(b));
  const places = [...new Set(entries.map((entry) => entry.place))].sort((a, b) => a - b);

  document.querySelector("#evidence-gender-filter").innerHTML =
    filterOption("all", "All genders") + genders.map((gender) => filterOption(gender)).join("");
  document.querySelector("#evidence-club-filter").innerHTML =
    filterOption("all", "All clubs") + clubs.map((club) => filterOption(club)).join("");
  document.querySelector("#evidence-place-filter").innerHTML =
    filterOption("all", "All places") + places.map((place) => filterOption(String(place), String(place))).join("");
}

function currentEvidenceFilters() {
  return {
    gender: document.querySelector("#evidence-gender-filter").value,
    club: document.querySelector("#evidence-club-filter").value,
    place: document.querySelector("#evidence-place-filter").value,
  };
}

function applyEvidenceFilters() {
  const filters = currentEvidenceFilters();
  rosterEntries = allRosterEntries.filter((entry) => {
    const gender = evidenceGender(entry.event);
    return (
      (filters.gender === "all" || gender === filters.gender) &&
      (filters.club === "all" || entry.club === filters.club) &&
      (filters.place === "all" || String(entry.place) === filters.place)
    );
  });

  document.querySelector("#evidence-count").textContent =
    `${rosterEntries.length} of ${allRosterEntries.length} race entries shown`;

  document.querySelector("#roster-entry-body").innerHTML = rosterEntries.length
    ? rosterEntries
        .map(
          (entry, index) => `
            <tr>
              <td>${escapeHtml(entry.event)}</td>
              <td>${escapeHtml(entry.race_name)}</td>
              <td>${escapeHtml(entry.club)}</td>
              <td>${entry.place}</td>
              <td>${entry.first_year_a}</td>
              <td>${entry.second_year_a}</td>
              <td>${entry.unknown}</td>
              <td><button class="crew-button" type="button" data-crew-index="${index}">View</button></td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="8">No race entries match these filters.</td></tr>`;
}
function renderMenBStory(data) {
  const seasons = data.season_competitiveness["Men Novice B"];
  const year2025 = seasons.find((item) => item.season === 2025);
  const easiestMargin = seasons.reduce((best, item) =>
    item.average_margin_seconds > best.average_margin_seconds ? item : best
  );
  const deepestField = seasons.reduce((best, item) =>
    item.average_entries > best.average_entries ? item : best
  );

  document.querySelector("#men-b-story").textContent =
    `Short answer: 2025 does not look easy by the competitiveness signals. ${year2025.most_wins_club} won all ${year2025.races} Men Novice B races, but the average winning margin was only ${seconds(year2025.average_margin_seconds)} with ${fmt(year2025.average_entries)} boats per race. That reads more like one crew consistently handling pressure than a soft field.`;

  document.querySelector("#men-b-callouts").innerHTML = `
    <article>
      <span>${year2025.most_wins}</span>
      <small>${year2025.most_wins_club} wins in 2025</small>
    </article>
    <article>
      <span>${seconds(year2025.average_margin_seconds)}</span>
      <small>2025 average winning margin</small>
    </article>
    <article>
      <span>${fmt(year2025.average_entries)}</span>
      <small>2025 average boats per race</small>
    </article>
    <article>
      <span>${deepestField.season}</span>
      <small>deepest average field</small>
    </article>
    <article>
      <span>${easiestMargin.season}</span>
      <small>largest average margin</small>
    </article>
  `;
}

function renderSeasonCards(data) {
  document.querySelector("#novice-event-stack").innerHTML = eventOrder
    .map((eventName) => {
      const cards = data.season_competitiveness[eventName].map(yearCard).join("");
      return `
        <section class="novice-event-block">
          <div>
            <p class="section-kicker">${eventName}</p>
            <h3>${eventName} by season</h3>
          </div>
          <div class="year-card-grid">${cards}</div>
        </section>
      `;
    })
    .join("");
}

function compositionBars(item) {
  const total = item.paddler_appearances || 1;
  const pieces = [
    ["first", item.first_year_a, "first_year_a"],
    ["second", item.second_year_a, "second_year_a"],
    ["history", item.prior_a_history + item.prior_b_history, "prior history"],
    ["unknown", item.unknown, "unknown"],
  ];
  return pieces
    .map(([className, count, label]) => {
      const width = (count / total) * 100;
      return `<i class="${className}" style="width:${width}%" title="${label}: ${count}"></i>`;
    })
    .join("");
}

function rosterCountPill(team, key, label) {
  const appearances =
    key === "prior_history" ? team.prior_a_history + team.prior_b_history : team[key];
  const unique =
    key === "prior_history"
      ? team.unique_prior_a_history + team.unique_prior_b_history
      : team[`unique_${key}`];

  const paddlerWord = unique === 1 ? "paddler" : "paddlers";
  const appearanceWord = appearances === 1 ? "appearance" : "appearances";
  return `<span>${unique} unique ${label} ${paddlerWord} with ${appearances} ${appearanceWord}</span>`;
}

function renderRosterTeams(data) {
  const teams = data.current_roster_composition.teams
    .filter((team) => team.entries >= 2)
    .sort((a, b) => a.event.localeCompare(b.event) || b.points - a.points);

  const firstLeans = teams.filter((team) => team.lean === "mostly_first_year_a").length;
  const secondLeans = teams.filter((team) => team.lean === "mostly_second_year_a").length;
  document.querySelector("#roster-story").textContent =
    `Using 2025 OHCRA season-standing rosters as the lookback, ${firstLeans} club-event crews lean first-year Novice A and ${secondLeans} lean second-year Novice A. Unknowns usually mean the paddler did not appear in the downloaded same-gender novice history, not that they are ineligible.`;

  document.querySelector("#roster-team-grid").innerHTML = teams
    .map(
      (team) => `
        <article class="roster-card">
          <small>${team.event}</small>
          <h3>${team.club}</h3>
          <p>${fmt(team.points)} points Â· ${team.entries} entries Â· ${team.wins} wins Â· ${team.podiums} podiums</p>
          <div class="composition-bar">${compositionBars(team)}</div>
          <div class="roster-counts">
            ${rosterLabels.map(([key, label]) => rosterCountPill(team, key, label)).join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function renderRosterEntries(data) {
  allRosterEntries = data.current_roster_composition.entries
    .filter((entry) => entry.place != null)
    .sort((a, b) => a.event.localeCompare(b.event) || a.race_id.localeCompare(b.race_id) || a.place - b.place);

  populateEvidenceFilters(allRosterEntries);
  applyEvidenceFilters();
}

function crewClassificationSummary(entry) {
  const pieces = [
    [entry.first_year_a, "first-year A"],
    [entry.second_year_a, "second-year A"],
    [entry.prior_a_history + entry.prior_b_history, "prior-history"],
    [entry.unknown, "unknown"],
  ].filter(([count]) => count > 0);
  return pieces.map(([count, label]) => `${count} ${label}`).join(" Â· ");
}

function openCrewDetail(index) {
  const entry = rosterEntries[index];
  if (!entry) return;

  const groups = [
    ["first_year_a", "First-year A signal", "Appeared in same-gender Novice B in 2025."],
    ["second_year_a", "Second-year A signal", "Appeared in same-gender Novice A in 2025."],
    ["prior_a_history", "Prior A history", "Appeared in same-gender Novice A before 2025."],
    ["prior_b_history", "Prior B history", "Appeared in same-gender Novice B before 2025."],
    ["unknown", "Unknown", "No same-gender novice history found in the downloaded data."],
  ];

  document.querySelector("#crew-sheet-kicker").textContent = entry.event;
  document.querySelector("#crew-sheet-title").textContent = entry.club;
  document.querySelector("#crew-sheet-meta").textContent =
    `${entry.race_name} Â· place ${entry.place} Â· ${entry.time || "no time"} Â· ${crewClassificationSummary(entry)}`;

  document.querySelector("#crew-group-list").innerHTML = groups
    .map(([classification, label, note]) => {
      const paddlers = entry.crew.filter((paddler) => paddler.classification === classification);
      if (!paddlers.length) return "";
      return `
        <article class="crew-group ${classification}">
          <div>
            <h3>${label}</h3>
            <p>${note}</p>
          </div>
          <ul>
            ${paddlers.map((paddler) => `<li>${escapeHtml(paddler.name)}</li>`).join("")}
          </ul>
        </article>
      `;
    })
    .join("");

  const modal = document.querySelector("#crew-modal");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeCrewDetail() {
  document.querySelector("#crew-modal").setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function init() {
  const response = await fetch("data/novice.json?v=novice-filters1");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();

  renderMenBStory(data);
  renderSeasonCards(data);
  renderRosterTeams(data);
  renderRosterEntries(data);

  document.querySelectorAll("#evidence-gender-filter, #evidence-club-filter, #evidence-place-filter").forEach((filter) => {
    filter.addEventListener("change", applyEvidenceFilters);
  });
  document.querySelector("#roster-entry-body").addEventListener("click", (event) => {
    const button = event.target.closest("[data-crew-index]");
    if (!button) return;
    openCrewDetail(Number(button.dataset.crewIndex));
  });

  document.querySelectorAll("[data-close-crew]").forEach((button) => {
    button.addEventListener("click", closeCrewDetail);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCrewDetail();
  });
}

init().catch(() => {
  document.querySelector("#novice-hero-copy").textContent =
    "Novice analysis data is missing. Run scripts/build_novice_data.py.";
});



