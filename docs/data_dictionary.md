# Data Dictionary

`data/processed/results.csv` and `data/processed/results.json` are expected to contain one row per club entry in one race event.

| Field | Description |
| --- | --- |
| `race_id` | HCRA race identifier from the source URL. |
| `season` | Season assigned in `data/races.csv`. |
| `race_name` | Race name shown in the HCRA page header. |
| `source_url` | Original HCRA roster-by-place result page. |
| `event_number` | Event number within the regatta. |
| `event_id` | HCRA event identifier from the page markup. |
| `event_name` | Division/event name, such as `Girls 10 & under`. |
| `place` | Numeric finish place when available. |
| `status` | Non-place status such as `DQ (OVR)` or `DQ (DNF)`. |
| `club` | Club name for the entry. |
| `entry_id` | HCRA entry identifier from the page markup. |
| `time` | Displayed result time. |
| `time_seconds` | Parsed numeric time in seconds, when available. |
| `points` | Points awarded for the entry. |
| `crew` | Crew names from the roster row. In CSV this is semicolon-delimited; in JSON this is an array. |
