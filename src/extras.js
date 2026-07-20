/**
 * Segment breakdowns, Related Party Transactions, and Corporate Actions.
 *
 * These are three more Screener widgets whose data is not in the
 * server-rendered DOM at page load — like the schedule "+"-rows in
 * schedules.js, they're fetched lazily, but via three different
 * same-origin endpoints with three different response shapes:
 *
 *   - Product/Geographical segments:
 *       GET /api/segments/<companyId>/<quarters|profit-loss>/<1|2>/?consolidated=<bool>
 *     `1` = Product Segments, `2` = Geographical Segments. Not every
 *     company has both (or either) — a 404 just means that segment type
 *     isn't reported, so this fails soft per (section, type) combination
 *     rather than checking the DOM for which buttons are present.
 *     Response is one <table> with several `data-segment-line` <tbody>
 *     blocks (Sales, Sales Growth %, Profit, Profit %, Profit Growth %,
 *     Capital Employed, ROCE %) all present in the same fetch — Screener's
 *     own JS just toggles which one is visible, so no need to simulate
 *     that toggle.
 *
 *   - Related Party Transactions:
 *       GET /results/rpt/<companyId>/<consolidated|standalone>/
 *     A single annual table, party-grouped (each related party is a
 *     header row with a relationship-type label, followed by its
 *     transaction-type line items). Screener's own response carries a
 *     disclaimer that this is an experimental annual-report extraction —
 *     preserved verbatim here rather than silently dropped, since it's a
 *     meaningfully different confidence level than the other sections.
 *
 *   - Corporate Actions:
 *       GET /company/actions/<companyId>/
 *       (requires header X-Requested-With: XMLHttpRequest — without it,
 *       Screener returns the full page, not the modal fragment; this is
 *       the one endpoint of the three that needs that header)
 *     Returns the entire modal at once: 6 tabs (Equity History, ESOPs,
 *     Dividend, Merger, Bonus, Split), each already rendered in the DOM
 *     fragment (CSS-hidden except the active tab) — again, no click
 *     simulation needed.
 *
 *   - Company Insights (Quarterly view only — Yearly is server-rendered,
 *     see `dom-sections.js`):
 *       POST /insights/company/<companyId>/quarter/?is_consolidated=<0|1>
 *     The only POST (and only CSRF-guarded) endpoint this tool calls —
 *     GET returns 403. Needs an `X-CSRFToken` header read from the
 *     same-origin `csrftoken` cookie (Django's standard CSRF cookie,
 *     already set for any logged-in session; no extra permission needed
 *     to read a non-HttpOnly same-origin cookie via `document.cookie`).
 *
 * Confirmed live against ITC (has Product Segments) and Ratnaveer (has
 * Geographical Segments), both consolidated, on 2026-07-20.
 *
 * "Trades" (next to Shareholding Pattern) is intentionally not covered —
 * out of scope for now, see context/DECISIONS.md.
 */

import { tableToMarkdown } from "./markdown.js";

const SEGMENT_TYPES = [
  { id: 1, label: "Product Segments" },
  { id: 2, label: "Geographical Segments" },
];

const SEGMENT_SECTIONS = [
  { id: "quarters", label: "Quarterly" },
  { id: "profit-loss", label: "Annual" },
];

/** Consolidated vs standalone, read from the page URL (`/company/<T>/<mode>/...`). */
export function getViewMode() {
  return location.pathname.includes("/standalone/") ? "standalone" : "consolidated";
}

function parseHtml(html) {
  return new DOMParser().parseFromString(html, "text/html");
}

/**
 * Each Company Insights data cell carries a hover tooltip citing the exact
 * source document/date/page it was extracted from. Deliberately dropped
 * here rather than surfaced in the output: the section-level "beta,
 * Screener AI-extracted" disclaimer already flags it as unverified, and
 * citing the source per cell would multiply token cost for little benefit
 * (each tooltip also repeats the row's whole value list, so keeping it
 * verbatim is redundant on top of expensive).
 */
function insightsCellText(cell) {
  const clone = cell.cloneNode(true);
  clone.querySelectorAll(".has-tooltip").forEach((el) => el.remove());
  return clone.textContent.replace(/\s+/g, " ").trim();
}

/** Used for both the server-rendered Yearly table (dom-sections.js) and the fetched Quarterly one. */
export function insightsTableToMarkdown(table) {
  if (!table) return "";
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return "";
  const lines = [];
  rows.forEach((row, i) => {
    const cells = Array.from(row.querySelectorAll("th,td")).map(insightsCellText);
    if (cells.length === 0) return;
    lines.push(`| ${cells.join(" | ")} |`);
    if (i === 0) lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
  });
  return lines.join("\n");
}

/** True if a segment <tbody> has at least one populated data cell. */
function tbodyHasData(tbody) {
  return Array.from(tbody.querySelectorAll("td")).some((td) => td.textContent.trim() !== "");
}

function segmentTbodyToMarkdown(headerCells, tbody) {
  const rows = Array.from(tbody.querySelectorAll("tr"))
    .slice(1) // first row is the metric name + Amount/Growth%/Margin% toggle buttons, not data
    .map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.textContent.replace(/\s+/g, " ").trim()),
    )
    .filter((cells) => cells.some((c) => c !== ""));
  if (rows.length === 0) return "";

  const header = `| ${headerCells.join(" | ")} |`;
  const sep = `| ${headerCells.map(() => "---").join(" | ")} |`;
  const body = rows.map((cells) => `| ${cells.join(" | ")} |`);
  return [header, sep, ...body].join("\n");
}

