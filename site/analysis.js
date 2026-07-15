const categoryLabels = {
  youth: "Youth program",
  novice: "Novice program (A&B)",
  open: "Open program",
  masters: "Masters program",
  mixed: "Mixed program",
};

const categoryOrder = ["youth", "novice", "open", "masters", "mixed"];
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
let clubProfiles = [];
let profileSeasons = [];
let podiumProfiles = [];
let podiumSeasons = [];

const profileModes = {
  wins: {
    label: "wins",
    detailKicker: "Club win detail",
    totalField: "total_wins",
    averageField: "average_wins",
    shareField: "win_share",
    countField: "wins",
    denominatorField: "total_events",
    denominatorLabel: "Events",
    averageLabel: "Avg wins/regatta",
    shareLabel: "Win share",
    rankText: (profile) => `${profile.total_wins} category wins`,
    peakText: (best) =>
      `${categoryLabels[best.category]} ${best.item.season} at ${fmt.format(best.item.average_wins)} / ${fmt.format(best.item.average_events)}`,
    cellText: (item) => `${fmt.format(item.average_wins)} / ${fmt.format(item.average_events)}`,
    cellSubtext: null,
    detailCountLabel: "Wins",
  },
  podiums: {
    label: "podiums",
    detailKicker: "Club podium detail",
    totalField: "total_podiums",
    averageField: "average_podiums",
    shareField: "podium_share",
    countField: "podiums",
    denominatorField: "podium_slots",
    denominatorLabel: "Podium slots",
    averageLabel: "Avg podiums/regatta",
    shareLabel: "Podium finish %",
    rankText: (profile) => `${profile.total_podiums} podium finishes · ${pct(profile.overall_podium_share)} overall podium share`,
    peakText: (best) =>
      `${categoryLabels[best.category]} ${best.item.season} at ${pct(best.item.podium_share)}`,
    cellText: (item) => pct(item.podium_share),
    cellSubtext: (item) => `${fmt.format(item.average_podiums)} per regatta`,
    detailCountLabel: "Podiums",
  },
};

