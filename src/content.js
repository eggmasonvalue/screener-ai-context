import { assembleDocument } from "./markdown.js";
import {
  companyTitle,
  overviewRatios,
  quarterlyResults,
  profitAndLoss,
  balanceSheet,
  cashFlow,
  ratios,
  shareholdingPattern,
  peerComparison,
  insightsYearly,
} from "./dom-sections.js";
import { getCompanyId, fetchSchedulesForSection } from "./schedules.js";
import {
  getViewMode,
  fetchSegmentsForSection,
  fetchRelatedPartyTransactions,
  fetchCorporateActions,
  fetchInsightsQuarterly,
} from "./extras.js";

const BUTTON_ID = "screener-ai-context-button";

/**
 * Section order follows "primary data takes precedence": each statement's
 * own line-item/segment breakdowns sit directly after that statement
 * (not lumped together at the end), then Corporate Actions and Related
 * Party Transactions (concrete, dated, sourced records), then Company
 * Insights (Screener AI-extracted, beta — lower confidence than the above,
 * but still real underlying figures), then Shareholding Pattern, Ratios
 * and Peer Comparison last (aggregated/derived views).
 */
async function buildMarkdown() {
  const title = companyTitle();
  const companyId = getCompanyId();
  const viewMode = getViewMode();

  const [
    quartersSchedules,
    quartersSegments,
    profitLossSchedules,
    profitLossSegments,
    balanceSheetSchedules,
    cashFlowSchedules,
    corporateActions,
    relatedPartyTransactions,
    insightsQuarterly,
  ] = await Promise.all([
    fetchSchedulesForSection(companyId, "quarters"),
    fetchSegmentsForSection(companyId, viewMode, "quarters"),
    fetchSchedulesForSection(companyId, "profit-loss"),
    fetchSegmentsForSection(companyId, viewMode, "profit-loss"),
    fetchSchedulesForSection(companyId, "balance-sheet"),
    fetchSchedulesForSection(companyId, "cash-flow"),
    fetchCorporateActions(companyId),
    fetchRelatedPartyTransactions(companyId, viewMode),
    fetchInsightsQuarterly(companyId, viewMode),
  ]);

  return assembleDocument(title, [
    overviewRatios(),
    quarterlyResults(),
    quartersSchedules,
    quartersSegments,
    profitAndLoss(),
    profitLossSchedules,
    profitLossSegments,
    balanceSheet(),
    balanceSheetSchedules,
    cashFlow(),
    cashFlowSchedules,
    corporateActions,
    relatedPartyTransactions,
    insightsYearly(),
    insightsQuarterly,
    shareholdingPattern(),
    ratios(),
    peerComparison(),
  ]);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function downloadMarkdown(title, markdown) {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(title)}-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function setButtonState(button, text, disabled) {
  button.textContent = text;
  button.disabled = disabled;
}

function injectButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;bottom:16px;right:16px;z-index:2147483647;display:flex;gap:8px;";

  const copyButton = document.createElement("button");
  copyButton.id = BUTTON_ID;
  copyButton.textContent = "Copy AI context (.md)";
  copyButton.style.cssText =
    "padding:8px 12px;border-radius:6px;border:none;background:#4b3fa8;color:#fff;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);";

  const downloadButton = document.createElement("button");
  downloadButton.textContent = "Download .md";
  downloadButton.style.cssText = copyButton.style.cssText;

  copyButton.addEventListener("click", async () => {
    setButtonState(copyButton, "Building…", true);
    try {
      const markdown = await buildMarkdown();
      await navigator.clipboard.writeText(markdown);
      setButtonState(copyButton, "Copied ✓", false);
    } catch (err) {
      console.error("screener-ai-context: failed to build/copy markdown", err);
      setButtonState(copyButton, "Failed — see console", false);
    } finally {
      setTimeout(() => setButtonState(copyButton, "Copy AI context (.md)", false), 2000);
    }
  });

  downloadButton.addEventListener("click", async () => {
    setButtonState(downloadButton, "Building…", true);
    try {
      const title = companyTitle();
      const markdown = await buildMarkdown();
      downloadMarkdown(title, markdown);
    } catch (err) {
      console.error("screener-ai-context: failed to build/download markdown", err);
    } finally {
      setButtonState(downloadButton, "Download .md", false);
    }
  });

  container.append(copyButton, downloadButton);
  document.body.appendChild(container);
}

injectButton();
