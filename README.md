# BISQ // KOINLY

Conversor estático para preparar un CSV universal de Koinly a partir de las exportaciones de Bisq.

## Privacidad

Esta aplicación es **100% client-side**: los dos CSV se leen y procesan dentro del navegador. No existe backend, no se hacen peticiones de subida y no se guardan archivos. El CSV final se genera como una descarga local.

## Uso

1. Abre la aplicación publicada en GitHub Pages.
2. Selecciona `tradeHistory.csv` y `transactions.csv`.
3. Introduce la moneda fiat, normalmente `EUR`.
4. Descarga `koinly-on-chain.csv` e impórtalo en Koinly.

`transactions.csv` es la fuente de movimientos BTC y `Transaction ID`, que se conserva en la columna `TxHash`. `tradeHistory.csv` aporta el precio, la moneda y el importe fiat. Los refunds por arbitraje no generan depósitos fiat sintéticos.

## Desarrollo local

```bash
python3 -m http.server 8777
```

Después abre `http://127.0.0.1:8777/`.

## GitHub Pages

En el repositorio: **Settings → Pages → Deploy from a branch → main → / (root)**.
