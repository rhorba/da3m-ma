# Curation Guide: Da3m.ma
**ADR**: ADR-8 (catalogue as code) · **Owner**: Curator · **Date**: 2026-09-17

Programmes live in `data/programs/<slug>.json`. A file is either a **draft** (never published) or **verified** (published to the database as an immutable version by `pnpm catalogue:sync`). CI validates every file on every push.

> **Verifying the current drafts?** `docs/verification-worksheet.md` lists every
> claim to confirm and every open decision, per programme, generated from the files
> themselves. Start there.

## Verifying a draft
1. Open every URL in `sources`. Criteria must come **only** from these official pages.
2. Read `verification.notes`. Each draft separates:
   - **OFFICIAL** — stated on the source, encoded as written
   - **INTERPRETATION** — a judgement call made when drafting; confirm or correct it
   - **OPEN** / **NOT ENCODED** — something the source doesn't settle; decide, or leave it out
3. Check each criterion in `version.rules` against the source, including its French, Arabic and English `reason`. The reason is shown to users when they don't qualify, so it must be accurate and actionable.
4. Check `content` (title + summary in all three languages) and the amounts.
5. Check the `goldenProfiles`: do the expected outcomes match what the source says?
6. Mark it verified:
   ```json
   "verification": { "status": "verified", "verifiedAt": "YYYY-MM-DD", "verifiedBy": "<your name>", "notes": "…" }
   ```
7. `pnpm catalogue:validate`, then commit. CI must be green.
8. `pnpm catalogue:sync` publishes verified files. Running it again with no changes does nothing.

## Changing a published programme
Edit the file, update `verifiedAt`, commit, sync. A new version is created; earlier versions and every report that used them stay untouched (ADR-4).

## When the watcher flags a change
```bash
pnpm catalogue:tasks                                   # open review tasks with diff excerpts
pnpm catalogue:resolve <task-id> no-change --by <name> # cosmetic change
pnpm catalogue:resolve <task-id> changed --by <name>   # after updating and syncing the file
```

## Rules of thumb
- **Never guess a threshold.** If the source doesn't state it, don't encode it — put it in `notes` as OPEN. Missing data produces "needs info", which is honest; an invented threshold produces a wrong answer.
- **Operator sources only.** Comparison sites, news articles and consultancies can point you to a source but can't be the source.
- **Dated documents are allowed but flagged.** If the only official statement of a criterion is an older document, say so in `notes`.
- **Every file needs golden profiles** covering eligible, ineligible (with `expectedFailing`) and needs_info (with `expectedMissing`).

## Sources we cannot read automatically
| Source | Problem | Consequence |
|---|---|---|
| `forsa.ma` | Returns HTTP 403 to our honest bot user agent | Curate manually in a browser; the watcher can't monitor it. We don't disguise the crawler. |
| `marocpme.gov.ma` | Incomplete TLS certificate chain — Node rejects it (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) | Watches will raise `fetch_failing`. Fix by adding the missing intermediate certificate via `NODE_EXTRA_CA_CERTS`, never by disabling verification. |
| Old `tamwilcom.ma/fr/votre-projet/*` URLs | Return 404 since Tamwilcom's site restructuring | Use the current `tamwilcom.ma/nos-solutions/*` pages. |
