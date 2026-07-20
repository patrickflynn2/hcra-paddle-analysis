# Live race-day page structure analysis

Observed July 19, 2026 from the public [OHCRA Championships Event by Place page](https://www.hcrapaddler.com/hcra_results.php?view=byevent&rid=1199). This review intentionally examines the page structure and update behavior, not the competitive results.

## Bottom line

A live race-day feature is feasible, and HCRA has already exposed most of the machinery needed to build one well. The best approach is **not** to scrape this HTML page as the primary data source. HCRA publishes a read-only JSON API with events, lanes, individual race results, and—most importantly—a regatta-level result-updates endpoint. The HTML page is still useful as the authoritative public reference and as a fallback.

The current page is practical on race day but optimized as a continuously updating results sheet rather than as a spectator dashboard. Our site could add value with a clearer event status, a focused “latest completed race” view, club points movement, and a compact race-day timeline while always linking back to HCRA as the official source.

## What the page does

### 1. It is one server-rendered table

The page is a single HTML form containing one large table. Its top row contains the regatta name and a view selector. The selector submits the same page with a different `view` query parameter.

Available views include:

- Event by Place
- Event by Lane
- Club by Division and Club Details by Division
- Medal Table
- Cumulative Points, including division-specific versions
- Roster by Lane and Roster by Place
- Regatta Results Trivia

This is useful architecture for officials and experienced users because all views share the same regatta identifier (`rid=1199`). For casual spectators, however, it creates a very long page and requires them to understand which view answers their question.

### 2. Every scheduled event is present before it is raced

Each event has a dark header row followed by all entered clubs. The event header contains:

- the event number and name;
- an event/race ID stored in the anchor's `title` attribute;
- a dedicated protest-timer cell whose ID follows `tm{race_id}`;
- Time and Points column headings.

Before results are posted, entries remain in their scheduled order with place `0`, a blank time, and `0` points. Once results are posted, the same block changes to places or status codes, times, and points. The winning crew's paddler names appear in a separate row immediately after the first result.

That means the page itself represents several states without explicitly naming all of them:

1. **Scheduled / awaiting results** — entries exist, but times are blank and places are zero.
2. **Unofficial / protest open** — result rows are populated and the event header has a green countdown.
3. **Official** — result rows remain populated and the countdown is absent.
4. **Special result status** — codes such as `DQ`, `SCR`, or `UnO` appear in the place column.

For a new feature, these states should be modeled explicitly rather than inferred only from a color or a single cell.

### 3. The live behavior is simple and effective

The source includes JavaScript that:

- stores the exact page URL;
- saves horizontal and vertical scroll position before the page unloads;
- restores that position after loading;
- reloads the page every 30 seconds;
- updates active protest countdowns once per second.

The server emits timer instructions only for races that currently have an active countdown. On the observation used for this report, `setTimers()` contained two active race IDs. Each countdown was expressed as a duration from the moment the page loaded, and the 30-second page reload obtained a fresh duration from the server.

This is an important detail: the browser is not receiving a push notification when results change. It polls by reloading the complete HTML document. The timer is also not a durable status record; it is a client display reconstructed on every refresh.

### 4. There are useful stable-looking identifiers, but the markup is brittle

The markup contains three valuable numeric identifiers:

- regatta ID in the URL and hidden form input;
- race/event ID in each event heading;
- crew/entry ID in the club cell's `title` attribute.

Those are better keys than event names or club text. Still, a scraper would be fragile because:

- semantic data is stored in presentation attributes such as `title`;
- event state is implied by combinations of blank fields, zeroes, status codes, and timer presence;
- column positions depend on `colspan` values;
- the document repeats `id="demo"`, even though HTML IDs should be unique;
- styles are inline and the green color is being used as status information;
- result and winning-crew rows have different shapes;
- spelling and naming variations may occur in event and club labels.

If HTML parsing is ever required, it should validate the expected regatta ID, race IDs, row counts, and time formats, and it should fail visibly rather than silently publishing questionable data.

## Better source: the official HCRA API

HCRA's public [API documentation](https://www.hcrapaddler.com/api/v1/hcra_api_doc.html) describes read-only JSON endpoints for regattas, events, lanes, crews, and results. It also documents:

- `GET /api/v1/results/updates/{REGATTA_ID}?after={EPOCH_TS}` to learn which races changed;
- `GET /api/v1/results/race/{RACE_ID}` to retrieve the affected race results.

The documented API requires an `x-api-key`. Test keys are limited to 500 calls per day and 10 calls per minute; the documentation says to contact HCRA for production limits.

This changes the recommendation substantially. A future implementation should use the update endpoint to discover changed races, then fetch only those races. At a 30-second cadence, a full race day would exceed the test-key daily quota, so production permission and limits should be agreed with HCRA before launch. The API key should be held in a small server-side job or GitHub-hosted process—not embedded in browser JavaScript where every visitor can see it.

One item still needs confirmation: whether the API result payload exposes the protest deadline or explicit official/unofficial status. The documented result example covers place, club, time, points, and paddlers, but not the countdown. If status is absent, we should ask HCRA to expose it rather than treating a scraped green timer as a long-term contract.

## Recommended race-day experience

I would build a compact page around the question, “What just happened, and what is happening next?”

### Primary display

- **Now / next event:** current event number and name, with the next scheduled event beneath it.
- **Latest result card:** top finishers, clearly labeled `Unofficial — protest window open` or `Official`.
- **Protest countdown:** text plus time, not green alone; when it expires, show `Awaiting official confirmation` until the source confirms the state.
- **Club points race:** an updating ranked chart that animates only when official point totals change.
- **Event navigator:** Completed, In protest, and Upcoming filters so users do not have to scroll through all events.
- **Last checked:** a visible Hawaii-time timestamp and a direct link to the HCRA source.

### Trust and clarity rules

- Never call a result official merely because a local countdown reached zero.
- Recompute countdowns from a deadline when possible; do not rely on decrementing a number forever in a background tab.
- Keep unofficial and official results visually distinct and accessible without relying on color.
- Preserve the last good snapshot if HCRA is briefly unavailable, but mark it stale.
- Record status transitions so a correction, DQ, or protest change does not look like a data error.
- Treat HCRA as the authority and our page as a presentation layer.

## Suggested technical flow

```text
HCRA result-updates endpoint
          |
          v
Fetch only changed race IDs
          |
          v
Normalize + validate result/status data
          |
          +--> Save timestamped snapshot/change log
          |
          v
Publish a small race-day JSON file
          |
          v
Browser refreshes JSON and updates only changed cards/charts
```

This keeps the API key private, reduces traffic to HCRA, avoids full-page reloads for our users, and gives us an audit trail if a result changes during protest review.

## Sensible first version

For a pilot, I would keep the scope deliberately narrow:

1. Configure one future regatta ID manually.
2. Poll HCRA's update endpoint from a server-side process at an approved interval.
3. Show event status, the latest result, the next event, and cumulative club points.
4. Keep a direct link to Event by Place and Event by Lane.
5. Archive each observed change with its retrieval time.
6. Test the full state sequence with saved fixtures before race day: unstarted, unofficial, protest countdown, corrected result, DQ/SCR, and official.

After that proves reliable, add club subscriptions, browser notifications, lane context, or richer animations.

## Questions to settle before building

1. Can HCRA grant a production API key and confirm acceptable race-day polling frequency?
2. Does an API field expose the protest deadline and official/unofficial state?
3. Is `rid` the API's regatta ID, or is there a separate mapping from the public results page to the API regatta ID?
4. Should point charts move on unofficial posting or only after official confirmation?
5. How should corrected results be announced and retained in the change history?
6. Does the feature cover OHCRA only, or should its event and scoring model support every association from the start?

## Recommendation

Proceed with a small proof of concept before the next target race, using saved response samples rather than waiting for race day. The official update endpoint makes the idea much more robust than it first appears. The two highest-priority dependencies are production API access and an authoritative status/protest-deadline field.
