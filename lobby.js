/**
 * ==========================================
 * Fever Casino - データ管理＆全共通制御スクリプト (lobby.js)
 * お知らせ既読管理・デバッグリアルタイム同期対応版
 * ==========================================
 */

const STORAGE_KEY = 'fever_casino_player_data';
const VIEW_MODE_KEY = 'fever_casino_view_mode';
const READ_NOTICES_KEY = 'fever_casino_read_notices';

function toBigInt(val, defaultValue = 0n) {
  if (val === null || val === undefined) return defaultValue;
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return defaultValue;
    try {
      return BigInt(Math.trunc(val));
    } catch (e) {
      return defaultValue;
    }
  }
  if (typeof val === 'string') {
    const cleanStr = val.replace(/[\$,\s]/g, '').trim();
    if (cleanStr === '' || cleanStr === '-') return defaultValue;
    try {
      const dotIndex = cleanStr.indexOf('.');
      const strToParse = dotIndex !== -1 ? cleanStr.substring(0, dotIndex) : cleanStr;
      if (strToParse.includes('e') || strToParse.includes('E')) {
        const numVal = Number(strToParse);
        if (!isNaN(numVal) && isFinite(numVal)) {
          return BigInt(Math.trunc(numVal));
        }
      }
      return BigInt(strToParse);
    } catch (e) {
      return defaultValue;
    }
  }
  return defaultValue;
}

window.toBigInt = toBigInt;

function formatCurrency(num) {
  const bigVal = toBigInt(num, 0n);
  if (bigVal < 0n) {
    return '-$' + (-bigVal).toLocaleString('en-US');
  }
  return '$' + bigVal.toLocaleString('en-US');
}

window.formatCurrency = formatCurrency;

// プレイヤーデータオブジェクト定義
let playerData = {
  userId: '',
  userName: '新規ユーザー',
  isNameSet: false,
  cash: 1000n,
  bank: 0n,
  debt: 0n,
  debtPlayCount: 0,
  debtChallengeFailCount: 0,
  nextDebtChallengeTime: 0,
  highScores: {
    blackjack: 0n,
    slots: 0n,
    roulette: 0n,
    poker: 0n,
    lottery: 0n,
    pachinko: 0n
  }
};

window.playerData = playerData;

function generateUserId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

function saveData() {
  try {
    playerData.cash = toBigInt(playerData.cash, 0n);
    if (playerData.cash < 0n) playerData.cash = 0n;

    playerData.bank = toBigInt(playerData.bank, 0n);
    if (playerData.bank < 0n) playerData.bank = 0n;

    playerData.debt = toBigInt(playerData.debt, 0n);
    if (playerData.debt < 0n) playerData.debt = 0n;

    const serializedData = {
      ...playerData,
      isNameSet: !!playerData.isNameSet,
      cash: playerData.cash.toString(),
      bank: playerData.bank.toString(),
      debt: playerData.debt.toString(),
      debtPlayCount: typeof playerData.debtPlayCount === 'number' ? playerData.debtPlayCount : 0,
      debtChallengeFailCount: typeof playerData.debtChallengeFailCount === 'number' ? playerData.debtChallengeFailCount : 0,
      nextDebtChallengeTime: typeof playerData.nextDebtChallengeTime === 'number' ? playerData.nextDebtChallengeTime : 0,
      highScores: {
        blackjack: toBigInt(playerData.highScores?.blackjack, 0n).toString(),
        slots: toBigInt(playerData.highScores?.slots, 0n).toString(),
        roulette: toBigInt(playerData.highScores?.roulette, 0n).toString(),
        poker: toBigInt(playerData.highScores?.poker, 0n).toString(),
        lottery: toBigInt(playerData.highScores?.lottery, 0n).toString(),
        pachinko: toBigInt(playerData.highScores?.pachinko, 0n).toString()
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedData));
    updateUI();
  } catch (error) {
    console.error('データの保存に失敗しました:', error);
  }
}

