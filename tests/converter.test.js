import test from "node:test";
import assert from "node:assert/strict";
import { convertFiles, parseBtc, btcText } from "../converter.js";

const trades = `Trade ID,Date/Time,Amount in BTC,Amount,Currency,Trade Fee BSQ,Status
t1,19 Aug 2026 17:17:26,0.01000000,587,EUR,,Completed`;
const transactions = `Date/Time,Trade ID,Details,Transaction ID,Amount in BTC
19 Aug 2026 17:46:51,t1-abc,Multisig payout,hash1,0.012534
19 Aug 2026 17:47:51,,Received funds,hash2,0.001`;

test("preserves BTC precision without floats", () => {
  assert.equal(btcText(parseBtc("0.012534")), "0.012534");
  assert.equal(btcText(parseBtc("-0.00000001")), "-0.00000001");
});

test("converts payout and collateral", () => {
  const result = convertFiles(trades, transactions);
  assert.equal(result.rows.length, 4);
  assert.equal(result.rows[1].Label, "buy");
  assert.equal(result.rows[2].Label, "transfer");
});

test("detects duplicates and unknown details", () => {
  const duplicate = `${transactions}\n19 Aug 2026 17:46:51,t1-abc,Multisig payout,hash1,0.012534`;
  const result = convertFiles(trades, duplicate.replace("Received funds", "Something new"));
  assert.equal(result.report.duplicates, 1);
  assert.equal(result.report.unknownTransactions, 1);
});

test("rejects missing required columns", () => {
  assert.throws(() => convertFiles("Trade ID\nx\n", transactions), /missing columns/);
});
