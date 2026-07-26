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
 * ランダムで一意なユーザーID（UUID風）を生成する関数
 */
function generateUserId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * プレイヤーデータを LocalStorage に保存する関数
 */
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
 * LocalStorage から最新データを確実にロードする関数
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

/**
 * 数値を3桁カンマ区切りのドル表記（例: $1,000）に整形する関数
 */
function formatCurrency(num) {
  return '$' + (Number(num) || 0).toLocaleString();
}

/**
 * ★ 全画面共通: 画面上の全ステータス表示（所持金・貯金・借金・純資産・名前）を完全同期する関数
 */
function updateUI() {
  const cash = Number(playerData.cash) || 0;
  const bank = Number(playerData.bank) || 0;
  const debt = Number(playerData.debt) || 0;
  const netWorth = cash + bank - debt;
  const userName = playerData.userName || 'ゲストプレイヤー';

  // ----------------------------------------------------
  // ① ロビー画面 (index.html) 用の要素更新
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // ② 各ゲーム画面 (game-*.html) 用の要素更新
  // ----------------------------------------------------
  const gameCashEl = document.getElementById('cash-display');
  const gameDebtEl = document.getElementById('debt-display');
  const gameNameEl = document.getElementById('player-name');

  if (gameCashEl) gameCashEl.textContent = formatCurrency(cash);
  if (gameDebtEl) gameDebtEl.textContent = formatCurrency(debt);
  if (gameNameEl) gameNameEl.textContent = userName;
}

// ゲーム画面用の旧関数（updateCashDisplay）が呼ばれた際も安全に updateUI を動かす完全互換設定
window.updateCashDisplay = updateUI;

/**
 * ★ 共通借金利子システム (applyDebtInterest)
 * 各ゲームで1プレイ終了するたびに自動実行されます。
 */
function applyDebtInterest() {
  if (!playerData.debt || playerData.debt <= 0) {
    playerData.debt = 0;
    playerData.debtPlayCount = 0;
    return { interestAmount: 0, rate: 0, newDebt: 0 };
  }

  // 未返済プレイ回数を+1
  playerData.debtPlayCount = (playerData.debtPlayCount || 0) + 1;

  // 金利計算: 初期1%、5プレイごとに+1%上昇 (1~4回=1%, 5~9回=2%, 10~14回=3%...)
  const currentRate = 1 + Math.floor(playerData.debtPlayCount / 5);

  // 加算利子の計算 (端数切り上げ)
  const interestAmount = Math.ceil(playerData.debt * (currentRate / 100));
  playerData.debt += interestAmount;

  saveData();
  updateUI();

  console.log(`【利子発生】未返済プレイ数:${playerData.debtPlayCount}回 | 金利:${currentRate}% | 利子:+$${interestAmount} | 総借金額:$${playerData.debt}`);

  return {
    interestAmount: interestAmount,
    rate: currentRate,
    newDebt: playerData.debt,
    count: playerData.debtPlayCount
  };
}

/**
 * ユーザー名変更ボタンのイベント登録
 */
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
 * ロビー用: ランキングスワイプ ＆ インジケーター連動処理
 */
function setupRankingSwipe() {
  const slider = document.getElementById('ranking-slider');
  const indicators = document.querySelectorAll('.indicator-btn');

  if (!slider || !indicators.length) return;

  let isClickScrolling = false;

  // 手動スワイプ検知 ➔ インジケーターの自動切り替え
  slider.addEventListener('scroll', () => {
    if (isClickScrolling) return;

    const slideWidth = slider.clientWidth;
    if (slideWidth === 0) return;

    const activeIndex = Math.round(slider.scrollLeft / slideWidth);

    indicators.forEach((btn, idx) => {
      if (idx === activeIndex) {
        btn.classList.add('active');
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        btn.classList.remove('active');
      }
    });
  });

  // インジケータークリック ➔ スライド移動
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

/**
 * 表示モード（自動 / PC / スマホ）の切り替え適用
 */
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
 * ★ 全画面共通の初期化関数 ★
 */
function initLobby() {
  loadData();
  updateUI();
  setupUsernameChange();
  setupRankingSwipe();
  setupViewModeToggle();
}

// 1. 初回 DOMContentLoaded で確実にデータ読み込み ＆ UI描画
document.addEventListener('DOMContentLoaded', initLobby);

// 2. ブラウザの「戻る」などで他ページから復帰した際にも即座に全自動ロード ＆ 完全同期！
window.addEventListener('pageshow', () => {
  loadData();
  updateUI();
});

// 3. 別タブや別ウィンドウで LocalStorage が変更された場合も即座に画面表示をリアルタイム同期！
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    loadData();
    updateUI();
  }
});
