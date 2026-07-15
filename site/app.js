const state = {
  rows: [],
  season: "all",
  club: "all",
};

const formatPlace = (row) => row.place ?? row.status ?? "";

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true })
  );
}

function populateSelect(element, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    element.append(option);
  }
}

function filteredRows() {
  return state.rows.filter((row) => {
    const seasonMatch = state.season === "all" || String(row.season) === state.season;
    const clubMatch = state.club === "all" || row.club === state.club;
    return seasonMatch && clubMatch;
  });
}

function render() {
  const rows = filteredRows();
  const races = unique(rows.map((row) => row.race_id));
  const clubs = unique(rows.map((row) => row.club));
  const events = unique(rows.map((row) => row.event_name));

  document.querySelector("#race-count").textContent = races.length;
  document.querySelector("#entry-count").textContent = rows.length.toLocaleString();
  document.querySelector("#club-count").textContent = clubs.length;
  document.querySelector("#event-count").textContent = events.length;
  document.querySelector("#status").textContent = `${rows.length.toLocaleString()} matching entries`;

  const topRows = [...rows]
    .sort((a, b) => b.points - a.points || (a.place ?? 999) - (b.place ?? 999))
    .slice(0, 50);

  document.querySelector("#results-body").innerHTML = topRows
    .map(
      (row) => `
        <tr>
          <td>${row.race_name}</td>
          <td>${row.event_name}</td>
          <td>${row.club}</td>
          <td>${formatPlace(row)}</td>
          <td>${row.time}</td>
          <td>${row.points}</td>
        </tr>
      `
    )
    .join("");
}

async function init() {
  try {
    const response = await fetch("data/results.json?v=refresh-2026-1198");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.rows = await response.json();

    populateSelect(document.querySelector("#season-filter"), unique(state.rows.map((row) => row.season)));
    populateSelect(document.querySelector("#club-filter"), unique(state.rows.map((row) => row.club)));
    render();
  } catch (error) {
    document.querySelector("#status").textContent =
      "No generated data found yet. Run the data pipeline first.";
  }
}

document.querySelector("#season-filter").addEventListener("change", (event) => {
  state.season = event.target.value;
  render();
});

document.querySelector("#club-filter").addEventListener("change", (event) => {
  state.club = event.target.value;
  render();
});

init();

