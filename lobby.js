/**
 * ==========================================
 * Fever Casino - データ管理＆ロビー制御スクリプト (lobby.js)
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

function generateUserId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

function saveData() {
  try {
    const jsonString = JSON.stringify(playerData);
    localStorage.setItem(STORAGE_KEY, jsonString);
    console.log('データが保存されました:', playerData);
  } catch (error) {
    console.error('データの保存に失敗しました:', error);
  }
}

/**
 * LocalStorageから最新データを確実にロードする
 */
function loadData() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      playerData = { ...playerData, ...parsedData };
      console.log('データを読み込みました:', playerData);
    } else {
      console.log('新規プレイヤーデータを作成します...');
      playerData.userId = generateUserId();
      saveData();
    }
  } catch (error) {
    console.error('データの読み込みに失敗しました。初期化します:', error);
    playerData.userId = generateUserId();
    saveData();
  }
}

function formatCurrency(num) {
  return '$' + (num || 0).toLocaleString();
}

/**
 * ★ 画面のステータス表示（所持金・貯金・借金・純資産）の完全同期関数
 */
function updateUI() {
  const netWorth = (playerData.cash || 0) + (playerData.bank || 0) - (playerData.debt || 0);

  const cashEl = document.getElementById('cash-amount');
  const bankEl = document.getElementById('bank-amount');
  const debtEl = document.getElementById('debt-amount');
  const netWorthEl = document.getElementById('net-worth-amount');
  const usernameInputEl = document.getElementById('username-input');

  if (cashEl) cashEl.textContent = formatCurrency(playerData.cash);
  if (bankEl) bankEl.textContent = formatCurrency(playerData.bank);
  if (debtEl) debtEl.textContent = formatCurrency(playerData.debt);
  if (netWorthEl) netWorthEl.textContent = formatCurrency(netWorth);

  if (usernameInputEl && document.activeElement !== usernameInputEl) {
    usernameInputEl.value = playerData.userName || 'ゲストプレイヤー';
  }
}

/**
 * 借金利子システム (applyDebtInterest)
 */
function applyDebtInterest() {
  if (!playerData.debt || playerData.debt <= 0) {
    playerData.debt = 0;
    playerData.debtPlayCount = 0;
    return { interestAmount: 0, rate: 0, newDebt: 0 };
  }

  playerData.debtPlayCount = (playerData.debtPlayCount || 0) + 1;
  const currentRate = 1 + Math.floor(playerData.debtPlayCount / 5);
  const interestAmount = Math.ceil(playerData.debt * (currentRate / 100));
  playerData.debt += interestAmount;

  saveData();
  updateUI();

  return {
    interestAmount: interestAmount,
    rate: currentRate,
    newDebt: playerData.debt,
    count: playerData.debtPlayCount
  };
}

function setupUsernameChange() {
  const changeBtn = document.getElementById('change-username-btn');
  const usernameInput = document.getElementById('username-input');

  if (!changeBtn || !usernameInput) return;

  changeBtn.addEventListener('click', () => {
    const newName = usernameInput.value.trim();
    if (newName === '') {
      alert('プレイヤー名を入力してください。');
      return;
    }
    playerData.userName = newName;
    saveData();
    updateUI();
    alert(`プレイヤー名を「${newName}」に変更しました！`);
  });
}

/**
 * ★ スワイプ ＆ インジケーター連動処理 (setupRankingSwipe) ★
 */
function setupRankingSwipe() {
  const slider = document.getElementById('ranking-slider');
  const indicators = document.querySelectorAll('.indicator-btn');

  if (!slider || !indicators.length) return;

  let isClickScrolling = false;

  // 1. 手動スワイプ（スクロール）検知 ➔ インジケーターを追従点灯
  slider.addEventListener('scroll', () => {
    if (isClickScrolling) return;

    const slideWidth = slider.clientWidth;
    if (slideWidth === 0) return;

    // 現在何番目のスライドが表示されているか計算
    const activeIndex = Math.round(slider.scrollLeft / slideWidth);

    indicators.forEach((btn, idx) => {
      if (idx === activeIndex) {
        btn.classList.add('active');
        // インジケーター自体も画面中央へスムーズスクロール移動
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        btn.classList.remove('active');
      }
    });
  });

  // 2. インジケータータップ ➔ 該当スライドへ直接滑らかスライド移動
  indicators.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      isClickScrolling = true;

      indicators.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const slideWidth = slider.clientWidth;
      slider.scrollTo({
        left: slideWidth * idx,
        behavior: 'smooth'
      });

      setTimeout(() => {
        isClickScrolling = false;
      }, 400);
    });
  });
}

function applyViewMode(mode) {
  document.body.classList.remove('force-desktop', 'force-mobile');

  if (mode === 'desktop') {
    document.body.classList.add('force-desktop');
  } else if (mode === 'mobile') {
    document.body.classList.add('force-mobile');
  }

  const viewBtns = document.querySelectorAll('.view-mode-toggle .view-btn');
  viewBtns.forEach(btn => {
    if (btn.getAttribute('data-mode') === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  localStorage.setItem(VIEW_MODE_KEY, mode);
}

function setupViewModeToggle() {
  const viewBtns = document.querySelectorAll('.view-mode-toggle .view-btn');
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedMode = btn.getAttribute('data-mode');
      applyViewMode(selectedMode);
    });
  });

  const savedMode = localStorage.getItem(VIEW_MODE_KEY) || 'auto';
  applyViewMode(savedMode);
}

/**
 * ★ 完全同期のための初期化 ＆ イベント登録 ★
 */
function initLobby() {
  loadData();
  updateUI();
  setupUsernameChange();
  setupRankingSwipe();
  setupViewModeToggle();
}

// 1. 初回DOMContentLoadedでロード＆表示
document.addEventListener('DOMContentLoaded', initLobby);

// 2. 他ページ（ゲーム画面等）からブラウザの「戻る」などで復帰した際にも即座に再ロード＆完全同期！
window.addEventListener('pageshow', () => {
  loadData();
  updateUI();
});

// 3. 別ウィンドウ・別タブでLocalStorageが変更された際も自動完全同期！
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    loadData();
    updateUI();
  }
});