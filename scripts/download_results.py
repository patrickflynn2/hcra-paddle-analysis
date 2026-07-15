"""Download HCRA race result pages as raw HTML snapshots."""

from __future__ import annotations

import csv
import time
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
RACES_CSV = ROOT / "data" / "races.csv"
RAW_DIR = ROOT / "data" / "raw" / "html"


def download(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "HCRA Paddle analysis portfolio project (educational use)"
        },
    )
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    with RACES_CSV.open(newline="", encoding="utf-8") as file:
        races = list(csv.DictReader(file))

    for index, race in enumerate(races, start=1):
        race_id = race["race_id"]
        destination = RAW_DIR / f"race_{race_id}.html"

        if destination.exists():
            print(f"[{index}/{len(races)}] race {race_id}: already downloaded")
            continue

        print(f"[{index}/{len(races)}] race {race_id}: downloading")
        html = download(race["source_url"])
        destination.write_text(html, encoding="utf-8")
        time.sleep(0.5)


if __name__ == "__main__":
    main()
