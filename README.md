# BISQ // KOINLY

Static tool for importing Bisq transaction exports into a Koinly Universal CSV.

## Privacy

This application is **100% client-side**: both CSV files are read and processed inside the browser. There is no backend, no upload request, and no file storage. The final CSV is generated as a local download.

## Usage

1. Open the app published on GitHub Pages.
2. Select `tradeHistory.csv` and `transactions.csv`.
3. Enter the fiat currency, usually `EUR`.
4. Download `koinly-on-chain.csv` and import it into Koinly.

`transactions.csv` provides Bisq transaction details and `Transaction ID`, preserved in the `TxHash` column. `tradeHistory.csv` adds trade prices, fiat amounts, and purchased BTC. Arbitration refunds do not create synthetic fiat deposits.

## Local development

```bash
python3 -m http.server 8777
```

Then open `http://127.0.0.1:8777/`.

## GitHub Pages

In the repository: **Settings → Pages → Deploy from a branch → main → / (root)**.
