# Bisq to Koinly

Aplicación web estática para convertir exportaciones de Bisq en un CSV
Universal compatible con Koinly.

## Uso

Abre la aplicación en GitHub Pages, selecciona `tradeHistory.csv` y
`transactions.csv`, y pulsa **REVISAR CSV**. Todo el procesamiento se ejecuta
localmente en JavaScript: los archivos no se suben ni se guardan en ningún
servidor.

También puedes servir estos archivos localmente con cualquier servidor
estático, por ejemplo:

```bash
npx serve .
```

La columna `TxHash` conserva el `Transaction ID` de `transactions.csv`.
Los depósitos fiat sintéticos no tienen hash on-chain y dejan esa columna
vacía. La aplicación incluye compras, comisiones, depósitos multisig,
collateral, retiros, fondos recibidos y refunds.

No requiere backend, dependencias, instalación ni conexión a Internet durante
la conversión.
