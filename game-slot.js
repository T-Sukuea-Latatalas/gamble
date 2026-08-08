/**
 * ==========================================
 * Fever Casino - リアルリールスロット 3x3 制御スクリプト (game-slot.js)
 * BigInt & 重み付き抽選アシスト・確変バランス調整・完全チラつきゼロ滑らか目押し対応版
 * ==========================================
 */

const REEL_STRIPS = [
  ['🍒', '🍋', '🔔', '🫚', '🗜️', '🍒', '🍋', '🔞', '🔔', '🚮', '🍒', '🍋', '🎎', '🫚'],
  ['🍋', '🍒', '🫚', '🎎', '🔔', '🍋', '🍒', '🔞', '🚮', '🔔', '🫚', '🍒', '🗜️', '🍋'],
  ['🔔', '🫚', '🍒', '🍋', '🎎', '🔞', '🍒', '🚮', '🗜️', '🔔', '🫚', '🍋', '🍒', '🔔']
];

const ONE_ROUND_CELLS = 14;
const ONE_ROUND_HEIGHT = ONE_ROUND_CELLS * 80; // 1120px

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
  [0, 1, 2], // 上段横
  [3, 4, 5], // 中段横
  [6, 7, 8], // 下段横
  [0, 4, 8], // 斜め右下がり
  [2, 4, 6]  // 斜め右上がり
];

let isSpinning = false;
let feverSpinsLeft = 0;

// 各リールの回転・停止ステータス管理: 'stopped' | 'spinning' | 'stopping'
let reelStates = ['stopped', 'stopped', 'stopped'];
let targetIndices = [0, 0, 0];
let stopTopCellIndices = [0, 0, 0]; // 停止時のトップ（最上段）セルインデックス
let stopCurrentY = [0, 0, 0];        // 停止時の最終Yトランスフォーム位置

let currentGridResults = new Array(9);
let currentBetVal = 0n;
let isFeverAtSpinStart = false;

function safeToBigInt(v) {
  if (typeof window.toBigInt === 'function') return window.toBigInt(v);
  try { return BigInt(v || 0); } catch (e) { return 0n; }
}

function updateCashDisplay() {
  if (typeof updateUI === 'function') {
    updateUI();
  }
}

/**
 * リール初期表示構築（チラつき防止のためリール配列を5周分生成）
 */
function initReels() {
  for (let i = 0; i < 3; i++) {
    const strip = document.getElementById(`strip-${i}`);
    if (!strip) continue;

    strip.innerHTML = '';
    const arr = REEL_STRIPS[i];

    // DOM要素の再作成によるチラつきを防ぐため、5周分（70コマ）配置
    for (let loop = 0; loop < 5; loop++) {
      for (let j = 0; j < ONE_ROUND_CELLS; j++) {
        const cell = document.createElement('div');
        cell.className = 'symbol-cell';
        cell.textContent = arr[j];
        strip.appendChild(cell);
      }
    }

    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0px)';
    stopCurrentY[i] = 0;
    stopTopCellIndices[i] = 0;
  }
}

/**
 * 重み付き確率による当選絵柄決定
 */
function chooseWeightedSymbol(isFever) {
  const weights = isFever ? [
    { sym: '🍒', weight: 30 },
    { sym: '🍋', weight: 25 },
    { sym: '🔔', weight: 20 },
    { sym: '🫚', weight: 12 },
    { sym: '🔞', weight: 7 },
    { sym: '🎎', weight: 4.5 },
    { sym: '🗜️', weight: 1.5 }
  ] : [
    { sym: '🍒', weight: 42 },
    { sym: '🍋', weight: 26 },
    { sym: '🔔', weight: 16 },
    { sym: '🫚', weight: 9 },
    { sym: '🔞', weight: 4 },
    { sym: '🎎', weight: 2.2 },
    { sym: '🗜️', weight: 0.8 }
  ];

  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of weights) {
    if (random < item.weight) {
      return item.sym;
    }
    random -= item.weight;
  }
  return '🍒';
}

/**
 * 指定した絵柄がラインに揃うリール停止インデックスを計算
 */
function getWinningIndicesForSymbol(sym) {
  const results = [];
  for (let col = 0; col < 3; col++) {
    const stripArr = REEL_STRIPS[col];
    const matchTargetIndices = [];

    for (let j = 0; j < ONE_ROUND_CELLS; j++) {
      // 中央コマ (j+1) % ONE_ROUND_CELLS が sym になる targetIndex (j)
      if (stripArr[(j + 1) % ONE_ROUND_CELLS] === sym) {
        matchTargetIndices.push(j);
      }
    }

    if (matchTargetIndices.length > 0) {
      const chosen = matchTargetIndices[Math.floor(Math.random() * matchTargetIndices.length)];
      results.push(chosen);
    } else {
      results.push(Math.floor(Math.random() * ONE_ROUND_CELLS));
    }
  }
  return results;
}

