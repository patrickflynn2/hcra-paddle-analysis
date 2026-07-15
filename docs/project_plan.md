# Project Plan

## Phase 1: Data Collection

- Use `data/races.csv` as the source manifest.
- Run `scripts/download_results.py` to save each HCRA result page as an HTML snapshot.
- Keep raw downloads local unless you decide the roster-level data should be committed publicly.

## Phase 2: Cleaning

- Run `scripts/parse_results.py` to create `data/processed/results.csv` and `data/processed/results.json`.
- Validate row counts by race and event.
- Review special statuses such as `DQ (OVR)`, `DQ (DNF)`, and other non-numeric places.
- Decide whether crew names should be included in the public website or removed for privacy.

## Phase 3: Exploration

Suggested questions:

- Which clubs score the most points by season?
- Which clubs are strongest in youth, open, masters, and mixed events?
- Which events have the tightest winning margins?
- How does participation vary by event and year?
- Which clubs are improving across seasons?

## Phase 4: Static Site

- Use the generated JSON in `site/data/results.json`.
- Start with club, season, race, and event filters.
- Add mobile-first summary cards and sortable tables.
- Add charts after the cleaned data has been validated.

## Phase 5: Natural Language Q&A

Add this after the static analysis is stable. Recommended path:

- Load cleaned results into DuckDB or SQLite.
- Define a small set of safe query templates or dataframe tools.
- Use an LLM only to map questions onto those approved tools.
- Return cited rows, aggregate numbers, and plain-English explanations.
