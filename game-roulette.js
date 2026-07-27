/**
 * ==========================================
 * Fever Casino - ルーレットPRO制御スクリプト (game-roulette.js)
 * BigInt & 超巨大数値完全対応版
 * ==========================================
 */

const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

let placedBets = {};

let isSpinning = false;
let wheelRotation = 0;
let ballRotation = 0;

function safeToBigInt(v) {
  if (typeof window.toBigInt === 'function') return window.toBigInt(v);
  try { return BigInt(v || 0); } catch (e) { return 0n; }
}

function updateCashDisplay() {
  if (typeof updateUI === 'function') {
    updateUI();
  }
}

function initWheelGraphic() {
  const wheel = document.getElementById('roulette-wheel');
  if (!wheel) return;

  const total = WHEEL_NUMBERS.length;
  const step = 360 / total;
  let gradientStops = [];

  WHEEL_NUMBERS.forEach((num, index) => {
    let color = '#2ecc71';
    if (num !== 0) {
      color = RED_NUMBERS.includes(num) ? '#e74c3c' : '#2c3e50';
    }
    const startDeg = (index * step).toFixed(2);
    const endDeg = ((index + 1) * step).toFixed(2);
    gradientStops.push(`${color} ${startDeg}deg ${endDeg}deg`);

    const label = document.createElement('div');
    label.className = 'wheel-num-label';
    label.textContent = num;
    
    const midDeg = index * step + step / 2;
    label.style.transform = `rotate(${midDeg}deg) translateY(-102px) rotate(-${midDeg}deg)`;
    wheel.appendChild(label);
  });

  wheel.style.background = `conic-gradient(${gradientStops.join(', ')})`;
}

function initBetTable() {
  const container = document.getElementById('numbers-container');
  if (!container) return;

  for (let i = 1; i <= 36; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isRed = RED_NUMBERS.includes(i);
    btn.className = `bet-spot num-spot ${isRed ? 'red' : 'black'}`;
    btn.textContent = i;
    btn.setAttribute('data-key', `number_${i}`);
    btn.setAttribute('data-label', `数字【${i}】`);

    const badge = document.createElement('span');
    badge.className = 'chip-badge hidden';
    badge.textContent = '$0';
    btn.appendChild(badge);

    container.appendChild(btn);
  }

  document.querySelectorAll('.bet-spot').forEach(spot => {
    spot.classList.add('amount-select-btn');

    spot.addEventListener('click', () => {
      if (isSpinning) return;
      const key = spot.getAttribute('data-key');
      const currentAmt = safeToBigInt(placedBets[key]);

      spot.setAttribute('data-amount', currentAmt.toString());
      spot.setAttribute('data-label', spot.getAttribute('data-label') + ": ");
    });

    spot.addEventListener('change', () => {
      const key = spot.getAttribute('data-key');
      const newAmt = safeToBigInt(spot.getAttribute('data-amount'));

      if (newAmt > 0n) {
        placedBets[key] = newAmt;
      } else {
        delete placedBets[key];
      }

      updateChipBadges();
    });
  });
}

function updateChipBadges() {
  let total = 0n;

  document.querySelectorAll('.bet-spot').forEach(spot => {
    const key = spot.getAttribute('data-key');
    const badge = spot.querySelector('.chip-badge');
    const amt = safeToBigInt(placedBets[key]);

    if (amt > 0n) {
      badge.textContent = (typeof window.formatCurrency === 'function') ? window.formatCurrency(amt) : '$' + amt.toLocaleString();
      badge.classList.remove('hidden');
      total += amt;
    } else {
      if (badge) badge.classList.add('hidden');
    }
  });

  const totalEl = document.getElementById('total-bet-amount');
  if (totalEl) {
    totalEl.textContent = (typeof window.formatCurrency === 'function') ? window.formatCurrency(total) : '$' + total.toLocaleString();
  }
}

function clearAllBets() {
  if (isSpinning) return;

  placedBets = {};

  document.querySelectorAll('.bet-spot').forEach(spot => {
    spot.setAttribute('data-amount', '0');
    const badge = spot.querySelector('.chip-badge');
    if (badge) {
      badge.textContent = '$0';
      badge.classList.add('hidden');
    }
  });

  const totalEl = document.getElementById('total-bet-amount');
  if (totalEl) {
    totalEl.textContent = '$0';
  }
}

