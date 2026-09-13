import { HEADERS } from "./converter.js";

function escapeCsv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function csvText(rows) {
  return [HEADERS, ...rows.map(item => HEADERS.map(header => item[header]))]
    .map(values => values.map(escapeCsv).join(","))
    .join("\r\n");
}

export function downloadCsv(rows) {
  const url = URL.createObjectURL(new Blob([csvText(rows)], {
    type: "text/csv;charset=utf-8",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "koinly-on-chain.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
