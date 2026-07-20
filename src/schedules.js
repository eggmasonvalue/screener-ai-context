/**
 * Expandable "+"-row breakdowns (Sales+, Expenses+, Borrowings+, FIIs+, ...)
 * are NOT present in the server-rendered DOM — Screener fetches them lazily
 * from a same-origin JSON endpoint when you click the row. Since it's
 * same-origin, a content script can call it directly with no extra
 * permissions and no click simulation:
 *
 *   GET /api/company/<companyId>/schedules/?parent=<Row Name>&section=<section>
 *
 * `companyId` is read from `[data-company-id]` in the page DOM (distinct
 * from the `data-warehouse-id` used by the peers/quick_ratios endpoints,
 * which this tool does not need).
 *
 * The `section` param per statement was confirmed live against ITC
 * (consolidated) on 2026-07-18:
 *   - profit-loss  -> annual P&L rows
 *   - quarters     -> quarterly P&L rows
 *   - balance-sheet -> balance sheet rows
 *   - cash-flow    -> cash flow rows
 *
 * The shareholding pattern breakdown (FIIs+/DIIs+/Government+/Public+) uses
 * a different, not-yet-confirmed section value (tried "shareholding" and
 * "shp", both 404). It's left out of PARENTS below until confirmed rather
 * than guessing further; `fetchSchedulesForSection` fails soft on 404s
 * regardless, so adding a wrong guess here would silently do nothing anyway.
 */

const PARENTS = [
  { label: "Sales breakdown (annual)", parent: "Sales", section: "profit-loss" },
  { label: "Expenses breakdown (annual)", parent: "Expenses", section: "profit-loss" },
  { label: "Other Income breakdown (annual)", parent: "Other Income", section: "profit-loss" },
  { label: "Net Profit breakdown (annual)", parent: "Net Profit", section: "profit-loss" },
  { label: "Sales breakdown (quarterly)", parent: "Sales", section: "quarters" },
  { label: "Expenses breakdown (quarterly)", parent: "Expenses", section: "quarters" },
  { label: "Borrowings breakdown", parent: "Borrowings", section: "balance-sheet" },
  { label: "Other Liabilities breakdown", parent: "Other Liabilities", section: "balance-sheet" },
  { label: "Fixed Assets breakdown", parent: "Fixed Assets", section: "balance-sheet" },
  { label: "Other Assets breakdown", parent: "Other Assets", section: "balance-sheet" },
  {
    label: "Cash from Operating Activity breakdown",
    parent: "Cash from Operating Activity",
    section: "cash-flow",
  },
  {
    label: "Cash from Investing Activity breakdown",
    parent: "Cash from Investing Activity",
    section: "cash-flow",
  },
  {
    label: "Cash from Financing Activity breakdown",
    parent: "Cash from Financing Activity",
    section: "cash-flow",
  },
];

export function getCompanyId() {
  const el = document.querySelector("[data-company-id]");
  return el ? el.getAttribute("data-company-id") : null;
}

function jsonToMarkdownTable(json) {
  // Each row's value object carries Screener's own `isExpandable` field
  // alongside the period columns (its value is the row's raw onclick JS,
  // e.g. `Company.showSchedule("X", "profit-loss", this)`) — strip it from
  // both the row list and every row's period set so it never surfaces as a
  // phantom "period" column.
  const rows = Object.entries(json).filter(([k]) => k !== "isExpandable");
  if (rows.length === 0) return "";
  const periods = Object.keys(rows[0][1]).filter((k) => k !== "isExpandable");
  const header = `| Line | ${periods.join(" | ")} |`;
  const sep = `| --- | ${periods.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    ([name, values]) => `| ${name} | ${periods.map((p) => values[p] ?? "").join(" | ")} |`,
  );
  return [header, sep, ...body].join("\n");
}

async function fetchSchedule(companyId, { label, parent, section }) {
  const url = `/api/company/${companyId}/schedules/?parent=${encodeURIComponent(parent)}&section=${section}&consolidated=`;
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return "";
    const json = await res.json();
    const table = jsonToMarkdownTable(json);
    return table ? `## ${label}\n\n${table}\n` : "";
  } catch {
    return "";
  }
}

/**
 * Fetch the known expandable breakdowns that belong to one statement
 * section ("quarters" | "profit-loss" | "balance-sheet" | "cash-flow"), in
 * parallel, dropping empty/failed ones. Lets the caller place each
 * statement's breakdowns directly after that statement's own table instead
 * of dumping every breakdown in one block at the end of the document.
 */
export async function fetchSchedulesForSection(companyId, section) {
  if (!companyId) return "";
  const parents = PARENTS.filter((p) => p.section === section);
  const results = await Promise.all(parents.map((p) => fetchSchedule(companyId, p)));
  return results.filter(Boolean).join("\n");
}
