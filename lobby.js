/**
 * ==========================================
 * Fever Casino - データ管理＆ロビー・全ゲーム共通制御スクリプト (lobby.js)
 * BigInt (超巨大数値) 完全対応版
 * ==========================================
 */

const STORAGE_KEY = 'fever_casino_player_data';
const VIEW_MODE_KEY = 'fever_casino_view_mode';

/**
 * どんな型からでも安全に BigInt へ変換する万能ヘルパー関数
 * @param {any} val - 変換対象 (BigInt, Number, String, undefined, null等)
 * @param {bigint} defaultValue - 変換失敗時のデフォルト値
 * @returns {bigint}
 */
function toBigInt(val, defaultValue = 0n) {
  if (val === null || val === undefined) return defaultValue;
  if (typeof val === 'bigint') return val < 0n ? 0n : val;
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return defaultValue;
    const intVal = Math.floor(val);
    return intVal < 0 ? 0n : BigInt(intVal);
  }
  if (typeof val === 'string') {
    // カンマやドルマーク、空白をすべて除外
    const cleanStr = val.replace(/[\$,\s]/g, '').trim();
    if (cleanStr === '' || cleanStr === '-') return defaultValue;
    try {
      const dotIndex = cleanStr.indexOf('.');
      const strToParse = dotIndex !== -1 ? cleanStr.substring(0, dotIndex) : cleanStr;
      const parsed = BigInt(strToParse);
      return parsed < 0n ? 0n : parsed;
    } catch (e) {
      return defaultValue;
    }
  }
  return defaultValue;
}

// グローバル公開
window.toBigInt = toBigInt;

// プレイヤーデータ構造 (内部数値はすべて BigInt)
let playerData = {
  userId: '',
  userName: 'ゲストプレイヤー',
  cash: 1000n,
  bank: 0n,
  debt: 0n,
  debtPlayCount: 0, // カウント数は通常の Number
  highScores: {
    blackjack: 0n,
    slots: 0n,
    roulette: 0n,
    poker: 0n
  }
};

window.playerData = playerData;

/**
 * プレイヤーID生成
 */
function generateUserId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * ★ LocalStorage 保存（BigInt を String に安全シリアライズ）
 */
function saveData() {
  try {
    const serializedData = {
      ...playerData,
      cash: (playerData.cash || 0n).toString(),
      bank: (playerData.bank || 0n).toString(),
      debt: (playerData.debt || 0n).toString(),
      debtPlayCount: Number(playerData.debtPlayCount) || 0,
      highScores: {
        blackjack: (playerData.highScores?.blackjack || 0n).toString(),
        slots: (playerData.highScores?.slots || 0n).toString(),
        roulette: (playerData.highScores?.roulette || 0n).toString(),
        poker: (playerData.highScores?.poker || 0n).toString()
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedData));
    updateUI();
  } catch (error) {
    console.error('データの保存に失敗しました:', error);
  }
}

/**
 * ★ LocalStorage ロード（String から safe に BigInt 復元）
 */
function loadData() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      playerData.userId = parsed.userId || generateUserId();
      playerData.userName = parsed.userName || 'ゲストプレイヤー';
      playerData.cash = toBigInt(parsed.cash, 1000n);
      playerData.bank = toBigInt(parsed.bank, 0n);
      playerData.debt = toBigInt(parsed.debt, 0n);
      playerData.debtPlayCount = Number(parsed.debtPlayCount) || 0;

      const hs = parsed.highScores || {};
      playerData.highScores = {
        blackjack: toBigInt(hs.blackjack, 0n),
        slots: toBigInt(hs.slots, 0n),
        roulette: toBigInt(hs.roulette, 0n),
        poker: toBigInt(hs.poker, 0n)
      };
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
 * BigInt対応 通貨整形表示関数
 */
function formatCurrency(num) {
  const bigNum = toBigInt(num, 0n);
  return '$' + bigNum.toLocaleString();
}

window.formatCurrency = formatCurrency;

/**
 * ★ 重要: 全画面のステータス表示をリアルタイム同期（BigInt演算）
 */
function updateUI() {
  playerData.cash = toBigInt(playerData.cash, 0n);
  playerData.bank = toBigInt(playerData.bank, 0n);
  playerData.debt = toBigInt(playerData.debt, 0n);

  const cash = playerData.cash;
  const bank = playerData.bank;
  const debt = playerData.debt;
  const netWorth = cash + bank - debt; // BigIntによる純資産計算
  const userName = playerData.userName || 'ゲストプレイヤー';

  const formatNetWorth = (val) => {
    if (val < 0n) {
      return '-$' + (-val).toLocaleString();
    }
    return '$' + val.toLocaleString();
  };

  // ロビー用要素
  const lobbyCashEl = document.getElementById('cash-amount');
  const lobbyBankEl = document.getElementById('bank-amount');
  const lobbyDebtEl = document.getElementById('debt-amount');
  const lobbyNetWorthEl = document.getElementById('net-worth-amount');
  const lobbyUsernameInputEl = document.getElementById('username-input');

  if (lobbyCashEl) lobbyCashEl.textContent = formatCurrency(cash);
  if (lobbyBankEl) lobbyBankEl.textContent = formatCurrency(bank);
  if (lobbyDebtEl) lobbyDebtEl.textContent = formatCurrency(debt);
  if (lobbyNetWorthEl) lobbyNetWorthEl.textContent = formatNetWorth(netWorth);
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

window.updateCashDisplay = updateUI;

/**
 * 借金利子システム (BigInt対応)
 */
function applyDebtInterest() {
  playerData.debt = toBigInt(playerData.debt, 0n);
  if (playerData.debt <= 0n) {
    playerData.debt = 0n;
    playerData.debtPlayCount = 0;
    return;
  }

  playerData.debtPlayCount = (Number(playerData.debtPlayCount) || 0) + 1;
  const currentRate = BigInt(1 + Math.floor(playerData.debtPlayCount / 5));

  // 端数切り上げ利子計算 (debt * rate + 99n) / 100n
  const interestAmount = (playerData.debt * currentRate + 99n) / 100n;
  playerData.debt += interestAmount;

  saveData();
}

/**
 * ユーザー名変更
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
 * 画面表示モード設定
 */
function applyViewMode(mode) {
  const targetMode = mode || 'auto';

  document.body.classList.remove('force-desktop', 'force-mobile');
  if (targetMode === 'desktop') document.body.classList.add('force-desktop');
  else if (targetMode === 'mobile') document.body.classList.add('force-mobile');

  localStorage.setItem(VIEW_MODE_KEY, targetMode);

  const viewBtns = document.querySelectorAll('.view-mode-toggle .view-btn');
  viewBtns.forEach(btn => {
    if (btn.getAttribute('data-mode') === targetMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function setupViewModeToggle() {
  const savedMode = localStorage.getItem(VIEW_MODE_KEY) || 'auto';
  applyViewMode(savedMode);

  const viewBtns = document.querySelectorAll('.view-mode-toggle .view-btn');
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedMode = btn.getAttribute('data-mode') || 'auto';
      applyViewMode(selectedMode);
    });
  });
}

/**
 * 初期化
 */
function initLobby() {
  loadData();
  updateUI();
  setupUsernameChange();
  setupViewModeToggle();
}

document.addEventListener('DOMContentLoaded', initLobby);
window.addEventListener('pageshow', () => { loadData(); updateUI(); });
window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) { loadData(); updateUI(); } });
