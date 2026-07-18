const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const pctFmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
let selectedRaceYear = "all";
let selectedClubDivision = "AAA";
let dqData = null;

const clubDivisions = {
  "Lanikai Canoe Club": "AAA", "Outrigger Canoe Club": "AAA", "Hui Nalu Canoe Club": "AAA",
  "Keahiakahoe Canoe Club": "AAA", "Kailua Canoe Club": "AAA", "Leeward Kai Canoe Club": "AAA", "Healani Canoe Club": "AAA",
  "Waikiki Surf Club": "AA", "Kai Oni Canoe Club": "AA", "Waimanalo Canoe Club": "AA", "Honolulu Pearl Canoe Club": "AA",
  "Koa Kai Canoe Club": "A", "Hui Lanakila Canoe Club": "A", "Keola O Ke Kai Canoe Club": "A", "New Hope Canoe Club": "A",
  "Ewa Pu`uloa Outrigger": "A", "Anuenue Canoe Club": "A", "Makaha Canoe Club": "A",
};

const programLabels = {
  youth: "Youth program",
  novice: "Novice program (A&B)",
  open: "Open program",
  masters: "Masters program",
  mixed: "Mixed program",
  special: "Special events",
};

function pct(value) {
  return pctFmt.format(value || 0);
}

function list(items, formatter) {
  if (!items?.length) return `<span class="muted">None listed</span>`;
  return items.map(formatter).join("");
}

function raceLabel(race) {
  const type = race.race_type === "season" ? "season race" : race.race_type;
  return `${race.race_name}, ${race.season} · ${type}`;
}

function rankedRacesForYear(data) {
  const races = selectedRaceYear === "all"
    ? data.races_ranked
    : data.races_ranked.filter((race) => String(race.season) === selectedRaceYear);
  return selectedRaceYear === "all" ? races.slice(0, 12) : races;
}

function renderRaceFilters(data) {
  const seasons = data.metadata.seasons;
  document.querySelector("#dq-year-filter").innerHTML = ["all", ...seasons]
    .map((season) => {
      const label = season === "all" ? "All years" : season;
      const active = String(season) === selectedRaceYear;
      return `<button class="dq-filter-button" type="button" data-race-year="${season}" aria-pressed="${active}">${label}</button>`;
    })
    .join("");
}

function renderReasonLegend(data) {
  document.querySelector("#dq-legend-body").innerHTML = data.reason_legend
    .map((reason) => `<tr><td><strong>${reason.code}</strong></td><td>${reason.label}</td></tr>`)
    .join("");
}
function renderRaceView(data) {
  const ranked = rankedRacesForYear(data);
  const maxRaceDqs = Math.max(...ranked.map((race) => race.dq_count), 1);
  const top = ranked[0];
  const yearPhrase = selectedRaceYear === "all" ? "the full dataset" : selectedRaceYear;

  renderRaceFilters(data);

  document.querySelector("#race-intro").textContent = top
    ? `${top.race_name} in ${top.season} leads ${yearPhrase} with ${top.dq_count} DQs across ${top.entry_count} entered events (${pct(top.dq_rate)} DQ rate). Use the year filter to compare races within a single season.`
    : `No DQs are listed for ${yearPhrase}.`;

  document.querySelector("#dq-year-grid").innerHTML = data.yearly_totals
    .map(
      (year) => `
        <article class="dq-year-card">
          <span>${year.season}</span>
          <strong>${year.dq_count}</strong>
          <small>DQs</small>
        </article>
      `
    )
    .join("");

  document.querySelector("#dq-race-list").innerHTML = ranked
    .map(
      (race) => `
        <article class="dq-race-row">
          <div>
            <h3>${race.race_name}</h3>
            <p>${race.season} · ${race.entry_count} entered events · ${pct(race.dq_rate)} DQ rate</p>
            <div class="dq-chip-row all-reasons">
              ${list(race.reasons, (item) => `<span>${item.name}: ${item.count}</span>`)}
            </div>
          </div>
          <div class="dq-row-meter" aria-hidden="true"><i style="width:${(race.dq_count / maxRaceDqs) * 100}%"></i></div>
          <strong>${race.dq_count}</strong>
        </article>
      `
    )
    .join("");
}

