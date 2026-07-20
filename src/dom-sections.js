/**
 * Static, server-rendered sections of a screener.in company page.
 *
 * Selectors below were captured against a live company page (ITC,
 * consolidated view) on 2026-07-18. Screener does not publish a markup
 * contract, so if extraction silently returns empty sections after a
 * Screener redesign, re-inspect the live DOM and update the ids/selectors
 * here — this is expected maintenance, not a bug in the approach.
 */
import { tableToMarkdown, section } from "./markdown.js";
import { insightsTableToMarkdown } from "./extras.js";

function firstTable(containerId) {
  const el = document.getElementById(containerId);
  const table = el && el.querySelector("table");
  return table ? tableToMarkdown(table) : "";
}

export function companyTitle() {
  const h1 = document.querySelector("h1");
  return h1 ? h1.textContent.trim() : document.title;
}

/** Overview ratio box (CMP, P/E, Market Cap, ROCE, ROE, etc). */
export function overviewRatios() {
  return section("Key Ratios (overview)", firstTable("top-ratios"));
}

export function quarterlyResults() {
  return section("Quarterly Results", firstTable("quarters"));
}

export function profitAndLoss() {
  return section("Profit & Loss", firstTable("profit-loss"));
}

export function balanceSheet() {
  return section("Balance Sheet", firstTable("balance-sheet"));
}

export function cashFlow() {
  return section("Cash Flow", firstTable("cash-flow"));
}

export function ratios() {
  return section("Ratios", firstTable("ratios"));
}

export function shareholdingPattern() {
  return section("Shareholding Pattern (currently displayed view)", firstTable("shareholding"));
}

function firstInsightsTable(containerId) {
  const el = document.getElementById(containerId);
  const table = el && el.querySelector("table");
  return insightsTableToMarkdown(table);
}

/**
 * Company Insights — custom, non-standard KPIs (e.g. "FMCG Others Segment
 * EBITDA", "UNNATI eB2B Outlet Coverage") that Screener's own AI extracts
 * from a company's annual reports/presentations/concalls. Explicitly
 * labeled "In beta" and "Extracted by Screener AI" on the page itself —
 * lower confidence than the hard financial-statement sections, but far
 * cheaper to read here than to have the harness re-derive the same numbers
 * from the underlying documents via its PDF tools. The default (Yearly)
 * view is already server-rendered; the Quarterly view is a separate fetch,
 * see `extras.js`. Per-cell source citations (which doc/page a number came
 * from) are deliberately dropped — the section-level beta/unverified
 * disclaimer already covers that, and citing sources per cell would bloat
 * the document for little benefit.
 */
export function insightsYearly() {
  return section(
    "Company Insights — Yearly (Screener AI-extracted, beta; unverified — treat as a lead, not ground truth)",
    firstInsightsTable("insights"),
  );
}

export function peerComparison() {
  return section("Peer Comparison (currently displayed columns/rows)", firstTable("peers"));
}
