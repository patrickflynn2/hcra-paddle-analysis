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
let selectedRosterGender = "Men";
let selectedRosterDivision = "AAA";
let selectedSeasonEvent = "Men Novice B";
let selectedPaceEvent = "Men Novice B";

const clubDivisions = {
  "Lanikai Canoe Club": "AAA",
  "Outrigger Canoe Club": "AAA",
  "Hui Nalu Canoe Club": "AAA",
  "Keahiakahoe Canoe Club": "AAA",
  "Kailua Canoe Club": "AAA",
  "Leeward Kai Canoe Club": "AAA",
  "Healani Canoe Club": "AAA",
  "Waikiki Surf Club": "AA",
  "Kai Oni Canoe Club": "AA",
  "Waimanalo Canoe Club": "AA",
  "Honolulu Pearl Canoe Club": "AA",
  "Koa Kai Canoe Club": "A",
  "Hui Lanakila Canoe Club": "A",
  "Keola O Ke Kai Canoe Club": "A",
  "New Hope Canoe Club": "A",
  "Ewa Pu`uloa Outrigger": "A",
  "Anuenue Canoe Club": "A",
  "Makaha Canoe Club": "A",
};

function fmt(value) {
  return numberFormat.format(value);
}

function unit(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
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


function noviceGender(eventName) {
  if (eventName.startsWith("Men ")) return "Men";
  if (eventName.startsWith("Women ")) return "Women";
  return "Other";
}

function evidenceGender(eventName) {
  return noviceGender(eventName);
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
function eventSwitcher(target, selected, attribute) {
  document.querySelector(target).innerHTML = eventOrder.map((eventName) =>
    `<button type="button" data-${attribute}="${eventName}" class="${eventName === selected ? "is-active" : ""}" aria-pressed="${eventName === selected}">${eventName}</button>`
  ).join("");
}

function renderSeasonCards(data) {
  eventSwitcher("#season-event-switcher", selectedSeasonEvent, "season-event");
  const cards = data.season_competitiveness[selectedSeasonEvent].map(yearCard).join("");
  document.querySelector("#novice-event-stack").innerHTML = `
    <section class="novice-event-block">
      <div><p class="section-kicker">${selectedSeasonEvent}</p><h3>${selectedSeasonEvent} by season</h3></div>
      <div class="year-card-grid">${cards}</div>
    </section>`;
}

function paceTime(value) {
  const minutes = Math.floor(value / 60);
  const secs = (value % 60).toFixed(1).padStart(4, "0");
  return `${minutes}:${secs}`;
}

function renderNovicePace(data) {
  const analysis = data.novice_pace;
  eventSwitcher("#pace-event-switcher", selectedPaceEvent, "pace-event");
  document.querySelector("#novice-pace-grid").innerHTML = [selectedPaceEvent]
    .map((eventName) => {
      const seasons = analysis.seasons[eventName];
      const comparable = seasons.filter((item) => eventName !== "Men Novice B" || item.era === "quarter_mile");
      const fastest = comparable.reduce((best, item) => item.pace_index > best.pace_index ? item : best);
      const rows = seasons.map((item) => {
        const position = Math.max(0, Math.min(100, ((item.pace_index - 90) / 20) * 100));
        const difference = item.difference_from_era_pct;
        const paceLabel = difference > 0.05 ? `${fmt(difference)}% faster` : difference < -0.05 ? `${fmt(Math.abs(difference))}% slower` : "typical";
        const isolated = eventName === "Men Novice B" && item.era === "half_mile";
        return `
          <div class="pace-year-row ${isolated ? "pace-isolated" : ""}">
            <div class="pace-year"><strong>${item.season}</strong><small>${item.distance_label}</small></div>
            <div class="pace-track"><i></i><span style="left:${position}%" title="Pace index ${item.pace_index}"></span></div>
            <div class="pace-result"><strong>${item.pace_index}</strong><small>${isolated ? "separate baseline" : paceLabel}</small></div>
            <div class="pace-details"><span>${paceTime(item.raw_top_three_median_seconds)} raw</span><span>${fmt(item.median_first_to_third_seconds)}s 1st–3rd</span><span>${item.races} races</span></div>
          </div>`;
      }).join("");
      return `
        <article class="pace-card">
          <div class="pace-card-head"><div><p class="section-kicker">${eventName}</p><h3>${fastest.season} set the fastest comparable pace</h3></div><strong>${fastest.pace_index}</strong></div>
          <p>${eventName === "Men Novice B" ? "Quarter-mile comparison uses 2024 onward; 2023 is shown only as its half-mile baseline." : `All four seasons use the same ${seasons[0].distance_label} comparison era.`}</p>
          <div class="pace-year-list">${rows}</div>
        </article>`;
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

function populateRosterFilters(teams) {
  const genders = [...new Set(teams.map((team) => noviceGender(team.event)))].sort();
  const current = selectedRosterGender;
  document.querySelector("#roster-gender-filter").innerHTML =
    filterOption("all", "All genders") + genders.map((gender) => filterOption(gender)).join("");
  document.querySelector("#roster-gender-filter").value = genders.includes(current) ? current : "all";
  selectedRosterGender = document.querySelector("#roster-gender-filter").value;
}

function renderRosterTeams(data) {
  const allTeams = data.current_roster_composition.teams
    .filter((team) => team.entries >= 2)
    .sort((a, b) => a.event.localeCompare(b.event) || b.points - a.points);
  populateRosterFilters(allTeams);

  const teams = allTeams.filter(
    (team) =>
      (selectedRosterGender === "all" || noviceGender(team.event) === selectedRosterGender) &&
      (selectedRosterDivision === "all" || clubDivisions[team.club] === selectedRosterDivision)
  );

  const firstLeans = teams.filter((team) => team.lean === "mostly_first_year_a").length;
  const secondLeans = teams.filter((team) => team.lean === "mostly_second_year_a").length;
  const genderPhrase = selectedRosterGender === "all" ? "" : `${selectedRosterGender.toLowerCase()} `;
  const divisionPhrase = selectedRosterDivision === "all" ? "" : ` in Division ${selectedRosterDivision}`;
  document.querySelector("#roster-story").textContent =
    `Using 2025 OHCRA season-standing rosters as the lookback, ${firstLeans} ${genderPhrase}club-event crews${divisionPhrase} lean first-year Novice A and ${secondLeans} lean second-year Novice A. Unknowns usually mean the paddler did not appear in the downloaded novice history for that program, not that they are ineligible.`;

  document.querySelector("#roster-team-grid").innerHTML = teams.length
    ? teams
        .map(
          (team) => `
            <article class="roster-card">
              <small>${team.event} · Division ${clubDivisions[team.club] ?? "not assigned"}</small>
              <h3>${team.club}</h3>
              <p>${fmt(team.points)} ${unit(team.points, "point")} - ${team.entries} ${unit(team.entries, "entry", "entries")} - ${team.wins} ${unit(team.wins, "win")} - ${team.podiums} ${unit(team.podiums, "podium")}</p>
              <div class="composition-bar">${compositionBars(team)}</div>
              <div class="roster-counts">
                ${rosterLabels.map(([key, label]) => rosterCountPill(team, key, label)).join("")}
              </div>
            </article>
          `
        )
        .join("")
    : `<article class="roster-card"><p>No roster cards match this gender filter.</p></article>`;
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
  return pieces.map(([count, label]) => `${count} ${label}`).join(" - ");
}

function openCrewDetail(index) {
  const entry = rosterEntries[index];
  if (!entry) return;

  const groups = [
    ["first_year_a", "First-year A signal", "Appeared in Novice B in 2025 for this program."],
    ["second_year_a", "Second-year A signal", "Appeared in Novice A in 2025 for this program."],
    ["prior_a_history", "Prior A history", "Appeared in Novice A before 2025 for this program."],
    ["prior_b_history", "Prior B history", "Appeared in Novice B before 2025 for this program."],
    ["unknown", "Unknown", "No novice history found for this program in the downloaded data."],
  ];

  document.querySelector("#crew-sheet-kicker").textContent = entry.event;
  document.querySelector("#crew-sheet-title").textContent = entry.club;
  document.querySelector("#crew-sheet-meta").textContent =
    `${entry.race_name} - place ${entry.place} - ${entry.time || "no time"} - ${crewClassificationSummary(entry)}`;

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

function openPaceExplanation() {
  document.querySelector("#pace-explanation-modal").setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closePaceExplanation() {
  document.querySelector("#pace-explanation-modal").setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function init() {
  const response = await fetch("data/novice.json?v=novice-pace-explanation6");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();

  renderSeasonCards(data);
  renderNovicePace(data);
  renderRosterTeams(data);
  renderRosterEntries(data);

  document.querySelector("#season-event-switcher").addEventListener("click", (event) => {
    const button = event.target.closest("[data-season-event]");
    if (!button) return;
    selectedSeasonEvent = button.dataset.seasonEvent;
    renderSeasonCards(data);
  });

  document.querySelector("#pace-event-switcher").addEventListener("click", (event) => {
    const button = event.target.closest("[data-pace-event]");
    if (!button) return;
    selectedPaceEvent = button.dataset.paceEvent;
    renderNovicePace(data);
  });

  document.querySelector("#roster-gender-filter").addEventListener("change", (event) => {
    selectedRosterGender = event.target.value;
    renderRosterTeams(data);
  });

  document.querySelector("#roster-division-filter").addEventListener("change", (event) => {
    selectedRosterDivision = event.target.value;
    renderRosterTeams(data);
  });

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

  document.querySelector("#pace-explanation-button").addEventListener("click", openPaceExplanation);
  document.querySelectorAll("[data-close-pace-explanation]").forEach((button) => {
    button.addEventListener("click", closePaceExplanation);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCrewDetail();
      closePaceExplanation();
    }
  });
}

init().catch(() => {
  document.querySelector("#novice-hero-copy").textContent =
    "Novice analysis data is missing. Run scripts/build_novice_data.py.";
});








