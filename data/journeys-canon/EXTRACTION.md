# Extracting a narrator's journey, events, stories and opening questions

You are reading one narrator's oral history to build two sections of the Memory Map:

- **Journeys** — their career as a line over time, plotted by how things were going *in their own
  telling*.
- **The canon** — the events several narrators return to, how each saw them, the stories most worth
  retelling, and the questions that opened narrators up.

Everything you record must trace to an exact recorded moment, and a script will check every quote
word for word.

## Inputs

- Transcript(s): `data/transcripts/{slug}-{part}.txt`, one per recording ("part"). Lines look like
  `[1326.08 22:06] Speaker: text`; the number is seconds into that recording. Paragraphs are separated
  by blank lines.
- Narrator registry: `data/narrators.json` (recordings, story ids, excluded segments).
- Interview-guide questions: `data/system-map/questions.md` (Q1–Q48). Interviewers read numbered
  questions in their own order and numbering ("Question 3", "number seven", "[Question 1]"); map by
  meaning to the guide's id.

**Read the whole transcript, in order, in chunks** (Read with offset/limit, about 200 lines at a time)
until you reach the end of every part. Do not grep or skim.

**Diarization is unreliable.** Labels can be swapped (in Crosson's file most of his answers carry the
interviewer's name) or generic (`SPEAKER_S2`). Identify the narrator by content. Only the narrator's
words can be journey moments, event views or stories. Questions are the interviewer's words.

## No fabrication

- Never invent dates, events or outcomes, and never fill a year from general knowledge of KP history.
- `year_basis`:
  - `stated`: the narrator says the year (or an exact date).
  - `inferred_from_transcript`: worked out *only* from what this narrator says ("I joined in 1977…
    two years later"). Explain in `year_note`. **Also** use this when the year comes from the
    interviewer: a question or framing the narrator answers within and does not contradict ("When the
    Emory partnership began in 2018, what…"). Then `year_note` starts `Year from the interviewer:` and
    quotes the interviewer's words.
  - `unknown`: anything else. Then `year` is `null`.
- Never later than the interview's record date, which is on the first line of each transcript.

## Journey: 8–16 moments in LIFE order (not interview order)

Pick the moments that shape their career story: arriving, turning points, setbacks, peaks, what they
handed on. For each:

- `t`, `part`: where the quote starts (the verifier then sets `t` and `end` exactly).
- `year`, `year_basis`, `year_note` (required unless `stated`).
- `stage`: a narrative grammar, not a claim that careers follow the hero's journey:
  `ordinary_world` (the everyday before anything happens), `call` (something asks more of them),
  `refusal` (doubts or reservations), `mentor` (someone who taught them), `threshold` (committing to
  the unfamiliar), `trials` (smaller tests along the way), `ordeal` (the defining crisis), `reward`
  (what changed), `transformation` (how they changed), `return` (the lesson reaching others).
- `label`: ≤ 7 words, plain, not dramatized ("Elected executive medical director").
- `fortune`: integer −3..3, **how things were going for them at that moment, in their own telling**,
  not how history judges the event:
  - **+3** they describe it as a peak ("the best part of my whole career", "I found my calling")
  - **+1 to +2** going well
  - **0** neutral or mixed
  - **−1 to −2** hard, frustrating or uncertain
  - **−3** they describe it as a low point (being pushed out, a crisis that frightened them, a
    personal loss)
  The same event can score very differently for different narrators (COVID was a low point for some
  and "the best part of my whole career" for one). Score what *this* narrator says.
- `fortune_basis`: ≤ 15 words **copied verbatim from the transcript** that justify the score (it is
  verified like a quote, near `t`).
- `quote`: verbatim, ≤ 35 words.
- `event_ref`: short name of a shared institutional event this moment is about (use the same names as
  in `events`), or `null`.
- `sensitive`: see below.

Moments must be in non-decreasing year order wherever years are known.

## Events: institutional or historical events another narrator might also mention

Examples: "Permanente Federation founded", "COVID-19 pandemic", "Electronic health record rollout",
"Tahoe agreement", "1990s financial crisis", "KP Medical Foundation formed". Use short, plain,
canonical names; keep genuinely different events apart (a 1990s KP financial crisis is not a 2010s
regional one).

- `year_start`, `year_end` (null if a single year or not given), `year_basis` (same rules as above),
  `year_note` (required unless `stated` or `unknown`: how the year was worked out, or the interviewer's words).
- `view`: one sentence, neutral words, how **they** saw it.
- `t`, `part`, `quote`: verbatim, ≤ 30 words.
- `prompt`: the interviewer's last question before the quote, read backwards from it:
  `question` (as asked, ≤ 40 words), `list_number` (`Q24`… if it's a guide question, else `null`),
  `type`: `asked_directly` (the question named the event; e.g. lists asked about the EHR and
  COVID-19), `narrators_choice` (an open question where they raised it), `follow_up` (an improvised
  follow-up).
- `sensitive`.

## Retellable: 2–4 stories most worth retelling in an exhibit, lesson plan or onboarding

`title` (≤ 8 words), `summary` (2 factual sentences), `t`, `part`, `quote` (verbatim, ≤ 40 words),
`why` (≤ 15 words), `sensitive`.

## Questions that opened things up: 1–3

Questions that drew unusually rich or candid answers. `t`, `part`, `question` — **the interviewer's
words copied verbatim** (≤ 40 words; `...` allowed to trim), `source`
(`question_list` | `written_for_narrator` | `improvised`), `list_number` (`Q10` or `null`), `why`
(≤ 20 words: what it drew out), `sensitive`.

## Sensitive (`sensitive: true`)

Mark an item sensitive when the narrator's words include any of:

- **Health of an identifiable person**: their own or a named person's illness, injury, disability,
  mental health or death. (General clinical topics, prevention, COVID as an institutional event: no.)
- **Family and personal loss**: a family member's death or illness, divorce, a child's hardship.
- **Harassment or discrimination** they experienced or witnessed (sexism, racism, sexual harassment).
- **Personnel conflict involving identifiable people**: firing, pushing out or disciplining someone;
  being pushed out themselves; blunt criticism of a named, living colleague.
- **Legal or confidential matters**: lawsuits, malpractice, settlements, NDA-covered details.

Criticism of institutions or decisions, financial crises and policy opinions are not sensitive.
Sensitive items are kept, verified and shown (these are internal recordings); the flag lets the
audience change later. Don't avoid them: flag them.

## Respect narrator wishes

Never take anything from a segment the narrator asked to have cut (`excluded_segments` in
`data/narrators.json`). If you find another request to cut, strike or go off the record, add it to
`excluded_segments` in your output with the span and their words in `reason`, and take nothing from it.

## Output: `data/journeys-canon/extracted/{slug}.json`

```jsonc
{
  "narrator": "Full name",
  "slug": "ellison",
  "recordings": [{ "part": 1, "story_id": "..." }],
  "one_line": "<= 20 words: who they are and their arc",
  "top_role": "highest role reached",
  "region": "as stated or clearly implied, else null",
  "excluded_segments": [],
  "journey": [
    { "t": 0, "part": 1, "year": 1978, "year_basis": "stated", "year_note": "",
      "stage": "threshold", "label": "Joins SCPMG as pediatrician", "fortune": 2,
      "fortune_basis": "verbatim words", "quote": "verbatim", "event_ref": null, "sensitive": false }
  ],
  "events": [
    { "name": "COVID-19 pandemic", "year_start": 2020, "year_end": null, "year_basis": "stated",
      "year_note": "", "view": "...", "t": 0, "part": 1, "quote": "verbatim",
      "prompt": { "question": "...", "list_number": "Q36", "type": "asked_directly" }, "sensitive": false }
  ],
  "retellable": [
    { "title": "...", "summary": "...", "t": 0, "part": 1, "quote": "verbatim", "why": "...", "sensitive": false }
  ],
  "questions_that_opened_things_up": [
    { "t": 0, "part": 1, "question": "verbatim interviewer words", "source": "question_list",
      "list_number": "Q10", "why": "...", "sensitive": false }
  ]
}
```

## Verify before you finish

Run `npx tsx scripts/journeys-canon/verify.ts {slug}`. It checks every quote, every `fortune_basis`
and every opening question is a verbatim substring of the transcript near `t`, sets `t`/`end` from the
word timecodes, drops anything inside an excluded segment, validates every field and checks the
journey's year order. **Fix every failure by re-reading that part of the transcript and copying the
exact words — never by paraphrasing or by editing the verifier.** Re-run until it reports everything
verified. Edit no file other than your own.
