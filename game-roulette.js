/**
 * ==========================================
 * Fever Casino - ルーレットPRO制御スクリプト (game-roulette.js)
 * ==========================================
 */

// 欧州ルーレットの盤面配列 (0〜36の配置順)
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// 複数ベット記憶オブジェクト
let placedBets = {};

let isSpinning = false;
let wheelRotation = 0; // ホイール角度
let ballRotation = 0;  // ボール角度

/**
 * ★ 画面の所持金・借金表示を完全同期 (lobby.js の共通 updateUI を安全呼び出し) ★
 */
function updateCashDisplay() {
  if (typeof updateUI === 'function') {
    updateUI();
  }
}

/**
 * 1. ホイールグラフィック描画
 */
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

    // 数字ラベルの配置
    const label = document.createElement('div');
    label.className = 'wheel-num-label';
    label.textContent = num;
    
    const midDeg = index * step + step / 2;
    label.style.transform = `rotate(${midDeg}deg) translateY(-102px) rotate(-${midDeg}deg)`;
    wheel.appendChild(label);
  });

  wheel.style.background = `conic-gradient(${gradientStops.join(', ')})`;
}

/**
 * 2. ベットテーブル初期化 ＆ テンキー連動
 */
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

  // テンキー連携設定
  document.querySelectorAll('.bet-spot').forEach(spot => {
    spot.classList.add('amount-select-btn');

    spot.addEventListener('click', () => {
      if (isSpinning) return;
      const key = spot.getAttribute('data-key');
      const currentAmt = placedBets[key] || 0;

      spot.setAttribute('data-amount', currentAmt.toString());
      spot.setAttribute('data-label', spot.getAttribute('data-label') + ": ");
    });

    spot.addEventListener('change', () => {
      const key = spot.getAttribute('data-key');
      const newAmt = parseInt(spot.getAttribute('data-amount'), 10) || 0;

      if (newAmt > 0) {
        placedBets[key] = newAmt;
      } else {
        delete placedBets[key];
      }

      updateChipBadges();
    });
  });
}

/**
 * チップバッジと総賭け金の描画更新
 */
function updateChipBadges() {
  let total = 0;

  document.querySelectorAll('.bet-spot').forEach(spot => {
    const key = spot.getAttribute('data-key');
    const badge = spot.querySelector('.chip-badge');
    const amt = placedBets[key] || 0;

    if (amt > 0) {
      badge.textContent = '$' + (amt >= 1000 ? (amt/1000) + 'k' : amt);
      badge.classList.remove('hidden');
      total += amt;
    } else {
      if (badge) badge.classList.add('hidden');
    }
  });

  const totalEl = document.getElementById('total-bet-amount');
  if (totalEl) {
    totalEl.textContent = '$' + total.toLocaleString();
  }
}

/**
 * 「チップをすべてクリア」のリセット関数
 */
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

/**
 * 3. スピン処理 (ボールの真ん中ぴったり停止計算)
 */
function startSpin() {
  if (isSpinning) return;

  const totalBet = Object.values(placedBets).reduce((a, b) => a + b, 0);

  if (totalBet <= 0) {
    alert('少なくとも1箇所にチップ（賭け金）を配置してください。');
    return;
  }

  if (totalBet > playerData.cash) {
    alert('所持金が足りません！');
    return;
  }

  // 賭け金引き落とし
  playerData.cash -= totalBet;
  saveData();

  isSpinning = true;
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('open-atm-btn').disabled = true; // ATMボタン無効化
  document.getElementById('result-display').textContent = '🎡 ルーレット回転中...';
  hideOverlays();

  // 当選数字のランダム決定
  const winningIndex = Math.floor(Math.random() * WHEEL_NUMBERS.length);
  const winningNumber = WHEEL_NUMBERS[winningIndex];

  // ボール停止位置の精度補正計算
  const step = 360 / WHEEL_NUMBERS.length;

  wheelRotation += 1800; // 時計回りに5周

  const sectorCenterDeg = winningIndex * step + (step / 2);
  const targetSectorWorldDeg = (wheelRotation + sectorCenterDeg) % 360;

  const targetBallBase = ballRotation - 2160;
  const currentWorldBallDeg = ((targetBallBase % 360) + 360) % 360;
  const diffDeg = (currentWorldBallDeg - targetSectorWorldDeg + 360) % 360;

  ballRotation = targetBallBase - diffDeg;

  const wheelEl = document.getElementById('roulette-wheel');
  const ballTrackEl = document.getElementById('ball-track');
  const ballEl = document.getElementById('roulette-ball');

  // アニメーション実行
  ballEl.classList.remove('in-pocket');
  wheelEl.style.transform = `rotate(${wheelRotation}deg)`;
  ballTrackEl.style.transform = `rotate(${ballRotation}deg)`;

  // ボールをポケットへ落とす
  setTimeout(() => {
    ballEl.classList.add('in-pocket');
  }, 3800);

  // 回転終了 ＆ 勝敗判定
  setTimeout(() => {
    evaluateResults(winningNumber, totalBet);
    isSpinning = false;
    document.getElementById('spin-btn').disabled = false;
    document.getElementById('open-atm-btn').disabled = false; // ATM再有効化
  }, 5000);
}

/**
 * 4. 勝敗判定 ＆ 配当計算
 */
function evaluateResults(winningNumber, totalBet) {
  const isRed = RED_NUMBERS.includes(winningNumber);
  const isZero = winningNumber === 0;
  const colorText = isZero ? '緑' : (isRed ? '赤' : '黒');

  let totalPayout = 0;

  Object.keys(placedBets).forEach(key => {
    const amt = placedBets[key];

    if (key === 'color_red' && isRed) totalPayout += amt * 2;
    if (key === 'color_black' && !isRed && !isZero) totalPayout += amt * 2;
    if (key === 'parity_odd' && !isZero && winningNumber % 2 !== 0) totalPayout += amt * 2;
    if (key === 'parity_even' && !isZero && winningNumber % 2 === 0) totalPayout += amt * 2;
    if (key === `number_${winningNumber}`) totalPayout += amt * 36;
  });

  const resultEl = document.getElementById('result-display');

  if (totalPayout > 0) {
    playerData.cash += totalPayout;

    const profit = totalPayout - totalBet;
    if (profit > (playerData.highScores.roulette || 0)) {
      playerData.highScores.roulette = profit;
    }

    resultEl.textContent = `🎉 当選！【 ${winningNumber} (${colorText}) 】 総配当 $${totalPayout.toLocaleString()} を獲得！`;
    showWinEffect();
  } else {
    resultEl.textContent = `当選【 ${winningNumber} (${colorText}) 】 - 不的中でした。`;
    showLoseEffect();
  }

  // ★ 借金利子の適用 ★
  if (typeof applyDebtInterest === 'function') {
    applyDebtInterest();
  }

  saveData();
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

/**
 * 初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadData === 'function') loadData();
  updateCashDisplay();

  initWheelGraphic();
  initBetTable();

  document.getElementById('spin-btn').addEventListener('click', startSpin);
  document.getElementById('clear-bets-btn').addEventListener('click', clearAllBets);
});
