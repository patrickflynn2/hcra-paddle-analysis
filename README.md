# HCRA Paddle Race Analysis

An analysis and mobile-friendly data site for HCRA outrigger canoe race results from 2023 through part of 2026.

The project is organized so the data work is repeatable:

- `data/races.csv` lists the source race pages.
- `data/raw/html/` stores downloaded HTML snapshots.
- `data/processed/` stores cleaned CSV and JSON outputs.
- `scripts/` contains the download, parse, and site-data build scripts.
- `site/` contains the shareable static site.
- `notebooks/` is reserved for exploratory analysis.
- `docs/` is reserved for notes, data dictionary, and portfolio writeups.

## Recommended Setup

Install Python 3.11 or newer, then create a virtual environment:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Data Pipeline

Download the race pages:

```powershell
py scripts/download_results.py
```

Parse the raw HTML into tidy data:

```powershell
py scripts/parse_results.py
```

Copy the processed JSON into the static site:

```powershell
py scripts/build_site_data.py
```

Build the narrative analysis data:

```powershell
py scripts/build_analysis_data.py
```

Build the novice-specific story data:

```powershell
py scripts/build_novice_data.py
```

## Site

The shareable site lives in `site/` and is designed for GitHub Pages. It reads the prebuilt JSON files in `site/data/`, so the published site does not need a Python server.

Run it locally from the `site/` folder:

```powershell
cd site
py -m http.server 8000
```

Then open <http://localhost:8000/>.

## GitHub Pages

This repo includes `.github/workflows/pages.yml`, which publishes the `site/` folder whenever changes are pushed to the `main` branch. In the GitHub repo settings, set Pages to use **GitHub Actions** as the build and deployment source.

Because the public site needs static JSON to render, `site/data/*.json` is committed. Raw downloaded HTML and row-level processed data under `data/raw/` and `data/processed/` stay out of Git by default.

## Natural Language Q&A Later

The project is set up to support a future Q&A feature. A good next step would be to add a small API that translates user questions into safe dataframe queries or SQL over a local DuckDB database. That should come after the cleaned dataset and visual summaries are stable.

## Notes

This project currently keeps raw HTML and processed data out of Git through `.gitignore`. That is intentional while deciding whether roster names should be published. If you want the public portfolio to show only team-level analysis, keep the raw and processed row-level data out of the repo and publish aggregated site data instead.