function loadData() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      playerData.userId = parsed.userId || playerData.userId || generateUserId();
      playerData.userName = parsed.userName || playerData.userName || '新規ユーザー';
      playerData.isNameSet = parsed.isNameSet !== undefined ? !!parsed.isNameSet : false;
      playerData.cash = toBigInt(parsed.cash, 1000n);
      playerData.bank = toBigInt(parsed.bank, 0n);
      playerData.debt = toBigInt(parsed.debt, 0n);
      playerData.debtPlayCount = typeof parsed.debtPlayCount === 'number' ? parsed.debtPlayCount : 0;
      playerData.debtChallengeFailCount = typeof parsed.debtChallengeFailCount === 'number' ? parsed.debtChallengeFailCount : 0;
      playerData.nextDebtChallengeTime = typeof parsed.nextDebtChallengeTime === 'number' ? parsed.nextDebtChallengeTime : 0;

      const hs = parsed.highScores || {};
      playerData.highScores = {
        blackjack: toBigInt(hs.blackjack, 0n),
        slots: toBigInt(hs.slots, 0n),
        roulette: toBigInt(hs.roulette, 0n),
        poker: toBigInt(hs.poker, 0n),
        lottery: toBigInt(hs.lottery, 0n),
        pachinko: toBigInt(hs.pachinko, 0n)
      };
    } else {
      if (!playerData.userId) playerData.userId = generateUserId();
      saveData();
    }
  } catch (error) {
    console.error('データの読み込み中にエラーが発生しました:', error);
    if (!playerData.userId) playerData.userId = generateUserId();
  }
}

function updateUI() {
  playerData.cash = toBigInt(playerData.cash, 0n);
  if (playerData.cash < 0n) playerData.cash = 0n;

  playerData.bank = toBigInt(playerData.bank, 0n);
  if (playerData.bank < 0n) playerData.bank = 0n;

  playerData.debt = toBigInt(playerData.debt, 0n);
  if (playerData.debt < 0n) playerData.debt = 0n;

  const cash = playerData.cash;
  const bank = playerData.bank;
  const debt = playerData.debt;
  const netWorth = cash + bank - debt;
  const userName = playerData.userName || '新規ユーザー';

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

  const gameCashEl = document.getElementById('cash-display');
  const gameDebtEl = document.getElementById('debt-display');
  const gameNameEl = document.getElementById('player-name');

  if (gameCashEl) gameCashEl.textContent = formatCurrency(cash);
  if (gameDebtEl) gameDebtEl.textContent = formatCurrency(debt);
  if (gameNameEl) gameNameEl.textContent = userName;

  if (typeof window.updateDebtChallengeButtons === 'function') {
    window.updateDebtChallengeButtons();
  }
}

window.updateCashDisplay = updateUI;

function applyDebtInterest() {
  playerData.debt = toBigInt(playerData.debt, 0n);
  if (playerData.debt <= 0n) {
    playerData.debt = 0n;
    playerData.debtPlayCount = 0;
    saveData();
    return;
  }

  playerData.debtPlayCount = (typeof playerData.debtPlayCount === 'number' ? playerData.debtPlayCount : 0) + 1;
  const currentRate = BigInt(1 + Math.floor(playerData.debtPlayCount / 5));

  const interestAmount = (playerData.debt * currentRate + 99n) / 100n;
  playerData.debt += interestAmount;

  saveData();
}

/**
 * お知らせモーダル ＆ 未読インジケーター（赤丸バッジ）制御
 */
