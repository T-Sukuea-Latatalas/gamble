/**
 * ==========================================
 * Fever Casino - ビデオポーカーPRO制御スクリプト (game-poker.js)
 * ==========================================
 */

const SUITS = [
  { symbol: '♠', color: 'black' },
  { symbol: '♥', color: 'red' },
  { symbol: '♦', color: 'red' },
  { symbol: '♣', color: 'black' }
];

const RANKS = [
  { str: '2', val: 2 }, { str: '3', val: 3 }, { str: '4', val: 4 },
  { str: '5', val: 5 }, { str: '6', val: 6 }, { str: '7', val: 7 },
  { str: '8', val: 8 }, { str: '9', val: 9 }, { str: '10', val: 10 },
  { str: 'J', val: 11 }, { str: 'Q', val: 12 }, { str: 'K', val: 13 }, { str: 'A', val: 14 }
];

let deck = [];
let hand = [null, null, null, null, null];
let heldStates = [false, false, false, false, false];
let currentBet = 0;
let gameState = 'BETTING'; // 'BETTING', 'HOLDING', 'RESULT'
let isAnimating = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ★ 画面の所持金・借金表示を完全同期 (lobby.js の共通 updateUI を安全呼び出し) ★
 */
function updateCashDisplay() {
  if (typeof updateUI === 'function') {
    updateUI();
  }
}