function seconds(value) {
  return `${fmt.format(value)}s`;
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function cellFor(profile, category, season) {
  return (profile.categories[category] ?? []).find((item) => item.season === season);
}

function renderScope(data) {
  const excluded = data.metadata.excluded_special_races ?? [];
  const byType = excluded.reduce((counts, race) => {
    counts[race.race_type] = (counts[race.race_type] ?? 0) + 1;
    return counts;
  }, {});

  document.querySelector("#scope-intro").textContent =
    `The raw dataset still contains ${data.metadata.source_races} races, but this story uses ${data.metadata.races} OHCRA season-standing races. Walter J. MacFarlane and HCRA State Championship results are preserved for separate analysis because their fields and race conditions tell a different kind of story.`;

  document.querySelector("#scope-grid").innerHTML = `
    <article><span>${data.metadata.races}</span><small>season races included</small></article>
    <article><span>${excluded.length}</span><small>special races held aside</small></article>
    <article><span>${byType.macfarlane ?? 0}</span><small>MacFarlane races excluded</small></article>
    <article><span>${byType.states ?? 0}</span><small>State races excluded</small></article>
  `;
}

function bestCategory(profile, mode = "wins") {
  const config = profileModes[mode];
  let best = null;
  for (const category of categoryOrder) {
    for (const item of profile.categories[category] ?? []) {
      const score = mode === "podiums" ? item[config.shareField] : item[config.averageField];
      if (!best || score > best.score) {
        best = { category, item, score };
      }
    }
  }
  return best;
}

function programMatrix(profile, seasons, mode = "wins") {
  const config = profileModes[mode];
  const header = seasons.map((season) => `<th>${season}</th>`).join("");
  const rows = categoryOrder
    .map((category) => {
      const cells = seasons
        .map((season) => {
          const item = cellFor(profile, category, season);
          if (!item) return `<td><span class="matrix-empty">-</span></td>`;
          const share = item[config.shareField] ?? 0;
          const subtext = config.cellSubtext ? `<small class="matrix-subvalue">${config.cellSubtext(item)}</small>` : "";
          return `
            <td>
              <span class="matrix-value">${config.cellText(item)}</span>
              ${subtext}
              <i class="matrix-meter" style="--w:${Math.round(share * 100)}%"></i>
            </td>
          `;
        })
        .join("");
      return `<tr><th>${categoryLabels[category]}</th>${cells}</tr>`;
    })
    .join("");

  return `
    <div class="club-matrix-wrap">
      <table class="club-matrix">
        <thead><tr><th>Program</th>${header}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function profileCard(profile, index, seasons, mode = "wins") {
  const config = profileModes[mode];
  const best = bestCategory(profile, mode);
  const dataAttribute = mode === "podiums" ? "data-podium-profile-index" : "data-profile-index";
  return `
    <article class="profile-card category-win-card ${mode === "podiums" ? "podium-card" : ""}">
      <div class="rank-badge">${index + 1}</div>
      <div class="profile-card-body">
        <div class="profile-heading matrix-heading">
          <div>
            <h3>${profile.club}</h3>
            <p>${config.rankText(profile)} · peak: ${config.peakText(best)}</p>
          </div>
          <button class="profile-detail-button" type="button" ${dataAttribute}="${index}">Details</button>
        </div>
        ${programMatrix(profile, seasons, mode)}
      </div>
    </article>
  `;
}

function renderProfiles(data) {
  clubProfiles = data.club_category_win_rates.clubs.slice(0, 8);
  profileSeasons = data.club_category_win_rates.seasons;
  const top = clubProfiles[0];
  const topBest = bestCategory(top, "wins");

  document.querySelector("#profile-intro").textContent =
    `Each card shows average event wins per regatta by program and year. For example, ${top.club}'s strongest line is ${categoryLabels[topBest.category]} in ${topBest.item.season}, averaging ${fmt.format(topBest.item.average_wins)} wins out of ${fmt.format(topBest.item.average_events)} available program events per regatta.`;

  document.querySelector("#profile-list").innerHTML = clubProfiles
    .map((profile, index) => profileCard(profile, index, profileSeasons, "wins"))
    .join("");
}

function renderPodiumProfiles(data) {
  podiumProfiles = data.club_category_podium_rates.clubs.slice(0, 8);
  podiumSeasons = data.club_category_podium_rates.seasons;
  const top = podiumProfiles[0];
  const topBest = bestCategory(top, "podiums");

  document.querySelector("#podium-profile-intro").textContent =
    `This version rewards consistency. Each percentage is the share of available podium spots captured by that club in a program and year. ${top.club} leads this cut overall, with its strongest line in ${categoryLabels[topBest.category]} ${topBest.item.season} at ${pct(topBest.item.podium_share)} of available podium spots.`;

  document.querySelector("#podium-profile-list").innerHTML = podiumProfiles
    .map((profile, index) => profileCard(profile, index, podiumSeasons, "podiums"))
    .join("");
}

function openProfileDetail(index, mode = "wins") {
  const config = profileModes[mode];
  const profiles = mode === "podiums" ? podiumProfiles : clubProfiles;
  const profile = profiles[index];
  if (!profile) return;
  const best = bestCategory(profile, mode);

  document.querySelector("#profile-sheet-kicker").textContent = config.detailKicker;
  document.querySelector("#profile-sheet-title").textContent = profile.club;
  document.querySelector("#profile-sheet-meta").textContent =
    `${config.rankText(profile)} · best line: ${config.peakText(best)}`;

  document.querySelector("#profile-detail-body").innerHTML = categoryOrder
    .map((category) => {
      const rows = profile.categories[category] ?? [];
      if (!rows.length) return "";
      return `
        <section class="profile-detail-group ${category}">
          <h3>${categoryLabels[category]}</h3>
          <div class="profile-detail-table-wrap">
            <table class="profile-detail-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>${config.detailCountLabel}</th>
                  <th>${config.denominatorLabel}</th>
                  <th>${config.averageLabel}</th>
                  <th>Avg events/regatta</th>
                  <th>${config.shareLabel}</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    (row) => `
                      <tr>
                        <td>${row.season}</td>
                        <td>${row[config.countField]}</td>
                        <td>${row[config.denominatorField]}</td>
                        <td>${fmt.format(row[config.averageField])}</td>
                        <td>${fmt.format(row.average_events)}</td>
                        <td>${pct(row[config.shareField])}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>
      `;
    })
    .join("");

  document.querySelector("#profile-modal").setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeProfileDetail() {
  document.querySelector("#profile-modal").setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function renderSpecializations(data) {
  const items = data.specializations.slice(0, 12);
  const top = items[0];
  document.querySelector("#specialization-intro").textContent =
    `${top.club}'s ${categoryLabels[top.category].toLowerCase()} results account for ${pct(top.share)} of its season-race points, the strongest specialization signal in this OHCRA-only cut.`;

  document.querySelector("#specialty-grid").innerHTML = items
    .map(
      (item) => `
        <article class="specialty-card">
          <small>${categoryLabels[item.category]}</small>
          <h3>${item.club}</h3>
          <p>${pct(item.share)} of points in ${categoryLabels[item.category].toLowerCase()} events</p>
          <div class="specialty-meta">
            <span>${fmt.format(item.points)} pts</span>
            <span>${item.wins} wins</span>
            <span>${item.podiums} podiums</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderClosest(data) {
  const races = data.closest_races.slice(0, 12);
  const first = races[0];
  document.querySelector("#closest-intro").textContent =
    `${first.winner} edged ${first.runner_up} by ${seconds(first.margin_seconds)} in ${first.event_name}, the slimmest winning margin found in the OHCRA season-race set.`;

  document.querySelector("#closest-body").innerHTML = races
    .map(
      (race) => `
        <tr>
          <td><strong>${seconds(race.margin_seconds)}</strong></td>
          <td>${race.event_name}</td>
          <td>${race.race_name}, ${race.season}</td>
          <td>${race.winner}<br><small>${race.winning_time}</small></td>
          <td>${race.runner_up}<br><small>${race.runner_up_time}</small></td>
        </tr>
      `
    )
    .join("");
}

function renderAverageMargins(data) {
  const margins = data.average_margins_by_event.slice(0, 12);
  const maxMargin = Math.max(...margins.map((item) => item.average_margin_seconds));
  const first = margins[0];
  document.querySelector("#average-margin-intro").textContent =
    `${first.event_name} has the lowest average winner-to-runner-up gap among events with repeated OHCRA season-race results, averaging ${seconds(first.average_margin_seconds)} across ${first.races} races.`;

  document.querySelector("#margin-list").innerHTML = margins
    .map(
      (item) => `
        <article class="margin-row">
          <div>
            <h3>${item.event_name}</h3>
            <p>${item.races} races · closest ${seconds(item.closest_margin_seconds)} · ${categoryLabels[item.category] ?? "Other"}</p>
          </div>
          <div class="margin-meter"><i style="width: ${(item.average_margin_seconds / maxMargin) * 100}%"></i></div>
          <strong>${seconds(item.average_margin_seconds)}</strong>
        </article>
      `
    )
    .join("");
}

function renderFastest(data) {
  const winners = data.fastest_winning_times
    .filter((item) => categoryOrder.includes(item.category))
    .sort((a, b) => a.event_name.localeCompare(b.event_name, undefined, { numeric: true }))
    .slice(0, 30);

  document.querySelector("#fastest-intro").textContent =
    "The table below keeps one fastest winning time per event across OHCRA season-standing races. MacFarlane and States are intentionally excluded from these benchmarks.";

  document.querySelector("#fastest-body").innerHTML = winners
    .map(
      (item) => `
        <tr>
          <td>${item.event_name}</td>
          <td>${item.club}</td>
          <td>${item.race_name}</td>
          <td>${item.season}</td>
          <td><strong>${item.time}</strong></td>
        </tr>
      `
    )
    .join("");
}

async function init() {
  const response = await fetch("data/analysis.json?v=refresh-2026-1198");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();

  document.querySelector("#story-races").textContent = data.metadata.races;
  document.querySelector("#story-clubs").textContent = data.metadata.clubs;
  document.querySelector("#story-events").textContent = data.metadata.events;

  renderScope(data);
  renderProfiles(data);
  renderPodiumProfiles(data);
  renderSpecializations(data);
  renderClosest(data);
  renderAverageMargins(data);
  renderFastest(data);

  document.querySelector("#profile-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-profile-index]");
    if (!button) return;
    openProfileDetail(Number(button.dataset.profileIndex), "wins");
  });

  document.querySelector("#podium-profile-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-podium-profile-index]");
    if (!button) return;
    openProfileDetail(Number(button.dataset.podiumProfileIndex), "podiums");
  });

  document.querySelectorAll("[data-close-profile]").forEach((button) => {
    button.addEventListener("click", closeProfileDetail);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeProfileDetail();
  });
}

init().catch(() => {
  document.querySelector("#scope-intro").textContent =
    "Analysis data is missing. Run the data pipeline and rebuild the site data.";
});