/**
 * 完全ハズレとなるリール停止インデックスを計算
 */
function getForcedLoseIndices() {
  let indices = [];
  let attempts = 0;
  while (attempts < 50) {
    indices = [
      Math.floor(Math.random() * ONE_ROUND_CELLS),
      Math.floor(Math.random() * ONE_ROUND_CELLS),
      Math.floor(Math.random() * ONE_ROUND_CELLS)
    ];

    let isWin = false;
    const grid = new Array(9);
    for (let col = 0; col < 3; col++) {
      const idx = indices[col];
      const stripArr = REEL_STRIPS[col];
      grid[col] = stripArr[idx];
      grid[col + 3] = stripArr[(idx + 1) % ONE_ROUND_CELLS];
      grid[col + 6] = stripArr[(idx + 2) % ONE_ROUND_CELLS];
    }

    for (const line of PAYLINES) {
      const [a, b, c] = line;
      if (grid[a] && grid[a] === grid[b] && grid[b] === grid[c]) {
        isWin = true;
        break;
      }
    }

    if (!isWin) return indices;
    attempts++;
  }
  return indices;
}

/**
 * レバーオン (スピン開始)
 */
async function startSpin() {
  if (isSpinning) return;

  const betBtn = document.getElementById('bet-select-btn');
  const betVal = safeToBigInt(betBtn ? betBtn.getAttribute('data-amount') : '0');

  isFeverAtSpinStart = feverSpinsLeft > 0;

  if (!isFeverAtSpinStart) {
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

  currentBetVal = betVal;
  isSpinning = true;

  // UI制御
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('open-atm-btn').disabled = true;
  document.getElementById('slot-message').textContent = isFeverAtSpinStart ? '🔥 FEVER SPIN! 各ボタンで目押しせよ！' : '🎰 各STOPボタンで目押し停止！';

  // 過去の発光演出全削除
  document.querySelectorAll('.symbol-cell.win-line').forEach(c => c.classList.remove('win-line'));

  // 内部当選判定（アシストまたはデバッグ）
  if (window.debugFlags?.forceWin) {
    targetIndices = getWinningIndicesForSymbol('🗜️');
  } else if (window.debugFlags?.forceLose) {
    targetIndices = getForcedLoseIndices();
  } else {
    const winAssistChance = isFeverAtSpinStart ? 0.60 : 0.33;
    if (Math.random() < winAssistChance) {
      const selectedSym = chooseWeightedSymbol(isFeverAtSpinStart);
      targetIndices = getWinningIndicesForSymbol(selectedSym);
    } else {
      targetIndices = getForcedLoseIndices();
    }
  }

  currentGridResults = new Array(9);

  // 3つのリールの回転を開始
  for (let col = 0; col < 3; col++) {
    reelStates[col] = 'spinning';
    startSingleReelAnimation(col);
    const stopBtn = document.getElementById(`stop-btn-${col}`);
    if (stopBtn) stopBtn.disabled = false;
  }
}

/**
 * リールのシームレス高速回転を開始
 */
function startSingleReelAnimation(colIndex) {
  const strip = document.getElementById(`strip-${colIndex}`);
  if (!strip) return;

  // 前回の停止位置が深すぎる（3周目以降）場合は同配色の1周目にシームレス移動
  let startY = stopCurrentY[colIndex] % ONE_ROUND_HEIGHT;
  strip.style.transition = 'none';
  strip.style.transform = `translateY(-${startY}px)`;
  
  // 無限ループアニメーションを付与
  strip.classList.add('is-spinning');
}

/**
 * チラつきを100%防止する目押し停止処理
 */
function stopSingleReel(colIndex) {
  if (reelStates[colIndex] !== 'spinning') return;

  reelStates[colIndex] = 'stopping';
  const stopBtn = document.getElementById(`stop-btn-${colIndex}`);
  if (stopBtn) stopBtn.disabled = true;

  const strip = document.getElementById(`strip-${colIndex}`);
  const arr = REEL_STRIPS[colIndex];
  const targetIndex = targetIndices[colIndex];

  // ① 現在のアニメーション計算座標（Y位置）を正確にキャプチャ
  const style = window.getComputedStyle(strip);
  const matrix = new WebKitCSSMatrix(style.transform);
  let currentY = Math.abs(matrix.m42) || 0;

  // ② is-spinning を解除し、一瞬のチラつきを防ぐため現在地で座標固定＆リフロー強制
  strip.classList.remove('is-spinning');
  strip.style.transform = `translateY(-${currentY}px)`;
  void strip.offsetHeight; // 強制リフロー (ブラウザに一瞬の飛躍をさせない)

  // ③ パチスロ風の滑らかな減速引き込み（現在地より前方の目標コマを算出）
  let currentRound = Math.floor(currentY / ONE_ROUND_HEIGHT);
  let targetYInRound = targetIndex * 80;
  
  // 最低1周〜2周分の自然な減速（滑りコマ）を保証
  let finalY = (currentRound + 1) * ONE_ROUND_HEIGHT + targetYInRound;
  if (finalY - currentY < 240) { // 滑り距離が短すぎる場合は次の周へ
    finalY += ONE_ROUND_HEIGHT;
  }

  // ④ CSS Transitionによるピタッと止まる減速アニメーションの開始
  strip.style.transition = 'transform 0.42s cubic-bezier(0.08, 0.85, 0.18, 1)';
  strip.style.transform = `translateY(-${finalY}px)`;

  // ⑤ 減速停止完了時の処理（DOM要素のリセット・再生成は一切行わず位置維持）
  setTimeout(() => {
    stopCurrentY[colIndex] = finalY;
    const topCellIndex = Math.round(finalY / 80);
    stopTopCellIndices[colIndex] = topCellIndex;

    reelStates[colIndex] = 'stopped';

    // 確定コマのシンボル取得
    const topSym = arr[topCellIndex % ONE_ROUND_CELLS];
    const midSym = arr[(topCellIndex + 1) % ONE_ROUND_CELLS];
    const botSym = arr[(topCellIndex + 2) % ONE_ROUND_CELLS];

    currentGridResults[colIndex] = topSym;
    currentGridResults[colIndex + 3] = midSym;
    currentGridResults[colIndex + 6] = botSym;

    // 3リール全ての停止チェック
    checkAllReelsStopped();
  }, 440);
}

/**
 * 3リール全停止確認と配当チェックの実行
 */
function checkAllReelsStopped() {
  if (reelStates.every(state => state === 'stopped')) {
    checkResults(currentGridResults, currentBetVal, isFeverAtSpinStart);

    isSpinning = false;
    document.getElementById('spin-btn').disabled = false;
    document.getElementById('open-atm-btn').disabled = false;
  }
}

/**
 * 配当判定および確変・演出処理
 */
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

      // 当たり成立マスの直接発光演出（DOM要素に直接クラスを付与）
      highlightWinCell(a);
      highlightWinCell(b);
      highlightWinCell(c);

      if (symChar === '🎎' || symChar === '🗜️') {
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
    msgEl.textContent = `🔥 確変モード突入/継続！ フリースピン10回獲得！`;
  } else if (winningLinesCount > 0) {
    msgEl.textContent = `🎉 【${winningLinesCount}ライン当選】 ${formattedPayout} 獲得！ ${isFeverNow ? '(確変2倍!)' : ''}`;
  } else {
    msgEl.textContent = isFeverNow ? '確変中... 次に期待！' : 'ハズレ！もう一度挑戦しよう！';
  }
}

