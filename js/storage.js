/**
 * trader-risk-management/js/storage.js
 * Centralized LocalStorage Persistence Manager
 */

const StorageManager = (() => {
  const KEYS = {
    RISK_RULES: 'trm_risk_rules',
    JOURNAL: 'trm_journal_entries',
    PLANS: 'trm_saved_trade_plans',
    PLANNING_MODE: 'trm_planning_mode_enabled'
  };

  const DEFAULT_RULES = {
    accountBalance: 10000,
    maxRiskPerTrade: 1.5,
    maxDailyDrawdown: 3.0,
    minRiskReward: 1.5,
    currentDailyLoss: 0,
    maxOpenTrades: 3
  };

  function getRiskRules() {
    try {
      const raw = localStorage.getItem(KEYS.RISK_RULES);
      return raw ? { ...DEFAULT_RULES, ...JSON.parse(raw) } : { ...DEFAULT_RULES };
    } catch {
      return { ...DEFAULT_RULES };
    }
  }

  function saveRiskRules(rules) {
    const merged = { ...getRiskRules(), ...rules };
    localStorage.setItem(KEYS.RISK_RULES, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('trm:rules-updated', { detail: merged }));
    return merged;
  }

  function getJournalTrades() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.JOURNAL) || '[]');
    } catch {
      return [];
    }
  }

  function saveJournalTrades(trades) {
    localStorage.setItem(KEYS.JOURNAL, JSON.stringify(trades));
    window.dispatchEvent(new CustomEvent('trm:journal-updated', { detail: trades }));
  }

  function addJournalTrade(trade) {
    const trades = getJournalTrades();
    trades.unshift(trade);
    saveJournalTrades(trades);
    return trades;
  }

  function getSavedPlans() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.PLANS) || '[]');
    } catch {
      return [];
    }
  }

  function savePlans(plans) {
    localStorage.setItem(KEYS.PLANS, JSON.stringify(plans));
  }

  function getPlanningMode() {
    return localStorage.getItem(KEYS.PLANNING_MODE) === 'true';
  }

  function setPlanningMode(enabled) {
    localStorage.setItem(KEYS.PLANNING_MODE, String(Boolean(enabled)));
  }

  return {
    KEYS,
    getRiskRules,
    saveRiskRules,
    getJournalTrades,
    saveJournalTrades,
    addJournalTrade,
    getSavedPlans,
    savePlans,
    getPlanningMode,
    setPlanningMode
  };
})();

window.StorageManager = StorageManager;