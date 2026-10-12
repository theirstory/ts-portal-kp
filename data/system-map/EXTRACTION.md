# Extracting cause-and-effect claims for one narrator

You are extracting every cause-and-effect claim one narrator makes about how Permanente works, for
the map "The loops they describe". Every claim you record must trace to an exact recorded moment.

## Inputs

- Transcript(s): `data/transcripts/{slug}-{part}.txt`. One file per recording ("part").
  Lines look like `[1326.08 22:06] Speaker: text`; the number is seconds into the recording.
  Paragraphs are separated by blank lines.
- Narrator registry: `data/narrators.json` (recordings, story ids, known excluded segments).
- Interview-guide questions: `data/system-map/questions.md` (Q1–Q48).

**Read the whole transcript, in order, in chunks** (Read with offset/limit, ~200 lines at a time)
until you reach the end of every part. Do not grep or skim for keywords: claims are often phrased in
ways no keyword finds.

**Diarization is unreliable.** Speaker labels can be swapped (in Crosson's file most of his answers
are labeled with the interviewer's name) or generic (`SPEAKER_S2`). Decide who is the narrator and
who is the interviewer from content: the interviewer asks; the narrator answers about their own career.
Only the narrator's words can be claims.

## What counts as a claim

The narrator asserts that one thing causes, enables, strengthens, protects, erodes or undermines
another. "Culture is what drives our quality." "The financial crisis eroded trust between the plan
and the groups." It does **not** count if they only mention two things together, or describe an event
without stating a cause and effect.

- `from` is the cause, `to` is the effect.
- `polarity`: `+` strengthens/enables/protects; `-` weakens/erodes/harms/undermines.
- `explicitness`: `explicit` when the narrator states the causal link; `implied` when it is clearly
  entailed by what they said (not your inference about what they might believe).
- Typically 5–15 distinct claims per narrator; more for long interviews if they are genuinely
  distinct. Do not pad. Do not split one statement into several claims unless it really asserts several
  links. If the narrator makes the same claim twice, keep the clearest instance.

## Factor names

Reuse these names exactly when they fit:

physician leadership, partnership with health plan, integrated care, group practice, medical group
autonomy, capitation, succession, quality, affordability, prevention, patient experience, membership
growth, innovation, trust, culture, candor, leadership development, physician well-being, burnout,
equity, workforce diversity, community health, financial pressure, competition, data & technology,
rapid change, secrecy, physician turnover, physician recruitment, access

`data/system-map/factors.json` holds the full canonical list (including factors added after the
first extraction) and the aliases that map near-synonyms onto it; prefer those names too.

Invent a short new name (lowercase, 1–4 words) only when nothing fits, and list it in `new_factors`.
Prefer the closest vocabulary name over a near-synonym ("mentorship" → leadership development;
"transparent communication" → candor; "electronic medical record" → data & technology).

## Quotes (verified mechanically — read carefully)

- `quote` must be copied **character for character** from the transcript text: same words, same case,
  same punctuation, same disfluencies ("um", repeated words). Do not fix grammar or remove fillers.
- At most **35 words**. You may join two verbatim segments with ` ... ` (in order, close together),
  e.g. to drop a tangent; never to stitch distant passages. The verifier rejects a join that skips
  more than 60 seconds or more than two paragraphs.
- A quote may continue across a line break or paragraph break of the same speaker; copy the words
  with single spaces between them.
- `t`: the seconds value from the line where the quote starts (the verifier then sets `t` and `end`
  exactly from the word timecodes). `part`: which recording.
- Choose the words that carry the causal claim itself.

## Prompt context

Read backwards from the quote to the interviewer's **last question before it**:

- `prompt.question`: that question as asked (verbatim or lightly trimmed, ≤ 40 words).
- `prompt.list_number`: `"Q24"` etc. if it is one of the guide questions in `questions.md` (matched
  by meaning; interviewers paraphrase and some read "[Question N]" with their own numbering — map to
  the guide's id by content), else `null`.
- `prompt.type`:
  - `asked_directly`: the question named this claim's topic (e.g. Q24 asks how integrated care
    benefits patients, so an "integrated care strengthens quality" answer to it is asked directly).
  - `narrators_choice`: an open question where the narrator raised the topic themselves.
  - `follow_up`: an improvised interviewer follow-up.

## Respect narrator wishes

Never take a claim from a segment the narrator asked to have cut. Known segments are in
`data/narrators.json` (`excluded_segments`). If you find any other request to cut, strike, go off the
record, or not use something, add it to `excluded_segments` in your output with the span and the
narrator's words in `reason`, and take no claims from it.

## Output

Write `data/system-map/claims/{slug}.json`:

```jsonc
{
  "narrator": "Full name",
  "slug": "ellison",
  "recordings": [{ "part": 1, "story_id": "..." }],
  "excluded_segments": [{ "part": 1, "start": 0, "end": 0, "reason": "..." }],
  "narrator_meta": {
    "region": "primary Permanente region/group they led or worked in, e.g. Southern California (SCPMG), Colorado, Georgia, Mid-Atlantic, Northwest, Northern California (TPMG), Washington, Hawaii, National (Federation/Program)",
    "region_quote": "verbatim words supporting it",
    "era": "their Permanente years, e.g. 1969–1999 (best evidence; null if not stated)",
    "era_quote": "verbatim words supporting it"
  },
  "claims": [
    {
      "from": "integrated care", "to": "quality", "polarity": "+",
      "t": 1326.08, "part": 1,
      "quote": "verbatim, <= 35 words",
      "explicitness": "explicit",
      "prompt": { "question": "...", "list_number": "Q24", "type": "asked_directly" }
    }
  ],
  "new_factors": []
}
```

## Verify before you finish

Run `npx tsx scripts/system-map/verify.ts {slug}`. It checks every quote is a verbatim substring of
the transcript near `t`, sets `t`/`end` from word timecodes, drops claims inside excluded segments and
validates fields. **Fix every failure by re-reading that part of the transcript and copying the exact
words — never by paraphrasing or by editing the verifier.** Re-run until it reports all claims verified.
Do not edit any file other than your own claims file.
