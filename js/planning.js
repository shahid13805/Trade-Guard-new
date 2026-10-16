/**
 * trader-risk-management/js/planning.js
 * Live Market Data, Technical Analysis, Scenario Architect & Risk Gatekeeper
 * Features:
 *  - Spacious 3-Subpage navigation
 *  - Interactive draggable chart levels (Entry, Stop Loss, TP1)
 *  - Direction-aware Stop Loss boundary locks (prevents 'Invalid SL Side' crashes)
 *  - Dynamic price preservation (doesn't wipe your custom inputs on incoming ticks)
 */

const PlanningWorkspace = (() => {
  const MARKET_CATALOG = {
    BTCUSDT: { price: 89450.0, change: 2.14, high: 90200.0, low: 87600.0, decimals: 2, type: 'crypto' },
    ETHUSDT: { price: 3120.5, change: 1.45, high: 3190.0, low: 3040.0, decimals: 2, type: 'crypto' },
    SOLUSDT: { price: 188.4, change: 3.82, high: 194.0, low: 179.5, decimals: 2, type: 'crypto' },
    BNBUSDT: { price: 642.0, change: 0.95, high: 651.0, low: 633.0, decimals: 2, type: 'crypto' },
    XAUUSD:  { price: 2742.8, change: 0.64, high: 2758.0, low: 2721.0, decimals: 2, type: 'sim' },
    EURUSD:  { price: 1.0864, change: -0.22, high: 1.0902, low: 1.0835, decimals: 4, type: 'sim' },
    NAS100:  { price: 20480.0, change: 0.91, high: 20610.0, low: 20290.0, decimals: 1, type: 'sim' }
  };

  let state = {
    planningMode: false,
    activeSymbol: 'BTCUSDT',
    timeframe: '15m',
    direction: 'LONG',
    candles: [],
    indicators: { rsi: 54.0, ema20: 0, ema50: 0, atr: 0, trend: 'BULLISH ▲' },
    ws: null,
    simInterval: null,
    savedPlans: [],
    lastCalculation: null,
    draggingLevel: null // Holds 'plan-stop-loss', 'plan-entry-price', or 'plan-tp1'
  };

  function init() {
    state.planningMode = window.StorageManager.getPlanningMode();
    state.savedPlans = window.StorageManager.getSavedPlans();

    syncWithGlobalRules();
    bindEvents();
    renderTickerStrip();
    switchSymbol(state.activeSymbol, state.timeframe);
    renderSavedPlans();
    updatePlanningModeUI();
  }

  function syncWithGlobalRules() {
    const rules = window.StorageManager.getRiskRules();
    const balEl = document.getElementById('plan-account-balance');
    const riskEl = document.getElementById('plan-risk-pct');
    if (balEl) balEl.value = rules.accountBalance;
    if (riskEl) riskEl.value = rules.maxRiskPerTrade;
  }

  // =========================================================================
  // LIVE DATA ENGINE (BINANCE WEBSOCKET + REST + SIMULATOR)
  // =========================================================================
  async function switchSymbol(symbol, timeframe) {
    state.activeSymbol = symbol;
    state.timeframe = timeframe;

    if (state.ws) {
      state.ws.close();
      state.ws = null;
    }
    if (state.simInterval) {
      clearInterval(state.simInterval);
      state.simInterval = null;
    }

    const meta = MARKET_CATALOG[symbol] || MARKET_CATALOG.BTCUSDT;
    const titleEl = document.getElementById('live-symbol-title');
    if (titleEl) titleEl.textContent = `${symbol} (${timeframe})`;

    if (meta.type === 'crypto') {
      await fetchBinanceKlines(symbol, timeframe);
      connectBinanceStream(symbol);
    } else {
      generateSimulatedCandles(symbol);
    }

    state.simInterval = setInterval(tickSimulatedMarkets, 1800);
  }

  async function fetchBinanceKlines(symbol, interval) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=60`);
      if (!res.ok) throw new Error('REST blocked');
      const data = await res.json();

      state.candles = data.map(k => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4])
      }));

      const lastClose = state.candles[state.candles.length - 1].close;
      const firstOpen = state.candles[0].open;
      MARKET_CATALOG[symbol].price = lastClose;
      MARKET_CATALOG[symbol].change = ((lastClose - firstOpen) / firstOpen) * 100;
      MARKET_CATALOG[symbol].high = Math.max(...state.candles.slice(-24).map(c => c.high));
      MARKET_CATALOG[symbol].low = Math.min(...state.candles.slice(-24).map(c => c.low));

      onMarketDataUpdated(false);
          window.dispatchEvent(new CustomEvent('trm:market-tick'));
    } catch {
      generateSimulatedCandles(symbol);
    }
  }

  function connectBinanceStream(symbol) {
    try {
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
      state.ws = ws;

      ws.onopen = () => setFeedStatus(true, 'LIVE WEBSOCKET');
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (!msg.c) return;
        const price = parseFloat(msg.c);
        MARKET_CATALOG[symbol].price = price;
        MARKET_CATALOG[symbol].change = parseFloat(msg.P);
        MARKET_CATALOG[symbol].high = parseFloat(msg.h);
        MARKET_CATALOG[symbol].low = parseFloat(msg.l);

        if (state.candles.length > 0) {
          const last = state.candles[state.candles.length - 1];
          last.close = price;
          if (price > last.high) last.high = price;
          if (price < last.low) last.low = price;
        }
        onMarketDataUpdated(false);
      };
      ws.onerror = () => setFeedStatus(false, 'LIVE SIMULATOR');
    } catch {
      setFeedStatus(false, 'LIVE SIMULATOR');
    }
  }

  function generateSimulatedCandles(symbol) {
    setFeedStatus(true, 'LIVE SIMULATOR');
    const meta = MARKET_CATALOG[symbol];
    const base = meta.price;
    const vol = base * 0.0025;
    const candles = [];
    let current = base * 0.994;

    for (let i = 0; i < 60; i++) {
      const open = current;
      const delta = (Math.random() - 0.485) * vol;
      const close = +(open + delta).toFixed(meta.decimals);
      const high = +(Math.max(open, close) + Math.random() * vol * 0.6).toFixed(meta.decimals);
      const low = +(Math.min(open, close) - Math.random() * vol * 0.6).toFixed(meta.decimals);
      candles.push({ time: Date.now() - (60 - i) * 60000, open, high, low, close });
      current = close;
    }

    state.candles = candles;
    meta.price = candles[candles.length - 1].close;
    onMarketDataUpdated(false);
  }

  function tickSimulatedMarkets() {
    Object.keys(MARKET_CATALOG).forEach(sym => {
      const item = MARKET_CATALOG[sym];
      if (item.type === 'sim' || !state.ws || state.ws.readyState !== 1) {
        const step = item.price * 0.0005 * (Math.random() - 0.495);
        item.price = +(item.price + step).toFixed(item.decimals);
        item.change = +(item.change + (Math.random() - 0.5) * 0.04).toFixed(2);
        if (item.price > item.high) item.high = item.price;
        if (item.price < item.low) item.low = item.price;

        if (sym === state.activeSymbol && state.candles.length > 0) {
          const last = state.candles[state.candles.length - 1];
          last.close = item.price;
          if (item.price > last.high) last.high = item.price;
          if (item.price < last.low) last.low = item.price;
          onMarketDataUpdated(false);
        }
      }
    });
    renderTickerStrip();
  }

  function setFeedStatus(isOnline, text) {
    const dot = document.getElementById('feed-status-dot');
    const label = document.getElementById('feed-status-text');
    if (dot) dot.style.background = isOnline ? '#10b981' : '#f59e0b';
    if (label) label.textContent = text;
  }

  // =========================================================================
  // TECHNICAL INDICATORS
  // =========================================================================
  function computeIndicators() {
    const closes = state.candles.map(c => c.close);
    if (closes.length < 20) return;

    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, Math.min(50, closes.length));
    const rsi = calcRSI(closes, 14);
    const atr = calcATR(state.candles, 14);

    let trend = 'NEUTRAL';
    if (ema20 > ema50 * 1.0003) trend = 'BULLISH ▲';
    else if (ema20 < ema50 * 0.9997) trend = 'BEARISH ▼';

    state.indicators = { ema20, ema50, rsi, atr, trend };
  }

  function calcEMA(values, period) {
    const k = 2 / (period + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  }

  function calcRSI(values, period = 14) {
    if (values.length <= period) return 50;
    let gains = 0, losses = 0;
    for (let i = values.length - period; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
  }

  function calcATR(candles, period = 14) {
    if (candles.length < 2) return 0;
    const trs = [];
    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i - 1].close;
      trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev)));
    }
    const slice = trs.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  // =========================================================================
  // RENDER TELEMETRY & DRAGGABLE CANVAS CHART
  // =========================================================================
  function onMarketDataUpdated(forceReseed = false) {
    computeIndicators();
    const meta = MARKET_CATALOG[state.activeSymbol];
    const dec = meta.decimals;

    const currPriceEl = document.getElementById('live-current-price');
    if (currPriceEl) currPriceEl.textContent = meta.price.toFixed(dec);

    const changeEl = document.getElementById('live-price-change');
    if (changeEl) {
      changeEl.textContent = `${meta.change >= 0 ? '+' : ''}${meta.change.toFixed(2)}%`;
      changeEl.className = `price-change-pill ${meta.change >= 0 ? 'pill-up' : 'pill-down'}`;
    }

    const highEl = document.getElementById('live-high-24h');
    if (highEl) highEl.textContent = meta.high.toFixed(dec);

    const lowEl = document.getElementById('live-low-24h');
    if (lowEl) lowEl.textContent = meta.low.toFixed(dec);

    const atrEl = document.getElementById('live-atr-value');
    if (atrEl) atrEl.textContent = state.indicators.atr.toFixed(dec);

    const { trend, ema20, ema50, rsi, atr } = state.indicators;
    const trendEl = document.getElementById('ind-trend-bias');
    if (trendEl) {
      trendEl.textContent = trend;
      trendEl.className = `ind-value ${trend.includes('BULLISH') ? 'text-success' : trend.includes('BEARISH') ? 'text-danger' : ''}`;
    }

    const emaSpreadEl = document.getElementById('ind-ema-spread');
    if (emaSpreadEl) emaSpreadEl.textContent = `EMA20: ${ema20.toFixed(dec)} | EMA50: ${ema50.toFixed(dec)}`;

    const rsiValEl = document.getElementById('ind-rsi-val');
    if (rsiValEl) rsiValEl.textContent = rsi.toFixed(1);

    const rsiStateEl = document.getElementById('ind-rsi-state');
    if (rsiStateEl) {
      rsiStateEl.textContent = rsi > 70 ? 'Overbought (>70)' : rsi < 30 ? 'Oversold (<30)' : 'Healthy Momentum';
    }

    const atrPct = (atr / meta.price) * 100;
    const volRegimeEl = document.getElementById('ind-vol-regime');
    if (volRegimeEl) {
      volRegimeEl.textContent = atrPct > 0.55 ? 'High Expansion' : 'Normal / Controlled';
    }

    const atrHintEl = document.getElementById('ind-atr-stop-hint');
    if (atrHintEl) {
      atrHintEl.textContent = `1.5x ATR Stop: ±${(atr * 1.5).toFixed(dec)}`;
    }

    renderTickerStrip();

    // Preserve custom inputs if already typed
    seedDefaultScenarioInputs(meta.price, atr, dec, forceReseed);
  }

  function drawMiniChart() {
    const canvas = document.getElementById('live-mini-chart');
    if (!canvas || state.candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const visible = state.candles.slice(-40);
    const highs = visible.map(c => c.high);
    const lows = visible.map(c => c.low);
    const maxP = Math.max(...highs);
    const minP = Math.min(...lows);
    const range = maxP - minP || 1;

    const padY = 32;
    const chartH = H - padY * 2;
    const stepX = (W - 150) / visible.length;
    const toY = (p) => padY + chartH - ((p - minP) / range) * chartH;

    // iOS Subdued Radial Horizon Gridlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (H / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W - 150, y);
      ctx.stroke();
    }

    // Candlesticks with Neon Sheen
    visible.forEach((c, idx) => {
      const x = idx * stepX + stepX / 2;
      const isBull = c.close >= c.open;
      const color = isBull ? '#30d158' : '#ff453a';

      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      // Wick
      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      // Body (Rounded Glass Candle)
      const top = toY(Math.max(c.open, c.close));
      const bot = toY(Math.min(c.open, c.close));
      const candleW = Math.max(3, stepX * 0.65);
      const candleH = Math.max(2, bot - top);

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x - candleW / 2, top, candleW, candleH, 2);
      } else {
        ctx.rect(x - candleW / 2, top, candleW, candleH);
      }
      ctx.fill();
    });

    const entry = parseFloat(document.getElementById('plan-entry-price')?.value);
    const sl = parseFloat(document.getElementById('plan-stop-loss')?.value);
    const tp1 = parseFloat(document.getElementById('plan-tp1')?.value);

    // iOS Frosted Interactive Level Handles
    const drawInteractiveLevel = (price, color, glowColor, label, inputId) => {
      if (!price || price < minP || price > maxP) return;
      const y = toY(price);
      const isDragged = state.draggingLevel === inputId;

      // Dashed Line with Ambient Glow
      ctx.strokeStyle = color;
      ctx.lineWidth = isDragged ? 2.5 : 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W - 150, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Apple Glass Pill on the right
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = isDragged ? 14 : 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(W - 146, y - 13, 138, 26, 8);
      } else {
        ctx.rect(W - 146, y - 13, 138, 26);
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner Pill Typography
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.fillText(`${label}: $${price.toFixed(2)} ↕`, W - 138, y + 4);
    };

    drawInteractiveLevel(entry, '#0a84ff', 'rgba(10, 132, 255, 0.6)', 'ENTRY', 'plan-entry-price');
    drawInteractiveLevel(sl, '#ff453a', 'rgba(255, 69, 58, 0.6)', 'SL', 'plan-stop-loss');
    drawInteractiveLevel(tp1, '#30d158', 'rgba(48, 209, 88, 0.6)', 'TP1', 'plan-tp1');
  }

  function renderTickerStrip() {
    const container = document.getElementById('ticker-items-container');
    if (!container) return;

    container.innerHTML = Object.entries(MARKET_CATALOG).map(([sym, data]) => {
      const sign = data.change >= 0 ? '+' : '';
      const cls = data.change >= 0 ? 'text-success' : 'text-danger';
      return `
        <div class="ticker-chip" data-sym="${sym}">
          <strong>${sym}</strong>
          <span>${data.price.toFixed(data.decimals)}</span>
          <span class="${cls}">${sign}${data.change.toFixed(2)}%</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.ticker-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const sym = chip.getAttribute('data-sym');
        const sel = document.getElementById('plan-symbol-select');
        if (sel) sel.value = sym;
        switchSymbol(sym, state.timeframe);
      });
    });
  }

  // =========================================================================
  // SCENARIO ARCHITECT & GATEKEEPER
  // =========================================================================
  function seedDefaultScenarioInputs(price, atr, decimals, force = false) {
    const entryEl = document.getElementById('plan-entry-price');
    const slEl = document.getElementById('plan-stop-loss');
    const tp1El = document.getElementById('plan-tp1');
    const tp2El = document.getElementById('plan-tp2');
    const tp3El = document.getElementById('plan-tp3');

    if (!force && entryEl && entryEl.value.trim() !== '') {
      evaluateScenario();
      return;
    }

    const stopDist = atr > 0 ? atr * 1.5 : price * 0.01;
    const isLong = state.direction === 'LONG';

    if (entryEl) entryEl.value = price.toFixed(decimals);
    if (slEl) slEl.value = (isLong ? price - stopDist : price + stopDist).toFixed(decimals);
    if (tp1El) tp1El.value = (isLong ? price + stopDist * 1.5 : price - stopDist * 1.5).toFixed(decimals);
    if (tp2El) tp2El.value = (isLong ? price + stopDist * 2.5 : price - stopDist * 2.5).toFixed(decimals);
    if (tp3El) tp3El.value = (isLong ? price + stopDist * 4.0 : price - stopDist * 4.0).toFixed(decimals);

    evaluateScenario();
  }

  function evaluateScenario() {
    const balance = parseFloat(document.getElementById('plan-account-balance')?.value) || 10000;
    const riskPct = parseFloat(document.getElementById('plan-risk-pct')?.value) || 1.0;
    const entry = parseFloat(document.getElementById('plan-entry-price')?.value) || 0;
    const sl = parseFloat(document.getElementById('plan-stop-loss')?.value) || 0;
    const winRate = (parseFloat(document.getElementById('plan-win-rate')?.value) || 50) / 100;

    const tp1 = parseFloat(document.getElementById('plan-tp1')?.value) || entry;
    const tp2 = parseFloat(document.getElementById('plan-tp2')?.value) || tp1;
    const tp3 = parseFloat(document.getElementById('plan-tp3')?.value) || tp2;

    const stopDistance = Math.abs(entry - sl);
    if (!entry || !sl || stopDistance === 0) return;

    const dollarRisk = balance * (riskPct / 100);
    const positionUnits = dollarRisk / stopDistance;
    const notionalValue = positionUnits * entry;

    const mult = state.direction === 'LONG' ? 1 : -1;
    const r1 = ((tp1 - entry) * mult) / stopDistance;
    const r2 = ((tp2 - entry) * mult) / stopDistance;
    const r3 = ((tp3 - entry) * mult) / stopDistance;

    const weightedR = r1 * 0.5 + r2 * 0.3 + r3 * 0.2;
    const netRewardDollar = dollarRisk * weightedR;

    const expectedValueDollar = winRate * netRewardDollar - (1 - winRate) * dollarRisk;
    const expectedValueR = winRate * weightedR - (1 - winRate);
    const breakevenWinRate = weightedR > 0 ? (1 / (1 + weightedR)) * 100 : 100;

    const posEl = document.getElementById('out-position-size');
    if (posEl) posEl.textContent = positionUnits.toFixed(4);

    const notionalEl = document.getElementById('out-notional-val');
    if (notionalEl) notionalEl.textContent = `$${notionalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    const riskEl = document.getElementById('out-dollar-risk');
    if (riskEl) riskEl.textContent = `-$${dollarRisk.toFixed(2)}`;

    const rewardEl = document.getElementById('out-net-reward');
    if (rewardEl) rewardEl.textContent = `+$${netRewardDollar.toFixed(2)} (${weightedR.toFixed(2)}R)`;

    const evEl = document.getElementById('out-expected-value');
    if (evEl) {
      evEl.textContent = `${expectedValueDollar >= 0 ? '+' : ''}$${expectedValueDollar.toFixed(2)} (${expectedValueR.toFixed(2)}R)`;
      evEl.className = expectedValueDollar >= 0 ? 'text-success' : 'text-danger';
    }

    const beEl = document.getElementById('out-breakeven-wr');
    if (beEl) beEl.textContent = `${breakevenWinRate.toFixed(1)}%`;

    const clampedR = Math.max(0.2, Math.min(weightedR, 6));
    const riskWidth = (1 / (1 + clampedR)) * 100;

    const riskFillEl = document.getElementById('rr-bar-risk-fill');
    if (riskFillEl) riskFillEl.style.width = `${riskWidth}%`;

    const rewardFillEl = document.getElementById('rr-bar-reward-fill');
    if (rewardFillEl) rewardFillEl.style.width = `${100 - riskWidth}%`;

    const rrRewardLabel = document.getElementById('rr-label-reward');
    if (rrRewardLabel) rrRewardLabel.textContent = `Weighted Reward: ${weightedR.toFixed(2)}R`;

    const rules = window.StorageManager.getRiskRules();
    const dailyMaxDollar = balance * (rules.maxDailyDrawdown / 100);
    const remainingDaily = Math.max(0, dailyMaxDollar - (rules.currentDailyLoss || 0));

    const pmEq = document.getElementById('pm-banner-equity');
    if (pmEq) pmEq.textContent = `$${balance.toLocaleString()}`;

    const pmDaily = document.getElementById('pm-banner-daily-left');
    if (pmDaily) pmDaily.textContent = `$${remainingDaily.toFixed(2)} (${rules.maxDailyDrawdown}%)`;

    const pmSim = document.getElementById('pm-banner-sim-equity');
    if (pmSim) pmSim.textContent = `$${(balance - dollarRisk).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    state.lastCalculation = {
      symbol: state.activeSymbol,
      timeframe: state.timeframe,
      direction: state.direction,
      entry,
      sl,
      tp1,
      tp2,
      tp3,
      riskPct,
      dollarRisk,
      positionUnits,
      weightedR
    };

    runRiskGatekeeperAudit({ entry, sl, riskPct, dollarRisk, weightedR, remainingDaily, rules });
    drawMiniChart();
  }

  function runRiskGatekeeperAudit(ctx) {
    const isStopValid =
      (state.direction === 'LONG' && ctx.sl < ctx.entry) ||
      (state.direction === 'SHORT' && ctx.sl > ctx.entry);

    const maxRisk = ctx.rules.maxRiskPerTrade || 1.5;
    const minRR = ctx.rules.minRiskReward || 1.5;
    const fitsDaily = ctx.dollarRisk <= ctx.remainingDaily;
    const trendAligned =
      (state.direction === 'LONG' && state.indicators.trend.includes('BULLISH')) ||
      (state.direction === 'SHORT' && state.indicators.trend.includes('BEARISH'));

    const audits = [
      {
        label: 'Stop Loss Geometry',
        value: isStopValid ? 'Valid Side' : 'Invalid SL Side!',
        status: isStopValid ? 'pass' : 'fail'
      },
      {
        label: `Max Risk / Trade (Limit ${maxRisk}%)`,
        value: `${ctx.riskPct.toFixed(2)}% ($${ctx.dollarRisk.toFixed(0)})`,
        status: ctx.riskPct <= maxRisk ? 'pass' : ctx.riskPct <= maxRisk * 1.25 ? 'warn' : 'fail'
      },
      {
        label: `Minimum R:R Ratio (Min ${minRR}R)`,
        value: `${ctx.weightedR.toFixed(2)}R`,
        status: ctx.weightedR >= minRR ? 'pass' : ctx.weightedR >= 1.0 ? 'warn' : 'fail'
      },
      {
        label: 'Daily Drawdown Buffer',
        value: fitsDaily ? 'Within Buffer' : 'Exceeds Daily Cap',
        status: fitsDaily ? 'pass' : 'fail'
      },
      {
        label: 'Live EMA 20/50 Alignment',
        value: trendAligned ? 'Aligned with Trend' : 'Counter-Trend',
        status: trendAligned ? 'pass' : 'warn'
      }
    ];

    const auditListEl = document.getElementById('rule-audit-list');
    if (auditListEl) {
      auditListEl.innerHTML = audits.map(a => `
        <li class="rule-audit-item rule-${a.status}">
          <span>${a.label}</span>
          <strong>${a.value}</strong>
        </li>
      `).join('');
    }

    const hasFail = audits.some(a => a.status === 'fail');
    const hasWarn = audits.some(a => a.status === 'warn');
    const badge = document.getElementById('gatekeeper-verdict-badge');

    if (badge) {
      if (hasFail) {
        badge.textContent = 'RULE VIOLATION';
        badge.className = 'verdict-badge verdict-block';
      } else if (hasWarn) {
        badge.textContent = 'CAUTION';
        badge.className = 'verdict-badge verdict-warn';
      } else {
        badge.textContent = 'APPROVED';
        badge.className = 'verdict-badge verdict-pass';
      }
    }
  }

  // =========================================================================
  // WATCHLIST & JOURNAL
  // =========================================================================
  function saveCurrentPlan(e) {
    if (e) e.preventDefault();
    if (!state.lastCalculation) return;

    const notes = document.getElementById('plan-thesis-notes')?.value.trim() || 'Staged from Planning Workspace';
    const plan = {
      id: 'PLAN-' + Date.now(),
      ...state.lastCalculation,
      notes
    };

    state.savedPlans.unshift(plan);
    window.StorageManager.savePlans(state.savedPlans);
    renderSavedPlans();
  }

  function pushToJournal() {
    if (!state.lastCalculation) return;

    const badgeText = document.getElementById('gatekeeper-verdict-badge')?.textContent;
    if (state.planningMode && badgeText === 'RULE VIOLATION') {
      alert('Planning Mode Gatekeeper Blocked Execution: Fix the highlighted Risk Rule Violation before logging this trade.');
      return;
    }

    const notes = document.getElementById('plan-thesis-notes')?.value.trim() || 'Executed via Planning Workspace';
    const tradeEntry = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      symbol: state.lastCalculation.symbol,
      direction: state.lastCalculation.direction,
      entryPrice: state.lastCalculation.entry,
      stopLoss: state.lastCalculation.sl,
      takeProfit: state.lastCalculation.tp1,
      positionSize: +state.lastCalculation.positionUnits.toFixed(4),
      riskAmount: +state.lastCalculation.dollarRisk.toFixed(2),
      rrRatio: +state.lastCalculation.weightedR.toFixed(2),
      notes,
      status: 'OPEN'
    };

    window.Journal.addTrade(tradeEntry);
    window.dispatchEvent(new CustomEvent('trm:trade-logged', { detail: tradeEntry }));
    alert(`Trade for ${tradeEntry.symbol} (${tradeEntry.direction}) logged to Trade Journal!`);
  }

  function renderSavedPlans() {
    const list = document.getElementById('saved-plans-list');
    const count = document.getElementById('saved-plans-count');
    if (!list || !count) return;

    count.textContent = state.savedPlans.length;
    if (state.savedPlans.length === 0) {
      list.innerHTML = `<div style="color:#94a3b8; font-size:0.78rem; padding:6px 0;">No staged plans yet.</div>`;
      return;
    }

    list.innerHTML = state.savedPlans.map(p => `
      <div class="saved-plan-card">
        <div>
          <strong>${p.symbol}</strong>
          <span class="${p.direction === 'LONG' ? 'text-success' : 'text-danger'}">${p.direction}</span>
          <small style="color:#94a3b8;"> @ ${p.entry} (SL: ${p.sl} | ${p.weightedR.toFixed(2)}R)</small>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-link" data-load="${p.id}">Load</button>
          <button type="button" class="btn-link-danger" data-del="${p.id}">✕</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-load]').forEach(btn => {
      btn.addEventListener('click', () => {
        const plan = state.savedPlans.find(x => x.id === btn.getAttribute('data-load'));
        if (!plan) return;
        document.getElementById('plan-entry-price').value = plan.entry;
        document.getElementById('plan-stop-loss').value = plan.sl;
        document.getElementById('plan-tp1').value = plan.tp1;
        document.getElementById('plan-tp2').value = plan.tp2;
        document.getElementById('plan-tp3').value = plan.tp3;
        setDirection(plan.direction);
      });
    });

    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.savedPlans = state.savedPlans.filter(x => x.id !== btn.getAttribute('data-del'));
        window.StorageManager.savePlans(state.savedPlans);
        renderSavedPlans();
      });
    });
  }

  function setDirection(dir) {
    state.direction = dir;
    document.getElementById('dir-long-btn')?.classList.toggle('active-long', dir === 'LONG');
    document.getElementById('dir-short-btn')?.classList.toggle('active-short', dir === 'SHORT');

    const entry = parseFloat(document.getElementById('plan-entry-price')?.value) || 0;
    const slEl = document.getElementById('plan-stop-loss');
    const tp1El = document.getElementById('plan-tp1');
    const meta = MARKET_CATALOG[state.activeSymbol];
    const dist = (state.indicators.atr || entry * 0.01) * 1.5;

    // Flip Stop Loss & TP to the mathematically valid side of entry
    if (entry > 0 && slEl) {
      if (dir === 'LONG') {
        slEl.value = (entry - dist).toFixed(meta.decimals);
        if (tp1El) tp1El.value = (entry + dist * 1.5).toFixed(meta.decimals);
      } else {
        slEl.value = (entry + dist).toFixed(meta.decimals);
        if (tp1El) tp1El.value = (entry - dist * 1.5).toFixed(meta.decimals);
      }
    }

    evaluateScenario();
  }

  function updatePlanningModeUI() {
    const toggle = document.getElementById('planning-mode-toggle');
    const badge = document.getElementById('planning-mode-badge');
    const banner = document.getElementById('planning-mode-banner');

    if (toggle) toggle.checked = state.planningMode;
    if (badge) {
      badge.textContent = state.planningMode ? 'ON' : 'OFF';
      badge.className = `mode-badge ${state.planningMode ? 'mode-on' : 'mode-off'}`;
    }
    if (banner) banner.classList.toggle('hidden', !state.planningMode);
  }

  function updateConfluenceScore() {
    const checks = document.querySelectorAll('.confluence-check');
    let checked = 0;
    checks.forEach(c => { if (c.checked) checked++; });
    const pct = Math.round((checked / checks.length) * 100);
    const grade = pct === 100 ? 'A+ Setup' : pct >= 75 ? 'A-Setup' : pct >= 50 ? 'B-Setup (Half Risk)' : 'Avoid (Low Confluence)';
    const el = document.getElementById('confluence-score-text');
    if (el) {
      el.textContent = `${pct}% (${grade})`;
      el.className = pct >= 75 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-danger';
    }
  }

  // =========================================================================
  // EVENT BINDINGS & DRAGGABLE CANVAS CONTROLLER
  // =========================================================================
  function bindEvents() {
    // 1. Sub-page Navigation Tabs
    const subBtns = document.querySelectorAll('.plan-sub-btn');
    const subViews = document.querySelectorAll('.plan-subview');

    subBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-subtab');
        subBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        subViews.forEach(view => {
          view.classList.toggle('hidden', view.id !== target);
        });

        if (target === 'sub-terminal') drawMiniChart();
        else if (target === 'sub-architect') evaluateScenario();
      });
    });

    // 2. Interactive Chart Drag-and-Drop (Prioritizes SL & Enforces Boundaries)
    const canvas = document.getElementById('live-mini-chart');
    if (canvas) {
      const getLevelAtPoint = (mouseX, mouseY) => {
        const entry = parseFloat(document.getElementById('plan-entry-price')?.value);
        const sl = parseFloat(document.getElementById('plan-stop-loss')?.value);
        const tp1 = parseFloat(document.getElementById('plan-tp1')?.value);

        const visible = state.candles.slice(-40);
        if (visible.length === 0) return null;
        const maxP = Math.max(...visible.map(c => c.high));
        const minP = Math.min(...visible.map(c => c.low));
        const range = maxP - minP || 1;
        const padY = 28;
        const chartH = canvas.height - padY * 2;
        const toY = (p) => padY + chartH - ((p - minP) / range) * chartH;

        // Give priority to SL detection
        if (Math.abs(mouseY - toY(sl)) < 16) return 'plan-stop-loss';
        if (Math.abs(mouseY - toY(entry)) < 16) return 'plan-entry-price';
        if (Math.abs(mouseY - toY(tp1)) < 16) return 'plan-tp1';

        return null;
      };

      const priceFromY = (y) => {
        const visible = state.candles.slice(-40);
        const maxP = Math.max(...visible.map(c => c.high));
        const minP = Math.min(...visible.map(c => c.low));
        const range = maxP - minP || 1;
        const padY = 28;
        const chartH = canvas.height - padY * 2;
        const pct = 1 - (y - padY) / chartH;
        return minP + pct * range;
      };

      // Hover feedback
      canvas.addEventListener('mousemove', (e) => {
        if (state.draggingLevel) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const targetId = getLevelAtPoint(x, y);
        canvas.style.cursor = targetId ? 'ns-resize' : 'crosshair';
      });

      // Mouse Down -> Start Dragging
      canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const targetId = getLevelAtPoint(x, y);
        if (targetId) {
          state.draggingLevel = targetId;
          canvas.style.cursor = 'ns-resize';
          e.preventDefault();
        }
      });

      // Window Move -> Drag smoothly & enforce boundaries
      window.addEventListener('mousemove', (e) => {
        if (!state.draggingLevel) return;
        const rect = canvas.getBoundingClientRect();
        const scaleY = canvas.height / rect.height;
        const y = (e.clientY - rect.top) * scaleY;
        const meta = MARKET_CATALOG[state.activeSymbol];
        let newPrice = priceFromY(y);

        const entryVal = parseFloat(document.getElementById('plan-entry-price')?.value) || meta.price;

        // Boundary Lock: Prevents Stop Loss from flipping past Entry
        if (state.draggingLevel === 'plan-stop-loss') {
          if (state.direction === 'LONG' && newPrice >= entryVal) {
            newPrice = entryVal - (meta.price * 0.001);
          } else if (state.direction === 'SHORT' && newPrice <= entryVal) {
            newPrice = entryVal + (meta.price * 0.001);
          }
        }

        const inputEl = document.getElementById(state.draggingLevel);
        if (inputEl) {
          inputEl.value = Math.max(0, newPrice).toFixed(meta.decimals);
          evaluateScenario();
        }
      });

      // Window Up -> Stop Dragging
      window.addEventListener('mouseup', () => {
        if (state.draggingLevel) {
          state.draggingLevel = null;
          canvas.style.cursor = 'crosshair';
        }
      });
    }

    // 3. Planning Mode Toggle
    document.getElementById('planning-mode-toggle')?.addEventListener('change', (e) => {
      state.planningMode = e.target.checked;
      window.StorageManager.setPlanningMode(state.planningMode);
      updatePlanningModeUI();
    });

    // 4. Symbol & Timeframe Selection
    document.getElementById('plan-symbol-select')?.addEventListener('change', (e) => {
      switchSymbol(e.target.value, state.timeframe);
    });

    document.getElementById('plan-timeframe-select')?.addEventListener('change', (e) => {
      switchSymbol(state.activeSymbol, e.target.value);
    });

    // 5. Direction Buttons
    document.getElementById('dir-long-btn')?.addEventListener('click', () => setDirection('LONG'));
    document.getElementById('dir-short-btn')?.addEventListener('click', () => setDirection('SHORT'));

    // 6. Manual Sync Buttons
    document.getElementById('btn-sync-live-entry')?.addEventListener('click', () => {
      const meta = MARKET_CATALOG[state.activeSymbol];
      document.getElementById('plan-entry-price').value = meta.price.toFixed(meta.decimals);
      evaluateScenario();
    });

    document.getElementById('btn-apply-atr-sl')?.addEventListener('click', () => {
      const meta = MARKET_CATALOG[state.activeSymbol];
      const entry = parseFloat(document.getElementById('plan-entry-price').value) || meta.price;
      const dist = (state.indicators.atr || entry * 0.01) * 1.5;
      const sl = state.direction === 'LONG' ? entry - dist : entry + dist;
      document.getElementById('plan-stop-loss').value = sl.toFixed(meta.decimals);
      evaluateScenario();
    });

    document.getElementById('btn-auto-rr-targets')?.addEventListener('click', () => {
      const meta = MARKET_CATALOG[state.activeSymbol];
      const entry = parseFloat(document.getElementById('plan-entry-price').value);
      const sl = parseFloat(document.getElementById('plan-stop-loss').value);
      const riskDist = Math.abs(entry - sl);
      if (!entry || !riskDist) return;
      const mult = state.direction === 'LONG' ? 1 : -1;
      document.getElementById('plan-tp1').value = (entry + mult * riskDist * 1.5).toFixed(meta.decimals);
      document.getElementById('plan-tp2').value = (entry + mult * riskDist * 2.5).toFixed(meta.decimals);
      document.getElementById('plan-tp3').value = (entry + mult * riskDist * 4.0).toFixed(meta.decimals);
      evaluateScenario();
    });

    // 7. Interactive Form Inputs
    [
      'plan-account-balance', 'plan-risk-pct', 'plan-entry-price',
      'plan-stop-loss', 'plan-win-rate', 'plan-tp1', 'plan-tp2', 'plan-tp3'
    ].forEach(id => {
      document.getElementById(id)?.addEventListener('input', evaluateScenario);
    });

    // 8. Confluence Checklist
    document.querySelectorAll('.confluence-check').forEach(chk => {
      chk.addEventListener('change', updateConfluenceScore);
    });

    // 9. Watchlist & Journal Buttons
    document.getElementById('trade-plan-form')?.addEventListener('submit', saveCurrentPlan);
    document.getElementById('btn-push-journal')?.addEventListener('click', pushToJournal);
    document.getElementById('btn-clear-plans')?.addEventListener('click', () => {
      state.savedPlans = [];
      window.StorageManager.savePlans([]);
      renderSavedPlans();
    });

    // 10. Sync with Global Risk Rules Updates
    window.addEventListener('trm:rules-updated', () => {
      syncWithGlobalRules();
      evaluateScenario();
    });
  }

 function getMarketPrice(symbol) {
    return MARKET_CATALOG[symbol] ? MARKET_CATALOG[symbol].price : null;
  }

  return { init, evaluateScenario, getMarketPrice };
})();

window.PlanningWorkspace = PlanningWorkspace;