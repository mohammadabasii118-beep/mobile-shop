# mobile-shop

## market-analyzer — تحلیلگر بازارهای مالی

Multi-market (crypto, forex, gold/commodities, indices, stocks) analysis app: candlestick chart with
overlays, a 17-factor scoring engine (trend, momentum, volatility, volume, structure, smart-money,
candlestick patterns, divergence), regime-aware weighting, multi-timeframe alignment, trade plan
(entry / stop / targets), position sizing and a no-look-ahead walk-forward backtest.

```bash
cd market-analyzer
node server.js          # http://localhost:8787  (serves the app + Yahoo proxy for forex/stocks/gold)
node tests/run.js       # unit tests incl. a no-look-ahead check
```

Data: crypto via Binance → Bybit → OKX (no key); forex/commodities/indices/stocks via Yahoo (through
`server.js`) or Twelve Data (free API key in ⚙); CSV import; demo data when offline.
Educational tool, not financial advice.
