/**
 * Markdown helpers: turn Screener's rendered tables into compact GFM
 * markdown tables without any summarization/lossy processing — the whole
 * point is to hand the AI harness exact figures.
 */

/** Collapse whitespace Screener leaves inside table cells. */
function cellText(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

/**
 * Convert a <table> element to a GFM markdown table.
 * Keeps header row(s) as the first `<tr>` containing `<th>`, everything
 * else as body rows. Screener's tables are consistently one header row.
 */
export function tableToMarkdown(table) {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return "";

  const lines = [];
  rows.forEach((row, i) => {
    const cells = Array.from(row.querySelectorAll("th,td")).map(cellText);
    if (cells.length === 0) return;
    lines.push(`| ${cells.join(" | ")} |`);
    if (i === 0) {
      lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
    }
  });
  return lines.join("\n");
}

/** Wrap a section's title + body into a markdown block. */
export function section(title, body) {
  if (!body || !body.trim()) return "";
  return `## ${title}\n\n${body.trim()}\n`;
}

/** Join non-empty sections with blank-line separation. */
export function assembleDocument(title, sections) {
  const body = sections.filter(Boolean).join("\n");
  return `# ${title} — Screener structured data\n\n${body}`;
}
