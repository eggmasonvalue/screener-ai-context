# Decisions

Curated architecture decision record. Not a changelog or worklog — see git
history for that. Entry format:

```text
## YYYY-MM-DD — <short decision title>
Context: what forced the choice
Decision: what we chose
Tradeoff: what we gave up / what we rejected and why
Status: active | superseded by <date/title>
```

## 2026-07-18 — Fetch Screener's schedule API directly instead of simulating clicks

Context: Screener's "+"-expandable rows (Sales+, Expenses+, Borrowings+, ...)
are not present in the server-rendered DOM; the data only appears after a
click triggers a same-origin XHR to
`/api/company/<id>/schedules/?parent=X&section=Y`.
Decision: call that endpoint directly with `fetch()` for a known list of
parents/sections, in parallel, instead of simulating UI clicks and reading
the DOM after each one.
Tradeoff: couples this tool to an undocumented internal API that could
change without notice (mitigated by failing soft per-parent so a broken
endpoint just drops that one section instead of failing the whole export).
In exchange, avoids click-simulation timing/flakiness entirely and gets
already-clean JSON instead of table-scraping rendered DOM.
Status: active

## 2026-07-18 — Exclude Documents/Announcements/Concalls/Annual Reports/Credit Ratings from scope

Context: Screener AI's own tool list (`read_credit_rating_report`,
`read_concall_transcript`, `refer_annual_report`, `read_presentation`,
`read_announcement`) shows the harness already has direct tool access to
these document types.
Decision: this exporter only covers structured tables/ratios/schedules that
the harness has no tool for, not documents it can already read itself.
Tradeoff: narrower scope than "export the whole page", but avoids
duplicating capability the harness already has and keeps the exported
markdown small (cheap to paste as context).
Status: active

## 2026-07-18 — Bundle with esbuild instead of raw ES modules in the content script

Context: Manifest V3 content scripts do not have a well-documented, reliably
cross-Chrome-version way to load `import`/`export` ES modules directly via
the manifest's `content_scripts.js` list.
Decision: write source as plain ESM under `src/`, bundle to a single IIFE
`dist/content.js` with esbuild, and point the manifest at the bundle.
Tradeoff: adds a build step (`npm run build`) before the extension is
loadable; in exchange, sidesteps undocumented/version-dependent MV3 module
behavior entirely.
Status: active

## 2026-07-21 — No auto-fill/auto-send into Screener AI's chat panel

Context: Explored adding a button to push the assembled markdown directly
into Screener AI's own chat input instead of copy/paste. Screener AI's chat
(opened by the page's own "AI" button) is not part of the screener.in page
— it's a third-party embed, an `<iframe>` pointing at a signed URL on a
different origin (`stocks-ai.com/chats/<id>/?key=...&signature=...`).
Confirmed via `iframe.contentDocument` returning `null` from the parent
page: genuine cross-origin isolation (Same-Origin Policy), not a
permissions or manifest issue.
Decision: do not add a second content script matched on `stocks-ai.com` (or
any other cross-origin-DOM-poking approach) to reach into that iframe's
textarea. Leave the export flow as copy-to-clipboard / download-`.md` only;
the user pastes into the chat panel themselves.
Tradeoff: this tool's own origin (`screener.in`) genuinely cannot script
the chat panel's DOM — the only ways in are (a) matching a content script
to a third-party vendor's undocumented, signed-URL widget (selectors and
auth scheme entirely outside our control, could break silently on either
party's next deploy), or (b) a `postMessage` bridge, unconfirmed to exist
and not worth the reverse-engineering to find out for what would still be a
fragile integration. One extra manual paste step is the far more durable
tradeoff.
Status: active