function renderClubView(data) {
  const clubs = [...data.clubs]
    .filter((club) => selectedClubDivision === "all" || clubDivisions[club.club] === selectedClubDivision)
    .sort((a, b) => a.dq_rate - b.dq_rate || a.dq_count - b.dq_count || a.club.localeCompare(b.club))
    .slice(0, 12);
  const best = clubs[0];

  if (!best) {
    document.querySelector("#club-intro").textContent = "No clubs with DQs are listed in this division.";
    document.querySelector("#dq-club-grid").innerHTML = "";
    return;
  }

  const divisionLabel = selectedClubDivision === "all" ? "all divisions" : `Division ${selectedClubDivision}`;

  document.querySelector("#club-intro").textContent =
    `${best.club} has the lowest DQ ratio among clubs with DQs in ${divisionLabel}: ${best.dq_count} DQs across ${best.entry_count} entered events (${pct(best.dq_rate)}). Cards are ranked from lowest ratio to highest.`;

  document.querySelector("#dq-club-grid").innerHTML = clubs
    .map(
      (club, index) => `
        <article class="dq-club-card">
          <div class="dq-card-topline">
            <span>${index + 1}</span>
            <strong>${club.dq_count} DQs</strong>
          </div>
          <h3>${club.club}</h3>
          <div class="dq-rate-panel sort-rate">
            <strong>${pct(club.dq_rate)}</strong>
            <span>${club.dq_count} DQs / ${club.entry_count} entered events</span>
          </div>
          <div class="dq-card-section">
            <small>Events with DQs</small>
            <ul>
              ${list(club.events.slice(0, 5), (item) => `<li><span>${item.name}</span><strong>${item.count}</strong></li>`)}
            </ul>
          </div>
          <div class="dq-card-section">
            <small>Reason mix</small>
            <div class="dq-chip-row">
              ${list(club.reasons.slice(0, 5), (item) => `<span>${item.name}: ${item.count}</span>`)}
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderReasonView(data) {
  const reasons = data.reasons.slice(0, 10);
  const top = reasons[0];
  const maxReasonDqs = Math.max(...reasons.map((reason) => reason.dq_count), 1);

  document.querySelector("#reason-intro").textContent =
    `${top.code} is the most common DQ reason code, accounting for ${top.dq_count} DQs (${pct(top.share)} of all DQs). Reason labels are working interpretations of the codes, so the original code remains visible.`;

  document.querySelector("#dq-reason-list").innerHTML = reasons
    .map(
      (reason) => `
        <article class="dq-reason-card">
          <div class="dq-reason-header">
            <div>
              <small>${reason.code}</small>
              <h3>${reason.label}</h3>
              <p>${reason.dq_count} DQs · ${pct(reason.share)} of all DQs</p>
            </div>
            <strong>${reason.dq_count}</strong>
          </div>
          <div class="dq-row-meter reason-meter" aria-hidden="true"><i style="width:${(reason.dq_count / maxReasonDqs) * 100}%"></i></div>
          <div class="dq-reason-columns">
            <div>
              <small>Top events</small>
              <ul>
                ${list(reason.top_events.slice(0, 5), (item) => `<li><span>${item.name}</span><strong>${item.count}</strong></li>`)}
              </ul>
            </div>
            <div>
              <small>Top clubs</small>
              <ul>
                ${list(reason.top_clubs.slice(0, 5), (item) => `<li><span>${item.name}</span><strong>${item.count}</strong></li>`)}
              </ul>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderOutriggerSeason(data) {
  const section = data.outrigger_2026;
  const maxRaceDqs = Math.max(...section.races.map((race) => race.dq_count), 1);

  document.querySelector("#outrigger-intro").textContent =
    `${section.club} has ${section.dq_count} DQs across ${section.entry_count} entered events in the ${section.season} season to date, a ${pct(section.dq_rate)} DQ rate.`;

  document.querySelector("#outrigger-season-grid").innerHTML = `
    <article class="dq-year-card outrigger-summary-card">
      <span>Season rate</span>
      <strong>${pct(section.dq_rate)}</strong>
      <small>${section.dq_count} / ${section.entry_count} entered events</small>
    </article>
    <article class="dq-club-card outrigger-race-card">
      <h3>By race</h3>
      <div class="outrigger-race-list">
        ${section.races
          .map(
            (race) => `
              <div class="outrigger-race-row">
                <span>${race.race_name}</span>
                <div class="dq-row-meter" aria-hidden="true"><i style="width:${(race.dq_count / maxRaceDqs) * 100}%"></i></div>
                <strong>${race.dq_count}/${race.entry_count}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
    <article class="dq-club-card">
      <h3>Reason mix</h3>
      <div class="dq-chip-row">
        ${list(section.reasons, (item) => `<span>${item.name}: ${item.count}</span>`)}
      </div>
    </article>
  `;

  document.querySelector("#outrigger-records").innerHTML = section.records.length
    ? section.records
        .map(
          (record) => `
            <tr>
              <td>${record.race_name}</td>
              <td>${record.event_name}</td>
              <td><strong>${record.reason_code}</strong><br><small>${record.reason_label}</small></td>
              <td>${record.time || "-"}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="4">No Outrigger DQs are listed for 2026.</td></tr>`;
}

async function init() {
  const response = await fetch("data/dqs.json?v=dq-refresh-2026-1198");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  dqData = await response.json();

  renderReasonLegend(dqData);
  renderRaceView(dqData);
  renderClubView(dqData);
  renderReasonView(dqData);
  renderOutriggerSeason(dqData);

  document.querySelector("#dq-year-filter").addEventListener("click", (event) => {
    const button = event.target.closest("[data-race-year]");
    if (!button) return;
    selectedRaceYear = button.dataset.raceYear;
    renderRaceView(dqData);
  });

  document.querySelector("#dq-division-filter").addEventListener("change", (event) => {
    selectedClubDivision = event.target.value;
    renderClubView(dqData);
  });
}

init().catch(() => {
  document.querySelector("#race-intro").textContent =
    "DQ data is missing. Run the DQ data builder and refresh the page.";
});




