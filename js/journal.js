/**
 * js/journal.js
 * Trade Execution Journal, Live PnL Analytics & CSV Export Engine
 */

const Journal = (() => {
  function init() {
    render();
    bindEvents();
  }

  function bindEvents() {
    document.getElementById('btn-clear-journal')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all journal trade entries?')) {
        window.StorageManager.saveJournalTrades([]);
        render();
      }
    });

    document.getElementById('btn-export-csv')?.addEventListener('click', exportJournalToCSV);

    window.addEventListener('trm:trade-logged', render);
    window.addEventListener('trm:market-tick', render); // Re-renders live PnL on every price tick
  }

  function addTrade(trade) {
    window.StorageManager.addJournalTrade(trade);
    render();
  }

  function updateTradeStatus(id, outcome) {
    const trades = window.StorageManager.getJournalTrades();
    const target = trades.find(t => String(t.id) === String(id));
    if (!target) return;

    target.status = outcome;
    target.closedDate = new Date().toISOString().split('T')[0];

    // Compute final realized dollar PnL
    if (outcome === 'WIN') {
      target.realizedPnl = +(Number(target.riskAmount) * Number(target.rrRatio)).toFixed(2);
    } else if (outcome === 'LOSS') {
      target.realizedPnl = -Number(target.riskAmount);
      
      // Sync realized loss back to global daily risk limit tracker
      const rules = window.StorageManager.getRiskRules();
      window.StorageManager.saveRiskRules({
        currentDailyLoss: (Number(rules.currentDailyLoss) || 0) + Number(target.riskAmount)
      });
      if (window.RiskRules) {
        window.RiskRules.renderRulesForm();
        window.RiskRules.renderDailyTelemetry();
      }
    } else if (outcome === 'BE') {
      target.realizedPnl = 0;
    }

    window.StorageManager.saveJournalTrades(trades);
    render();
  }

  function deleteTrade(id) {
    const trades = window.StorageManager.getJournalTrades().filter(t => String(t.id) !== String(id));
    window.StorageManager.saveJournalTrades(trades);
    render();
  }

  function getCurrentMarketPrice(symbol) {
    if (window.PlanningWorkspace && window.PlanningWorkspace.getMarketPrice) {
      return window.PlanningWorkspace.getMarketPrice(symbol);
    }
    return null;
  }

  function render() {
    const trades = window.StorageManager.getJournalTrades();
    const tbody = document.getElementById('journal-table-body');
    if (!tbody) return;

    // KPI Calculations
    const closed = trades.filter(t => t.status === 'WIN' || t.status === 'LOSS' || t.status === 'BE');
    const wins = closed.filter(t => t.status === 'WIN');
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

    let totalRealizedPnL = 0;
    let totalOpenRisk = 0;

    trades.forEach(t => {
      if (t.status === 'WIN') {
        totalRealizedPnL += Number(t.realizedPnl || (Number(t.riskAmount) * Number(t.rrRatio)));
      } else if (t.status === 'LOSS') {
        totalRealizedPnL -= Number(t.riskAmount);
      } else if (t.status === 'OPEN') {
        totalOpenRisk += Number(t.riskAmount);
      }
    });

    // Update KPI Cards
    const totalEl = document.getElementById('j-kpi-total');
    const winRateEl = document.getElementById('j-kpi-winrate');
    const pnlEl = document.getElementById('j-kpi-netpnl');
    const openRiskEl = document.getElementById('j-kpi-openrisk');

    if (totalEl) totalEl.textContent = trades.length;
    if (winRateEl) winRateEl.textContent = `${winRate.toFixed(1)}%`;
    if (pnlEl) {
      pnlEl.textContent = `${totalRealizedPnL >= 0 ? '+' : '-'}$${Math.abs(totalRealizedPnL).toFixed(2)}`;
      pnlEl.className = totalRealizedPnL >= 0 ? 'text-success' : 'text-danger';
    }
    if (openRiskEl) openRiskEl.textContent = `$${totalOpenRisk.toFixed(2)}`;

    // Render Table Rows
    if (trades.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; color:#94a3b8; padding:24px;">No trades logged yet. Stage and execute a plan from the Planning Workspace.</td></tr>`;
      return;
    }

    tbody.innerHTML = trades.map(t => {
      const currentPrice = getCurrentMarketPrice(t.symbol);
      let pnlDisplay = '-';
      let pnlClass = '';

      if (t.status === 'OPEN' && currentPrice) {
        // Calculate Live Unrealized PnL
        const diff = t.direction === 'LONG' ? (currentPrice - t.entryPrice) : (t.entryPrice - currentPrice);
        const livePnL = diff * Number(t.positionSize);
        pnlDisplay = `${livePnL >= 0 ? '+' : '-'}$${Math.abs(livePnL).toFixed(2)} (Live)`;
        pnlClass = livePnL >= 0 ? 'text-success' : 'text-danger';
      } else if (t.status === 'WIN') {
        pnlDisplay = `+$${Number(t.realizedPnl || (t.riskAmount * t.rrRatio)).toFixed(2)}`;
        pnlClass = 'text-success';
      } else if (t.status === 'LOSS') {
        pnlDisplay = `-$${Number(t.riskAmount).toFixed(2)}`;
        pnlClass = 'text-danger';
      } else if (t.status === 'BE') {
        pnlDisplay = '$0.00';
        pnlClass = 'text-warning';
      }

      return `
        <tr>
          <td>${t.date}</td>
          <td><strong>${t.symbol}</strong></td>
          <td class="${t.direction === 'LONG' ? 'text-success' : 'text-danger'}"><strong>${t.direction}</strong></td>
          <td>$${Number(t.entryPrice).toFixed(2)}</td>
          <td>$${Number(t.stopLoss).toFixed(2)}</td>
          <td>$${Number(t.takeProfit).toFixed(2)}</td>
          <td>${Number(t.positionSize).toFixed(4)}</td>
          <td class="text-danger">-$${Number(t.riskAmount).toFixed(2)}</td>
          <td class="${pnlClass}"><strong>${pnlDisplay}</strong></td>
          <td>
            <button type="button" class="status-btn ${t.status === 'WIN' ? 'active-win' : ''}" data-win="${t.id}">WIN</button>
            <button type="button" class="status-btn ${t.status === 'LOSS' ? 'active-loss' : ''}" data-loss="${t.id}">LOSS</button>
            <button type="button" class="status-btn ${t.status === 'BE' ? 'active-win' : ''}" data-be="${t.id}">BE</button>
            <span style="font-size:0.72rem; color:#94a3b8; margin-left:4px;">${t.status}</span>
          </td>
          <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#94a3b8;">${t.notes || '-'}</td>
          <td>
            <button type="button" class="btn-link-danger" data-del="${t.id}" title="Delete trade">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row button events
    tbody.querySelectorAll('[data-win]').forEach(btn => {
      btn.addEventListener('click', () => updateTradeStatus(btn.getAttribute('data-win'), 'WIN'));
    });
    tbody.querySelectorAll('[data-loss]').forEach(btn => {
      btn.addEventListener('click', () => updateTradeStatus(btn.getAttribute('data-loss'), 'LOSS'));
    });
    tbody.querySelectorAll('[data-be]').forEach(btn => {
      btn.addEventListener('click', () => updateTradeStatus(btn.getAttribute('data-be'), 'BE'));
    });
    tbody.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => deleteTrade(btn.getAttribute('data-del')));
    });
  }

  // =========================================================================
  // CSV EXPORT UTILITY
  // =========================================================================
  function exportJournalToCSV() {
    const trades = window.StorageManager.getJournalTrades();
    if (!trades || trades.length === 0) {
      alert('No journal trades available to export.');
      return;
    }

    const headers = [
      'Trade ID',
      'Date Logged',
      'Symbol',
      'Direction',
      'Entry Price',
      'Stop Loss',
      'Take Profit',
      'Position Units',
      'Dollar Risk ($)',
      'Planned R:R',
      'Status',
      'Realized PnL ($)',
      'Notes'
    ];

    const rows = trades.map(t => [
      t.id,
      t.date,
      t.symbol,
      t.direction,
      t.entryPrice,
      t.stopLoss,
      t.takeProfit,
      t.positionSize,
      t.riskAmount,
      t.rrRatio,
      t.status,
      t.realizedPnl !== undefined ? t.realizedPnl : (t.status === 'WIN' ? t.riskAmount * t.rrRatio : (t.status === 'LOSS' ? -t.riskAmount : 0)),
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trade_guard_journal_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return { init, addTrade, render };
})();

window.Journal = Journal;