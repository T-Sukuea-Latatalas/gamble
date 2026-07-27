/**
 * ==========================================
 * Fever Casino - ビデオポーカーPRO制御スクリプト (game-poker.js)
 * BigInt & 超巨大数値完全対応版
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
let currentBet = 0n;
let gameState = 'BETTING';
let isAnimating = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function safeToBigInt(v) {
  if (typeof window.toBigInt === 'function') return window.toBigInt(v);
  try { return BigInt(v || 0); } catch (e) { return 0n; }
}

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

async function startDeal() {
  if (gameState !== 'BETTING' || isAnimating) return;

  const betBtn = document.getElementById('bet-select-btn');
  const betVal = safeToBigInt(betBtn ? betBtn.getAttribute('data-amount') : '0');

  if (betVal <= 0n) {
    alert('1以上の賭け金を選択してください。');
    return;
  }

  if (betVal > safeToBigInt(playerData.cash)) {
    alert('所持金が足りません！');
    return;
  }

  currentBet = betVal;
  playerData.cash = safeToBigInt(playerData.cash) - currentBet;
  saveData();

  isAnimating = true;
  document.getElementById('open-atm-btn').disabled = true;
  createDeck();
  heldStates = [false, false, false, false, false];

  const wrappers = document.querySelectorAll('.poker-card-wrapper');
  wrappers.forEach(w => {
    w.classList.remove('held', 'flipped', 'lose-state');
  });

  document.getElementById('bet-group').classList.add('hidden');
  document.getElementById('poker-message').textContent = 'カードを配っています...';

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

  evaluateHand();

  document.getElementById('next-group').classList.remove('hidden');
}

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
  let multiplier = 0n;
  let payElementId = '';

  if (isStraight && isFlush) {
    if (sorted[0].rankVal === 10 && sorted[4].rankVal === 14) {
      rankName = '🎉 ロイヤルストレートフラッシュ！'; multiplier = 250n; payElementId = 'pay-royal';
    } else {
      rankName = '✨ ストレートフラッシュ！'; multiplier = 50n; payElementId = 'pay-sf';
    }
  } else if (countValues[0] === 4) {
    rankName = '🔥 フォーカード！'; multiplier = 25n; payElementId = 'pay-4k';
  } else if (countValues[0] === 3 && countValues[1] === 2) {
    rankName = '🏠 フルハウス！'; multiplier = 9n; payElementId = 'pay-fh';
  } else if (isFlush) {
    rankName = '🎨 フラッシュ！'; multiplier = 6n; payElementId = 'pay-fl';
  } else if (isStraight) {
    rankName = '📏 ストレート！'; multiplier = 4n; payElementId = 'pay-st';
  } else if (countValues[0] === 3) {
    rankName = '☘️ スリーカード！'; multiplier = 3n; payElementId = 'pay-3k';
  } else if (countValues[0] === 2 && countValues[1] === 2) {
    rankName = '✌️ ツーペア！'; multiplier = 2n; payElementId = 'pay-2p';
  } else if (countValues[0] === 2) {
    const pairRank = Number(Object.keys(counts).find(k => counts[k] === 2));
    if (pairRank >= 11) {
      rankName = '🃏 ジャックス・オア・ベター！'; multiplier = 1n; payElementId = 'pay-job';
    }
  }

  const msgEl = document.getElementById('poker-message');

  if (multiplier > 0n) {
    const payout = currentBet * multiplier;
    const profit = payout > currentBet ? payout - currentBet : 0n;

    playerData.cash = safeToBigInt(playerData.cash) + payout;

    const currentHigh = safeToBigInt(playerData.highScores?.poker);
    if (profit > currentHigh) {
      if (!playerData.highScores) playerData.highScores = {};
      playerData.highScores.poker = profit;
    }

    if (payElementId) {
      document.getElementById(payElementId).classList.add('active-pay');
    }

    const formattedPayout = (typeof window.formatCurrency === 'function') ? window.formatCurrency(payout) : '$' + payout.toLocaleString();
    msgEl.textContent = `${rankName} 配当 ${formattedPayout} を獲得！ (${multiplier}倍)`;
    triggerWinEffects();

  } else {
    msgEl.textContent = '残念！役なしでした。';
    document.querySelectorAll('.poker-card-wrapper').forEach(w => w.classList.add('lose-state'));
  }

  if (typeof applyDebtInterest === 'function') {
    applyDebtInterest();
  } else {
    saveData();
  }
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

function prepareNextGame() {
  gameState = 'BETTING';
  hand = [null, null, null, null, null];
  heldStates = [false, false, false, false, false];

  document.getElementById('open-atm-btn').disabled = false;
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
