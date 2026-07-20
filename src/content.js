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
 * (not lumped together at the end), then Corporate Actions (concrete,
 * dated, sourced records), then Company Insights (Screener AI-extracted,
 * beta — lower confidence than the above, but still real underlying
 * figures), then Shareholding Pattern and Ratios, then Peer Comparison and
 * Related Party Transactions last. RPT is deliberately placed after Peer
 * Comparison (rather than next to Corporate Actions, despite being a
 * similarly concrete/dated record) because for conglomerates/complex group
 * structures it can be very large, and its detail is the least likely of
 * the "concrete record" sections to be needed for a typical numeric
 * question — better to let it trail off the end than crowd out
 * everything after it.
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
    insightsYearly(),
    insightsQuarterly,
    shareholdingPattern(),
    ratios(),
    peerComparison(),
    relatedPartyTransactions,
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

// navigator.clipboard.writeText() needs a secure, focused, user-gesture
// context; some mobile Chromium extension content-script contexts (seen on
// Android browsers with extension support) reject or silently no-op it.
// Falls back to the legacy execCommand('copy') via a hidden textarea, which
// has broader mobile support despite being deprecated on desktop.
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (err) {
    console.warn("screener-ai-context: navigator.clipboard failed, falling back", err);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.cssText = "position:fixed;top:-9999px;left:-9999px;";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("execCommand('copy') returned false");
  } finally {
    textarea.remove();
  }
}

function setButtonState(button, text, disabled) {
  button.textContent = text;
  button.disabled = disabled;
}

// `pointer: coarse` picks out real touchscreens (phones/tablets), not
// desktop mice/trackpads — used to branch layout, not to detect "mobile"
// generally. Evaluated once at inject time; this is a same-page content
// script, so orientation/device doesn't change mid-session.
const isCoarsePointer =
  typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

const LABELS = isCoarsePointer
  ? { copy: "📋 .md", download: "⬇️ .md", building: "…", copied: "✓", failed: "⚠️" }
  : {
      copy: "Copy AI context (.md)",
      download: "Download .md",
      building: "Building…",
      copied: "Copied ✓",
      failed: "Failed — see console",
    };

function injectButton() {
  if (document.getElementById(BUTTON_ID)) return;

  // Desktop: unchanged from the original — small pill buttons, bottom-right.
  // Coarse-pointer (phones/tablets): icon-only labels, top-right — Quetta
  // (and likely other Android browsers with extension support) render their
  // own bottom toolbar/tab-switcher bar, which a bottom-right overlay
  // collides with; there's no reliable bottom "safe" zone to target since
  // that chrome isn't part of the page's own viewport-safe-area insets.
  const container = document.createElement("div");
  container.style.cssText = isCoarsePointer
    ? "position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;gap:6px;"
    : "position:fixed;bottom:16px;right:16px;z-index:2147483647;display:flex;gap:8px;";

  const buttonStyle = isCoarsePointer
    ? "padding:6px 10px;border-radius:6px;border:none;background:#4b3fa8;color:#fff;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);"
    : "padding:8px 12px;border-radius:6px;border:none;background:#4b3fa8;color:#fff;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);";

  const copyButton = document.createElement("button");
  copyButton.id = BUTTON_ID;
  copyButton.textContent = LABELS.copy;
  copyButton.style.cssText = buttonStyle;

  const downloadButton = document.createElement("button");
  downloadButton.textContent = LABELS.download;
  downloadButton.style.cssText = buttonStyle;

  copyButton.addEventListener("click", async () => {
    setButtonState(copyButton, LABELS.building, true);
    try {
      const markdown = await buildMarkdown();
      await copyToClipboard(markdown);
      setButtonState(copyButton, LABELS.copied, false);
    } catch (err) {
      console.error("screener-ai-context: failed to build/copy markdown", err);
      setButtonState(copyButton, LABELS.failed, false);
    } finally {
      setTimeout(() => setButtonState(copyButton, LABELS.copy, false), 2000);
    }
  });

  downloadButton.addEventListener("click", async () => {
    setButtonState(downloadButton, LABELS.building, true);
    try {
      const title = companyTitle();
      const markdown = await buildMarkdown();
      downloadMarkdown(title, markdown);
    } catch (err) {
      console.error("screener-ai-context: failed to build/download markdown", err);
    } finally {
      setButtonState(downloadButton, LABELS.download, false);
    }
  });

  container.append(copyButton, downloadButton);
  document.body.appendChild(container);
}

injectButton();
