/**
 * js/app.js
 * Main Application Bootstrapper, Tab Navigation & Global Hotkeys
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize all application modules
  if (window.StorageManager) {
    if (window.RiskRules) window.RiskRules.init();
    if (window.Calculators) window.Calculators.init();
    if (window.Journal) window.Journal.init();
    if (window.PlanningWorkspace) window.PlanningWorkspace.init();
  }

  // 2. Select tab buttons and workspace panels
  const navButtons = document.querySelectorAll('.nav-tab-btn');
  const sections = document.querySelectorAll('.workspace-section');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');

      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(sec => {
        sec.classList.toggle('hidden', sec.id !== targetId);
      });

      if (targetId === 'planning-workspace' && window.PlanningWorkspace) {
        window.PlanningWorkspace.evaluateScenario();
      } else if (targetId === 'journal-workspace' && window.Journal) {
        window.Journal.render();
      }
    });
  });

  // =========================================================================
  // GLOBAL ESCAPE KEY HANDLER
  // =========================================================================
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // 1. If an input or textarea is focused, unfocus it
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        document.activeElement.blur();
      }

      // 2. If an open calculator view is visible, back out to the cards grid
      const calcBackBtn = document.getElementById('calc-hub-back-btn');
      if (calcBackBtn && !calcBackBtn.classList.contains('hidden')) {
        calcBackBtn.click();
        return;
      }

      // 3. If in Planning Workspace sub-pages (Architect or Gatekeeper), return to Terminal
      const terminalSubBtn = document.querySelector('.plan-sub-btn[data-subtab="sub-terminal"]');
      const isTerminalActive = terminalSubBtn?.classList.contains('active');
      const planningSection = document.getElementById('planning-workspace');

      if (planningSection && !planningSection.classList.contains('hidden') && !isTerminalActive) {
        terminalSubBtn?.click();
        return;
      }
    }
  });
});
// ==========================================
// Trade Guard: Editable Equity Feature
// ==========================================
const STORAGE_KEY = "trade_guard_equity";
const DEFAULT_EQUITY = 10000;

// Connect to HTML elements
const equityDisplay = document.getElementById("equity-display");
const equityEdit = document.getElementById("equity-edit");
const equityAmount = document.getElementById("equity-amount");
const equityInput = document.getElementById("equity-input");

const editBtn = document.getElementById("edit-equity-btn");
const saveBtn = document.getElementById("save-equity-btn");
const cancelBtn = document.getElementById("cancel-equity-btn");

// 1. Read stored balance
function getEquity() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? parseFloat(saved) : DEFAULT_EQUITY;
}

// 2. Format as currency ($10,000.00)
function formatCurrency(num) {
  return "$" + Number(num).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// 3. Update the text on the screen
function renderEquity() {
  if (!equityAmount) return;
  equityAmount.textContent = formatCurrency(getEquity());
}

// 4. Switch between text and input box
function toggleEditMode(isEditing) {
  if (isEditing) {
    equityInput.value = getEquity();
    equityDisplay.classList.add("hidden");
    equityEdit.classList.remove("hidden");
    equityInput.focus();
    equityInput.select();
  } else {
    equityEdit.classList.add("hidden");
    equityDisplay.classList.remove("hidden");
  }
}

// 5. Save the new balance
function saveEquity() {
  const parsed = parseFloat(equityInput.value);
  if (isNaN(parsed) || parsed < 0) {
    alert("Please enter a valid balance.");
    return;
  }
  localStorage.setItem(STORAGE_KEY, parsed.toString());
  renderEquity();
  toggleEditMode(false);
}

// 6. Hook up the buttons
if (editBtn && saveBtn && cancelBtn && equityInput) {
  editBtn.addEventListener("click", () => toggleEditMode(true));
  cancelBtn.addEventListener("click", () => toggleEditMode(false));
  saveBtn.addEventListener("click", saveEquity);

  equityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveEquity();
    if (e.key === "Escape") toggleEditMode(false);
  });
}

// 7. Run on load
renderEquity();