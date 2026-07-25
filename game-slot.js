/**
 * ==========================================
 * Fever Casino - リアルリールスロット 3x3 制御スクリプト (game-slot.js)
 * ==========================================
 */

/**
 * ★ 完全固定の3つのリール絵柄配列 (リール帯) ★
 */
const REEL_STRIPS = [
  // リール1 (左)
  ['🍒', '🍋', '🔔', '💎', '🍒', '🍋', '7️⃣', '🔔', '🍒', '🍋', '🎰', '💎'],
  // リール2 (中)
  ['🍋', '🍒', '💎', '🎰', '🔔', '🍋', '🍒', '7️⃣', '🔔', '💎', '🍒', '🍋'],
  // リール3 (右)
  ['🔔', '💎', '🍒', '🍋', '🎰', '7️⃣', '🍒', '🔔', '💎', '🍋', '🍒', '🔔']
];

// 各絵柄の配当倍率
const SYMBOL_PAYOUTS = {
  '🍒': 2,
  '🍋': 3,
  '🔔': 5,
  '💎': 10,
  '7️⃣': 25,
  '🎰': 50
};

// 5つのペイライン定義 (3x3の9マス: 0〜8)
const PAYLINES = [
  [0, 1, 2], // 横上段
  [3, 4, 5], // 横中段
  [6, 7, 8], // 横下段
  [0, 4, 8], // 斜め(左上 ➔ 右下)
  [2, 4, 6]  // 斜め(右上 ➔ 左下)
];

let isSpinning = false;
let feverSpinsLeft = 0; // 残り確変回数

// 現在の各リールの停止インデックス位置 (初期値: 0)
let currentIndices = [0, 0, 0];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 所持金 ＆ 借金表示の同期
 */
function updateCashDisplay() {
  const cashEl = document.getElementById('cash-display');
  const debtEl = document.getElementById('debt-display');

  if (window.playerData) {
    if (cashEl) cashEl.textContent = '$' + (playerData.cash || 0).toLocaleString();
    if (debtEl) debtEl.textContent = '$' + (playerData.debt || 0).toLocaleString();
  }
}

/**
 * 初期状態のリール帯DOM描画
 */
function initReels() {
  for (let i = 0; i < 3; i++) {
    const strip = document.getElementById(`strip-${i}`);
    if (!strip) continue;

    strip.innerHTML = '';
    const arr = REEL_STRIPS[i];

    // 初期表示用に3コマ分生成
    for (let j = 0; j < 3; j++) {
      const cell = document.createElement('div');
      cell.className = 'symbol-cell';
      cell.id = `cell-${i * 3 + j}`;
      cell.textContent = arr[j];
      strip.appendChild(cell);
    }
  }
}

/**
 * ★ スピン処理 (縦方向へのスムーズスクロール回転) ★
 */
async function startSpin() {
  if (isSpinning) return;

  const betBtn = document.getElementById('bet-select-btn');
  const betVal = parseInt(betBtn.getAttribute('data-amount'), 10) || 0;

  if (feverSpinsLeft === 0) {
    if (betVal <= 0) {
      alert('1以上の賭け金を選択してください。');
      return;
    }
    if (betVal > playerData.cash) {
      alert('所持金が足りません！');
      return;
    }
    playerData.cash -= betVal;
    saveData();
  } else {
    // 確変中: 賭け金 $0
    feverSpinsLeft--;
  }

  isSpinning = true;
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('open-atm-btn').disabled = true; // ATM無効化
  document.getElementById('slot-message').textContent = feverSpinsLeft > 0 ? '🔥 FEVER SPIN...!' : '🎰 スピン中...!';

  // 前回の発光をリセット
  document.querySelectorAll('.symbol-cell').forEach(c => c.classList.remove('win-line'));

  // 1. 各リールの次のストップ位置（インデックス）をランダム決定
  const targetIndices = [];
  for (let i = 0; i < 3; i++) {
    targetIndices.push(Math.floor(Math.random() * REEL_STRIPS[i].length));
  }

  // 2. スクロール用の拡張リール帯DOMを動的ビルド
  const stopDelays = [1000, 1500, 2000]; // 左・中・右の停止タイムラグ
  const gridResults = new Array(9);      // 最終停止時の9マス結果

  for (let col = 0; col < 3; col++) {
    spinSingleReel(col, targetIndices[col], stopDelays[col], gridResults);
  }

  // 全リール停止後の判定（2秒＋アルファ）
  await delay(2200);

  // 当たり判定へ
  checkResults(gridResults, betVal);

  isSpinning = false;
  document.getElementById('spin-btn').disabled = false;
  document.getElementById('open-atm-btn').disabled = false; // ATM再有効化
}

/**
 * 1つのリール列を縦スクロール回転させる関数
 */