function createDeck() {
  deck = [];
  for (let suit of SUITS) {
    for (let rank of RANKS) {
      deck.push({
        suit: suit.symbol,
        color: suit.color,
        rankStr: rank.str,
        rankVal: rank.val
      });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

/**
 * カードを3Dフリップ描画
 */
async function flipCard(index, cardData) {
  const wrapper = document.querySelector(`.poker-card-wrapper[data-index="${index}"]`);
  if (!wrapper) return;

  const front = wrapper.querySelector('.card-front');

  wrapper.classList.remove('flipped');
  await delay(120);

  front.className = `card-face card-front ${cardData.color}`;
  front.innerHTML = `
    <div class="card-top">${cardData.rankStr}${cardData.suit}</div>
    <div class="card-center">${cardData.suit}</div>
    <div class="card-bottom">${cardData.rankStr}</div>
  `;

  wrapper.classList.add('flipped');
}

/**
 * ディール
 */
async function startDeal() {
  if (gameState !== 'BETTING' || isAnimating) return;

  const betBtn = document.getElementById('bet-select-btn');
  const betVal = parseInt(betBtn.getAttribute('data-amount'), 10) || 0;

  if (betVal <= 0) {
    alert('1以上の賭け金を選択してください。');
    return;
  }

  if (betVal > playerData.cash) {
    alert('所持金が足りません！');
    return;
  }

  currentBet = betVal;
  playerData.cash -= currentBet;
  saveData();

  isAnimating = true;
  document.getElementById('open-atm-btn').disabled = true; // ATMボタン無効化
  createDeck();
  heldStates = [false, false, false, false, false];

  const wrappers = document.querySelectorAll('.poker-card-wrapper');
  wrappers.forEach(w => {
    w.classList.remove('held', 'flipped', 'lose-state');
  });

  document.getElementById('bet-group').classList.add('hidden');
  document.getElementById('poker-message').textContent = 'カードを配っています...';

  // 時間差フリップ配付
  for (let i = 0; i < 5; i++) {
    hand[i] = deck.pop();
    await flipCard(i, hand[i]);
    await delay(180);
  }

  isAnimating = false;
  gameState = 'HOLDING';

  document.getElementById('action-group').classList.remove('hidden');
  document.getElementById('poker-message').textContent = '残したいカードをタップして「ドロー」を押してください。';
}

/**
 * ドロー
 */
async function startDraw() {
  if (gameState !== 'HOLDING' || isAnimating) return;

  isAnimating = true;
  document.getElementById('action-group').classList.add('hidden');
  document.getElementById('poker-message').textContent = 'カードを入れ替えています...';

  for (let i = 0; i < 5; i++) {
    if (!heldStates[i]) {
      hand[i] = deck.pop();
      await flipCard(i, hand[i]);
      await delay(180);
    }
  }

  isAnimating = false;
  gameState = 'RESULT';

  // 役判定へ
  evaluateHand();

  document.getElementById('next-group').classList.remove('hidden');
}

/**
 * 役判定 ＆ 配当処理
 */
function evaluateHand() {
  document.querySelectorAll('.pay-row').forEach(r => r.classList.remove('active-pay'));

  const sorted = [...hand].sort((a, b) => a.rankVal - b.rankVal);
  const isFlush = hand.every(c => c.suit === hand[0].suit);

  let isStraight = false;
  if (sorted[4].rankVal - sorted[0].rankVal === 4 && new Set(sorted.map(c => c.rankVal)).size === 5) {
    isStraight = true;
  }
  if (sorted[0].rankVal === 2 && sorted[1].rankVal === 3 && sorted[2].rankVal === 4 && sorted[3].rankVal === 5 && sorted[4].rankVal === 14) {
    isStraight = true;
  }

  const counts = {};
  sorted.forEach(c => { counts[c.rankVal] = (counts[c.rankVal] || 0) + 1; });
  const countValues = Object.values(counts).sort((a, b) => b - a);

  let rankName = '役なし';
  let multiplier = 0;
  let payElementId = '';

  if (isStraight && isFlush) {
    if (sorted[0].rankVal === 10 && sorted[4].rankVal === 14) {
      rankName = '🎉 ロイヤルストレートフラッシュ！'; multiplier = 250; payElementId = 'pay-royal';
    } else {
      rankName = '✨ ストレートフラッシュ！'; multiplier = 50; payElementId = 'pay-sf';
    }
  } else if (countValues[0] === 4) {
    rankName = '🔥 フォーカード！'; multiplier = 25; payElementId = 'pay-4k';
  } else if (countValues[0] === 3 && countValues[1] === 2) {
    rankName = '🏠 フルハウス！'; multiplier = 9; payElementId = 'pay-fh';
  } else if (isFlush) {
    rankName = '🎨 フラッシュ！'; multiplier = 6; payElementId = 'pay-fl';
  } else if (isStraight) {
    rankName = '📏 ストレート！'; multiplier = 4; payElementId = 'pay-st';
  } else if (countValues[0] === 3) {
    rankName = '☘️ スリーカード！'; multiplier = 3; payElementId = 'pay-3k';
  } else if (countValues[0] === 2 && countValues[1] === 2) {
    rankName = '✌️ ツーペア！'; multiplier = 2; payElementId = 'pay-2p';
  } else if (countValues[0] === 2) {
    const pairRank = Number(Object.keys(counts).find(k => counts[k] === 2));
    if (pairRank >= 11) {
      rankName = '🃏 ジャックス・オア・ベター！'; multiplier = 1; payElementId = 'pay-job';
    }
  }

  const msgEl = document.getElementById('poker-message');

  if (multiplier > 0) {
    const payout = currentBet * multiplier;
    const profit = payout - currentBet;

    playerData.cash += payout;

    if (profit > (playerData.highScores.poker || 0)) {
      playerData.highScores.poker = profit;
    }

    if (payElementId) {
      document.getElementById(payElementId).classList.add('active-pay');
    }

    msgEl.textContent = `${rankName} 配当 $${payout.toLocaleString()} を獲得！ (${multiplier}倍)`;
    triggerWinEffects();

  } else {
    msgEl.textContent = '残念！役なしでした。';
    document.querySelectorAll('.poker-card-wrapper').forEach(w => w.classList.add('lose-state'));
  }

  // ★ 借金利子システムの実行 ★
  if (typeof applyDebtInterest === 'function') {
    applyDebtInterest();
  }

  saveData();
}

function triggerWinEffects() {
  const container = document.getElementById('particle-container');
  if (!container) return;

  container.innerHTML = '';
  const items = ['🪙', '✨', '💎', '♠️', '♦️'];

  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = items[Math.floor(Math.random() * items.length)];
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDelay = Math.random() * 0.8 + 's';
    container.appendChild(p);

    setTimeout(() => p.remove(), 3000);
  }
}

/**
 * 次のゲームの準備
 */
function prepareNextGame() {
  gameState = 'BETTING';
  hand = [null, null, null, null, null];
  heldStates = [false, false, false, false, false];

  document.getElementById('open-atm-btn').disabled = false; // ATMボタン再有効化
  document.querySelectorAll('.pay-row').forEach(r => r.classList.remove('active-pay'));

  const wrappers = document.querySelectorAll('.poker-card-wrapper');
  wrappers.forEach(w => {
    w.classList.remove('held', 'flipped', 'lose-state');
  });

  document.getElementById('next-group').classList.add('hidden');
  document.getElementById('bet-group').classList.remove('hidden');
  document.getElementById('poker-message').textContent = '賭け金を選択して「ディール」を押してください';

  updateCashDisplay();
}

/**
 * 初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadData === 'function') loadData();
  updateCashDisplay();

  const cardWrappers = document.querySelectorAll('.poker-card-wrapper');
  cardWrappers.forEach((wrapper, index) => {
    wrapper.addEventListener('click', () => {
      if (gameState !== 'HOLDING' || isAnimating) return;

      heldStates[index] = !heldStates[index];
      if (heldStates[index]) {
        wrapper.classList.add('held');
      } else {
        wrapper.classList.remove('held');
      }
    });
  });

  document.getElementById('deal-btn').addEventListener('click', startDeal);
  document.getElementById('draw-btn').addEventListener('click', startDraw);
  document.getElementById('next-btn').addEventListener('click', prepareNextGame);
});
