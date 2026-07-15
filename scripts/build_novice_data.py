"""Build novice-specific analysis data for the narrative site page."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "processed" / "results.json"
PROCESSED_DESTINATION = ROOT / "data" / "processed" / "novice.json"
SITE_DESTINATION = ROOT / "site" / "data" / "novice.json"
CURRENT_SEASON = 2026
PRIOR_SEASON = CURRENT_SEASON - 1
TARGET_EVENTS = [
    "Men Novice A",
    "Men Novice B",
    "Women Novice A",
    "Women Novice B",
]


def special_race_type(race_name: str) -> str | None:
    value = race_name.lower()
    if "macfarlane" in value:
        return "macfarlane"
    if "hcra state championship" in value:
        return "states"
    return None


def core_ohcra_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in rows if special_race_type(row["race_name"]) is None]


def special_race_summary(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    races = {}
    for row in rows:
        race_type = special_race_type(row["race_name"])
        if race_type is None:
            continue
        races.setdefault(
            row["race_id"],
            {
                "race_id": row["race_id"],
                "season": row["season"],
                "race_name": row["race_name"],
                "race_type": race_type,
                "rows": 0,
            },
        )
        races[row["race_id"]]["rows"] += 1
    return sorted(races.values(), key=lambda item: (item["season"], item["race_id"]))


def normalize_event_name(name: str) -> str:
    value = name.replace("*", "").replace('"', "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def novice_event(name: str) -> str | None:
    value = normalize_event_name(name).lower()
    if "mixed" in value or "novice" not in value:
        return None

    if value.startswith("men novice"):
        gender = "Men"
    elif value.startswith("women novice"):
        gender = "Women"
    else:
        return None

    if re.search(r"\bnovice\s+a\b", value):
        level = "A"
    elif re.search(r"\bnovice\s+b\b", value):
        level = "B"
    else:
        return None

    return f"{gender} Novice {level}"


def person_key(name: str) -> str:
    value = name.lower().strip()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def result_groups(rows: list[dict[str, Any]]) -> dict[tuple[str, int], list[dict[str, Any]]]:
    groups: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        event = novice_event(row["event_name"])
        if event not in TARGET_EVENTS:
            continue
        groups[(row["race_id"], row["event_number"])].append({**row, "novice_event": event})
    return groups


def season_competitiveness(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    summaries: dict[tuple[str, int], dict[str, Any]] = {}
    winners_by_season_event: dict[tuple[str, int], Counter[str]] = defaultdict(Counter)

    for group in result_groups(rows).values():
        finishers = [
            row
            for row in group
            if row["place"] is not None and row["time_seconds"] is not None
        ]
        if not finishers:
            continue

        ordered = sorted(finishers, key=lambda row: row["place"])
        winner = ordered[0]
        runner_up = ordered[1] if len(ordered) > 1 and ordered[1]["place"] == 2 else None
        key = (winner["novice_event"], winner["season"])
        summary = summaries.setdefault(
            key,
            {
                "event": winner["novice_event"],
                "season": winner["season"],
                "races": 0,
                "total_entries": 0,
                "clubs": set(),
                "winning_times": [],
                "margins": [],
                "closest_race": None,
                "fastest_winner": None,
                "deepest_race": None,
            },
        )

        margin = None
        if runner_up is not None:
            margin = round(runner_up["time_seconds"] - winner["time_seconds"], 2)
            if margin >= 0:
                summary["margins"].append(margin)

        summary["races"] += 1
        summary["total_entries"] += len(group)
        summary["clubs"].update(row["club"] for row in group if row["club"])
        summary["winning_times"].append(winner["time_seconds"])
        winners_by_season_event[key][winner["club"]] += 1

        race_item = {
            "race_id": winner["race_id"],
            "race_name": winner["race_name"],
            "season": winner["season"],
            "winner": winner["club"],
            "winning_time": winner["time"],
            "winning_time_seconds": winner["time_seconds"],
            "runner_up": runner_up["club"] if runner_up else None,
            "runner_up_time": runner_up["time"] if runner_up else None,
            "margin_seconds": margin,
            "entries": len(group),
        }

        if summary["fastest_winner"] is None or winner["time_seconds"] < summary["fastest_winner"]["winning_time_seconds"]:
            summary["fastest_winner"] = race_item
        if margin is not None and (
            summary["closest_race"] is None or margin < summary["closest_race"]["margin_seconds"]
        ):
            summary["closest_race"] = race_item
        if summary["deepest_race"] is None or len(group) > summary["deepest_race"]["entries"]:
            summary["deepest_race"] = race_item

    output: dict[str, list[dict[str, Any]]] = {event: [] for event in TARGET_EVENTS}
    for (event, season), summary in summaries.items():
        winning_times = summary["winning_times"]
        margins = summary["margins"]
        winners = winners_by_season_event[(event, season)]
        winner_club, winner_count = winners.most_common(1)[0]
        output[event].append(
            {
                "event": event,
                "season": season,
                "races": summary["races"],
                "entries": summary["total_entries"],
                "average_entries": round(summary["total_entries"] / summary["races"], 1),
                "clubs": len(summary["clubs"]),
                "average_winning_time_seconds": round(mean(winning_times), 2),
                "average_margin_seconds": round(mean(margins), 2) if margins else None,
                "closest_margin_seconds": min(margins) if margins else None,
                "most_wins_club": winner_club,
                "most_wins": winner_count,
                "fastest_winner": summary["fastest_winner"],
                "closest_race": summary["closest_race"],
                "deepest_race": summary["deepest_race"],
            }
        )

    for event in output:
        output[event].sort(key=lambda item: item["season"])
    return output


def top_three_median(group: list[dict[str, Any]]) -> float | None:
    finishers = sorted(
        (row for row in group if row["place"] is not None and row["time_seconds"] is not None),
        key=lambda row: row["place"],
    )
    if len(finishers) < 3 or [row["place"] for row in finishers[:3]] != [1, 2, 3]:
        return None
    return float(finishers[1]["time_seconds"])


def novice_b_pace(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Compare front-of-field Novice B pace after a robust race-day adjustment."""
    by_race_event: dict[tuple[int, str, int], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_race_event[(row["season"], row["race_id"], row["event_number"])].append(row)

    observations = []
    for (season, race_id, event_number), group in by_race_event.items():
        pace = top_three_median(group)
        if pace is None:
            continue
        sample = group[0]
        observations.append({
            "season": season,
            "race_id": race_id,
            "race_name": sample["race_name"],
            "event_number": event_number,
            "event_name": normalize_event_name(sample["event_name"]),
            "pace": pace,
            "field": sum(row["place"] is not None for row in group),
            "spread": round(
                max(row["time_seconds"] for row in group if row["place"] == 3)
                - min(row["time_seconds"] for row in group if row["place"] == 1),
                2,
            ),
        })

    event_baselines: dict[tuple[int, str], float] = {}
    for key in {(item["season"], item["event_name"]) for item in observations}:
        values = [item["pace"] for item in observations if (item["season"], item["event_name"]) == key]
        if len(values) >= 3:
            event_baselines[key] = median(values)

    race_factors: dict[tuple[int, str], dict[str, Any]] = {}
    for season, race_id in {(item["season"], item["race_id"]) for item in observations}:
        ratios = []
        for item in observations:
            if item["season"] != season or item["race_id"] != race_id or novice_event(item["event_name"]) in {"Men Novice B", "Women Novice B"}:
                continue
            baseline = event_baselines.get((season, item["event_name"]))
            if baseline:
                ratio = item["pace"] / baseline
                if 0.65 <= ratio <= 1.5:
                    ratios.append(ratio)
        if len(ratios) >= 8:
            race_factors[(season, race_id)] = {
                "factor": median(ratios),
                "benchmarks": len(ratios),
            }

    target_races = []
    for item in observations:
        event = novice_event(item["event_name"])
        if event not in {"Men Novice B", "Women Novice B"}:
            continue
        factor = race_factors.get((item["season"], item["race_id"]))
        if factor is None:
            continue
        gender = event.split()[0]
        era = "half_mile" if gender == "Men" and item["season"] < 2024 else "quarter_mile"
        target_races.append({
            **item,
            "event": event,
            "gender": gender,
            "era": era,
            "course_factor": round(factor["factor"], 4),
            "benchmark_events": factor["benchmarks"],
            "adjusted_pace": item["pace"] / factor["factor"],
        })

    era_baselines = {}
    for gender in ("Men", "Women"):
        for era in ("half_mile", "quarter_mile"):
            values = [item["adjusted_pace"] for item in target_races if item["gender"] == gender and item["era"] == era]
            if values:
                era_baselines[(gender, era)] = median(values)

    seasons = {"Men Novice B": [], "Women Novice B": []}
    for event in seasons:
        for season in sorted({item["season"] for item in target_races if item["event"] == event}):
            items = [item for item in target_races if item["event"] == event and item["season"] == season]
            era = items[0]["era"]
            baseline = era_baselines[(items[0]["gender"], era)]
            adjusted = median(item["adjusted_pace"] for item in items)
            raw = median(item["pace"] for item in items)
            index = 100 * baseline / adjusted
            seasons[event].append({
                "season": season,
                "era": era,
                "distance_label": "1/2 mile" if era == "half_mile" else "1/4 mile",
                "races": len(items),
                "raw_top_three_median_seconds": round(raw, 2),
                "adjusted_top_three_median_seconds": round(adjusted, 2),
                "pace_index": round(index, 1),
                "difference_from_era_pct": round(index - 100, 1),
                "median_first_to_third_seconds": round(median(item["spread"] for item in items), 2),
                "average_front_field": round(mean(item["field"] for item in items), 1),
                "median_benchmark_events": int(median(item["benchmark_events"] for item in items)),
            })

    return {
        "method": {
            "headline_metric": "Median second-place time, adjusted by same-day course factor",
            "index_definition": "100 is the typical pace within the same gender and distance era; above 100 is faster.",
            "distance_note": "Men Novice B is treated as 1/2 mile through 2023 and 1/4 mile from 2024; Women Novice B is treated as 1/4 mile throughout this dataset.",
            "minimum_benchmark_events": 8,
        },
        "seasons": seasons,
    }


def build_person_history(rows: list[dict[str, Any]]) -> dict[str, set[tuple[int, str]]]:
    history: dict[str, set[tuple[int, str]]] = defaultdict(set)
    for row in rows:
        event = novice_event(row["event_name"])
        if event is None:
            continue
        for name in row["crew"]:
            key = person_key(name)
            if key:
                history[key].add((row["season"], event))
    return history


def classify_novice_a_paddler(name: str, event: str, history: dict[str, set[tuple[int, str]]]) -> str:
    key = person_key(name)
    if not key:
        return "unknown"

    gender = event.split(" ")[0]
    prior_events = history.get(key, set())
    prior_a = (PRIOR_SEASON, f"{gender} Novice A") in prior_events
    prior_b = (PRIOR_SEASON, f"{gender} Novice B") in prior_events

    if prior_a:
        return "second_year_a"
    if prior_b:
        return "first_year_a"
    if any(season < CURRENT_SEASON and novice_event_name == f"{gender} Novice A" for season, novice_event_name in prior_events):
        return "prior_a_history"
    if any(season < CURRENT_SEASON and novice_event_name == f"{gender} Novice B" for season, novice_event_name in prior_events):
        return "prior_b_history"
    return "unknown"


def roster_composition(rows: list[dict[str, Any]]) -> dict[str, Any]:
    history = build_person_history(rows)
    target_rows = [
        row
        for row in rows
        if row["season"] == CURRENT_SEASON and novice_event(row["event_name"]) in {"Men Novice A", "Women Novice A"}
    ]

    entries = []
    club_summary: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {
            "event": "",
            "club": "",
            "entries": 0,
            "wins": 0,
            "podiums": 0,
            "paddler_appearances": 0,
            "first_year_a": 0,
            "second_year_a": 0,
            "prior_a_history": 0,
            "prior_b_history": 0,
            "unknown": 0,
            "unique_paddlers": {},
            "points": 0.0,
        }
    )

    for row in target_rows:
        event = novice_event(row["event_name"])
        assert event is not None
        counts = Counter(classify_novice_a_paddler(name, event, history) for name in row["crew"])
        total = sum(counts.values())
        entry = {
            "event": event,
            "race_id": row["race_id"],
            "race_name": row["race_name"],
            "club": row["club"],
            "place": row["place"],
            "time": row["time"],
            "points": row["points"],
            "crew_size": total,
            "first_year_a": counts["first_year_a"],
            "second_year_a": counts["second_year_a"],
            "prior_a_history": counts["prior_a_history"],
            "prior_b_history": counts["prior_b_history"],
            "unknown": counts["unknown"],
            "crew": [
                {"name": name, "classification": classify_novice_a_paddler(name, event, history)}
                for name in row["crew"]
            ],
        }
        entries.append(entry)

        summary = club_summary[(event, row["club"])]
        summary["event"] = event
        summary["club"] = row["club"]
        summary["entries"] += 1
        summary["wins"] += 1 if row["place"] == 1 else 0
        summary["podiums"] += 1 if isinstance(row["place"], int) and row["place"] <= 3 else 0
        summary["paddler_appearances"] += total
        summary["first_year_a"] += counts["first_year_a"]
        summary["second_year_a"] += counts["second_year_a"]
        summary["prior_a_history"] += counts["prior_a_history"]
        summary["prior_b_history"] += counts["prior_b_history"]
        summary["unknown"] += counts["unknown"]
        summary["points"] += number(row["points"]) or 0.0
        for name in row["crew"]:
            key = person_key(name)
            if key:
                summary["unique_paddlers"][key] = classify_novice_a_paddler(name, event, history)

    teams = []
    for summary in club_summary.values():
        known = (
            summary["first_year_a"]
            + summary["second_year_a"]
            + summary["prior_a_history"]
            + summary["prior_b_history"]
        )
        summary["known_share"] = round(known / summary["paddler_appearances"], 3) if summary["paddler_appearances"] else 0
        summary["first_year_share"] = round(summary["first_year_a"] / summary["paddler_appearances"], 3) if summary["paddler_appearances"] else 0
        summary["second_year_share"] = round(summary["second_year_a"] / summary["paddler_appearances"], 3) if summary["paddler_appearances"] else 0
        unique_counts = Counter(summary["unique_paddlers"].values())
        summary["unique_paddler_count"] = sum(unique_counts.values())
        summary["unique_first_year_a"] = unique_counts["first_year_a"]
        summary["unique_second_year_a"] = unique_counts["second_year_a"]
        summary["unique_prior_a_history"] = unique_counts["prior_a_history"]
        summary["unique_prior_b_history"] = unique_counts["prior_b_history"]
        summary["unique_unknown"] = unique_counts["unknown"]
        del summary["unique_paddlers"]
        if summary["first_year_a"] > summary["second_year_a"]:
            summary["lean"] = "mostly_first_year_a"
        elif summary["second_year_a"] > summary["first_year_a"]:
            summary["lean"] = "mostly_second_year_a"
        else:
            summary["lean"] = "mixed_or_unknown"
        teams.append(summary)

    teams.sort(
        key=lambda item: (
            item["event"],
            item["points"],
            item["first_year_a"] + item["second_year_a"],
            item["entries"],
        ),
        reverse=True,
    )

    entries.sort(key=lambda item: (item["event"], item["race_id"], item["place"] or 999))
    return {"teams": teams, "entries": entries}


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit("Missing data/processed/results.json. Run scripts/parse_results.py first.")

    rows = json.loads(SOURCE.read_text(encoding="utf-8"))
    for row in rows:
        row["event_name"] = normalize_event_name(row["event_name"])
    core_rows = core_ohcra_rows(rows)

    analysis = {
        "metadata": {
            "current_season": CURRENT_SEASON,
            "prior_season": PRIOR_SEASON,
            "events": TARGET_EVENTS,
            "scope": "OHCRA season-standing races only",
            "source_rows": len(rows),
            "source_races": len({row["race_id"] for row in rows}),
            "rows": len(core_rows),
            "races": len({row["race_id"] for row in core_rows}),
            "excluded_special_races": special_race_summary(rows),
            "classification_notes": {
                "first_year_a": f"Appeared in the same-gender Novice B roster in {PRIOR_SEASON}.",
                "second_year_a": f"Appeared in the same-gender Novice A roster in {PRIOR_SEASON}.",
                "prior_a_history": f"Appeared in same-gender Novice A before {PRIOR_SEASON}.",
                "prior_b_history": f"Appeared in same-gender Novice B before {PRIOR_SEASON}.",
                "unknown": "No same-gender novice history found in the downloaded roster data.",
            },
        },
        "season_competitiveness": season_competitiveness(core_rows),
        "novice_b_pace": novice_b_pace(core_rows),
        "current_roster_composition": roster_composition(core_rows),
    }

    PROCESSED_DESTINATION.write_text(
        json.dumps(analysis, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    SITE_DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    SITE_DESTINATION.write_text(
        json.dumps(analysis, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("Wrote novice analysis")


if __name__ == "__main__":
    main()