function spinSingleReel(colIndex, targetIndex, stopDelay, gridResults) {
  const strip = document.getElementById(`strip-${colIndex}`);
  const arr = REEL_STRIPS[colIndex];
  const len = arr.length;

  // 現在位置から指定目標位置まで何周か（3周分追加）回す長さを計算
  const extraRounds = 3;
  const totalSteps = extraRounds * len + ((targetIndex - currentIndices[colIndex] + len) % len);

  // アニメーション用に長い連続要素を作成
  strip.style.transition = 'none';
  strip.style.transform = 'translateY(0px)';
  strip.innerHTML = '';

  const buildSymbols = [];
  let curr = currentIndices[colIndex];

  for (let s = 0; s <= totalSteps + 2; s++) {
    buildSymbols.push(arr[(curr + s) % len]);
  }

  buildSymbols.forEach((sym, idx) => {
    const cell = document.createElement('div');
    cell.className = 'symbol-cell';
    cell.textContent = sym;
    strip.appendChild(cell);
  });

  // リフレッシュ後にCSSトランスフォームで縦スクロール開始
  setTimeout(() => {
    const moveDistance = totalSteps * 80; // 1コマ80px
    strip.style.transition = `transform ${stopDelay / 1000}s cubic-bezier(0.1, 0.9, 0.2, 1)`;
    strip.style.transform = `translateY(-${moveDistance}px)`;
  }, 20);

  // 停止後の位置確定処理
  setTimeout(() => {
    currentIndices[colIndex] = targetIndex;

    // 確定した縦3コマ（上・中・下）
    const topSym = arr[targetIndex];
    const midSym = arr[(targetIndex + 1) % len];
    const botSym = arr[(targetIndex + 2) % len];

    // 結果配列（0〜8）にセット
    gridResults[colIndex] = topSym;
    gridResults[colIndex + 3] = midSym;
    gridResults[colIndex + 6] = botSym;

    // 表示を元のシンプルな3コマに置き換えて描画位置を固定
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0px)';
    strip.innerHTML = `
      <div id="cell-${colIndex}" class="symbol-cell">${topSym}</div>
      <div id="cell-${colIndex + 3}" class="symbol-cell">${midSym}</div>
      <div id="cell-${colIndex + 6}" class="symbol-cell">${botSym}</div>
    `;
  }, stopDelay + 50);
}

/**
 * 5ライン判定 ＆ 配当処理
 */
function checkResults(gridResults, betVal) {
  let totalPayout = 0;
  let winningLinesCount = 0;
  let triggeredFever = false;

  const isFeverNow = feverSpinsLeft > 0;
  const multiplier = isFeverNow ? 2 : 1;

  PAYLINES.forEach(line => {
    const [a, b, c] = line;
    if (
      gridResults[a] &&
      gridResults[a] === gridResults[b] &&
      gridResults[b] === gridResults[c]
    ) {
      const symChar = gridResults[a];
      const payoutMult = SYMBOL_PAYOUTS[symChar] || 2;
      const linePayout = betVal * payoutMult * multiplier;
      
      totalPayout += linePayout;
      winningLinesCount++;

      // 発光エフェクト
      document.getElementById(`cell-${a}`).classList.add('win-line');
      document.getElementById(`cell-${b}`).classList.add('win-line');
      document.getElementById(`cell-${c}`).classList.add('win-line');

      if (symChar === '🎰') {
        triggeredFever = true;
      }
    }
  });

  // 確変突入（重複なし）
  if (triggeredFever && !isFeverNow) {
    feverSpinsLeft = 10;
    showFeverUI(true);
  }

  // 収支加算 ＆ セーブ
  if (totalPayout > 0) {
    playerData.cash += totalPayout;

    const profit = totalPayout - (isFeverNow ? 0 : betVal);
    if (profit > (playerData.highScores.slots || 0)) {
      playerData.highScores.slots = profit;
    }

    triggerWinEffects();
  }

  // 借金利子適用
  if (typeof applyDebtInterest === 'function') {
    applyDebtInterest();
  }

  saveData();
  updateFeverUI();

  // アナウンス表示
  const msgEl = document.getElementById('slot-message');
  if (triggeredFever && !isFeverNow) {
    msgEl.textContent = `🔥 確変モード突入！ フリースピン10回獲得 (配当2倍)！`;
  } else if (winningLinesCount > 0) {
    msgEl.textContent = `🎉 【${winningLinesCount}ライン当選】 配当 $${totalPayout.toLocaleString()} を獲得！ ${isFeverNow ? '(確変2倍!)' : ''}`;
  } else {
    msgEl.textContent = isFeverNow ? '確変中... 残念！次を回そう！' : 'ハズレ！もう一度挑戦しよう！';
  }
}

function showFeverUI(active) {
  const banner = document.getElementById('fever-banner');
  const container = document.getElementById('slot-container');

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
  container.innerHTML = '';
  const items = ['🪙', '✨', '💎', '🎰', '7️⃣'];

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
 * 初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadData === 'function') loadData();
  updateCashDisplay();
  initReels();

  document.getElementById('spin-btn').addEventListener('click', startSpin);
});