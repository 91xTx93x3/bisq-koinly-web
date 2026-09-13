import { parseCsv, validateColumns } from "./csv.js";

export const HEADERS = [
  "Date", "Sent Amount", "Sent Currency", "Received Amount", "Received Currency",
  "Fee Amount", "Fee Currency", "Label", "Description", "TxHash",
];
const BTC_SCALE = 100000000n;
const TRADE_COLUMNS = ["Trade ID", "Date/Time", "Amount in BTC", "Amount", "Currency", "Status"];
const TRANSACTION_COLUMNS = ["Date/Time", "Details", "Transaction ID", "Amount in BTC"];
const KNOWN_DETAILS = new Set([
  "maker and tx fee", "taker and tx fee", "multisig deposit", "multisig payout",
  "withdrawn from wallet", "received funds", "refund from arbitration", "refund collateral",
]);

function normalized(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseBtc(value, field = "BTC") {
  const raw = String(value ?? "").trim();
  if (!raw || !/^[+-]?\d+(\.\d+)?$/.test(raw)) throw new Error(`${field}: invalid BTC amount (${value}).`);
  const negative = raw.startsWith("-");
  const unsigned = raw.replace(/^[+-]/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  if (fraction.length > 8) throw new Error(`${field}: supports at most 8 decimal places.`);
  const result = BigInt(whole) * BTC_SCALE
    + BigInt((fraction + "00000000").slice(0, 8));
  return negative ? -result : result;
}

export function btcText(value) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / BTC_SCALE;
  const fraction = (absolute % BTC_SCALE).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

function date(value, field = "Date/Time") {
  const parsed = new Date(`${String(value).trim()} UTC`);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${field}: invalid date (${value}).`);
  return parsed.toISOString().replace(".000Z", "+00:00");
}

function fiatAmount(value, field) {
  const raw = String(value ?? "").trim();
  if (!raw || !/^[+]?\d+(\.\d+)?$/.test(raw)) throw new Error(`${field}: invalid fiat amount (${value}).`);
  return raw.replace(/^\+/, "");
}

function row(values) {
  return Object.fromEntries(HEADERS.map((header, index) => [header, values[index] ?? ""]));
}

function tradePrefix(value) {
  return String(value ?? "").split("-", 1)[0];
}

export function convertFiles(tradeText, transactionText) {
  const trades = parseCsv(tradeText, "tradeHistory.csv");
  const transactions = parseCsv(transactionText, "transactions.csv");
  validateColumns(trades, TRADE_COLUMNS, "tradeHistory.csv");
  validateColumns(transactions, TRANSACTION_COLUMNS, "transactions.csv");

  const warnings = [];
  const seenTrades = new Set();
  const uniqueTrades = [];
  let duplicates = 0;
  for (const [index, trade] of trades.entries()) {
    const id = trade["Trade ID"];
    if (!id) throw new Error(`tradeHistory.csv, row ${index + 2}: empty Trade ID.`);
    if (seenTrades.has(id)) {
      duplicates += 1;
      warnings.push(`${id}: duplicate trade skipped.`);
      continue;
    }
    seenTrades.add(id);
    if (normalized(trade.Status) !== "completed") continue;
    fiatAmount(trade.Amount, `Trade ${id}`);
    parseBtc(trade["Amount in BTC"], `Trade ${id}`);
    if (!trade.Currency) throw new Error(`Trade ${id}: empty fiat currency.`);
    date(trade["Date/Time"], `Trade ${id}`);
    uniqueTrades.push(trade);
  }
  const tradesById = new Map(uniqueTrades.map(trade => [trade["Trade ID"], trade]));
  const seenTransactions = new Set();
  const uniqueTransactions = [];
  for (const [index, transaction] of transactions.entries()) {
    const txid = transaction["Transaction ID"];
    if (!txid) throw new Error(`transactions.csv, row ${index + 2}: empty Transaction ID.`);
    if (seenTransactions.has(txid)) {
      duplicates += 1;
      warnings.push(`${txid}: duplicate transaction skipped.`);
      continue;
    }
    seenTransactions.add(txid);
    parseBtc(transaction["Amount in BTC"], `Transaction ${txid}`);
    date(transaction["Date/Time"], `Transaction ${txid}`);
    uniqueTransactions.push(transaction);
  }

  const rows = [];
  const refunds = new Set(uniqueTransactions
    .filter(transaction => normalized(transaction.Details) === "refund from arbitration")
    .map(transaction => tradePrefix(transaction["Trade ID"])));
  for (const trade of uniqueTrades) {
    const id = trade["Trade ID"];
    const currency = trade.Currency.toUpperCase();
    const tradeDate = date(trade["Date/Time"]);
    if (!refunds.has(id)) rows.push(row([
      tradeDate, "", "", fiatAmount(trade.Amount, `Trade ${id}`), currency, "", "",
      "deposit", `Fiat deposited from bank for Bisq trade ${id}`, "",
    ]));
    if (trade["Trade Fee BSQ"]) rows.push(row([
      tradeDate, trade["Trade Fee BSQ"], "BSQ", "", "", "", "",
      "fee", `Bisq trade fee for ${id}`, "",
    ]));
    if (!uniqueTransactions.length && trade["Trade Fee BTC"]) rows.push(row([
      tradeDate, trade["Trade Fee BTC"], "BTC", "", "", "", "",
      "fee", `Bisq trade fee for ${id}`, "",
    ]));
    if (!uniqueTransactions.length && trade["Transaction Fee"]) rows.push(row([
      tradeDate, trade["Transaction Fee"], "BTC", "", "", "", "",
      "fee", `Bisq mining fee for ${id}`, "",
    ]));
  }

  let unknownTransactions = 0;
  for (const transaction of uniqueTransactions) {
    const amount = parseBtc(transaction["Amount in BTC"]);
    if (amount === 0n) continue;
    const details = normalized(transaction.Details);
    const prefix = tradePrefix(transaction["Trade ID"]);
    const trade = tradesById.get(prefix);
    const hash = transaction["Transaction ID"];
    const when = date(transaction["Date/Time"]);
    if (!KNOWN_DETAILS.has(details)) {
      unknownTransactions += 1;
      warnings.push(`${hash}: unknown detail "${transaction.Details}", skipped.`);
      continue;
    }
    if (details === "maker and tx fee" || details === "taker and tx fee") rows.push(row([
      when, btcText(amount), "BTC", "", "", "", "", "fee", `Bisq on-chain fee: ${transaction.Details}`, hash,
    ]));
    else if (details === "multisig deposit") {
      if (!trade) {
        warnings.push(`${hash}: multisig deposit has no associated trade, skipped.`);
        continue;
      }
      rows.push(row([
        when, btcText(-amount), "BTC", "", "", "", "", "transfer",
        `Bisq escrow deposit (on-chain amount) for ${prefix}`, hash,
      ]));
    } else if (details === "multisig payout") {
      if (!trade) {
        warnings.push(`${hash}: multisig payout has no associated trade, skipped.`);
        continue;
      }
      const bought = parseBtc(trade["Amount in BTC"]);
      const collateral = amount - bought;
      if (collateral < 0n) warnings.push(`${hash}: payout is lower than the purchased BTC for ${prefix}.`);
      rows.push(row([
        when, fiatAmount(trade.Amount, `Trade ${prefix}`), trade.Currency.toUpperCase(),
        trade["Amount in BTC"], "BTC", "", "", "buy",
        `Bisq trade ${prefix}; BTC allocated from on-chain payout`, hash,
      ]));
      if (collateral > 0n) rows.push(row([
        when, "", "", btcText(collateral), "BTC", "", "", "transfer",
        `Bisq escrow collateral returned for ${prefix}`, hash,
      ]));
    } else if (["withdrawn from wallet", "received funds", "refund from arbitration", "refund collateral"].includes(details)) {
      const sent = amount < 0n;
      rows.push(row([
        when, sent ? btcText(-amount) : "", sent ? "BTC" : "",
        sent ? "" : btcText(amount), sent ? "" : "BTC", "", "",
        sent ? "withdrawal" : "transfer", `Bisq wallet transaction: ${transaction.Details}`, hash,
      ]));
    }
  }
  return {
    rows,
    report: {
      tradesProcessed: uniqueTrades.length,
      transactionsProcessed: uniqueTransactions.length,
      duplicates,
      unknownTransactions,
      warnings,
      rows,
    },
  };
}
