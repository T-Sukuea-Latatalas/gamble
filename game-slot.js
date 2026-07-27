/**
 * ==========================================
 * Fever Casino - リアルリールスロット 3x3 制御スクリプト (game-slot.js)
 * BigInt & 超巨大数値完全対応版
 * ==========================================
 */

const REEL_STRIPS = [
  ['🍒', '🍋', '🔔', '🫚', '🗜️', '🍒', '🍋', '🔞', '🔔', '🚮', '🍒', '🍋', '🎎', '🫚'],
  ['🍋', '🍒', '🫚', '🎎', '🔔', '🍋', '🍒', '🔞', '🚮', '🔔', '🫚', '🍒', '🗜️', '🍋'],
  ['🔔', '🫚', '🍒', '🍋', '🎎', '🔞', '🍒', '🚮', '🗜️', '🔔', '🫚', '🍋', '🍒', '🔔']
];

const SYMBOL_PAYOUTS = {
  '🍒': 2n,
  '🍋': 3n,
  '🔔': 5n,
  '🫚': 10n,
  '🔞': 25n,
  '🎎': 50n,
  '🗜️': 777n,
  '🚮': 0n
};

const PAYLINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 4, 8],
  [2, 4, 6]
];

let isSpinning = false;
let feverSpinsLeft = 0;
let currentIndices = [0, 0, 0];

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

function initReels() {
  for (let i = 0; i < 3; i++) {
    const strip = document.getElementById(`strip-${i}`);
    if (!strip) continue;

    strip.innerHTML = '';
    const arr = REEL_STRIPS[i];

    for (let j = 0; j < 3; j++) {
      const cell = document.createElement('div');
      cell.className = 'symbol-cell';
      cell.id = `cell-${i * 3 + j}`;
      cell.textContent = arr[j];
      strip.appendChild(cell);
    }
  }
}

async function startSpin() {
  if (isSpinning) return;

  const betBtn = document.getElementById('bet-select-btn');
  const betVal = safeToBigInt(betBtn ? betBtn.getAttribute('data-amount') : '0');

  const isFeverNow = feverSpinsLeft > 0;

  if (!isFeverNow) {
    if (betVal <= 0n) {
      alert('1以上の賭け金を選択してください。');
      return;
    }
    if (betVal > safeToBigInt(playerData.cash)) {
      alert('所持金が足りません！');
      return;
    }
    playerData.cash = safeToBigInt(playerData.cash) - betVal;
    saveData();
  } else {
    feverSpinsLeft--;
  }

  isSpinning = true;
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('open-atm-btn').disabled = true; 
  document.getElementById('slot-message').textContent = isFeverNow ? '🔥 FEVER SPIN...!' : '🎰 スピン中...!';

  document.querySelectorAll('.symbol-cell').forEach(c => c.classList.remove('win-line'));

  let targetIndices = [];

  if (isFeverNow && Math.random() < 0.45) {
    targetIndices = getForcedWinIndices();
  } else {
    for (let i = 0; i < 3; i++) {
      targetIndices.push(Math.floor(Math.random() * REEL_STRIPS[i].length));
    }
  }

  const stopDelays = [1000, 1500, 2000];
  const gridResults = new Array(9);

  for (let col = 0; col < 3; col++) {
    spinSingleReel(col, targetIndices[col], stopDelays[col], gridResults);
  }

  await delay(2200);

  checkResults(gridResults, betVal, isFeverNow);

  isSpinning = false;
  document.getElementById('spin-btn').disabled = false;
  document.getElementById('open-atm-btn').disabled = false;
}

function getForcedWinIndices() {
  const weights = [
    { sym: '🍒', weight: 40 },
    { sym: '🍋', weight: 25 },
    { sym: '🔔', weight: 15 },
    { sym: '🫚', weight: 10 },
    { sym: '🔞', weight: 7 },
    { sym: '🎎', weight: 3 },
  ];
  
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  let random = Math.random() * totalWeight;
  let selectedSymbol = '🍒';
  for (const w of weights) {
    if (random < w.weight) {
      selectedSymbol = w.sym;
      break;
    }
    random -= w.weight;
  }

  const results = [];
  for (let i = 0; i < 3; i++) {
    const strip = REEL_STRIPS[i];
    const possibleIndices = [];
    for (let j = 0; j < strip.length; j++) {
      if (strip[j] === selectedSymbol) {
        possibleIndices.push((j - 1 + strip.length) % strip.length);
      }
    }
    const chosen = possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
    results.push(chosen !== undefined ? chosen : Math.floor(Math.random() * strip.length));
  }
  return results;
}

