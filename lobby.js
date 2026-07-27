/**
 * ==========================================
 * Fever Casino - データ管理＆ロビー・全ゲーム共通制御スクリプト (lobby.js)
 * ==========================================
 */

const STORAGE_KEY = 'fever_casino_player_data';
const VIEW_MODE_KEY = 'fever_casino_view_mode';

// プレイヤーデータ構造
let playerData = {
  userId: '',
  userName: 'ゲストプレイヤー',
  cash: 1000,
  bank: 0,
  debt: 0,
  debtPlayCount: 0,
  highScores: {
    blackjack: 0,
    slots: 0,
    roulette: 0,
    poker: 0
  }
};

/**
 * プレイヤー名を生成
 */
function generateUserId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * ★ LocalStorage に保存 ＆ 画面表示を即座に自動同期
 */
function saveData() {
  try {
    const jsonString = JSON.stringify(playerData);
    localStorage.setItem(STORAGE_KEY, jsonString);
    // データ保存時に自動で画面上のUI（所持金・借金など）を更新
    updateUI();
  } catch (error) {
    console.error('データの保存に失敗しました:', error);
  }
}

/**
 * LocalStorage からロード
 */
function loadData() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      playerData = { ...playerData, ...parsedData };
    } else {
      playerData.userId = generateUserId();
      saveData();
    }
  } catch (error) {
    console.error('データの読み込みに失敗しました:', error);
    playerData.userId = generateUserId();
    saveData();
  }
}

/**
 * 数値を通貨形式に整形
 */
function formatCurrency(num) {
  return '$' + (Number(num) || 0).toLocaleString();
}

/**
 * ★ 重要: 全画面のステータス表示をリアルタイム同期
 */
function updateUI() {
  const cash = Number(playerData.cash) || 0;
  const bank = Number(playerData.bank) || 0;
  const debt = Number(playerData.debt) || 0;
  const netWorth = cash + bank - debt;
  const userName = playerData.userName || 'ゲストプレイヤー';

  // ロビー用要素
  const lobbyCashEl = document.getElementById('cash-amount');
  const lobbyBankEl = document.getElementById('bank-amount');
  const lobbyDebtEl = document.getElementById('debt-amount');
  const lobbyNetWorthEl = document.getElementById('net-worth-amount');
  const lobbyUsernameInputEl = document.getElementById('username-input');

  if (lobbyCashEl) lobbyCashEl.textContent = formatCurrency(cash);
  if (lobbyBankEl) lobbyBankEl.textContent = formatCurrency(bank);
  if (lobbyDebtEl) lobbyDebtEl.textContent = formatCurrency(debt);
  if (lobbyNetWorthEl) lobbyNetWorthEl.textContent = formatCurrency(netWorth);
  if (lobbyUsernameInputEl && document.activeElement !== lobbyUsernameInputEl) {
    lobbyUsernameInputEl.value = userName;
  }

  // ゲーム画面用要素 (game-*.html)
  const gameCashEl = document.getElementById('cash-display');
  const gameDebtEl = document.getElementById('debt-display');
  const gameNameEl = document.getElementById('player-name');

  if (gameCashEl) gameCashEl.textContent = formatCurrency(cash);
  if (gameDebtEl) gameDebtEl.textContent = formatCurrency(debt);
  if (gameNameEl) gameNameEl.textContent = userName;
}

// 互換性のためのエイリアス
window.updateCashDisplay = updateUI;

/**
 * 借金利子システム
 */
function applyDebtInterest() {
  if (!playerData.debt || playerData.debt <= 0) {
    playerData.debt = 0;
    playerData.debtPlayCount = 0;
    return;
  }
  playerData.debtPlayCount = (playerData.debtPlayCount || 0) + 1;
  const currentRate = 1 + Math.floor(playerData.debtPlayCount / 5);
  const interestAmount = Math.ceil(playerData.debt * (currentRate / 100));
  playerData.debt += interestAmount;

  saveData(); // saveData() 内で updateUI() が呼ばれるため画面も即座に同期される
}

/**
 * ユーザー名変更イベントの設定
 */
function setupUsernameChange() {
  const changeBtn = document.getElementById('change-username-btn');
  const usernameInput = document.getElementById('username-input');
  if (!changeBtn || !usernameInput) return;
  changeBtn.addEventListener('click', () => {
    const newName = usernameInput.value.trim();
    if (newName) {
      playerData.userName = newName;
      saveData();
      alert(`プレイヤー名を変更しました！`);
    }
  });
}

/**
 * 画面表示モード（自動・PC・スマホ）の適用・UI同期関数
 * @param {string} mode - 'auto' | 'desktop' | 'mobile'
 */
function applyViewMode(mode) {
  const targetMode = mode || 'auto';

  // 1. body タグの表示切り替えクラス制御
  document.body.classList.remove('force-desktop', 'force-mobile');
  if (targetMode === 'desktop') document.body.classList.add('force-desktop');
  else if (targetMode === 'mobile') document.body.classList.add('force-mobile');

  // 2. LocalStorage に保存
  localStorage.setItem(VIEW_MODE_KEY, targetMode);

  // 3. ボタンの .active クラス切り替え（UI同期）
  const viewBtns = document.querySelectorAll('.view-mode-toggle .view-btn');
  viewBtns.forEach(btn => {
    if (btn.getAttribute('data-mode') === targetMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * 表示モード切替ボタンのイベントリスナー登録＆初期適用
 */
function setupViewModeToggle() {
  // 保存された表示モードを読み込み（未設定時は 'auto'）
  const savedMode = localStorage.getItem(VIEW_MODE_KEY) || 'auto';
  applyViewMode(savedMode);

  // 切替ボタン群へのイベントリスナー登録
  const viewBtns = document.querySelectorAll('.view-mode-toggle .view-btn');
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedMode = btn.getAttribute('data-mode') || 'auto';
      applyViewMode(selectedMode);
    });
  });
}

/**
 * ロビーおよび全画面共通初期化関数
 */
function initLobby() {
  loadData();
  updateUI();
  setupUsernameChange();
  setupViewModeToggle(); // 表示モード切替機能の初期化
}

document.addEventListener('DOMContentLoaded', initLobby);
window.addEventListener('pageshow', () => { loadData(); updateUI(); });
window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) { loadData(); updateUI(); } });
