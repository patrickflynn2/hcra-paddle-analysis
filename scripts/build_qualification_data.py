"""Build Outrigger 2026 OHCRA state qualification watch data."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://www.hcrapaddler.com/hcra_results.php?view=bystanding&assoc_id=4&year=2026"
RAW_DESTINATION = ROOT / "data" / "raw" / "standings" / "ohcra_2026_standings.html"
PROCESSED_DESTINATION = ROOT / "data" / "processed" / "qualification.json"
SITE_DESTINATION = ROOT / "site" / "data" / "qualification.json"
OUTRIGGER = "Outrigger Canoe Club"


def clean(value: str) -> str:
    value = re.sub(r"<.*?>", "", value, flags=re.S)
    return html.unescape(" ".join(value.replace("\xa0", " ").split())).strip()


def number(value: str) -> int:
    value = clean(value)
    return int(value) if value.isdigit() else 0


def download_standings() -> str:
    request = Request(
        SOURCE_URL,
        headers={"User-Agent": "HCRA Paddle analysis portfolio project (educational use)"},
    )
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_standings(raw: str) -> dict[str, Any]:
    heading = re.search(r"Standings as of\s*([^<]+)", raw)
    race_map = re.search(r"R1=.*?R6=.*?</TD>", raw, flags=re.S)
    races = []
    if race_map:
        for race_number, name, date in re.findall(r"R(\d+)=(.*?)[(](\d{4}-\d{2}-\d{2})[)];", race_map.group(0)):
            races.append({"race_number": int(race_number), "race_name": clean(name), "date": date})

    parts = re.split(r"(?=<TH COLSPAN=3[^>]*>Event \d+:)|(?=<TR><TD WIDTH=40)", raw, flags=re.I)
    events: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    for part in parts:
        event_match = re.search(r"Event\s+(\d+):\s*([^<]+)", part, flags=re.I)
        if event_match:
            current = {
                "event_number": int(event_match.group(1)),
                "event_name": clean(event_match.group(2)),
                "standings": [],
            }
            events.append(current)

        if current is None:
            continue

        cells = re.findall(r"<TD[^>]*>(.*?)</TD>", part, flags=re.I | re.S)
        if len(cells) < 10:
            continue

        rank = number(cells[1])
        club = clean(cells[2]).rstrip("*")
        if not rank or not club:
            continue

        scores = [number(cell) for cell in cells[3:9]]
        current["standings"].append(
            {
                "rank": rank,
                "club": club,
                "raw_club": clean(cells[2]),
                "scores": scores,
                "total": number(cells[9]),
            }
        )

    return {
        "as_of": clean(heading.group(1)) if heading else "",
        "races": races,
        "events": events,
    }


def places_text(count: int) -> str:
    return "1 place" if count == 1 else f"{count} places"


def points_text(count: int) -> str:
    return "1 point" if count == 1 else f"{count} points"


def qualification_note(event: dict[str, Any], out: dict[str, Any]) -> tuple[str, str, str]:
    standings = event["standings"]
    field = len(standings)
    rank = out["rank"]
    total = out["total"]
    max_swing = max(field - 1, 0)

    if field <= 5 and rank <= 5:
        return (
            "safe",
            "Top-five spot is mathematically safe",
            "This event currently has five or fewer listed crews, so Outrigger is inside the state qualifying group. The final race is mainly about seed position.",
        )

    if rank <= 5:
        sixth = standings[5] if len(standings) > 5 else None
        if not sixth:
            return ("safe", "Top-five spot is mathematically safe", "No sixth-place challenger is listed in the current standings.")
        cushion = total - sixth["total"]
        if cushion > max_swing:
            return (
                "safe",
                "Top-five spot is mathematically safe",
                f"Outrigger leads sixth-place {sixth['club']} by {points_text(cushion)}. With {field} crews listed, that gap is too large to lose in one race.",
            )
        if cushion <= 0:
            return (
                "protecting",
                "Protecting a top-five spot",
                f"Outrigger is ranked {rank} but is tied or nearly tied with {sixth['club']}. A better OHCRA Championship finish than the closest challenger protects the qualifying spot.",
            )
        return (
            "protecting",
            "Protecting a top-five spot",
            f"Outrigger leads sixth-place {sixth['club']} by {points_text(cushion)}. To stay top five, avoid losing to {sixth['club']} by {places_text(cushion)} or more at OHCRA Championships.",
        )

    fifth = standings[4] if len(standings) >= 5 else None
    if not fifth:
        return ("unknown", "No cutoff found", "This event does not have a normal top-five cutoff in the current standings.")
    gap = fifth["total"] - total
    if gap > max_swing:
        return (
            "needs-help",
            "Needs outside help",
            f"Outrigger trails fifth-place {fifth['club']} by {points_text(gap)}. Even a win may not be enough without multiple teams near the cutoff finishing low or missing points.",
        )
    return (
        "chasing",
        "Chasing the top-five cutoff",
        f"Outrigger trails fifth-place {fifth['club']} by {points_text(gap)}. A finish at least {places_text(gap)} ahead of {fifth['club']} would create a tie or pass, and a total-points tie favors the better OHCRA Championship result.",
    )


def seed_note(event: dict[str, Any], out: dict[str, Any]) -> str:
    standings = event["standings"]
    field = len(standings)
    rank = out["rank"]
    total = out["total"]
    max_swing = max(field - 1, 0)

    if rank == 1:
        if len(standings) < 2:
            return "Outrigger is the only listed crew in this event."
        second = standings[1]
        lead = total - second["total"]
        if lead > max_swing:
            return f"First seed is safe: Outrigger leads {second['club']} by {points_text(lead)}, more than one race can swing."
        safe_margin = max(lead - 1, 0)
        if safe_margin:
            return f"Outrigger leads second-place {second['club']} by {points_text(lead)}. To keep first seed, finish within {places_text(safe_margin)} of {second['club']}."
        return f"Outrigger is tied for first on points. Beating the closest challenger at OHCRA Championships decides the top seed."

    above = standings[rank - 2] if rank > 1 else None
    below = standings[rank] if rank < len(standings) else None
    pieces = []
    if above:
        gap_up = above["total"] - total
        if gap_up <= 0:
            pieces.append(f"Tied on points with {above['club']}; beating them at OHCRA Championships can improve seed.")
        elif gap_up <= max_swing:
            pieces.append(f"Can improve seed by finishing at least {places_text(gap_up)} ahead of {above['club']}.")
    if below:
        cushion = total - below["total"]
        if cushion <= max_swing:
            pieces.append(f"Nearest seed threat is {below['club']}, {points_text(cushion)} back.")
    return " ".join(pieces) if pieces else "Seed position is relatively stable unless several nearby crews swing points at Championships."


def event_program(name: str) -> str:
    value = name.lower()
    if "mixed boys and girls" in value or "open keiki" in value:
        return "Youth"
    if re.search(r"\b(girls|boys)\b", value) and (
        "under" in value or re.search(r"\b(10|12|13|14|15|16|18)\b", value)
    ):
        return "Youth"
    if "novice" in value:
        return "Novice"
    if "mixed" in value:
        return "Mixed"
    if "master" in value or re.search(r"\b(40|50|55|60|65|70)\b", value):
        return "Masters"
    return "Open"
def build_watch(parsed: dict[str, Any]) -> dict[str, Any]:
    watch = []
    for event in parsed["events"]:
        out = next((row for row in event["standings"] if row["club"] == OUTRIGGER), None)
        if out is None:
            continue
        fifth = event["standings"][4] if len(event["standings"]) >= 5 else None
        sixth = event["standings"][5] if len(event["standings"]) >= 6 else None
        status, headline, note = qualification_note(event, out)
        watch.append(
            {
                "event_number": event["event_number"],
                "event_name": event["event_name"],
                "program": event_program(event["event_name"]),
                "field_size": len(event["standings"]),
                "rank": out["rank"],
                "total": out["total"],
                "scores": out["scores"],
                "status": status,
                "headline": headline,
                "qualification_note": note,
                "seed_note": seed_note(event, out),
                "cutoff": fifth,
                "first_chaser": sixth,
                "top_five": event["standings"][:5],
                "standings": event["standings"],
            }
        )

    status_order = {
        "chasing": 0,
        "needs-help": 1,
        "protecting": 2,
        "safe": 3,
        "unknown": 4,
    }
    watch.sort(key=lambda item: item["event_number"])
    return {
        "metadata": {
            "source_url": SOURCE_URL,
            "as_of": parsed["as_of"],
            "club": OUTRIGGER,
            "events": len(watch),
            "qualifying_cutoff": 5,
            "tie_breaker": "Better OHCRA Championship result wins a total-points tie.",
        },
        "races": parsed["races"],
        "watch": watch,
    }


def main() -> None:
    raw = download_standings()
    RAW_DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    RAW_DESTINATION.write_text(raw, encoding="utf-8")

    data = build_watch(parse_standings(raw))
    PROCESSED_DESTINATION.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    SITE_DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    SITE_DESTINATION.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote qualification watch for {data['metadata']['events']} Outrigger crews")


if __name__ == "__main__":
    main()





