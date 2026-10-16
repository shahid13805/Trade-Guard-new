/**
 * js/calculators.js
 * Comprehensive Dhan-Style Financial & Trading Calculators Suite (16 Tools)
 */

const Calculators = (() => {
  const TOOLS = [
    // ==========================================
    // 1. TRADING & POSITION SIZING
    // ==========================================
    {
      id: 'dhan-position-size',
      cat: 'trading',
      icon: '🎯',
      name: 'Position Size Calculator',
      desc: 'Calculate exact unit sizing and leverage risk based on stop loss distance.',
      fields: [
        { id: 'capital', label: 'Trading Capital ($)', type: 'number', val: 10000 },
        { id: 'riskPct', label: 'Risk Per Trade (%)', type: 'number', val: 1.0, step: 0.1 },
        { id: 'entry', label: 'Entry Price', type: 'number', val: 100, step: 'any' },
        { id: 'sl', label: 'Stop Loss Price', type: 'number', val: 95, step: 'any' }
      ],
      calc: (v) => {
        const riskAmount = v.capital * (v.riskPct / 100);
        const slDist = Math.abs(v.entry - v.sl);
        if (slDist === 0) return { error: 'Stop loss cannot equal Entry price.' };
        const qty = riskAmount / slDist;
        const totalValue = qty * v.entry;
        const leverage = totalValue / v.capital;
        return {
          hero: { label: 'Recommended Quantity', value: qty.toFixed(2) + ' Units' },
          rows: [
            { label: 'Total Risk ($)', value: '$' + riskAmount.toFixed(2), color: 'text-danger' },
            { label: 'Position Notional Value', value: '$' + totalValue.toFixed(2) },
            { label: 'Stop Distance', value: '$' + slDist.toFixed(2) },
            { label: 'Effective Leverage', value: leverage.toFixed(2) + 'x' }
          ]
        };
      }
    },
    {
      id: 'dhan-margin',
      cat: 'trading',
      icon: '🏛️',
      name: 'Margin & Leverage Calculator',
      desc: 'Determine the exact cash required to hold an intraday or delivery leveraged trade.',
      fields: [
        { id: 'price', label: 'Stock / Asset Price ($)', type: 'number', val: 250, step: 'any' },
        { id: 'qty', label: 'Quantity to Trade', type: 'number', val: 100 },
        { id: 'leverage', label: 'Leverage Multiplier (x)', type: 'number', val: 5, step: 1 }
      ],
      calc: (v) => {
        if (v.leverage <= 0) return { error: 'Leverage must be at least 1x.' };
        const exposure = v.price * v.qty;
        const marginReq = exposure / v.leverage;
        const brokerFunded = exposure - marginReq;
        return {
          hero: { label: 'Margin Required', value: '$' + marginReq.toFixed(2) },
          rows: [
            { label: 'Total Exposure', value: '$' + exposure.toFixed(2) },
            { label: 'Broker Funded Capital', value: '$' + brokerFunded.toFixed(2) },
            { label: 'Margin Percentage', value: ((1 / v.leverage) * 100).toFixed(1) + '%' }
          ]
        };
      }
    },
    {
      id: 'dhan-avg-price',
      cat: 'trading',
      icon: '📊',
      name: 'Stock Average Calculator',
      desc: 'Calculate average buy price when scaling or adding to positions.',
      fields: [
        { id: 'b1_qty', label: '1st Buy Quantity', type: 'number', val: 50 },
        { id: 'b1_px', label: '1st Buy Price', type: 'number', val: 120, step: 'any' },
        { id: 'b2_qty', label: '2nd Buy Quantity', type: 'number', val: 50 },
        { id: 'b2_px', label: '2nd Buy Price', type: 'number', val: 100, step: 'any' }
      ],
      calc: (v) => {
        const totQty = v.b1_qty + v.b2_qty;
        if (totQty <= 0) return { error: 'Total quantity must be greater than zero.' };
        const totInvested = v.b1_qty * v.b1_px + v.b2_qty * v.b2_px;
        const avg = totInvested / totQty;
        return {
          hero: { label: 'Average Buy Price', value: '$' + avg.toFixed(2) },
          rows: [
            { label: 'Total Shares', value: totQty.toFixed(0) },
            { label: 'Total Outlay', value: '$' + totInvested.toFixed(2) },
            { label: 'Breakeven Price', value: '$' + avg.toFixed(2) }
          ]
        };
      }
    },
    {
      id: 'dhan-drawdown-recovery',
      cat: 'trading',
      icon: '📉',
      name: 'Drawdown Recovery Calculator',
      desc: 'Compute the exact percentage gain needed to recover from portfolio drawdowns.',
      fields: [
        { id: 'peak', label: 'Peak Portfolio Value ($)', type: 'number', val: 10000 },
        { id: 'lossPct', label: 'Current Drawdown (%)', type: 'number', val: 20, step: 1 }
      ],
      calc: (v) => {
        if (v.lossPct >= 100) return { error: 'Drawdown cannot be 100% or higher.' };
        const currentBal = v.peak * (1 - v.lossPct / 100);
        const gainNeeded = ((v.peak - currentBal) / currentBal) * 100;
        return {
          hero: { label: 'Gain Needed to Breakeven', value: '+' + gainNeeded.toFixed(2) + '%' },
          rows: [
            { label: 'Current Account Balance', value: '$' + currentBal.toFixed(2) },
            { label: 'Capital Lost', value: '-$' + (v.peak - currentBal).toFixed(2), color: 'text-danger' },
            { label: '1R Trades Needed (at 1% Risk)', value: gainNeeded.toFixed(1) + ' R' }
          ]
        };
      }
    },
    {
      id: 'dhan-expectancy',
      cat: 'trading',
      icon: '🎲',
      name: 'Expectancy & System Edge',
      desc: 'Determine your trading system mathematical edge per trade.',
      fields: [
        { id: 'winRate', label: 'Strategy Win Rate (%)', type: 'number', val: 50 },
        { id: 'avgWin', label: 'Average Win (R)', type: 'number', val: 2.0, step: 0.1 },
        { id: 'avgLoss', label: 'Average Loss (R)', type: 'number', val: 1.0, step: 0.1 }
      ],
      calc: (v) => {
        const wr = v.winRate / 100;
        const lr = 1 - wr;
        const ev = wr * v.avgWin - lr * v.avgLoss;
        return {
          hero: { label: 'Expectancy Per Trade', value: (ev >= 0 ? '+' : '') + ev.toFixed(2) + ' R' },
          rows: [
            { label: 'System Edge Verdict', value: ev > 0 ? 'Profitable Edge' : 'Negative Expectancy', color: ev > 0 ? 'text-success' : 'text-danger' },
            { label: 'Projected R over 100 Trades', value: (ev * 100).toFixed(1) + ' R' },
            { label: 'Breakeven Win Rate', value: ((v.avgLoss / (v.avgWin + v.avgLoss)) * 100).toFixed(1) + '%' }
          ]
        };
      }
    },

    // ==========================================
    // 2. TECHNICALS & PIVOT LEVELS
    // ==========================================
    {
      id: 'dhan-fibonacci',
      cat: 'technical',
      icon: '📐',
      name: 'Fibonacci Retracement',
      desc: 'Horizontal pullback support & resistance levels (23.6% to 78.6%).',
      fields: [
        { id: 'high', label: 'Swing High Price', type: 'number', val: 150, step: 'any' },
        { id: 'low', label: 'Swing Low Price', type: 'number', val: 100, step: 'any' }
      ],
      calc: (v) => {
        const diff = v.high - v.low;
        if (diff <= 0) return { error: 'High must be strictly greater than Low.' };
        return {
          hero: { label: '50% Equilibrium Level', value: '$' + (v.high - diff * 0.5).toFixed(2) },
          rows: [
            { label: '23.6% Retracement', value: '$' + (v.high - diff * 0.236).toFixed(2) },
            { label: '38.2% Retracement', value: '$' + (v.high - diff * 0.382).toFixed(2) },
            { label: '50.0% Equilibrium', value: '$' + (v.high - diff * 0.500).toFixed(2) },
            { label: '61.8% Golden Pocket', value: '$' + (v.high - diff * 0.618).toFixed(2), color: 'text-warning' },
            { label: '78.6% Deep Pullback', value: '$' + (v.high - diff * 0.786).toFixed(2) },
            { label: '161.8% Extension', value: '$' + (v.high + diff * 0.618).toFixed(2), color: 'text-success' }
          ]
        };
      }
    },
    {
      id: 'dhan-pivot-points',
      cat: 'technical',
      icon: '⚖️',
      name: 'Pivot Points (Classic)',
      desc: 'Daily floor pivots with R1-R2 resistance and S1-S2 support levels.',
      fields: [
        { id: 'prevH', label: 'Previous Day High', type: 'number', val: 105, step: 'any' },
        { id: 'prevL', label: 'Previous Day Low', type: 'number', val: 98, step: 'any' },
        { id: 'prevC', label: 'Previous Day Close', type: 'number', val: 102, step: 'any' }
      ],
      calc: (v) => {
        const pp = (v.prevH + v.prevL + v.prevC) / 3;
        const r1 = 2 * pp - v.prevL;
        const s1 = 2 * pp - v.prevH;
        const r2 = pp + (v.prevH - v.prevL);
        const s2 = pp - (v.prevH - v.prevL);
        return {
          hero: { label: 'Central Pivot (PP)', value: '$' + pp.toFixed(2) },
          rows: [
            { label: 'Resistance 2 (R2)', value: '$' + r2.toFixed(2), color: 'text-danger' },
            { label: 'Resistance 1 (R1)', value: '$' + r1.toFixed(2), color: 'text-warning' },
            { label: 'Central Pivot (PP)', value: '$' + pp.toFixed(2) },
            { label: 'Support 1 (S1)', value: '$' + s1.toFixed(2), color: 'text-success' },
            { label: 'Support 2 (S2)', value: '$' + s2.toFixed(2), color: 'text-success' }
          ]
        };
      }
    },
    {
      id: 'dhan-camarilla-pivots',
      cat: 'technical',
      icon: '🎯',
      name: 'Camarilla Pivot Points',
      desc: 'Intraday mean-reversion & breakout levels (H3, H4, L3, L4).',
      fields: [
        { id: 'h', label: 'Previous High', type: 'number', val: 505, step: 'any' },
        { id: 'l', label: 'Previous Low', type: 'number', val: 495, step: 'any' },
        { id: 'c', label: 'Previous Close', type: 'number', val: 500, step: 'any' }
      ],
      calc: (v) => {
        const range = v.h - v.l;
        const h4 = v.c + range * (1.1 / 2);
        const h3 = v.c + range * (1.1 / 4);
        const l3 = v.c - range * (1.1 / 4);
        const l4 = v.c - range * (1.1 / 2);
        return {
          hero: { label: 'Long Breakout Level (H4)', value: '$' + h4.toFixed(2) },
          rows: [
            { label: 'H4 Breakout Long', value: '$' + h4.toFixed(2), color: 'text-success' },
            { label: 'H3 Short Reversal Zone', value: '$' + h3.toFixed(2), color: 'text-warning' },
            { label: 'L3 Long Reversal Zone', value: '$' + l3.toFixed(2), color: 'text-warning' },
            { label: 'L4 Breakdown Short', value: '$' + l4.toFixed(2), color: 'text-danger' }
          ]
        };
      }
    },

    // ==========================================
    // 3. DERIVATIVES & TRADING CHARGES
    // ==========================================
    {
      id: 'dhan-brokerage',
      cat: 'derivatives',
      icon: '🧾',
      name: 'Brokerage & Statutory Charges',
      desc: 'Calculate turnover fees, commission, STT, exchange charges, and net PnL.',
      fields: [
        { id: 'buyPx', label: 'Buy Price ($)', type: 'number', val: 200, step: 'any' },
        { id: 'sellPx', label: 'Sell Price ($)', type: 'number', val: 205, step: 'any' },
        { id: 'qty', label: 'Quantity', type: 'number', val: 100 },
        { id: 'feePerOrder', label: 'Flat Fee Per Order ($)', type: 'number', val: 1.0 }
      ],
      calc: (v) => {
        const turnover = (v.buyPx + v.sellPx) * v.qty;
        const grossPnL = (v.sellPx - v.buyPx) * v.qty;
        const brokerage = v.feePerOrder * 2;
        const stt = (v.sellPx * v.qty) * 0.00025;
        const exchTxn = turnover * 0.00003;
        const gst = (brokerage + exchTxn) * 0.18;
        const totalCharges = brokerage + stt + exchTxn + gst;
        const netPnL = grossPnL - totalCharges;
        return {
          hero: { label: 'Net Take-Home PnL', value: (netPnL >= 0 ? '+$' : '-$') + Math.abs(netPnL).toFixed(2) },
          rows: [
            { label: 'Gross Trade PnL', value: '$' + grossPnL.toFixed(2) },
            { label: 'Total Statutory Fees', value: '-$' + totalCharges.toFixed(2), color: 'text-danger' },
            { label: 'Brokerage Commission', value: '$' + brokerage.toFixed(2) },
            { label: 'STT Tax', value: '$' + stt.toFixed(2) },
            { label: 'Break-Even Move Needed', value: '$' + (totalCharges / v.qty).toFixed(2) + ' / unit' }
          ]
        };
      }
    },
    {
      id: 'dhan-mtf',
      cat: 'derivatives',
      icon: '💳',
      name: 'MTF (Margin Trading Facility)',
      desc: 'Estimate daily interest charges and net returns using broker funding.',
      fields: [
        { id: 'buyPx', label: 'Buy Price ($)', type: 'number', val: 500 },
        { id: 'qty', label: 'Quantity', type: 'number', val: 100 },
        { id: 'marginPct', label: 'Your Contribution (%)', type: 'number', val: 25 },
        { id: 'rate', label: 'Annual MTF Interest (%)', type: 'number', val: 15 },
        { id: 'days', label: 'Holding Period (Days)', type: 'number', val: 30 },
        { id: 'sellPx', label: 'Target Sell Price ($)', type: 'number', val: 540 }
      ],
      calc: (v) => {
        const total = v.buyPx * v.qty;
        const own = total * (v.marginPct / 100);
        const funded = total - own;
        const interest = funded * (v.rate / 100) * (v.days / 365);
        const grossPnL = (v.sellPx - v.buyPx) * v.qty;
        const netPnL = grossPnL - interest;
        const roiOnOwn = (netPnL / own) * 100;
        return {
          hero: { label: 'Net Profit after MTF Interest', value: (netPnL >= 0 ? '+$' : '-$') + Math.abs(netPnL).toFixed(2) },
          rows: [
            { label: 'Total Trade Value', value: '$' + total.toFixed(2) },
            { label: 'Your Margin Used', value: '$' + own.toFixed(2) },
            { label: 'Broker Funded Capital', value: '$' + funded.toFixed(2) },
            { label: 'Interest Cost', value: '-$' + interest.toFixed(2), color: 'text-danger' },
            { label: 'Return on Own Margin', value: roiOnOwn.toFixed(2) + '%', color: roiOnOwn >= 0 ? 'text-success' : 'text-danger' }
          ]
        };
      }
    },
    {
      id: 'dhan-options-payoff',
      cat: 'derivatives',
      icon: '⚡',
      name: 'Options Payoff & Intrinsic Value',
      desc: 'Calculate intrinsic value, time decay risk, and breakeven for Calls & Puts.',
      fields: [
        { id: 'spot', label: 'Current Spot Price ($)', type: 'number', val: 100, step: 'any' },
        { id: 'strike', label: 'Strike Price ($)', type: 'number', val: 100, step: 'any' },
        { id: 'premium', label: 'Option Premium Paid ($)', type: 'number', val: 3.5, step: 'any' }
      ],
      calc: (v) => {
        const callIntrinsic = Math.max(0, v.spot - v.strike);
        const callTimeVal = Math.max(0, v.premium - callIntrinsic);
        const callBreakeven = v.strike + v.premium;
        const putBreakeven = v.strike - v.premium;
        return {
          hero: { label: 'Call Breakeven Price', value: '$' + callBreakeven.toFixed(2) },
          rows: [
            { label: 'Call Intrinsic Value', value: '$' + callIntrinsic.toFixed(2) },
            { label: 'Extrinsic / Time Value', value: '$' + callTimeVal.toFixed(2) },
            { label: 'Long Call Break-Even', value: '$' + callBreakeven.toFixed(2) },
            { label: 'Long Put Break-Even', value: '$' + putBreakeven.toFixed(2) },
            { label: 'Max Risk / Loss (Debit)', value: '-$' + v.premium.toFixed(2), color: 'text-danger' }
          ]
        };
      }
    },
    {
      id: 'dhan-slbm',
      cat: 'derivatives',
      icon: '🤝',
      name: 'Stock Lending & Borrowing (SLBM)',
      desc: 'Calculate yield earned by lending idle portfolio shares to short sellers.',
      fields: [
        { id: 'price', label: 'Stock Price ($)', type: 'number', val: 400, step: 'any' },
        { id: 'qty', label: 'Quantity Lent', type: 'number', val: 250 },
        { id: 'fee', label: 'Lending Fee (% p.a.)', type: 'number', val: 9, step: 0.5 },
        { id: 'days', label: 'Lending Period (Days)', type: 'number', val: 30 }
      ],
      calc: (v) => {
        const stockVal = v.price * v.qty;
        const income = stockVal * (v.fee / 100) * (v.days / 365);
        return {
          hero: { label: 'Estimated Lending Income', value: '+$' + income.toFixed(2) },
          rows: [
            { label: 'Total Value Lent', value: '$' + stockVal.toFixed(2) },
            { label: 'Period Return', value: ((income / stockVal) * 100).toFixed(2) + '%' },
            { label: 'Annualized Lending Yield', value: v.fee.toFixed(1) + '%' }
          ]
        };
      }
    },

    // ==========================================
    // 4. INVESTING, SIP & WEALTH
    // ==========================================
    {
      id: 'dhan-sip',
      cat: 'investing',
      icon: '🔁',
      name: 'SIP Wealth Projector',
      desc: 'Systematic Investment Plan growth compounder.',
      fields: [
        { id: 'sipAmt', label: 'Monthly Investment ($)', type: 'number', val: 500 },
        { id: 'rate', label: 'Expected Return (% p.a.)', type: 'number', val: 12 },
        { id: 'years', label: 'Tenure (Years)', type: 'number', val: 10 }
      ],
      calc: (v) => {
        const i = v.rate / 1200;
        const n = v.years * 12;
        const fv = v.sipAmt * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        const invested = v.sipAmt * n;
        const profit = fv - invested;
        return {
          hero: { label: 'Maturity Corpus', value: '$' + fv.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
          rows: [
            { label: 'Total Invested Capital', value: '$' + invested.toLocaleString() },
            { label: 'Wealth Gain', value: '+$' + profit.toLocaleString(undefined, { maximumFractionDigits: 0 }), color: 'text-success' },
            { label: 'Return Multiple', value: (fv / invested).toFixed(2) + 'x' }
          ]
        };
      }
    },
    {
      id: 'dhan-cagr',
      cat: 'investing',
      icon: '📈',
      name: 'CAGR Portfolio Growth',
      desc: 'Calculate compound annual growth rate over any duration.',
      fields: [
        { id: 'initial', label: 'Initial Value ($)', type: 'number', val: 5000 },
        { id: 'finalVal', label: 'Final Value ($)', type: 'number', val: 12000 },
        { id: 'years', label: 'Time Period (Years)', type: 'number', val: 3, step: 0.1 }
      ],
      calc: (v) => {
        if (v.initial <= 0 || v.finalVal <= 0 || v.years <= 0) return { error: 'All numbers must be greater than zero.' };
        const cagr = (Math.pow(v.finalVal / v.initial, 1 / v.years) - 1) * 100;
        const abs = ((v.finalVal - v.initial) / v.initial) * 100;
        return {
          hero: { label: 'Annual Compound Growth (CAGR)', value: cagr.toFixed(2) + '% p.a.' },
          rows: [
            { label: 'Total Absolute Return', value: abs.toFixed(2) + '%', color: 'text-success' },
            { label: 'Total Net Profit', value: '+$' + (v.finalVal - v.initial).toFixed(2) },
            { label: 'Capital Multiplier', value: (v.finalVal / v.initial).toFixed(2) + 'x' }
          ]
        };
      }
    },
    {
      id: 'dhan-swp',
      cat: 'investing',
      icon: '🏧',
      name: 'SWP (Systematic Withdrawal Plan)',
      desc: 'Simulate monthly cash withdrawals from a mutual fund corpus.',
      fields: [
        { id: 'corpus', label: 'Initial Corpus ($)', type: 'number', val: 100000 },
        { id: 'monthly', label: 'Monthly Withdrawal ($)', type: 'number', val: 800 },
        { id: 'rate', label: 'Expected Growth Rate (%)', type: 'number', val: 8 },
        { id: 'years', label: 'Duration (Years)', type: 'number', val: 10 }
      ],
      calc: (v) => {
        let bal = v.corpus;
        const i = v.rate / 1200;
        const months = v.years * 12;
        let totalWithdrawn = 0;
        for (let m = 0; m < months; m++) {
          bal = bal * (1 + i) - v.monthly;
          if (bal < 0) { bal = 0; break; }
          totalWithdrawn += v.monthly;
        }
        return {
          hero: { label: 'Final Remaining Corpus', value: '$' + Math.max(0, bal).toLocaleString(undefined, { maximumFractionDigits: 0 }) },
          rows: [
            { label: 'Total Cash Withdrawn', value: '$' + totalWithdrawn.toLocaleString() },
            { label: 'Corpus Depleted Early?', value: bal <= 0 ? 'Yes - Increase Corpus' : 'No - Sustainable', color: bal > 0 ? 'text-success' : 'text-danger' }
          ]
        };
      }
    },
    {
      id: 'dhan-goal-planner',
      cat: 'investing',
      icon: '🏆',
      name: 'Financial Goal Target Calculator',
      desc: 'Calculate the monthly SIP needed to reach a specific financial target.',
      fields: [
        { id: 'target', label: 'Target Wealth Goal ($)', type: 'number', val: 100000 },
        { id: 'years', label: 'Years to Goal', type: 'number', val: 7 },
        { id: 'rate', label: 'Expected Return (% p.a.)', type: 'number', val: 12 }
      ],
      calc: (v) => {
        const i = v.rate / 1200;
        const n = v.years * 12;
        const fvFactor = ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        const reqSip = v.target / fvFactor;
        return {
          hero: { label: 'Required Monthly Investment', value: '$' + reqSip.toFixed(2) + ' / month' },
          rows: [
            { label: 'Target Goal', value: '$' + v.target.toLocaleString() },
            { label: 'Total Capital Outlay', value: '$' + (reqSip * n).toLocaleString(undefined, { maximumFractionDigits: 0 }) }, { label: 'Estimated Growth Gain', value: '+$' + (v.target - reqSip * n).toLocaleString(undefined, { maximumFractionDigits: 0 }), color: 'text-success' }
          ]
        };
      }
    }
  ];

  let activeTool = null;
  let activeCategory = 'all';

  function init() {
    renderCards();
    bindEvents();
  }

  function renderCards() {
    const grid = document.getElementById('calc-cards-grid');
    if (!grid) return;

    const searchInput = document.getElementById('calc-search-input');
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const filtered = TOOLS.filter(t => {
      const matchCat = activeCategory === 'all' || t.cat === activeCategory;
      const matchQuery = !query || t.name.toLowerCase().includes(query) || t.desc.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--plan-muted); padding: 40px 0;">No calculators match your search.</p>';
      return;
    }

    grid.innerHTML = filtered.map(t => `
      <div class="dhan-tool-card" data-tool="${t.id}">
        <div class="dhan-card-icon">${t.icon}</div>
        <h4 class="dhan-card-title">${t.name}</h4>
        <p class="dhan-card-desc">${t.desc}</p>
      </div>
    `).join('');

    grid.querySelectorAll('.dhan-tool-card').forEach(card => {
      card.addEventListener('click', () => {
        openTool(card.getAttribute('data-tool'));
      });
    });
  }

  function openTool(toolId) {
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool) return;
    activeTool = tool;

    const titleEl = document.getElementById('active-calc-title');
    const descEl = document.getElementById('active-calc-desc');
    const formEl = document.getElementById('active-calc-form');

    if (titleEl) titleEl.textContent = tool.icon + ' ' + tool.name;
    if (descEl) descEl.textContent = tool.desc;

    if (formEl) {
      formEl.innerHTML = `
        <div class="form-row-2">
          ${tool.fields.map(f => `
            <div class="form-group">
              <label for="inp-${f.id}">${f.label}</label>
              <input type="${f.type}" id="inp-${f.id}" data-id="${f.id}" class="plan-input" value="${f.val}" step="${f.step || '1'}" required />
            </div>
          `).join('')}
        </div>
      `;

      formEl.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', runCalculation);
      });
    }

    document.getElementById('calc-cards-grid')?.classList.add('hidden');
    document.getElementById('calc-search-controls')?.classList.add('hidden');
    document.getElementById('calc-active-container')?.classList.remove('hidden');
    document.getElementById('calc-hub-back-btn')?.classList.remove('hidden');

    runCalculation();
  }

  function closeTool() {
    activeTool = null;
    document.getElementById('calc-active-container')?.classList.add('hidden');
    document.getElementById('calc-hub-back-btn')?.classList.add('hidden');
    document.getElementById('calc-cards-grid')?.classList.remove('hidden');
    document.getElementById('calc-search-controls')?.classList.remove('hidden');
  }

  function runCalculation() {
    if (!activeTool) return;
    const formEl = document.getElementById('active-calc-form');
    const outEl = document.getElementById('active-calc-output');
    if (!formEl || !outEl) return;

    const values = {};
    activeTool.fields.forEach(f => {
      const el = formEl.querySelector(`[data-id="${f.id}"]`);
      values[f.id] = el ? parseFloat(el.value) || 0 : 0;
    });

    const res = activeTool.calc(values);

    if (res.error) {
      outEl.innerHTML = `<div class="rule-audit-item rule-fail" style="color: var(--plan-danger);">${res.error}</div>`;
      return;
    }

    outEl.innerHTML = `
      <div class="calc-hero-badge">
        <small>${res.hero.label}</small>
        <strong>${res.hero.value}</strong>
      </div>
      <div class="calc-results-list">
        ${res.rows.map(r => `
          <div class="calc-result-row">
            <span>${r.label}</span>
            <strong class="${r.color || ''}">${r.value}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  function bindEvents() {
    document.getElementById('calc-search-input')?.addEventListener('input', renderCards);

    document.getElementById('calc-category-chips')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.calc-chip');
      if (!chip) return;
      document.querySelectorAll('.calc-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.getAttribute('data-cat');
      renderCards();
    });

    document.getElementById('calc-hub-back-btn')?.addEventListener('click', closeTool);
  }

  return { init, openTool };
})();

window.Calculators = Calculators;