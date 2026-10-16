# Trade Guard — Trading Risk Management

Trade Guard is a browser-based trading planning and risk-management workspace built with HTML, CSS, and vanilla JavaScript. It includes trade planning, position-sizing calculations, configurable risk rules, a calculator hub, and a local trade journal.

## Interface update

The interface uses a restrained dark trading-terminal design: solid surfaces, subtle borders, compact navigation, readable numerical data, and limited status colors. The styling is implemented in `css/style.css`; the final section contains the current professional design overrides. No framework or build step is required.

## Features

- Planning workspace for reviewing a trade scenario
- Position sizing and risk/reward calculations
- Risk rules and planning-mode controls
- Calculator hub for trading, returns, savings, and loan calculations
- Trade journal with P&L tracking and CSV export
- Browser `localStorage` persistence for supported settings and journal data
- Responsive layout for desktop and smaller screens
- Market ticker/chart integration using Binance data where supported, with simulated data as a fallback

## Run locally

1. Extract the project folder.
2. Open `index.html` in a modern browser, or open the folder in VS Code and use the Live Server extension.
3. No package installation, build command, or API key is required.
4. An internet connection is needed for remote market data. If the data source is unavailable, the interface may fall back to simulated market data.

## Project structure

```text
trader-risk-management/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── calculators.js
│   ├── journal.js
│   ├── planning.js
│   ├── risk-rules.js
│   └── storage.js
└── README.md
```

## Important limitations

- This is a planning and journaling tool, not a broker-connected trading platform. It does not place orders.
- Binance market data covers supported crypto symbols; it should not be represented as live Indian or US stock-market data.
- Simulated fallback data is illustrative and must not be used as a basis for real trades.
- Currency formatting does not perform currency conversion. Do not combine different currencies in one account summary.
- Browser-local data is not encrypted, synced, or backed up automatically. Export journal data regularly and do not store credentials or API secrets here.
- Planned risk is not a guaranteed maximum loss. Gaps, slippage, fees, taxes, liquidity, and execution can change actual results.

## Suggested smoke test

1. Open the Planning Workspace and confirm the market panel renders.
2. Enter an entry price and stop-loss value and check that risk/position sizing updates.
3. Switch between the Planning Workspace, Risk Calculators, Risk Rules, and Trade Journal tabs.
4. Change a supported risk setting, refresh, and verify persistence.
5. Add a journal entry, edit its status, refresh, and confirm the entry remains.
6. Export the journal CSV and confirm it opens in a spreadsheet application.
7. Test the interface at desktop and mobile widths.