function segmentHtmlToMarkdown(html) {
  const doc = parseHtml(html);
  const table = doc.querySelector("table");
  if (!table) return "";

  const periods = Array.from(table.querySelectorAll("thead th"))
    .map((th) => th.textContent.trim())
    .filter(Boolean);
  const headerCells = ["Segment", ...periods];

  const blocks = Array.from(table.querySelectorAll("tbody[data-segment-line]"))
    .filter(tbodyHasData)
    .map((tbody) => {
      const metric = tbody.getAttribute("data-segment-line");
      const md = segmentTbodyToMarkdown(headerCells, tbody);
      return md ? `#### ${metric}\n\n${md}\n` : "";
    })
    .filter(Boolean);

  return blocks.join("\n");
}

async function fetchSegmentVariant(companyId, viewMode, segmentType, segmentSection) {
  const url = `/api/segments/${companyId}/${segmentSection.id}/${segmentType.id}/?consolidated=${viewMode === "consolidated"}`;
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return "";
    const html = await res.text();
    const body = segmentHtmlToMarkdown(html);
    return body ? `## ${segmentType.label} (${segmentSection.label})\n\n${body}` : "";
  } catch {
    return "";
  }
}

/**
 * Fetch Product + Geographical segments for one period ("quarters" |
 * "profit-loss"), in parallel, dropping whichever segment type a company
 * doesn't report. Split by period so the caller can place quarterly
 * segments after Quarterly Results and annual segments after Profit & Loss,
 * instead of one combined block.
 */
export async function fetchSegmentsForSection(companyId, viewMode, sectionId) {
  if (!companyId) return "";
  const segmentSection = SEGMENT_SECTIONS.find((s) => s.id === sectionId);
  if (!segmentSection) return "";
  const results = await Promise.all(
    SEGMENT_TYPES.map((type) => fetchSegmentVariant(companyId, viewMode, type, segmentSection)),
  );
  return results.filter(Boolean).join("\n");
}

function cellsWithColspan(row) {
  const out = [];
  Array.from(row.querySelectorAll("th,td")).forEach((cell) => {
    const text = cell.textContent.replace(/\s+/g, " ").trim();
    const span = parseInt(cell.getAttribute("colspan") || "1", 10);
    out.push(text);
    for (let i = 1; i < span; i++) out.push("");
  });
  return out;
}

/** RPT rows use colspan for party-header rows; expand them so every row has the same column count as the header. */
function rptTableToMarkdown(table) {
  const rows = Array.from(table.querySelectorAll("tr")).map(cellsWithColspan);
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(width - r.length).fill("")];
  const header = `| ${pad(rows[0]).join(" | ")} |`;
  const sep = `| ${Array(width).fill("---").join(" | ")} |`;
  const body = rows.slice(1).map((r) => `| ${pad(r).join(" | ")} |`);
  return [header, sep, ...body].join("\n");
}

/** Related Party Transactions: annual, party-grouped. Experimental per Screener's own callout. */
export async function fetchRelatedPartyTransactions(companyId, viewMode) {
  if (!companyId) return "";
  const url = `/results/rpt/${companyId}/${viewMode}/`;
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return "";
    const html = await res.text();
    const doc = parseHtml(html);
    const table = doc.querySelector("table");
    if (!table) return "";
    const md = rptTableToMarkdown(table);
    if (!md) return "";
    return (
      "## Related Party Transactions\n\n" +
      "_Screener notes this is an experimental, annual-report-extracted feature and may contain errors._\n\n" +
      `${md}\n`
    );
  } catch {
    return "";
  }
}

const CORPORATE_ACTION_TABS = [
  { id: "corporate-actions-equityhistory", label: "Equity History" },
  { id: "corporate-actions-esops", label: "ESOPs" },
  { id: "corporate-actions-dividend", label: "Dividend" },
  { id: "corporate-actions-merger", label: "Merger" },
  { id: "corporate-actions-bonus", label: "Bonus" },
  { id: "corporate-actions-split", label: "Split" },
];

/** Corporate Actions modal: Equity History, ESOPs, Dividend, Merger, Bonus, Split tabs. */
export async function fetchCorporateActions(companyId) {
  if (!companyId) return "";
  const url = `/company/actions/${companyId}/`;
  try {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const doc = parseHtml(html);

    const blocks = CORPORATE_ACTION_TABS.map(({ id, label }) => {
      const container = doc.getElementById(id);
      const table = container && container.querySelector("table");
      const md = table ? tableToMarkdown(table) : "";
      return md ? `### ${label}\n\n${md}\n` : "";
    }).filter(Boolean);

    if (blocks.length === 0) return "";
    return `## Corporate Actions\n\n${blocks.join("\n")}`;
  } catch {
    return "";
  }
}

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Company Insights, Quarterly view. The Yearly view is server-rendered
 * (see `dom-sections.js#insightsYearly`); this is the only section of the
 * two that needs a fetch, and the only endpoint in this project that's a
 * CSRF-guarded POST instead of a plain GET.
 */
export async function fetchInsightsQuarterly(companyId, viewMode) {
  if (!companyId) return "";
  const csrfToken = getCsrfToken();
  if (!csrfToken) return "";
  const url = `/insights/company/${companyId}/quarter/?is_consolidated=${viewMode === "consolidated" ? 1 : 0}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": csrfToken },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const doc = parseHtml(html);
    const table = doc.querySelector("table");
    const md = insightsTableToMarkdown(table);
    if (!md) return "";
    return (
      "## Company Insights — Quarterly (Screener AI-extracted, beta; unverified — treat as a lead, not ground truth)\n\n" +
      `${md}\n`
    );
  } catch {
    return "";
  }
}
