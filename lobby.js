/**
 * ==========================================
 * Fever Casino - データ管理＆ロビー・全ゲーム共通制御スクリプト (lobby.js)
 * BigInt & クッキークリッカー風フォーマッター対応版
 * ==========================================
 */

const STORAGE_KEY = 'fever_casino_player_data';
const VIEW_MODE_KEY = 'fever_casino_view_mode';

/**
 * どんな型からでも安全に BigInt へ変換する万能ヘルパー関数
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
    // カンマ、ドル、記号、単位表記や空白を除外
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

window.toBigInt = toBigInt;

/**
 * クッキークリッカー風単位付きフォーマッター
 */
function formatBigIntShort(bigVal) {
  if (bigVal < 100000n) {
    return bigVal.toLocaleString();
  }

  const SUFFIXES = [
    '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 
    'Dc', 'UnD', 'DuD', 'TreD', 'QaD', 'QiD', 'SxD', 'SpD', 'OcD', 'NoD', 'Vig'
  ];

  const str = bigVal.toString();
  const len = str.length;
  let unitIndex = Math.floor((len - 1) / 3);

  if (unitIndex >= SUFFIXES.length) {
    unitIndex = SUFFIXES.length - 1;
  }

  const shift = unitIndex * 3;
  const rem = len - shift;

  let intPartStr = str.slice(0, rem);
  let decPartStr = str.slice(rem, rem + 3);

  while (decPartStr.length < 3) {
    decPartStr += '0';
  }

  let decNum = Math.round(parseInt(decPartStr, 10) / 10);
  let intNum = BigInt(intPartStr);

  if (decNum >= 100) {
    intNum += 1n;
    decNum = 0;
    if (intNum.toString().length > rem) {
      if (unitIndex < SUFFIXES.length - 1) {
        unitIndex += 1;
        intPartStr = "1";
        decNum = 0;
      } else {
        intPartStr = intNum.toString();
      }
    } else {
      intPartStr = intNum.toString();
    }
  }

  const decFormatted = String(decNum).padStart(2, '0');
  const suffix = SUFFIXES[unitIndex] || '';

  return `${intPartStr}.${decFormatted}${suffix}`;
}

/**
 * 通貨表記用メイン関数 (例: $100.00K, -$50.00M, $9,999)
 */
function formatCurrency(num) {
  let isNegative = false;
  let bigVal = 0n;

  if (typeof num === 'bigint') {
    if (num < 0n) {
      isNegative = true;
      bigVal = -num;
    } else {
      bigVal = num;
    }
  } else {
    const b = toBigInt(num, 0n);
    bigVal = b;
  }

  const formattedStr = formatBigIntShort(bigVal);
  return (isNegative ? '-$' : '$') + formattedStr;
}

window.formatCurrency = formatCurrency;
window.formatBigIntShort = formatBigIntShort;

// プレイヤーデータ構造 (内部数値はすべて BigInt)
let playerData = {
  userId: '',
  userName: 'ゲストプレイヤー',
  cash: 1000n,
  bank: 0n,
  debt: 0n,
  debtPlayCount: 0,
  highScores: {
    blackjack: 0n,
    slots: 0n,
    roulette: 0n,
    poker: 0n
  }
};

window.playerData = playerData;

function generateUserId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * LocalStorage 保存
 */
function saveData() {
  try {
    playerData.cash = toBigInt(playerData.cash, 0n);
    playerData.bank = toBigInt(playerData.bank, 0n);
    playerData.debt = toBigInt(playerData.debt, 0n);

    const serializedData = {
      ...playerData,
      cash: playerData.cash.toString(),
      bank: playerData.bank.toString(),
      debt: playerData.debt.toString(),
      debtPlayCount: Number(playerData.debtPlayCount) || 0,
      highScores: {
        blackjack: toBigInt(playerData.highScores?.blackjack, 0n).toString(),
        slots: toBigInt(playerData.highScores?.slots, 0n).toString(),
        roulette: toBigInt(playerData.highScores?.roulette, 0n).toString(),
        poker: toBigInt(playerData.highScores?.poker, 0n).toString()
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedData));
    updateUI();
  } catch (error) {
    console.error('データの保存に失敗しました:', error);
  }
}

/**
 * LocalStorage ロード
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
 * 全画面ステータス表示のリアルタイム自動同期
 */
function updateUI() {
  playerData.cash = toBigInt(playerData.cash, 0n);
  playerData.bank = toBigInt(playerData.bank, 0n);
  playerData.debt = toBigInt(playerData.debt, 0n);

  const cash = playerData.cash;
  const bank = playerData.bank;
  const debt = playerData.debt;
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

  // ゲーム画面用要素
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

  const interestAmount = (playerData.debt * currentRate + 99n) / 100n;
  playerData.debt += interestAmount;

  saveData();
}

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

function initLobby() {
  loadData();
  updateUI();
  setupUsernameChange();
  setupViewModeToggle();
}

document.addEventListener('DOMContentLoaded', initLobby);
window.addEventListener('pageshow', () => { loadData(); updateUI(); });
window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) { loadData(); updateUI(); } });
