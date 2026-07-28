/**
 * ==========================================
 * Fever Casino - ATM制御スクリプト (atm.js)
 * ==========================================
 */

let selectedMode = null;
window.selectedAtmMode = null;

function safeToBigInt(v) {
  if (typeof window.toBigInt === 'function') return window.toBigInt(v);
  try { return BigInt(v || 0); } catch (e) { return 0n; }
}

function isGameInProgress() {
  if (typeof isSpinning !== 'undefined' && isSpinning) return true;
  if (typeof isDealing !== 'undefined' && isDealing) return true;
  if (typeof isAnimating !== 'undefined' && isAnimating) return true;
  if (typeof gameState !== 'undefined' && gameState !== 'BETTING') return true;
  return false;
}

function updateAtmStatusDisplay() {
  const atmModal = document.getElementById('atm-modal');
  if (!atmModal) return;

  let summaryEl = document.getElementById('atm-status-summary');
  if (!summaryEl) {
    const modalBody = atmModal.querySelector('.modal-body');
    if (!modalBody) return;

    summaryEl = document.createElement('div');
    summaryEl.id = 'atm-status-summary';
    summaryEl.className = 'atm-status-summary';
    modalBody.insertBefore(summaryEl, modalBody.firstChild);
  }

  const cash = safeToBigInt(window.playerData?.cash);
  const bank = safeToBigInt(window.playerData?.bank);
  const debt = safeToBigInt(window.playerData?.debt);

  const format = (num) => (typeof window.formatCurrency === 'function') ? window.formatCurrency(num) : '$' + safeToBigInt(num).toLocaleString();

  summaryEl.innerHTML = `
    <div class="atm-status-item">
      <span class="label">所持金</span>
      <span class="val">${format(cash)}</span>
    </div>
    <div class="atm-status-item">
      <span class="label">銀行貯金</span>
      <span class="val">${format(bank)}</span>
    </div>
    <div class="atm-status-item">
      <span class="label">借金</span>
      <span class="val debt-value">${format(debt)}</span>
    </div>
  `;

  // 借金相殺ボタン状態の更新
  if (typeof window.updateDebtChallengeButtons === 'function') {
    window.updateDebtChallengeButtons();
  }
}

function refreshAllUI() {
  if (typeof updateUI === 'function') updateUI();
  if (typeof updateCashDisplay === 'function') updateCashDisplay();
  updateAtmStatusDisplay();
}

function setupAtmModal() {
  const atmModal = document.getElementById('atm-modal');
  const openBtns = document.querySelectorAll('#open-atm-btn, .open-atm-btn');
  const closeBtns = document.querySelectorAll('#close-atm-btn, .close-btn');
  const overlay = atmModal ? atmModal.querySelector('.modal-overlay') : null;

  if (!atmModal || openBtns.length === 0) return;

  openBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isGameInProgress()) {
        alert('ゲーム進行中はATMを利用できません。ゲーム終了後にご利用ください。');
        return;
      }

      resetAtmUI();
      updateAtmStatusDisplay();
      atmModal.classList.remove('hidden');
    });
  });

  const closeModal = () => {
    atmModal.classList.add('hidden');
  };

  closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
  if (overlay) overlay.addEventListener('click', closeModal);
}

function resetAtmUI() {
  selectedMode = null;
  window.selectedAtmMode = null;
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));

  const actionPanel = document.getElementById('atm-action-panel');
  if (actionPanel) actionPanel.classList.add('hidden');

  const amountBtn = document.getElementById('atm-amount-btn');
  if (amountBtn) {
    amountBtn.setAttribute('data-amount', '0');
    amountBtn.textContent = '金額を入力: $0';
  }
}

function setupModeSelection() {
  const modeBtns = document.querySelectorAll('.mode-btn');
  const actionPanel = document.getElementById('atm-action-panel');
  const labelEl = document.getElementById('selected-mode-text');

  const MODE_NAMES = {
    deposit: '銀行に預ける (Deposit)',
    withdraw: '銀行から引き出す (Withdraw)',
    repay: '借金を返済する (Repay)',
    borrow: '新たに借金する (Borrow)'
  };

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      selectedMode = btn.getAttribute('data-mode');
      window.selectedAtmMode = selectedMode;

      if (labelEl) {
        labelEl.textContent = MODE_NAMES[selectedMode] || '-';
      }

      if (actionPanel) {
        actionPanel.classList.remove('hidden');
      }
    });
  });
}

function handleExecuteTransaction() {
  if (!selectedMode) {
    alert('最初に取引メニューを選択してください。');
    return;
  }

  const amountBtn = document.getElementById('atm-amount-btn');
  const rawAmt = amountBtn ? amountBtn.getAttribute('data-amount') : '0';
  const amount = safeToBigInt(rawAmt);

  if (amount <= 0n) {
    alert('「金額を入力」ボタンを押して、1以上の正しい金額を指定してください。');
    return;
  }

  const format = (v) => (typeof window.formatCurrency === 'function') ? window.formatCurrency(v) : '$' + safeToBigInt(v).toLocaleString();

  playerData.cash = safeToBigInt(playerData.cash);
  playerData.bank = safeToBigInt(playerData.bank);
  playerData.debt = safeToBigInt(playerData.debt);

  if (selectedMode === 'deposit') {
    if (playerData.cash < amount) {
      alert('所持金が足りません！');
      return;
    }
    playerData.cash -= amount;
    playerData.bank += amount;
    alert(`${format(amount)} を銀行に預け入れました。`);
  } else if (selectedMode === 'withdraw') {
    if (playerData.bank < amount) {
      alert('銀行貯金額が足りません！');
      return;
    }
    playerData.bank -= amount;
    playerData.cash += amount;
    alert(`${format(amount)} を銀行から引き出しました。`);
  } else if (selectedMode === 'repay') {
    if (playerData.debt <= 0n) {
      alert('現在、返済すべき借金はありません。');
      return;
    }
    if (playerData.cash < amount) {
      alert('所持金が足りません！');
      return;
    }
    if (amount > playerData.debt) {
      alert(`借金額以上の返済はできません。（現在の借金: ${format(playerData.debt)}）`);
      return;
    }

    playerData.cash -= amount;
    playerData.debt -= amount;

    if (playerData.debt === 0n) {
      playerData.debtPlayCount = 0;
      alert(`🎉 借金を全額完済しました！ 金利カウントがリセットされました。`);
    } else {
      alert(`${format(amount)} の借金を返済しました。残りの借金: ${format(playerData.debt)}`);
    }
  } else if (selectedMode === 'borrow') {
    playerData.debt += amount;
    playerData.cash += amount;
    alert(`${format(amount)} を借入れました。現在の借金: ${format(playerData.debt)}`);
  }

  if (typeof saveData === 'function') saveData();

  refreshAllUI();
  resetAtmUI();

  const atmModal = document.getElementById('atm-modal');
  if (atmModal) atmModal.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  setupAtmModal();
  setupModeSelection();

  const executeBtn = document.getElementById('atm-execute-btn');
  if (executeBtn) {
    executeBtn.addEventListener('click', handleExecuteTransaction);
  }
});
