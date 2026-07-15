"""Build year-by-year Macfarlane program and lane analysis data."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "data" / "processed" / "results.json"
PROCESSED = ROOT / "data" / "processed" / "macfarlane.json"
SITE = ROOT / "site" / "data" / "macfarlane.json"
RACES = {2023: "932", 2024: "1011", 2025: "1086", 2026: "1197"}
CLUBS = [
    "Outrigger Canoe Club",
    "Lanikai Canoe Club",
    "Keahiakahoe Canoe Club",
    "Hui Nalu Canoe Club",
]
CATEGORIES = ["youth", "novice", "open", "masters", "mixed"]


def event_category(name: str) -> str:
    value = re.sub(r"\s+", " ", name.replace("*", "")).strip().lower()
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
    if "master" in value or re.search(r"\b(40|50|55|60|65|70)\b", value):
        return "masters"
    return "open"


def lane_assignments(year: int) -> dict[tuple[int, str], int]:
    source = ROOT / "data" / "raw" / "html" / f"macfarlane_{year}_bylane.html"
    soup = BeautifulSoup(source.read_text(encoding="utf-8", errors="replace"), "html.parser")
    assignments: dict[tuple[int, str], int] = {}
    current_event = None
    table = soup.select_one("table.eventbylane")
    if table is None:
        raise ValueError(f"No lane table found for {year}")
    for row in table.find_all("tr"):
        heading = row.find("th")
        if heading:
            match = re.search(r"Event\s+(\d+):", heading.get_text(" ", strip=True))
            if match:
                current_event = int(match.group(1))
            continue
        cells = row.find_all("td")
        if current_event is None or len(cells) < 5:
            continue
        lane_text = cells[1].get_text(" ", strip=True)
        club = cells[4].get_text(" ", strip=True)
        if lane_text.isdigit() and club:
            assignments[(current_event, club)] = int(lane_text)
    return assignments


def build() -> dict:
    rows = json.loads(RESULTS.read_text(encoding="utf-8"))
    output = {"years": {}}
    for year, race_id in RACES.items():
        race_rows = [
            row for row in rows
            if row["season"] == year and row["race_id"] == race_id and row.get("status") != "UnO"
        ]
        assignments = lane_assignments(year)

        composition = {
            club: {category: 0 for category in CATEGORIES}
            for club in CLUBS
        }
        for row in race_rows:
            if row["club"] in composition:
                composition[row["club"]][event_category(row["event_name"])] += round(row["points"])

        event_fields = defaultdict(int)
        for row in race_rows:
            event_fields[row["event_number"]] += 1

        lanes = defaultdict(lambda: {
            "entries": 0, "finishes": 0, "wins": 0, "podiums": 0,
            "dqs": 0, "place_sum": 0, "percentile_sum": 0,
        })
        unmatched = 0
        for row in race_rows:
            lane = assignments.get((row["event_number"], row["club"]))
            if lane is None:
                unmatched += 1
                continue
            item = lanes[lane]
            item["entries"] += 1
            place = row.get("place")
            if place is None:
                item["dqs"] += 1
                continue
            field = event_fields[row["event_number"]]
            percentile = 100 if field <= 1 else 100 * (field - place) / (field - 1)
            item["finishes"] += 1
            item["place_sum"] += place
            item["percentile_sum"] += percentile
            item["wins"] += int(place == 1)
            item["podiums"] += int(place <= 3)

        lane_rows = []
        for lane in sorted(lanes):
            item = lanes[lane]
            finishes = item["finishes"]
            entries = item["entries"]
            lane_rows.append({
                "lane": lane,
                "entries": entries,
                "finishes": finishes,
                "wins": item["wins"],
                "podiums": item["podiums"],
                "dqs": item["dqs"],
                "average_place": round(item["place_sum"] / finishes, 2) if finishes else None,
                "finish_percentile": round(item["percentile_sum"] / finishes, 1) if finishes else None,
                "win_rate": round(100 * item["wins"] / entries, 1) if entries else 0,
                "podium_rate": round(100 * item["podiums"] / entries, 1) if entries else 0,
            })

        output["years"][str(year)] = {
            "race_id": race_id,
            "composition": [
                {"club": club, "total": sum(composition[club].values()), **composition[club]}
                for club in CLUBS
            ],
            "lanes": lane_rows,
            "source_url": f"https://www.hcrapaddler.com/hcra_results.php?rid={race_id}&view=bylane",
            "unmatched_entries": unmatched,
        }
    return output


if __name__ == "__main__":
    data = build()
    encoded = json.dumps(data, indent=2) + "\n"
    PROCESSED.write_text(encoded, encoding="utf-8")
    SITE.write_text(encoded, encoding="utf-8")
    print(f"Wrote {PROCESSED} and {SITE}")
