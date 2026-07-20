# Screener AI Context Exporter

A Chrome extension for screener.in. It reads the structured financials
already rendered on a company page (Quarters, P&L, Balance Sheet, Cash Flow,
Ratios, Peer Comparison) plus the line-item breakdowns behind
the page's "+"-expandable rows (Sales+, Expenses+, Borrowings+, etc.) and
other lazily-loaded widgets (Product/Geographical Segments, Related Party
Transactions, Corporate Actions, Company Insights), and turns all of it into
one Markdown document you can paste into Screener AI as context. Company
Insights is Screener's own beta, AI-extracted KPI section — included
(without its per-cell source citations, to keep the document compact) since
it's far cheaper to read here than to have the harness re-derive the same
numbers from source documents via its own PDF tools.

## Why

Screener AI's chat harness has tools to read PDFs (annual reports, concalls,
credit ratings, announcements) but no tool to read Screener's own structured
tables. Plain numeric questions ("3-year sales growth", "why did other income
spike") end up triggering expensive PDF-scanning tool calls (hundreds of
thousands of input tokens, ₹10s per question) to reconstruct numbers that are
already sitting on the page you're looking at. Pasting this extension's
Markdown output as a prefix to your question gives the AI exact figures up
front, so it only needs to spend tokens/tool calls on genuinely qualitative
or narrative questions.

Not in scope: Documents, Announcements, Annual Reports, Credit Ratings,
Concalls (Screener AI already has direct tool access to those), and the
"Trades" widget next to Shareholding Pattern (not investigated yet).

## Install (unpacked, for now)

1. `npm install`
2. `npm run build` (bundles `src/content.js` into `dist/content.js`)
3. Chrome → `chrome://extensions` → enable Developer Mode → **Load unpacked**
   → select this folder.
4. Open any `https://www.screener.in/company/<TICKER>/...` page. Two buttons
   appear bottom-right: **Copy AI context (.md)** and **Download .md**.

## Install on Android (Quetta, etc.)

Quetta (and most Chromium-based Android browsers with extension support) only
install extensions from the Chrome Web Store/Edge Add-ons — there's no
"load unpacked from a folder" option like desktop Chrome, and local
`.crx`/`.zip` sideloading is unreliable where it exists at all. The
practical path for a personal, unpublished extension is an **Unlisted**
Chrome Web Store listing (not searchable, installable only via its direct
URL):

1. `npm run package` — builds and zips `manifest.json` + `dist/content.js` +
   `icons/` into `release/screener-ai-context-v<version>.zip`.
2. Upload that zip to the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (one-time $5 registration fee), set visibility to **Unlisted**.
3. Once published, open the listing's direct URL in Quetta (or any Android
   browser with Web Store-based extension install) and install it there —
   same flow as any other Chrome Web Store extension.

## Usage

1. Click **Copy AI context (.md)**.
2. Paste it at the start of your Screener AI question, e.g.:

   ```text
   Here is Screener's structured financial data for this company (treat as
   ground truth; only use your document tools for things not covered here):

   <pasted markdown>

   Now answer: <your actual question>
   ```

## Development

See `context/CONVENTIONS.md` for lint/format/build commands and
`context/MAP.md` for module layout and how data is gathered.
