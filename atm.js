/**
 * ==========================================
 * Fever Casino - 新・ATM制御スクリプト (atm.js)
 * ==========================================
 */

let selectedMode = null; // 'deposit', 'withdraw', 'repay', 'borrow'

/**
 * ゲームが現在プレイ中（進行中）かどうかを自動判定する関数
 * @returns {boolean} ゲーム進行中なら true
 */
function isGameInProgress() {
  // ① スロットやルーレットの回転中フラグ
  if (typeof isSpinning !== 'undefined' && isSpinning) return true;
  // ② ブラックジャックやポーカーのアニメーション・カード配付中フラグ
  if (typeof isDealing !== 'undefined' && isDealing) return true;
  if (typeof isAnimating !== 'undefined' && isAnimating) return true;
  // ③ ポーカー等のゲーム状態が「ベット中」以外
  if (typeof gameState !== 'undefined' && gameState !== 'BETTING') return true;

  return false;
}

/**
 * 画面全体のUI（所持金・貯金・借金額など）を確実に更新・同期する関数
 */
function refreshAllUI() {
  // ロビー画面のUI更新関数を呼び出し
  if (typeof updateUI === 'function') {
    updateUI();
  }
  // 各ゲーム画面の所持金更新関数を呼び出し
  if (typeof updateCashDisplay === 'function') {
    updateCashDisplay();
  }
}

/**
 * 1. モーダル開閉と初期化
 */
function setupAtmModal() {
  const atmModal = document.getElementById('atm-modal');
  // ID指定またはクラス指定の両方のATMボタンに対応
  const openBtns = document.querySelectorAll('#open-atm-btn, .open-atm-btn');
  const closeBtns = document.querySelectorAll('#close-atm-btn, .close-btn');
  const overlay = atmModal ? atmModal.querySelector('.modal-overlay') : null;

  if (!atmModal || openBtns.length === 0) return;

  // 「ATMを開く」ボタンが押された時の処理
  openBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // ゲーム進行中はATMを開けないように制御
      if (isGameInProgress()) {
        alert('ゲーム進行中はATMを利用できません。ゲーム終了後にご利用ください。');
        return;
      }

      resetAtmUI();
      atmModal.classList.remove('hidden');
    });
  });

  // モーダルを閉じる処理
  const closeModal = () => {
    atmModal.classList.add('hidden');
  };

  closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
  if (overlay) overlay.addEventListener('click', closeModal);
}

/**
 * ATMの表示状態を初期状態（メニュー未選択）に戻す
 */
function resetAtmUI() {
  selectedMode = null;
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));

  const actionPanel = document.getElementById('atm-action-panel');
  if (actionPanel) actionPanel.classList.add('hidden');

  const amountBtn = document.getElementById('atm-amount-btn');
  if (amountBtn) {
    amountBtn.setAttribute('data-amount', '0');
    amountBtn.textContent = '金額を入力: $0';
  }
}

/**
 * 2. メニュー選択（預入・引出・返済・借入）のクリック処理
 */
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
      if (labelEl) {
        labelEl.textContent = MODE_NAMES[selectedMode] || '-';
      }

      if (actionPanel) {
        actionPanel.classList.remove('hidden');
      }
    });
  });
}

/**
 * 3. 取引確定ボタンを押した時の処理
 */
function handleExecuteTransaction() {
  if (!selectedMode) {
    alert('最初に取引メニューを選択してください。');
    return;
  }

  const amountBtn = document.getElementById('atm-amount-btn');
  const amount = parseInt(amountBtn ? amountBtn.getAttribute('data-amount') : '0', 10) || 0;

  if (amount <= 0) {
    alert('「金額を入力」ボタンを押して、1以上の正しい金額を指定してください。');
    return;
  }

  // ① 預け入れ (Deposit)
  if (selectedMode === 'deposit') {
    if (playerData.cash < amount) {
      alert('所持金が足りません！');
      return;
    }
    playerData.cash -= amount;
    playerData.bank += amount;
    alert(`$${amount.toLocaleString()} を銀行に預け入れました。`);
  }

  // ② 引き出し (Withdraw)
  else if (selectedMode === 'withdraw') {
    if (playerData.bank < amount) {
      alert('銀行貯金額が足りません！');
      return;
    }
    playerData.bank -= amount;
    playerData.cash += amount;
    alert(`$${amount.toLocaleString()} を銀行から引き出しました。`);
  }

  // ③ 借金返済 (Repay)
  else if (selectedMode === 'repay') {
    if (playerData.debt <= 0) {
      alert('現在、返済すべき借金はありません。');
      return;
    }
    if (playerData.cash < amount) {
      alert('所持金が足りません！');
      return;
    }
    if (amount > playerData.debt) {
      alert(`借金額以上の返済はできません。（現在の借金: $${playerData.debt.toLocaleString()}）`);
      return;
    }

    playerData.cash -= amount;
    playerData.debt -= amount;

    // ★ 完済時の処理: 連続未返済カウントを0にリセット！
    if (playerData.debt === 0) {
      playerData.debtPlayCount = 0;
      alert(`🎉 借金を全額完済しました！ 金利カウントがリセットされました。`);
    } else {
      alert(`$${amount.toLocaleString()} の借金を返済しました。残りの借金: $${playerData.debt.toLocaleString()}`);
    }
  }

  // ④ 借金 (Borrow) ※上限なし！
  else if (selectedMode === 'borrow') {
    playerData.debt += amount;
    playerData.cash += amount;
    alert(`$${amount.toLocaleString()} を借入れました。現在の借金: $${playerData.debt.toLocaleString()}`);
  }

  // ★ 1. ローカルストレージおよびスプレッドシートへ保存
  if (typeof saveData === 'function') {
    saveData();
  }

  // ★ 2. ロビー ＆ ゲーム画面の所持金表示を即座に完全同期
  refreshAllUI();

  // ★ 3. ATM表示のリセット ＆ モーダルを閉じる
  resetAtmUI();
  const atmModal = document.getElementById('atm-modal');
  if (atmModal) {
    atmModal.classList.add('hidden');
  }
}

/**
 * 4. 初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  setupAtmModal();
  setupModeSelection();

  const executeBtn = document.getElementById('atm-execute-btn');
  if (executeBtn) {
    executeBtn.addEventListener('click', handleExecuteTransaction);
  }
});