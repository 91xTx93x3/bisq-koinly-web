const HEADERS = ["Date","Sent Amount","Sent Currency","Received Amount","Received Currency","Fee Amount","Fee Currency","Label","Description","TxHash"];
const BTC_SCALE = 100000000n;

function csv(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell); if (row.some(value => value !== "")) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift().map(value => value.trim());
  return rows.map(values => Object.fromEntries(headers.map((header, i) => [header, (values[i] || "").trim()])));
}
function btc(value) {
  const raw = String(value || "0").trim(), negative = raw.startsWith("-");
  const [whole, fraction = ""] = raw.replace(/^[+-]/, "").split(".");
  const result = BigInt(whole || "0") * BTC_SCALE + BigInt((fraction + "00000000").slice(0, 8));
  return negative ? -result : result;
}
function btcText(value) {
  const sign = value < 0n ? "-" : ""; const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / BTC_SCALE}.${(absolute % BTC_SCALE).toString().padStart(8, "0")}`.replace(/\.?0+$/, "");
}
function money(value) { return String(value || "").trim(); }
function date(value) {
  const parsed = new Date(`${value.trim()} UTC`);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid date: ${value}`);
  return parsed.toISOString().replace(".000Z", "+00:00");
}
function row(values) { return Object.fromEntries(HEADERS.map((header, i) => [header, values[i] ?? ""])); }
function mapFiles(tradeText, transactionText, fiat) {
  const trades = csv(tradeText), transactions = csv(transactionText);
  const tradesById = new Map(trades.map(trade => [trade["Trade ID"], trade]));
  const refunds = new Set(transactions.filter(tx => tx.Details.toLowerCase() === "refund from arbitration").map(tx => tx["Trade ID"].split("-", 1)[0]));
  const output = [], hasOnChain = transactions.length > 0;
  for (const trade of trades) {
    if ((trade.Status || "").toLowerCase() !== "completed") continue;
    if (!refunds.has(trade["Trade ID"])) output.push(row([date(trade["Date/Time"]), "", "", money(trade.Amount), trade.Currency.toUpperCase(), "", "", "deposit", `Fiat deposited from bank for Bisq trade ${trade["Trade ID"]}`, ""]));
    if (trade["Trade Fee BSQ"]) output.push(row([date(trade["Date/Time"]), trade["Trade Fee BSQ"], "BSQ", "", "", "", "", "fee", `Bisq trade fee for ${trade["Trade ID"]}`, ""]));
    if (!hasOnChain && trade["Trade Fee BTC"]) output.push(row([date(trade["Date/Time"]), trade["Trade Fee BTC"], "BTC", "", "", "", "", "fee", `Bisq trade fee for ${trade["Trade ID"]}`, ""]));
    if (!hasOnChain && trade["Transaction Fee"]) output.push(row([date(trade["Date/Time"]), trade["Transaction Fee"], "BTC", "", "", "", "", "fee", `Bisq mining fee for ${trade["Trade ID"]}`, ""]));
  }
  for (const tx of transactions) {
    const amount = btc(tx["Amount in BTC"]); if (amount === 0n) continue;
    const details = tx.Details.toLowerCase(), prefix = (tx["Trade ID"] || "").split("-", 1)[0];
    const trade = tradesById.get(prefix), hash = tx["Transaction ID"], when = date(tx["Date/Time"]);
    if (details === "maker and tx fee" || details === "taker and tx fee") output.push(row([when, btcText(-amount), "BTC", "", "", "", "", "fee", `Bisq on-chain fee: ${tx.Details}`, hash]));
    else if (details === "multisig deposit" && trade) output.push(row([when, btcText(-amount), "BTC", "", "", "", "", "transfer", `Bisq escrow deposit (on-chain amount) for ${prefix}`, hash]));
    else if (details === "multisig payout" && trade) {
      const bought = btc(trade["Amount in BTC"]), collateral = amount - bought;
      output.push(row([when, money(trade.Amount), trade.Currency.toUpperCase(), money(trade["Amount in BTC"]), "BTC", "", "", "buy", `Bisq trade ${prefix}; BTC allocated from on-chain payout`, hash]));
      if (collateral > 0n) output.push(row([when, "", "", btcText(collateral), "BTC", "", "", "transfer", `Bisq escrow collateral returned for ${prefix}`, hash]));
    } else if (["withdrawn from wallet","received funds","refund from arbitration","refund collateral"].includes(details)) {
      const sent = amount < 0n;
      output.push(row([when, sent ? btcText(-amount) : "", sent ? "BTC" : "", sent ? "" : btcText(amount), sent ? "" : "BTC", "", "", sent ? "withdrawal" : "transfer", `Bisq wallet transaction: ${tx.Details}`, hash]));
    }
  }
  return output;
}
function escapeCsv(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function download(rows) {
  const text = [HEADERS, ...rows.map(item => HEADERS.map(header => item[header]))].map(values => values.map(escapeCsv).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], {type:"text/csv;charset=utf-8"}));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "koinly-on-chain.csv"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelector("#form").addEventListener("submit", async event => {
  event.preventDefault(); const message = document.querySelector("#message");
  try {
    const trade = document.querySelector("#trade").files[0], transactions = document.querySelector("#transactions").files[0];
    if (!trade || !transactions) throw new Error("Select both CSV files.");
    const rows = mapFiles(await trade.text(), await transactions.text(), document.querySelector("#fiat").value.trim().toUpperCase());
    download(rows); message.hidden = false; message.textContent = `CSV generated: ${rows.length} rows. The download was created in your browser.`;
  } catch (error) { message.hidden = false; message.textContent = `Could not generate the file: ${error.message}`; }
});