function startSpin() {
  if (isSpinning) return;

  const totalBet = Object.values(placedBets).reduce((a, b) => safeToBigInt(a) + safeToBigInt(b), 0n);

  if (totalBet <= 0n) {
    alert('少なくとも1箇所にチップ（賭け金）を配置してください。');
    return;
  }

  if (totalBet > safeToBigInt(playerData.cash)) {
    alert('所持金が足りません！');
    return;
  }

  playerData.cash = safeToBigInt(playerData.cash) - totalBet;
  saveData();

  isSpinning = true;
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('open-atm-btn').disabled = true;
  document.getElementById('result-display').textContent = '🎡 ルーレット回転中...';
  hideOverlays();

  const winningIndex = Math.floor(Math.random() * WHEEL_NUMBERS.length);
  const winningNumber = WHEEL_NUMBERS[winningIndex];

  const step = 360 / WHEEL_NUMBERS.length;

  wheelRotation += 1800;

  const sectorCenterDeg = winningIndex * step + (step / 2);
  const targetSectorWorldDeg = (wheelRotation + sectorCenterDeg) % 360;

  const targetBallBase = ballRotation - 2160;
  const currentWorldBallDeg = ((targetBallBase % 360) + 360) % 360;
  const diffDeg = (currentWorldBallDeg - targetSectorWorldDeg + 360) % 360;

  ballRotation = targetBallBase - diffDeg;

  const wheelEl = document.getElementById('roulette-wheel');
  const ballTrackEl = document.getElementById('ball-track');
  const ballEl = document.getElementById('roulette-ball');

  ballEl.classList.remove('in-pocket');
  wheelEl.style.transform = `rotate(${wheelRotation}deg)`;
  ballTrackEl.style.transform = `rotate(${ballRotation}deg)`;

  setTimeout(() => {
    ballEl.classList.add('in-pocket');
  }, 3800);

  setTimeout(() => {
    evaluateResults(winningNumber, totalBet);
    isSpinning = false;
    document.getElementById('spin-btn').disabled = false;
    document.getElementById('open-atm-btn').disabled = false;
  }, 5000);
}

function evaluateResults(winningNumber, totalBet) {
  const isRed = RED_NUMBERS.includes(winningNumber);
  const isZero = winningNumber === 0;
  const colorText = isZero ? '緑' : (isRed ? '赤' : '黒');

  let totalPayout = 0n;

  Object.keys(placedBets).forEach(key => {
    const amt = safeToBigInt(placedBets[key]);

    if (key === 'color_red' && isRed) totalPayout += amt * 2n;
    if (key === 'color_black' && !isRed && !isZero) totalPayout += amt * 2n;
    if (key === 'parity_odd' && !isZero && winningNumber % 2 !== 0) totalPayout += amt * 2n;
    if (key === 'parity_even' && !isZero && winningNumber % 2 === 0) totalPayout += amt * 2n;
    if (key === `number_${winningNumber}`) totalPayout += amt * 36n;
  });

  const resultEl = document.getElementById('result-display');
  const formattedPayout = (typeof window.formatCurrency === 'function') ? window.formatCurrency(totalPayout) : '$' + totalPayout.toLocaleString();

  if (totalPayout > 0n) {
    playerData.cash = safeToBigInt(playerData.cash) + totalPayout;

    const profit = totalPayout > totalBet ? totalPayout - totalBet : 0n;
    const currentHigh = safeToBigInt(playerData.highScores?.roulette);
    if (profit > currentHigh) {
      if (!playerData.highScores) playerData.highScores = {};
      playerData.highScores.roulette = profit;
    }

    resultEl.textContent = `🎉 当選！【 ${winningNumber} (${colorText}) 】 総配当 ${formattedPayout} を獲得！`;
    showWinEffect();
  } else {
    resultEl.textContent = `当選【 ${winningNumber} (${colorText}) 】 - 不的中でした。`;
    showLoseEffect();
  }

  if (typeof applyDebtInterest === 'function') {
    applyDebtInterest();
  } else {
    saveData();
  }
}

function showWinEffect() {
  document.getElementById('win-overlay').classList.remove('hidden');

  const container = document.getElementById('particle-container');
  if (!container) return;

  container.innerHTML = '';
  const items = ['🪙', '✨', '💎', '🎉'];

  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = items[Math.floor(Math.random() * items.length)];
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDelay = Math.random() * 0.8 + 's';
    container.appendChild(p);

    setTimeout(() => p.remove(), 3000);
  }

  setTimeout(hideOverlays, 2500);
}

function showLoseEffect() {
  document.getElementById('lose-overlay').classList.remove('hidden');
  setTimeout(hideOverlays, 2000);
}

function hideOverlays() {
  document.getElementById('win-overlay').classList.add('hidden');
  document.getElementById('lose-overlay').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadData === 'function') loadData();
  updateCashDisplay();

  initWheelGraphic();
  initBetTable();

  document.getElementById('spin-btn').addEventListener('click', startSpin);
  document.getElementById('clear-bets-btn').addEventListener('click', clearAllBets);
});
