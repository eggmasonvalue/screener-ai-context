# Conventions

- Write plain ESM (`import`/`export`) under `src/`. Do not hand-edit
  `dist/content.js`; it is a build artifact.
- Keep `src/markdown.js` Screener-agnostic (pure table/text -> markdown
  helpers). Put all screener.in-specific selectors/endpoints in
  `dom-sections.js` and `schedules.js`.
- Any new same-origin API call added to `schedules.js` must fail soft
  (return `""` on non-OK response or thrown error) — never throw out of
  `fetchSchedulesForSection`. Same rule applies to `extras.js`'s fetchers
  (`fetchSegmentsForSection`, `fetchRelatedPartyTransactions`,
  `fetchCorporateActions`).
- Never let implementation detail (endpoint paths, "API", "schedule",
  header names, etc.) leak into a heading or body text that ends up in the
  generated `.md` — that's for code comments only. The exported document is
  read by an AI harness as data, not as documentation of this tool.
- Do not add `Documents`/`Announcements`/`Annual Reports`/`Credit Ratings`/
  `Concalls` scraping — out of scope, see `context/MAP.md`.
- Do not request extra manifest permissions/host permissions for same-origin
  `fetch()` calls to `screener.in` endpoints; the content-script match
  pattern already covers them.
- `npm run package` builds and zips the Web Store upload artifact
  (`release/screener-ai-context-v<version>.zip`); bump `manifest.json`'s
  `version` before re-running for a new upload. `scripts/package.js` writes
  the zip with a hand-rolled zip writer (no `zip` CLI dependency, since
  Git Bash on Windows doesn't ship one) — do not add a zip dependency
  without checking this still isn't needed.
- Run before committing:
  - `npm run build`
  - `npm run lint`
  - `npm run format:check` (or `npm run format` to auto-fix)
  - `npm run lint:md`
