"""Build disqualification analysis data for the DQ story page."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "processed" / "results.json"
PROCESSED_DESTINATION = ROOT / "data" / "processed" / "dqs.json"
SITE_DESTINATION = ROOT / "site" / "data" / "dqs.json"
OUTRIGGER_CLUB = "Outrigger Canoe Club"
OUTRIGGER_SEASON = 2026

REASON_LABELS = {
    "BHV": "Behavior",
    "CLN": "Course lane",
    "CLS": "Course line start",
    "COL": "Collision",
    "DNF": "Did not finish",
    "EQP": "Equipment",
    "FGT": "Forgot requirement",
    "FLG": "Flag",
    "FWL": "False start waterline",
    "INT": "Interference",
    "LAN": "Lane violation",
    "NOS": "No show",
    "OVR": "Overlap",
    "PNE": "Paddler not eligible",
    "PNL": "Penalty",
    "RCI": "Race course infraction",
    "RCV": "Receiving assistance",
    "SWL": "Start waterline",
}


def special_race_type(race_name: str) -> str | None:
    value = race_name.lower()
    if "macfarlane" in value:
        return "macfarlane"
    if "hcra state championship" in value:
        return "states"
    return None


def normalize_event_name(name: str) -> str:
    value = name.replace("*", "").replace('"', "")
    value = re.sub(r"\s+", " ", value).strip()
    value = value.replace(" & Under", " & under")
    value = value.replace("Woman Masters", "Women Masters")
    value = value.replace("Woman Master", "Women Master")
    value = value.replace("Golden Masters", "Masters")
    value = value.replace("Senior Women Masters", "Women Masters")
    value = value.replace("Senior Men Masters", "Men Masters")
    value = value.replace(" yrs", " years")
    value = value.replace("(", "").replace(")", "")
    value = re.sub(r"\s+years", " years", value)
    return re.sub(r"\s+", " ", value).strip()


def event_program(name: str) -> str:
    value = normalize_event_name(name).lower()
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
    if value.startswith("special event"):
        return "special"
    return "open"


def dq_reason(status: str | None) -> tuple[str, str]:
    if not status or not status.upper().startswith("DQ"):
        return "", ""
    match = re.search(r"\(([^)]+)\)", status)
    code = match.group(1).strip().upper() if match else "Unspecified"
    return code, REASON_LABELS.get(code, "Unmapped DQ reason")


def is_dq(row: dict[str, Any]) -> bool:
    return str(row.get("status") or "").upper().startswith("DQ")


def counter_items(counter: Counter, count: int | None = None) -> list[dict[str, Any]]:
    items = counter.most_common(count)
    return [{"name": name, "count": value} for name, value in items]


def dq_rate(dq_count: int, entry_count: int) -> float:
    return round(dq_count / entry_count, 4) if entry_count else 0


def compact_record(row: dict[str, Any], races: dict[str, dict[str, Any]]) -> dict[str, Any]:
    reason_code, reason_label = dq_reason(row.get("status"))
    return {
        "race_id": row["race_id"],
        "season": row["season"],
        "race_name": row["race_name"],
        "race_type": races[row["race_id"]]["race_type"],
        "event_number": row["event_number"],
        "event_name": normalize_event_name(row["event_name"]),
        "program": event_program(row["event_name"]),
        "club": row["club"],
        "status": row.get("status"),
        "reason_code": reason_code,
        "reason_label": reason_label,
        "time": row.get("time") or "",
        "crew_count": len(row.get("crew") or []),
    }


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit("Missing data/processed/results.json. Run scripts/parse_results.py first.")

    source_rows = json.loads(SOURCE.read_text(encoding="utf-8-sig"))
    rows = [row for row in source_rows if special_race_type(row["race_name"]) is None]
    races: dict[str, dict[str, Any]] = {}
    race_entries: Counter[str] = Counter()
    club_entries: Counter[str] = Counter()
    club_season_entries: Counter[tuple[str, int]] = Counter()
    club_race_entries: Counter[tuple[str, str]] = Counter()

    for row in rows:
        race_id = row["race_id"]
        club = row.get("club") or ""
        race_entries[race_id] += 1
        if club:
            club_entries[club] += 1
            club_season_entries[(club, row["season"])] += 1
            club_race_entries[(club, race_id)] += 1
        races.setdefault(
            race_id,
            {
                "race_id": race_id,
                "season": row["season"],
                "race_name": row["race_name"],
                "race_type": special_race_type(row["race_name"]) or "season",
            },
        )

    dq_rows = [compact_record(row, races) for row in rows if is_dq(row)]

    dq_by_race: dict[str, dict[str, Any]] = {}
    for record in dq_rows:
        item = dq_by_race.setdefault(
            record["race_id"],
            {
                **races[record["race_id"]],
                "dq_count": 0,
                "entry_count": race_entries[record["race_id"]],
                "reason_counts": Counter(),
                "program_counts": Counter(),
            },
        )
        item["dq_count"] += 1
        item["reason_counts"][record["reason_code"]] += 1
        item["program_counts"][record["program"]] += 1

    race_summaries = []
    for item in dq_by_race.values():
        entry_count = item["entry_count"]
        race_summaries.append(
            {
                "race_id": item["race_id"],
                "season": item["season"],
                "race_name": item["race_name"],
                "race_type": item["race_type"],
                "dq_count": item["dq_count"],
                "entry_count": entry_count,
                "dq_rate": dq_rate(item["dq_count"], entry_count),
                "reasons": counter_items(item["reason_counts"]),
                "top_reasons": counter_items(item["reason_counts"], 4),
                "top_programs": counter_items(item["program_counts"], 4),
            }
        )

    club_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    reason_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in dq_rows:
        club_groups[record["club"]].append(record)
        reason_groups[record["reason_code"]].append(record)

    club_summaries = []
    for club, records in club_groups.items():
        event_counts = Counter(f"{record['event_name']} ({record['season']})" for record in records)
        reason_counts = Counter(record["reason_code"] for record in records)
        race_counts = Counter(f"{record['race_name']} ({record['season']})" for record in records)
        entry_count = club_entries[club]
        club_summaries.append(
            {
                "club": club,
                "dq_count": len(records),
                "entry_count": entry_count,
                "dq_rate": dq_rate(len(records), entry_count),
                "events": counter_items(event_counts, 10),
                "reasons": counter_items(reason_counts, 8),
                "races": counter_items(race_counts, 6),
                "records": sorted(records, key=lambda item: (item["season"], item["race_id"], item["event_number"])),
            }
        )

    reason_summaries = []
    for code, records in reason_groups.items():
        event_counts = Counter(f"{record['event_name']} ({record['season']})" for record in records)
        club_counts = Counter(record["club"] for record in records)
        year_counts = Counter(record["season"] for record in records)
        reason_summaries.append(
            {
                "code": code,
                "label": REASON_LABELS.get(code, "Unmapped DQ reason"),
                "dq_count": len(records),
                "share": round(len(records) / len(dq_rows), 4) if dq_rows else 0,
                "by_year": [
                    {"season": season, "count": year_counts[season]}
                    for season in sorted(year_counts)
                ],
                "top_events": counter_items(event_counts, 8),
                "top_clubs": counter_items(club_counts, 8),
                "examples": sorted(records, key=lambda item: (item["season"], item["race_id"], item["event_number"]))[:6],
            }
        )

    outrigger_records = [
        record for record in dq_rows
        if record["club"] == OUTRIGGER_CLUB and record["season"] == OUTRIGGER_SEASON
    ]
    outrigger_race_counts = Counter(record["race_id"] for record in outrigger_records)
    outrigger_reason_counts = Counter(record["reason_code"] for record in outrigger_records)
    outrigger_event_counts = Counter(record["event_name"] for record in outrigger_records)
    outrigger_races = []
    for race_id, race in sorted(races.items(), key=lambda item: (item[1]["season"], item[0])):
        if race["season"] != OUTRIGGER_SEASON:
            continue
        entry_count = club_race_entries[(OUTRIGGER_CLUB, race_id)]
        if entry_count == 0:
            continue
        count = outrigger_race_counts[race_id]
        outrigger_races.append(
            {
                **race,
                "entry_count": entry_count,
                "dq_count": count,
                "dq_rate": dq_rate(count, entry_count),
            }
        )

    yearly_counts = Counter(record["season"] for record in dq_rows)
    program_counts = Counter(record["program"] for record in dq_rows)

    data = {
        "metadata": {
            "rows": len(rows),
            "source_rows": len(source_rows),
            "scope": "OHCRA season-standing races only",
            "dq_count": len(dq_rows),
            "races": len(races),
            "races_with_dqs": len(dq_by_race),
            "clubs_with_dqs": len(club_groups),
            "events_with_dqs": len({record["event_name"] for record in dq_rows}),
            "seasons": sorted({row["season"] for row in rows}),
        },
        "yearly_totals": [
            {"season": season, "dq_count": yearly_counts[season]}
            for season in sorted(yearly_counts)
        ],
        "reason_legend": [
            {"code": code, "label": label}
            for code, label in sorted(REASON_LABELS.items())
            if any(record["reason_code"] == code for record in dq_rows)
        ],
        "program_totals": counter_items(program_counts, 10),
        "races": sorted(race_summaries, key=lambda item: (item["season"], item["race_id"])),
        "races_ranked": sorted(race_summaries, key=lambda item: (item["dq_count"], item["dq_rate"]), reverse=True),
        "clubs": sorted(club_summaries, key=lambda item: (item["dq_count"], item["dq_rate"]), reverse=True),
        "clubs_by_rate": sorted(club_summaries, key=lambda item: (item["dq_rate"], item["dq_count"]), reverse=True),
        "reasons": sorted(reason_summaries, key=lambda item: item["dq_count"], reverse=True),
        "outrigger_2026": {
            "club": OUTRIGGER_CLUB,
            "season": OUTRIGGER_SEASON,
            "dq_count": len(outrigger_records),
            "entry_count": club_season_entries[(OUTRIGGER_CLUB, OUTRIGGER_SEASON)],
            "dq_rate": dq_rate(len(outrigger_records), club_season_entries[(OUTRIGGER_CLUB, OUTRIGGER_SEASON)]),
            "races": outrigger_races,
            "reasons": counter_items(outrigger_reason_counts),
            "events": counter_items(outrigger_event_counts),
            "records": sorted(outrigger_records, key=lambda item: (item["race_id"], item["event_number"])),
        },
        "records": sorted(dq_rows, key=lambda item: (item["season"], item["race_id"], item["event_number"], item["club"])),
    }

    PROCESSED_DESTINATION.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    SITE_DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    SITE_DESTINATION.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {data['metadata']['dq_count']} DQ rows across {data['metadata']['races_with_dqs']} races")


if __name__ == "__main__":
    main()