function spinSingleReel(colIndex, targetIndex, stopDelay, gridResults) {
  const strip = document.getElementById(`strip-${colIndex}`);
  const arr = REEL_STRIPS[colIndex];
  const len = arr.length;

  const extraRounds = 3;
  const totalSteps = extraRounds * len + ((targetIndex - currentIndices[colIndex] + len) % len);

  strip.style.transition = 'none';
  strip.style.transform = 'translateY(0px)';
  strip.innerHTML = '';

  const buildSymbols = [];
  let curr = currentIndices[colIndex];

  for (let s = 0; s <= totalSteps + 2; s++) {
    buildSymbols.push(arr[(curr + s) % len]);
  }

  buildSymbols.forEach((sym) => {
    const cell = document.createElement('div');
    cell.className = 'symbol-cell';
    cell.textContent = sym;
    strip.appendChild(cell);
  });

  setTimeout(() => {
    const moveDistance = totalSteps * 80;
    strip.style.transition = `transform ${stopDelay / 1000}s cubic-bezier(0.1, 0.9, 0.2, 1)`;
    strip.style.transform = `translateY(-${moveDistance}px)`;
  }, 20);

  setTimeout(() => {
    currentIndices[colIndex] = targetIndex;

    const topSym = arr[targetIndex];
    const midSym = arr[(targetIndex + 1) % len];
    const botSym = arr[(targetIndex + 2) % len];

    gridResults[colIndex] = topSym;
    gridResults[colIndex + 3] = midSym;
    gridResults[colIndex + 6] = botSym;

    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0px)';
    strip.innerHTML = `
      <div id="cell-${colIndex}" class="symbol-cell">${topSym}</div>
      <div id="cell-${colIndex + 3}" class="symbol-cell">${midSym}</div>
      <div id="cell-${colIndex + 6}" class="symbol-cell">${botSym}</div>
    `;
  }, stopDelay + 50);
}

function checkResults(gridResults, betVal, isFeverNow) {
  let totalPayout = 0n;
  let winningLinesCount = 0;
  let triggeredFever = false;

  const multiplier = isFeverNow ? 2n : 1n;
  const effBet = isFeverNow ? (betVal || 100n) : betVal;

  PAYLINES.forEach(line => {
    const [a, b, c] = line;
    if (
      gridResults[a] &&
      gridResults[a] === gridResults[b] &&
      gridResults[b] === gridResults[c]
    ) {
      const symChar = gridResults[a];
      const payoutMult = SYMBOL_PAYOUTS[symChar] || 2n;
      const linePayout = effBet * payoutMult * multiplier;
      
      totalPayout += linePayout;
      winningLinesCount++;

      document.getElementById(`cell-${a}`).classList.add('win-line');
      document.getElementById(`cell-${b}`).classList.add('win-line');
      document.getElementById(`cell-${c}`).classList.add('win-line');

      if (symChar === '🗜️') {
        triggeredFever = true;
      }
    }
  });

  if (triggeredFever) {
    feverSpinsLeft = 10;
    showFeverUI(true);
  }

  if (totalPayout > 0n) {
    playerData.cash = safeToBigInt(playerData.cash) + totalPayout;
    const currentHigh = safeToBigInt(playerData.highScores?.slots);
    if (totalPayout > currentHigh) {
      if (!playerData.highScores) playerData.highScores = {};
      playerData.highScores.slots = totalPayout;
    }
    triggerWinEffects();
  }

  if (typeof applyDebtInterest === 'function') {
    applyDebtInterest();
  } else {
    saveData();
  }

  updateFeverUI();

  const msgEl = document.getElementById('slot-message');
  const formattedPayout = (typeof window.formatCurrency === 'function') ? window.formatCurrency(totalPayout) : '$' + totalPayout.toLocaleString();

  if (triggeredFever) {
    msgEl.textContent = `🔥 確変モード突入/継続！ 777揃いでフリースピン獲得！`;
  } else if (winningLinesCount > 0) {
    msgEl.textContent = `🎉 【${winningLinesCount}ライン当選】 ${formattedPayout} 獲得！ ${isFeverNow ? '(確変2倍!)' : ''}`;
  } else {
    msgEl.textContent = isFeverNow ? '確変中... 次に期待！' : 'ハズレ！もう一度挑戦しよう！';
  }
}

function showFeverUI(active) {
  const banner = document.getElementById('fever-banner');
  const container = document.getElementById('slot-container');
  if (!banner || !container) return;

  if (active) {
    banner.classList.remove('hidden');
    container.classList.add('fever-mode');
  } else {
    banner.classList.add('hidden');
    container.classList.remove('fever-mode');
  }
}

function updateFeverUI() {
  const countEl = document.getElementById('fever-count');
  if (countEl) countEl.textContent = feverSpinsLeft;

  if (feverSpinsLeft <= 0) {
    showFeverUI(false);
  }
}

function triggerWinEffects() {
  const container = document.getElementById('particle-container');
  if (!container) return;
  container.innerHTML = '';
  const items = ['🪙', '✨', '💎', '🎰', '👍'];

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

document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadData === 'function') loadData();
  updateCashDisplay();
  initReels();
  updateFeverUI();

  const spinBtn = document.getElementById('spin-btn');
  if (spinBtn) spinBtn.addEventListener('click', startSpin);
});