/**
 * 停止中リール要素内の該当コマを直接発光させる
 */
function highlightWinCell(gridIndex) {
  const col = gridIndex % 3;
  const row = Math.floor(gridIndex / 3);
  const strip = document.getElementById(`strip-${col}`);
  if (!strip) return;

  const targetCellIndex = stopTopCellIndices[col] + row;
  const cellEl = strip.children[targetCellIndex];
  if (cellEl) {
    cellEl.classList.add('win-line');
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

/**
 * キーボード操作（Z/X/C または 1/2/3 キー）での個別目押し停止対応
 */
function handleKeyDown(e) {
  if (e.repeat) return;

  // モーダルや入力エリアが開いている場合はスキップ
  if (document.activeElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName) && document.activeElement.id !== 'spin-btn') {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  }

  const key = e.key.toLowerCase();

  // SPIN操作 (Space / Enter)
  if ((key === ' ' || key === 'enter') && !isSpinning) {
    e.preventDefault();
    startSpin();
    return;
  }

  // 個別ストップ操作 (1,2,3 / Z,X,C)
  if (key === '1' || key === 'z') {
    e.preventDefault();
    stopSingleReel(0);
  } else if (key === '2' || key === 'x') {
    e.preventDefault();
    stopSingleReel(1);
  } else if (key === '3' || key === 'c') {
    e.preventDefault();
    stopSingleReel(2);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadData === 'function') loadData();
  updateCashDisplay();
  initReels();
  updateFeverUI();

  const spinBtn = document.getElementById('spin-btn');
  if (spinBtn) spinBtn.addEventListener('click', startSpin);

  for (let i = 0; i < 3; i++) {
    const stopBtn = document.getElementById(`stop-btn-${i}`);
    if (stopBtn) {
      stopBtn.addEventListener('click', () => stopSingleReel(i));
    }
  }

  // キーボードイベント登録
  window.addEventListener('keydown', handleKeyDown);
});