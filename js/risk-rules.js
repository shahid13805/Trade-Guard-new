/**
 * trader-risk-management/js/risk-rules.js
 * Risk Rules Configuration & Daily Drawdown Lockout Engine
 */

const RiskRules = (() => {
  function init() {
    renderRulesForm();
    renderDailyTelemetry();
    bindEvents();
  }

  function getRules() {
    return window.StorageManager.getRiskRules();
  }

  function renderRulesForm() {
    const r = getRules();
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    setVal('rule-account-balance', r.accountBalance);
    setVal('rule-max-risk-trade', r.maxRiskPerTrade);
    setVal('rule-max-daily-dd', r.maxDailyDrawdown);
    setVal('rule-min-rr', r.minRiskReward);
    setVal('rule-daily-loss-used', r.currentDailyLoss);
    setVal('rule-max-open-trades', r.maxOpenTrades);

    const headerEq = document.getElementById('header-account-equity');
    if (headerEq) {
      headerEq.textContent = `$${Number(r.accountBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }
  }

  function renderDailyTelemetry() {
    const r = getRules();
    const dailyCap = r.accountBalance * (r.maxDailyDrawdown / 100);
    const used = Math.max(0, Number(r.currentDailyLoss) || 0);
    const remaining = Math.max(0, dailyCap - used);
    const pctUsed = dailyCap > 0 ? Math.min(100, (used / dailyCap) * 100) : 0;

    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setTxt('rule-out-daily-cap', `$${dailyCap.toFixed(2)}`);
    setTxt('rule-out-loss-today', `$${used.toFixed(2)}`);
    setTxt('rule-out-daily-buffer', `$${remaining.toFixed(2)}`);
    setTxt('rule-out-consumed-pct', `${pctUsed.toFixed(1)}% Used`);

    const barConsumed = document.getElementById('rule-bar-consumed');
    const barRemaining = document.getElementById('rule-bar-remaining');
    if (barConsumed && barRemaining) {
      barConsumed.style.width = `${pctUsed}%`;
      barRemaining.style.width = `${100 - pctUsed}%`;
    }

    const badge = document.getElementById('daily-lockout-badge');
    if (badge) {
      if (used >= dailyCap) {
        badge.textContent = 'DAILY LOCKOUT REACHED';
        badge.className = 'verdict-badge verdict-block';
      } else if (pctUsed >= 70) {
        badge.textContent = 'APPROACHING DAILY LIMIT';
        badge.className = 'verdict-badge verdict-warn';
      } else {
        badge.textContent = 'TRADING PERMITTED';
        badge.className = 'verdict-badge verdict-pass';
      }
    }
  }

  function bindEvents() {
    const form = document.getElementById('risk-rules-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const updated = {
          accountBalance: parseFloat(document.getElementById('rule-account-balance').value) || 10000,
          maxRiskPerTrade: parseFloat(document.getElementById('rule-max-risk-trade').value) || 1.5,
          maxDailyDrawdown: parseFloat(document.getElementById('rule-max-daily-dd').value) || 3.0,
          minRiskReward: parseFloat(document.getElementById('rule-min-rr').value) || 1.5,
          currentDailyLoss: parseFloat(document.getElementById('rule-daily-loss-used').value) || 0,
          maxOpenTrades: parseInt(document.getElementById('rule-max-open-trades').value, 10) || 3
        };
        window.StorageManager.saveRiskRules(updated);
        renderRulesForm();
        renderDailyTelemetry();
      });
    }

    document.getElementById('btn-reset-daily-loss')?.addEventListener('click', () => {
      window.StorageManager.saveRiskRules({ currentDailyLoss: 0 });
      renderRulesForm();
      renderDailyTelemetry();
    });
  }

  return { init, getRules, renderRulesForm, renderDailyTelemetry };
})();

window.RiskRules = RiskRules;