"""Build aggregate analysis data for the narrative site page."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from statistics import mean
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "processed" / "results.json"
PROCESSED_DESTINATION = ROOT / "data" / "processed" / "analysis.json"
SITE_DESTINATION = ROOT / "site" / "data" / "analysis.json"
CATEGORIES = ["youth", "novice", "open", "masters", "mixed"]
SPECIAL_RACE_PATTERNS = [
    ("macfarlane", "Walter J. MacFarlane Regatta"),
    ("states", "HCRA State Championship"),
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
    value = value.replace(" & Under", " & under")
    value = value.replace(" under", " under")
    value = value.replace("Woman Masters", "Women Masters")
    value = value.replace("Woman Master", "Women Master")
    value = value.replace("Golden Masters", "Masters")
    value = value.replace("Senior Women Masters", "Women Masters")
    value = value.replace("Senior Men Masters", "Men Masters")
    value = value.replace(" yrs", " years")
    value = value.replace("(", "").replace(")", "")
    value = re.sub(r"\s+years", " years", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def event_category(name: str) -> str:
    value = normalize_event_name(name).lower()

    if value.startswith("special event"):
        return "other"
    if "mixed boys and girls" in value or "open keiki" in value:
        return "youth"
    if re.search(r"\b(girls|boys)\b", value) and (
        "under" in value or re.search(r"\b(10|12|13|14|15|16|18)\b", value)
    ):
        return "youth"
    if "novice" in value:
        return "novice"
    if "mixed" in value:
        return "mixed"
    if "master" in value or re.search(r"\b(40|50|55|60|65|70) years\b", value):
        return "masters"
    return "open"


def number(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    return float(value)


def top(items: list[dict[str, Any]], count: int) -> list[dict[str, Any]]:
    return items[:count]


def build_strength_profiles(rows: list[dict[str, Any]]) -> dict[str, Any]:
    clubs: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "club": "",
            "total_points": 0.0,
            "total_entries": 0,
            "categories": {
                category: {"points": 0.0, "entries": 0, "wins": 0, "podiums": 0}
                for category in CATEGORIES
            },
        }
    )

    for row in rows:
        category = event_category(row["event_name"])
        if category not in CATEGORIES:
            continue

        club = row["club"]
        place = row["place"]
        points = number(row["points"])
        profile = clubs[club]
        profile["club"] = club
        profile["total_points"] += points
        profile["total_entries"] += 1
        profile["categories"][category]["points"] += points
        profile["categories"][category]["entries"] += 1
        if place == 1:
            profile["categories"][category]["wins"] += 1
        if isinstance(place, int) and place <= 3:
            profile["categories"][category]["podiums"] += 1

    profiles = []
    for profile in clubs.values():
        if profile["total_entries"] == 0:
            continue
        category_points = [
            profile["categories"][category]["points"] for category in CATEGORIES
        ]
        profile["primary_category"] = CATEGORIES[
            max(range(len(CATEGORIES)), key=lambda index: category_points[index])
        ]
        profile["primary_share"] = (
            max(category_points) / profile["total_points"] if profile["total_points"] else 0
        )
        profiles.append(profile)

    leaders = {}
    for category in CATEGORIES:
        leaders[category] = top(
            sorted(
                [
                    {
                        "club": profile["club"],
                        **profile["categories"][category],
                        "points_per_entry": (
                            profile["categories"][category]["points"]
                            / profile["categories"][category]["entries"]
                            if profile["categories"][category]["entries"]
                            else 0
                        ),
                    }
                    for profile in profiles
                    if profile["categories"][category]["entries"] >= 5
                ],
                key=lambda item: (
                    item["points"],
                    item["points_per_entry"],
                    item["podiums"],
                ),
                reverse=True,
            ),
            8,
        )

    return {
        "profiles": sorted(profiles, key=lambda item: item["total_points"], reverse=True),
        "leaders": leaders,
    }


def build_category_win_rates(rows: list[dict[str, Any]]) -> dict[str, Any]:
    event_groups: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        event_groups[(row["race_id"], row["event_number"])].append(row)

    season_category_totals: dict[tuple[int, str], dict[str, Any]] = defaultdict(
        lambda: {"race_ids": set(), "events": 0}
    )
    club_year_category: dict[tuple[str, int, str], dict[str, Any]] = defaultdict(
        lambda: {"club": "", "season": 0, "category": "", "wins": 0}
    )

    for group in event_groups.values():
        sample = group[0]
        category = event_category(sample["event_name"])
        if category not in CATEGORIES:
            continue

        season = sample["season"]
        race_id = sample["race_id"]
        season_category_totals[(season, category)]["race_ids"].add(race_id)
        season_category_totals[(season, category)]["events"] += 1

        winners = [row for row in group if row["place"] == 1]
        if not winners:
            continue

        winner = winners[0]
        key = (winner["club"], season, category)
        club_year_category[key]["club"] = winner["club"]
        club_year_category[key]["season"] = season
        club_year_category[key]["category"] = category
        club_year_category[key]["wins"] += 1

    seasons = sorted({row["season"] for row in rows})
    clubs = sorted({row["club"] for row in rows if row["club"]})
    profiles = []

    for club in clubs:
        profile = {
            "club": club,
            "total_wins": 0,
            "total_average_wins": 0.0,
            "categories": {category: [] for category in CATEGORIES},
        }

        for category in CATEGORIES:
            for season in seasons:
                totals = season_category_totals.get((season, category))
                if not totals:
                    continue

                race_count = len(totals["race_ids"])
                total_events = totals["events"]
                wins = club_year_category.get((club, season, category), {}).get("wins", 0)
                average_wins = wins / race_count if race_count else 0
                average_events = total_events / race_count if race_count else 0
                win_share = wins / total_events if total_events else 0

                profile["categories"][category].append(
                    {
                        "season": season,
                        "races": race_count,
                        "wins": wins,
                        "total_events": total_events,
                        "average_wins": round(average_wins, 2),
                        "average_events": round(average_events, 2),
                        "win_share": round(win_share, 3),
                    }
                )
                profile["total_wins"] += wins
                profile["total_average_wins"] += average_wins

        if profile["total_wins"]:
            profiles.append(profile)

    profiles.sort(key=lambda item: (item["total_wins"], item["total_average_wins"]), reverse=True)
    return {"clubs": profiles, "seasons": seasons, "categories": CATEGORIES}


def build_category_result_rates(rows: list[dict[str, Any]]) -> dict[str, Any]:
    event_groups: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        event_groups[(row["race_id"], row["event_number"])].append(row)

    season_category_totals: dict[tuple[int, str], dict[str, Any]] = defaultdict(
        lambda: {"race_ids": set(), "events": 0}
    )
    club_year_category: dict[tuple[str, int, str], dict[str, Any]] = defaultdict(
        lambda: {"wins": 0, "podiums": 0}
    )

    for group in event_groups.values():
        sample = group[0]
        category = event_category(sample["event_name"])
        if category not in CATEGORIES:
            continue

        season = sample["season"]
        race_id = sample["race_id"]
        season_category_totals[(season, category)]["race_ids"].add(race_id)
        season_category_totals[(season, category)]["events"] += 1

        for row in group:
            if not row.get("club"):
                continue
            key = (row["club"], season, category)
            if row["place"] == 1:
                club_year_category[key]["wins"] += 1
            if isinstance(row["place"], int) and row["place"] <= 3:
                club_year_category[key]["podiums"] += 1

    seasons = sorted({row["season"] for row in rows})
    clubs = sorted({row["club"] for row in rows if row["club"]})
    win_profiles = []
    podium_profiles = []

    for club in clubs:
        win_profile = {
            "club": club,
            "total_wins": 0,
            "total_average_wins": 0.0,
            "categories": {category: [] for category in CATEGORIES},
        }
        podium_profile = {
            "club": club,
            "total_podiums": 0,
            "total_average_podiums": 0.0,
            "overall_podium_share": 0.0,
            "categories": {category: [] for category in CATEGORIES},
        }
        podium_slots_captured = 0
        podium_slots_available = 0

        for category in CATEGORIES:
            for season in seasons:
                totals = season_category_totals.get((season, category))
                if not totals:
                    continue

                race_count = len(totals["race_ids"])
                total_events = totals["events"]
                podium_slots = total_events * 3
                values = club_year_category.get((club, season, category), {})
                wins = values.get("wins", 0)
                podiums = values.get("podiums", 0)
                average_wins = wins / race_count if race_count else 0
                average_podiums = podiums / race_count if race_count else 0
                average_events = total_events / race_count if race_count else 0
                average_podium_slots = podium_slots / race_count if race_count else 0
                win_share = wins / total_events if total_events else 0
                podium_share = podiums / podium_slots if podium_slots else 0

                win_profile["categories"][category].append(
                    {
                        "season": season,
                        "races": race_count,
                        "wins": wins,
                        "total_events": total_events,
                        "average_wins": round(average_wins, 2),
                        "average_events": round(average_events, 2),
                        "win_share": round(win_share, 3),
                    }
                )
                podium_profile["categories"][category].append(
                    {
                        "season": season,
                        "races": race_count,
                        "podiums": podiums,
                        "total_events": total_events,
                        "podium_slots": podium_slots,
                        "average_podiums": round(average_podiums, 2),
                        "average_events": round(average_events, 2),
                        "average_podium_slots": round(average_podium_slots, 2),
                        "podium_share": round(podium_share, 3),
                    }
                )
                win_profile["total_wins"] += wins
                win_profile["total_average_wins"] += average_wins
                podium_profile["total_podiums"] += podiums
                podium_profile["total_average_podiums"] += average_podiums
                podium_slots_captured += podiums
                podium_slots_available += podium_slots

        if win_profile["total_wins"]:
            win_profiles.append(win_profile)
        if podium_profile["total_podiums"]:
            podium_profile["overall_podium_share"] = round(
                podium_slots_captured / podium_slots_available, 3
            ) if podium_slots_available else 0
            podium_profiles.append(podium_profile)

    win_profiles.sort(key=lambda item: (item["total_wins"], item["total_average_wins"]), reverse=True)
    podium_profiles.sort(
        key=lambda item: (item["overall_podium_share"], item["total_podiums"], item["total_average_podiums"]),
        reverse=True,
    )
    return {
        "wins": {"clubs": win_profiles, "seasons": seasons, "categories": CATEGORIES},
        "podiums": {"clubs": podium_profiles, "seasons": seasons, "categories": CATEGORIES},
    }
def build_specializations(profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    specializations = []
    for profile in profiles:
        if profile["total_points"] < 20:
            continue
        for category in CATEGORIES:
            category_data = profile["categories"][category]
            if category_data["points"] < 12 or category_data["entries"] < 5:
                continue
            share = category_data["points"] / profile["total_points"]
            specializations.append(
                {
                    "club": profile["club"],
                    "category": category,
                    "share": share,
                    "points": category_data["points"],
                    "entries": category_data["entries"],
                    "wins": category_data["wins"],
                    "podiums": category_data["podiums"],
                    "total_points": profile["total_points"],
                }
            )

    return top(
        sorted(
            specializations,
            key=lambda item: (item["share"], item["points"], item["podiums"]),
            reverse=True,
        ),
        18,
    )


def result_groups(rows: list[dict[str, Any]]) -> dict[tuple[str, int], list[dict[str, Any]]]:
    groups: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if row["place"] is None or row["time_seconds"] is None:
            continue
        groups[(row["race_id"], row["event_number"])].append(row)
    return groups


def build_margins(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    race_margins = []
    event_margins: dict[str, list[float]] = defaultdict(list)
    event_examples: dict[str, dict[str, Any]] = {}

    for group in result_groups(rows).values():
        ordered = sorted(group, key=lambda row: row["place"])
        if len(ordered) < 2 or ordered[0]["place"] != 1 or ordered[1]["place"] != 2:
            continue
        margin = ordered[1]["time_seconds"] - ordered[0]["time_seconds"]
        if margin < 0:
            continue

        event_name = normalize_event_name(ordered[0]["event_name"])
        item = {
            "race_id": ordered[0]["race_id"],
            "season": ordered[0]["season"],
            "race_name": ordered[0]["race_name"],
            "event_name": event_name,
            "category": event_category(event_name),
            "winner": ordered[0]["club"],
            "runner_up": ordered[1]["club"],
            "winning_time": ordered[0]["time"],
            "runner_up_time": ordered[1]["time"],
            "margin_seconds": round(margin, 2),
        }
        race_margins.append(item)
        event_margins[event_name].append(margin)

        if event_name not in event_examples or margin < event_examples[event_name]["margin_seconds"]:
            event_examples[event_name] = item

    average_margins = [
        {
            "event_name": event_name,
            "category": event_category(event_name),
            "races": len(margins),
            "average_margin_seconds": round(mean(margins), 2),
            "closest_margin_seconds": round(min(margins), 2),
            "closest_example": event_examples[event_name],
        }
        for event_name, margins in event_margins.items()
        if len(margins) >= 3
    ]

    return (
        top(sorted(race_margins, key=lambda item: item["margin_seconds"]), 20),
        top(
            sorted(
                average_margins,
                key=lambda item: (item["average_margin_seconds"], -item["races"]),
            ),
            24,
        ),
    )


def build_fastest_winners(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fastest: dict[str, dict[str, Any]] = {}

    for row in rows:
        if row["place"] != 1 or row["time_seconds"] is None:
            continue

        event_name = normalize_event_name(row["event_name"])
        item = {
            "event_name": event_name,
            "category": event_category(event_name),
            "club": row["club"],
            "season": row["season"],
            "race_name": row["race_name"],
            "race_id": row["race_id"],
            "time": row["time"],
            "time_seconds": row["time_seconds"],
        }
        if event_name not in fastest or row["time_seconds"] < fastest[event_name]["time_seconds"]:
            fastest[event_name] = item

    return sorted(fastest.values(), key=lambda item: (item["category"], item["event_name"]))


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit("Missing data/processed/results.json. Run scripts/parse_results.py first.")

    rows = json.loads(SOURCE.read_text(encoding="utf-8"))
    for row in rows:
        row["event_name"] = normalize_event_name(row["event_name"])

    core_rows = core_ohcra_rows(rows)
    strength = build_strength_profiles(core_rows)
    closest_races, average_margins = build_margins(core_rows)

    category_results = build_category_result_rates(core_rows)

    analysis = {
        "metadata": {
            "rows": len(core_rows),
            "races": len({row["race_id"] for row in core_rows}),
            "clubs": len({row["club"] for row in core_rows if row["club"]}),
            "events": len({normalize_event_name(row["event_name"]) for row in core_rows}),
            "seasons": sorted({row["season"] for row in core_rows}),
            "scope": "OHCRA season-standing races only",
            "source_rows": len(rows),
            "source_races": len({row["race_id"] for row in rows}),
            "excluded_special_races": special_race_summary(rows),
        },
        "club_strength": strength,
        "club_category_win_rates": category_results["wins"],
        "club_category_podium_rates": category_results["podiums"],
        "specializations": build_specializations(strength["profiles"]),
        "closest_races": closest_races,
        "average_margins_by_event": average_margins,
        "fastest_winning_times": build_fastest_winners(core_rows),
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
    print(f"Wrote analysis for {analysis['metadata']['races']} races")


if __name__ == "__main__":
    main()


