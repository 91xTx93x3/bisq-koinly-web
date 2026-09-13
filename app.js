import { convertFiles } from "./converter.js";
import { downloadCsv } from "./download.js";

const form = document.querySelector("#form");
const message = document.querySelector("#message");
const preview = document.querySelector("#preview");
const previewBody = document.querySelector("#preview-body");
const downloadButton = document.querySelector("#download");
const resetButton = document.querySelector("#reset");
let pendingResult = null;

function showMessage(text, type = "error") {
  message.hidden = false;
  message.className = `message ${type}`;
  message.textContent = text;
}

function renderPreview(result) {
  const { report } = result;
  const values = [
    ["Trades completados", report.tradesProcessed],
    ["Transacciones leídas", report.transactionsProcessed],
    ["Filas generadas", report.rows.length],
    ["Duplicados omitidos", report.duplicates],
    ["Transacciones desconocidas", report.unknownTransactions],
    ["Advertencias", report.warnings.length],
  ];
  previewBody.innerHTML = values.map(([label, value]) =>
    `<div><dt>${label}</dt><dd>${value}</dd></div>`
  ).join("");
  const warnings = report.warnings.length
    ? `<ul class="warnings">${report.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`
    : "<p class=\"success-text\">No se han detectado advertencias.</p>";
  document.querySelector("#warnings").innerHTML = warnings;
  preview.hidden = false;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  pendingResult = null;
  preview.hidden = true;
  downloadButton.disabled = true;
  try {
    const tradeFile = document.querySelector("#trade").files[0];
    const transactionFile = document.querySelector("#transactions").files[0];
    if (!tradeFile || !transactionFile) throw new Error("Selecciona los dos archivos CSV.");
    const [tradeText, transactionText] = await Promise.all([
      tradeFile.text(), transactionFile.text(),
    ]);
    const result = convertFiles(tradeText, transactionText);
    pendingResult = result;
    renderPreview(result);
    downloadButton.disabled = false;
    showMessage("Revisión completada. Comprueba las advertencias antes de descargar.", "success");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "No se pudo procesar la conversión.");
  }
});

downloadButton.addEventListener("click", () => {
  if (!pendingResult) return;
  downloadCsv(pendingResult.rows);
  showMessage(`CSV generado correctamente: ${pendingResult.rows.length} filas.`, "success");
});

resetButton.addEventListener("click", () => {
  form.reset();
  pendingResult = null;
  preview.hidden = true;
  downloadButton.disabled = true;
  message.hidden = true;
});
