"""Parse HCRA roster-by-place HTML snapshots into tidy race results."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
RACES_CSV = ROOT / "data" / "races.csv"
RAW_DIR = ROOT / "data" / "raw" / "html"
PROCESSED_DIR = ROOT / "data" / "processed"
EVENT_RE = re.compile(r"Event\s+(\d+):\s*(.+)")


def clean_text(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split())


def parse_time_seconds(value: str) -> float | None:
    value = clean_text(value)
    if not value:
        return None

    parts = value.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        return float(value)
    except ValueError:
        return None


def parse_place(value: str) -> tuple[int | None, str | None]:
    value = clean_text(value)
    if value.isdigit():
        return int(value), None
    return None, value or None


def split_crew(value: str) -> list[str]:
    value = clean_text(value).strip("()")
    if not value:
        return []
    return [name.strip() for name in value.split(",") if name.strip()]


def load_races() -> dict[str, dict[str, str]]:
    with RACES_CSV.open(newline="", encoding="utf-8") as file:
        return {row["race_id"]: row for row in csv.DictReader(file)}


def parse_race(path: Path, race: dict[str, str]) -> list[dict[str, Any]]:
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    header = soup.find("th", string=re.compile("Race Results for"))
    race_name = clean_text(header.get_text()).replace("Race Results for ", "") if header else ""

    rows: list[dict[str, Any]] = []
    current_event: dict[str, Any] | None = None
    last_result: dict[str, Any] | None = None

    for tr in soup.find_all("tr"):
        anchor = tr.find("a")
        if anchor and EVENT_RE.search(anchor.get_text(" ", strip=True)):
            match = EVENT_RE.search(anchor.get_text(" ", strip=True))
            assert match is not None
            current_event = {
                "event_number": int(match.group(1)),
                "event_name": clean_text(match.group(2)),
                "event_id": anchor.get("title", ""),
            }
            last_result = None
            continue

        cells = tr.find_all("td")
        if current_event is None or not cells:
            continue

        cell_text = [clean_text(cell.get_text(" ", strip=True)) for cell in cells]

        if len(cells) >= 5 and cells[1].get("colspan") is None:
            place, status = parse_place(cell_text[1])
            result = {
                "race_id": race["race_id"],
                "season": int(race["season"]),
                "race_name": race_name,
                "source_url": race["source_url"],
                **current_event,
                "place": place,
                "status": status,
                "club": cell_text[2],
                "entry_id": cells[2].get("title", ""),
                "time": cell_text[3],
                "time_seconds": parse_time_seconds(cell_text[3]),
                "points": float(cell_text[4]) if cell_text[4] else 0.0,
                "crew": [],
            }
            rows.append(result)
            last_result = result
            continue

        if last_result is not None and len(cells) >= 2 and cells[1].get("colspan"):
            last_result["crew"] = split_crew(cell_text[1])

    return rows


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    races = load_races()
    records: list[dict[str, Any]] = []

    for path in sorted(RAW_DIR.glob("race_*.html")):
        race_id = path.stem.replace("race_", "")
        if race_id not in races:
            print(f"Skipping {path.name}: race_id not in data/races.csv")
            continue
        records.extend(parse_race(path, races[race_id]))

    if not records:
        raise SystemExit("Parsed 0 rows. Check the raw HTML files and parser selectors.")

    csv_path = PROCESSED_DIR / "results.csv"
    json_path = PROCESSED_DIR / "results.json"

    fieldnames = [
        "race_id",
        "season",
        "race_name",
        "source_url",
        "event_number",
        "event_id",
        "event_name",
        "place",
        "status",
        "club",
        "entry_id",
        "time",
        "time_seconds",
        "points",
        "crew",
    ]

    with csv_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            row = {**record, "crew": "; ".join(record["crew"])}
            writer.writerow(row)

    json_path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {len(records):,} result rows")


if __name__ == "__main__":
    main()
