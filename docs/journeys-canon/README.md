# Journeys and The canon (`/memory-map`)

Two sections of the Memory Map, alongside System ("The loops they describe"), all under one "Compare
narrators" filter kept in the URL (`/memory-map?n=wilson,ellison#journeys`). `/system` redirects to
`/memory-map#system`.

- **Journeys — "How it felt, year by year".** Each narrator's career as a line over time, plotted by
  how things were going in their own telling (fortune −3..3). Every point plays that moment.
- **The canon — "The backbone stories".** Events more than one narrator returns to, how each saw them
  and how it felt at the time, stories worth retelling, and questions that opened narrators up.

## Files

| Path | What it is | Edited by |
|---|---|---|
| `data/narrators.json` | Narrators, recordings, regions, join year, excluded segments (shared by every section) | hand |
| `data/journeys-canon/extracted/{slug}.json` | One narrator's journey, events, stories, opening questions | extraction, then `verify` |
| `data/journeys-canon/events.json` | Canonical events (aliases merge names across narrators) and the chart's bands | hand |
| `data/journeys-canon/overrides.json` | Labels, years, stages, fortune, visibility, event moves/merges, bands, featured stories; applied last | hand |
| `data/journeys-canon/model.json` | Built model the page imports | `yarn journeys:build` only |
| `data/journeys-canon/EXTRACTION.md` | Instructions each extraction agent follows (rubric, stages, year rules, sensitivity) | hand |
| `data/transcripts/` | Normalized transcripts (gitignored) | `yarn narratives:normalize` |
| `scripts/lib/narratives/` | Transcript loading, verbatim quote matching, clip bounds (shared with System) | |
| `scripts/journeys-canon/` | `verify`, `build`, `selftest` | |
| `lib/journeys-canon/model.ts` | Time placement, events, bands, findings (shared by the build, page and tests) | |
| `app/memory-map/` | The page | |

## Rules the scripts enforce

- **Verbatim.** Every quote, `fortune_basis` and opening question is an exact, word-aligned substring of
  the transcript near `t` (same paragraph or within 180 s after; `...` joins ≤ 60 s apart).
- **Clips from word timecodes.** `verify` resets `t`/`end` to the first quoted word's start (floored)
  and the last word's end (ceiled). No padding.
- **No invented years.** `year_basis` is `stated`, `inferred_from_transcript` (with a `year_note`; this
  includes a year the interviewer gave that the narrator answers within) or `unknown` (year null).
  Never after the interview's record date. Journey years never go backwards.
- **Narrator wishes.** Anything overlapping an excluded segment is removed.
- **Sensitive material** (`sensitive: true`) is flagged and shown, since these are internal recordings;
  the flag lets that change later. Hide individual items in overrides.

## Placing moments in time (build)

Dated moments sit at their year. Undated ones are interpolated between dated neighbours; before a
narrator's first dated moment they step back 5 years each, after the last forward 3, never past the
interview year. Moments sharing a year get small offsets. Each point has `placement`
(`stated | inferred | interpolated`); a line with more than half its points interpolated is
low-confidence and drawn dashed.

## Add an interview

1. Publish it in Portal Publisher (portal-sync stores `json/interviews/oral-histories/{storyId}.json`);
   pull it locally: `rsync -a --exclude '._*' root@137.184.196.175:/root/ts-portal-kp/json/interviews/ json/interviews/`
2. Add the recording to `data/narrators.json` (new narrator, or a new `part`), with any cut requests in
   `excluded_segments`.
3. `yarn narratives:normalize`
4. Extract (below), then `yarn journeys:verify`, `yarn journeys:build`. Do the same for System
   (`docs/system-map/README.md`).

## Re-extract one narrator

Run one Claude Code agent with:

> Working directory: the repo. Read `data/journeys-canon/EXTRACTION.md` first and follow it exactly.
> Narrator: slug `{slug}`, {name}. Part 1 = `data/transcripts/{slug}-1.txt` (story {id}). Read the entire
> transcript in ~200-line chunks, write `data/journeys-canon/extracted/{slug}.json`, then run
> `npx tsx scripts/journeys-canon/verify.ts {slug}` and fix every failure by re-reading the transcript.
> Edit no other files.

Overrides are keyed by item id (`{slug}-{m|e|s|q}-{part}-{rounded seconds}`); the build warns about
overrides whose item no longer exists.

## Edit events

In `events.json`, add a name (lowercase match) to an event's `aliases` to merge it, or add a new
`{ id, name, aliases }`. Keep genuinely different events apart (the 1990s KP crisis is not the 2008
crash). `on_question_list: true` marks events the interview guide names. `bands`: `null` uses the
build's proposal (shared events with the most narrators, a range of 10 years or less, not overlapping);
set a list of ids to choose.

## Overrides

```jsonc
{
  "moments": { "goldsmith-m-1-436": { "label": "Elected EMD", "year": 1994, "stage": "reward", "fortune": 2 },
               "ellison-m-1-444": { "review_status": "hidden" } },
  "eventMentions": { "pearl-e-1-2615": { "event": "financial-crisis-1990s" } },
  "events": { "financial-crisis-2008": { "name": "The 2008 crash" }, "kp-nevada": { "mergeInto": "risant" } },
  "stories": { "tarnoff-s-1-3222": { "review_status": "reviewed" } },
  "questions": {},
  "bands": ["tahoe-1", "financial-crisis-1990s", "covid-19"],
  "featuredStories": ["crosson-s-1-1915"]
}
```

Every item carries `review_status` (`draft` by default, `reviewed`, `hidden`).

## Rebuild and check

```bash
yarn journeys:verify   # exits non-zero on any failure
yarn journeys:build    # writes model.json
yarn journeys:test     # unit tests
```

The page imports `model.json` at build time; redeploy the frontend to publish.

## Computed findings

Never written by hand: **shared lows** (3+ narrators at −2 or lower within 4 years), **same event,
opposite feeling** (narrators' moments tied to a shared event differ by 4+), **personal lows** (a
narrator's lowest point not tied to a shared event) and **prompted events** (most-mentioned events with
how many mentions were asked directly).
