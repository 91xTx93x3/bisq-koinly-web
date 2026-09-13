# Bisq to Koinly

Static web application for converting Bisq exports into a Koinly Universal
CSV.

## Usage

Open the application on GitHub Pages, select `tradeHistory.csv` and
`transactions.csv`, then click **REVIEW CSV**. All processing runs locally in
JavaScript: files are never uploaded or stored on a server.

You can also serve the files locally with any static server:

```bash
npx serve .
```

The `TxHash` column preserves the `Transaction ID` from `transactions.csv`.
Synthetic fiat deposits have no on-chain hash and leave that column empty. The
application handles purchases, fees, multisig deposits, collateral, wallet
withdrawals, received funds, and refunds.

No backend, dependencies, installation, or internet connection is required
during conversion.