function setupNoticeModal() {
  const openBtn = document.getElementById('open-notice-btn');
  const closeBtn = document.getElementById('close-notice-btn');
  const modal = document.getElementById('notice-modal');

  if (!modal) return;

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      markAllNoticesAsRead();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  const overlay = modal.querySelector('.modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }
}

function getReadNoticeIds() {
  try {
    return JSON.parse(localStorage.getItem(READ_NOTICES_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function markAllNoticesAsRead() {
  const notices = window.fetchedNoticeList || [];
  const readIds = notices.map(n => n.noticeId);
  localStorage.setItem(READ_NOTICES_KEY, JSON.stringify(readIds));

  const badge = document.getElementById('notice-unread-badge');
  if (badge) badge.classList.add('hidden');
}

function updateNoticeUnreadBadge(notices) {
  window.fetchedNoticeList = notices;
  const readIds = getReadNoticeIds();
  const hasUnread = notices.some(n => !readIds.includes(n.noticeId));

  const badge = document.getElementById('notice-unread-badge');
  if (badge) {
    if (hasUnread) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

window.updateNoticeUnreadBadge = updateNoticeUnreadBadge;

function setupUsernameChange() {
  const changeBtn = document.getElementById('change-username-btn');
  const usernameInput = document.getElementById('username-input');
  if (!changeBtn || !usernameInput) return;
  changeBtn.addEventListener('click', () => {
    const newName = usernameInput.value.trim();
    if (newName) {
      playerData.userName = newName;
      playerData.isNameSet = true;
      saveData();
      alert('プレイヤー名を変更しました！');
    }
  });
}

function checkUsernameSetup() {
  const modal = document.getElementById('username-modal');
  const input = document.getElementById('modal-username-input');
  if (!modal) return;

  const defaultNames = ['新規ユーザー', 'ゲスト', 'ゲストプレイヤー', 'Unknown', 'ゲストユーザー'];
  const isDefaultName = defaultNames.includes(playerData.userName) || !playerData.userName || playerData.userName.trim() === '';

  if (isDefaultName && !playerData.isNameSet) {
    if (input) {
      input.value = playerData.userName || '新規ユーザー';
    }
    modal.classList.remove('hidden');
  }
}

function setupUsernameModalEvents() {
  const modal = document.getElementById('username-modal');
  const saveBtn = document.getElementById('save-username-btn');
  const skipBtn = document.getElementById('skip-username-btn');
  const input = document.getElementById('modal-username-input');

  if (!modal) return;

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const newName = input ? input.value.trim() : '';
      if (!newName) {
        alert('プレイヤー名を入力してください。');
        return;
      }
      playerData.userName = newName;
      playerData.isNameSet = true;
      saveData();
      modal.classList.add('hidden');
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      if (!playerData.userName || playerData.userName.trim() === '') {
        playerData.userName = '新規ユーザー';
      }
      playerData.isNameSet = true;
      saveData();
      modal.classList.add('hidden');
    });
  }
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

function setupRankingSlider() {
  const slider = document.getElementById('ranking-slider');
  const indicatorWrapper = document.querySelector('.ranking-indicators-wrapper');
  const indicatorBtns = document.querySelectorAll('.indicator-btn');

  if (!slider || indicatorBtns.length === 0) return;

  function setActiveIndicator(index) {
    indicatorBtns.forEach((btn, i) => {
      if (i === index) {
        btn.classList.add('active');
        if (indicatorWrapper) {
          const btnLeft = btn.offsetLeft;
          const btnWidth = btn.offsetWidth;
          const wrapperScrollLeft = indicatorWrapper.scrollLeft;
          const wrapperWidth = indicatorWrapper.clientWidth;

          if (btnLeft < wrapperScrollLeft) {
            indicatorWrapper.scrollTo({ left: btnLeft, behavior: 'smooth' });
          } else if (btnLeft + btnWidth > wrapperScrollLeft + wrapperWidth) {
            indicatorWrapper.scrollTo({ left: btnLeft + btnWidth - wrapperWidth, behavior: 'smooth' });
          }
        }
      } else {
        btn.classList.remove('active');
      }
    });
  }

  indicatorBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'), 10);
      if (isNaN(index)) return;

      const slideWidth = slider.clientWidth;
      slider.scrollTo({
        left: slideWidth * index,
        behavior: 'smooth'
      });

      setActiveIndicator(index);
    });
  });

  slider.addEventListener('scroll', () => {
    const slideWidth = slider.clientWidth;
    if (slideWidth <= 0) return;

    const currentIndex = Math.round(slider.scrollLeft / slideWidth);
    setActiveIndicator(currentIndex);
  });
}

function initLobby() {
  loadData();
  updateUI();
  setupUsernameChange();
  setupUsernameModalEvents();
  setupViewModeToggle();
  setupRankingSlider();
  setupNoticeModal();
  checkUsernameSetup();
}

document.addEventListener('DOMContentLoaded', initLobby);
window.addEventListener('pageshow', () => { loadData(); updateUI(); checkUsernameSetup(); });
window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) { loadData(); updateUI(); } });