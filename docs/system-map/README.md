# The loops they describe (System section of `/memory-map`)

An interactive map of the cause-and-effect claims narrators make about how Permanente works. Every
arrow is one or more claims ("X strengthens Y", "X undermines Y"), each traced to a verbatim quote and
a clip that plays exactly those words. Thicker arrows were made by more narrators: agreement, not truth.

## Files

| Path | What it is | Edited by |
|---|---|---|
| `data/narrators.json` | Narrators, their recordings (story ids), excluded segments, regions and join year | hand |
| `data/system-map/claims/{slug}.json` | One narrator's extracted claims | extraction, then `verify` |
| `data/system-map/factors.json` | Canonical factors: column, definition, valence, aliases | hand |
| `data/system-map/overrides.json` | Renames, merges, column moves, per-claim fixes; applied last | hand |
| `data/system-map/model.json` | Built model the page imports | `yarn system-map:build` only |
| `data/system-map/EXTRACTION.md` | Instructions each extraction agent follows | hand |
| `data/system-map/questions.md` | The interview guide's questions (Q1–Q48) | generated from the evidence bank |
| `data/transcripts/` | Normalized transcripts for extraction (gitignored) | `yarn narratives:normalize` |
| `scripts/system-map/` | `verify`, `build`, `selftest` (shared transcript and quote code: `scripts/lib/narratives/`) | |
| `lib/system-map/` | Model building and view logic shared by the build and the page | |
| `app/memory-map/Components/system/` | The section (part of `/memory-map`; `/system` redirects there) | |

Transcripts come from `json/interviews/oral-histories/{storyId}.json` (portal-sync's copies). To work
locally, pull them from the droplet first:

```bash
rsync -a --exclude '._*' root@137.184.196.175:/root/ts-portal-kp/json/interviews/ json/interviews/
```

## Principles the scripts enforce

- **Verbatim quotes.** `verify` requires each quote to be an exact, word-aligned substring of the
  recording (same case and punctuation; only whitespace normalized), starting in the paragraph that
  contains `t` or within 180 s after it. `...` may join segments in order, at most 60 s and two
  paragraphs apart. Quotes are capped at 35 words.
- **Clip bounds from word timecodes.** `verify` rewrites `t` and `end` to the first quoted word's start
  (floored) and the last quoted word's end (ceiled), to the centisecond. No padding.
- **Narrator wishes.** Claims overlapping a narrator's `excluded_segments` are removed.
- **Human edits win.** Everything editorial lives in `factors.json`, `data/narrators.json` and
  `overrides.json`, which re-extraction never touches.

Fix a verification failure by re-reading the transcript and copying the exact words. Never loosen the
check.

## Add an interview

1. Publish it in Portal Publisher so portal-sync stores `json/interviews/oral-histories/{storyId}.json`
   (and pull it locally).
2. Add the recording to `data/narrators.json`: a new narrator `{ slug, name, regions, joined, recordings:
   [{ part: 1, story_id }], excluded_segments: [] }`, or a new `part` on an existing narrator.
3. `yarn narratives:normalize`
4. Read the new transcript for cut requests ("off the record", "cut that", "don't put that in") and add
   them to `excluded_segments` with the narrator's words in `reason`.
5. Extract (below), verify, build.

## Re-extract one narrator

Run one Claude Code agent with:

> Working directory: the repo. Follow `data/system-map/EXTRACTION.md` exactly. Narrator: slug `{slug}`,
> {name}; recordings: part 1 = `data/transcripts/{slug}-1.txt` (story {id}). Read the entire
> transcript in ~200-line chunks, write `data/system-map/claims/{slug}.json`, run
> `npx tsx scripts/system-map/verify.ts {slug}` and fix failures by re-reading the transcript. Edit no
> other files.

Then review any new `excluded_segments` the agent reports and copy the ones you accept into
`data/narrators.json`. Claim overrides are keyed by claim id (`{slug}-{part}-{rounded seconds}`): after a
re-extraction, `yarn system-map:build` warns about overrides whose claim no longer exists.

## Edit factors

In `factors.json`:

- **Rename or merge an extracted name:** add it to a factor's `aliases`.
- **Add a factor:** add an entry with `name`, `column` (`pressure`, `structure`, `people`, `outcome`),
  a one-line `definition` and `valence` (`-1` for factors that are bad when they grow, like burnout;
  used to flag mixed effects; otherwise `0`).
- **Move a factor:** change its `column`.

The build fails if a claim uses a factor that is neither a name nor an alias, and tells you which.

## Overrides

`overrides.json`, applied after everything else:

```jsonc
{
  "renameFactors": { "culture": "organizational culture" },
  "mergeFactors": { "brand & reputation": "membership growth" },
  "moveFactors": { "innovation": "structure" },
  "claims": {
    "wilson-2-6481": { "review_status": "reviewed" },
    "ellison-1-5343": { "review_status": "hidden", "note": "quote is about crisis preparation" },
    "chu-1-7192": { "from": "data & technology", "to": "quality", "polarity": "+" }
  }
}
```

`review_status` is `draft` (default), `reviewed` or `hidden`. Hidden claims are left off the map.

## Rebuild and check

```bash
yarn system-map:verify   # all narrators; exits non-zero on any failure
yarn system-map:build    # writes model.json
yarn system-map:test     # unit tests
```

`model.json` is imported by the page at build time, so deploy (rebuild the frontend) to publish.

## What the page computes

Edges, contradictions and findings are recomputed in the browser from the claims in view:

- **Narrator, region and join-cohort filters** choose whose claims count.
- **Minimum narrators per arrow** (default 2) hides thinner arrows; arrows other narrators made stay
  as faint gray, and the layout never moves when filtering.
- **Claims asked directly** (on by default): when on, arrows resting only on answers to questions that
  named the topic carry a hollow marker; when off, those claims are removed.
- **Contradictions**: opposite claims about the same link (always shown, even below the minimum) and
  factors credited with good effects and blamed for bad ones by at least two narrators each.
- **Default selection** is the most widely shared arrow across the whole collection, so the claims
  panel is never empty on load.
