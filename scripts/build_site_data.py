"""Copy processed data into the static site."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "processed" / "results.json"
DESTINATION = ROOT / "site" / "data" / "results.json"


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit("Missing data/processed/results.json. Run scripts/parse_results.py first.")

    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE, DESTINATION)
    print(f"Copied {SOURCE} to {DESTINATION}")


if __name__ == "__main__":
    main()
