/**
 * ==========================================
 * Fever Casino - CR FEVER PACHINKO 制御スクリプト (game-pachinko.js)
 * BigInt & Canvas 物理グラフィック・確変完全対応版
 * ==========================================
 */

(function () {
  let canvas, ctx;
  let animFrameId = null;

  // ゲーム状態
  let isAutoFiring = false;
  let autoFireInterval = null;
  let isFeverMode = false;
  let holdCount = 0; // 保留玉 (最大4)
  let isSlotSpinning = false;
  let slotQueue = [];

  // 大当り状態
  let isJackpot = false;
  let jackpotTimer = 0;
  let isAttackerOpen = false;
  let totalJackpotPayout = 0n;
  let currentSessionProfit = 0n;

  // 玉・オブジェクト群
  let balls = [];
  let pegs = []; // 釘
  let chacker = { x: 200, y: 380, w: 32, h: 18 }; // チャッカー
  let attacker = { x: 200, y: 470, w: 70, h: 22 }; // アタッカー

  // 液晶用リール数字
  let slotReels = ['7', '7', '7'];
  const SYMBOLS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  function safeToBigInt(v) {
    if (typeof window.toBigInt === 'function') return window.toBigInt(v);
    try { return BigInt(v || 0); } catch (e) { return 0n; }
  }

  function formatMoney(v) {
    const b = safeToBigInt(v);
    return typeof window.formatCurrency === 'function' ? window.formatCurrency(b) : '$' + b.toLocaleString('en-US');
  }

  function updateCashDisplay() {
    if (typeof window.updateUI === 'function') window.updateUI();
  }

  // 1. 盤面初期化・釘配置
  function initBoard() {
    canvas = document.getElementById('pachinko-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    pegs = [];
    const rows = 11;
    const startY = 110;
    const spacingY = 24;

    for (let r = 0; r < rows; r++) {
      const cols = r % 2 === 0 ? 9 : 8;
      const startX = r % 2 === 0 ? 50 : 68;
      const spacingX = 36;

      for (let c = 0; c < cols; c++) {
        const px = startX + c * spacingX;
        const py = startY + r * spacingY;
        // 液晶画面エリア（中央）を避けて釘を生成
        if (py > 160 && py < 320 && px > 110 && px < 290) continue;
        pegs.push({ x: px, y: py, r: 3 });
      }
    }

    if (animFrameId) cancelAnimationFrame(animFrameId);
    gameLoop();
  }

  // 2. 玉の発射処理
  function shootBall() {
    const betBtn = document.getElementById('bet-select-btn');
    const ballCost = safeToBigInt(betBtn ? betBtn.getAttribute('data-amount') : '10');

    if (ballCost <= 0n) {
      alert('1球の価格を1以上に設定してください。');
      stopAutoFire();
      return;
    }

    const currentCash = safeToBigInt(window.playerData?.cash);
    if (currentCash < ballCost) {
      alert('所持金が足りません！');
      stopAutoFire();
      return;
    }

    // 賭け金引き落とし
    window.playerData.cash = currentCash - ballCost;
    if (typeof window.saveData === 'function') window.saveData();
    updateCashDisplay();

    // 物理玉生成 (右下打ち出しルート)
    const power = 13.5 + Math.random() * 1.5;
    balls.push({
      x: 382,
      y: 480,
      vx: -1.2 - Math.random() * 0.8,
      vy: -power,
      r: 5,
      cost: ballCost
    });
  }

  // 3. 自動発射切り替え
  function toggleAutoFire() {
    const autoBtn = document.getElementById('auto-btn');
    if (isAutoFiring) {
      stopAutoFire();
    } else {
      isAutoFiring = true;
      if (autoBtn) {
        autoBtn.classList.add('active');
        autoBtn.textContent = '🔄 自動発射: ON';
      }
      autoFireInterval = setInterval(shootBall, 350);
    }
  }

  function stopAutoFire() {
    isAutoFiring = false;
    if (autoFireInterval) {
      clearInterval(autoFireInterval);
      autoFireInterval = null;
    }
    const autoBtn = document.getElementById('auto-btn');
    if (autoBtn) {
      autoBtn.classList.remove('active');
      autoBtn.textContent = '🔄 自動発射: OFF';
    }
  }

  // 4. チャッカー入賞＆スロット保留
  function onChackerHit(ball) {
    if (holdCount < 4) {
      holdCount++;
      updateHoldDisplay();
      if (!isSlotSpinning) {
        processSlotSpin(ball.cost);
      }
    }
  }

  function updateHoldDisplay() {
    const holdEl = document.getElementById('hold-count');
    if (holdEl) holdEl.textContent = holdCount;
  }

  // 5. 液晶スロット抽選
  async function processSlotSpin(ballCost) {
    if (holdCount <= 0) return;
    holdCount--;
    updateHoldDisplay();

    isSlotSpinning = true;
    const msgEl = document.getElementById('pachinko-message');
    if (msgEl) msgEl.textContent = '🎰 液晶スロット回転中...！';

    // 確率設定 (通常 1/99, 確変時 1/15)
    const winRate = isFeverMode ? 15 : 99;
    const isWin = Math.floor(Math.random() * winRate) === 0;
    const isFeverWin = isWin && Math.random() < 0.4; // 確変大当り(777)

    const startTime = Date.now();
    const spinDuration = 1800; // 1.8秒演出

    const spinInterval = setInterval(() => {
      slotReels[0] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      slotReels[1] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      slotReels[2] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

      if (Date.now() - startTime > spinDuration) {
        clearInterval(spinInterval);

        if (isWin) {
          const winSym = isFeverWin ? '7' : SYMBOLS[Math.floor(Math.random() * (SYMBOLS.length - 1))];
          slotReels = [winSym, winSym, winSym];
          triggerJackpot(isFeverWin, ballCost);
        } else {
          // ハズレ（リーチ演出混じり）
          const s1 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          let s2 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          let s3 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          if (s1 === s2 && s2 === s3) {
            s3 = (parseInt(s3) % 9 + 1).toString();
          }
          slotReels = [s1, s2, s3];
          if (msgEl) msgEl.textContent = 'ハズレ... 次に期待！';
        }

        isSlotSpinning = false;
        if (holdCount > 0) {
          setTimeout(() => processSlotSpin(ballCost), 500);
        }
      }
    }, 60);
  }

  // 6. 大当り発動
  function triggerJackpot(isFeverWin, ballCost) {
    isJackpot = true;
    isAttackerOpen = true;
    jackpotTimer = 300; // アタッカーオープン時間（フレーム数）

    if (isFeverWin) {
      isFeverMode = true;
      showFeverUI(true);
    }

    const msgEl = document.getElementById('pachinko-message');
    if (msgEl) {
      msgEl.textContent = isFeverWin 
        ? '🎉🎉 超確変大当り(777)GET!! アタッカー開放 ＆ FEVER MODE突入！' 
        : '🎉 大当りGET!! アタッカー開放中！大量出玉を狙え！';
    }

    triggerWinParticles();
  }

  function showFeverUI(active) {
    const banner = document.getElementById('fever-banner');
    const container = document.getElementById('pachinko-container');
    if (banner && container) {
      if (active) {
        banner.classList.remove('hidden');
        container.classList.add('fever-mode');
      } else {
        banner.classList.add('hidden');
        container.classList.remove('fever-mode');
      }
    }
  }

  // 7. アタッカー入賞処理 (大量配当獲得)
  function onAttackerHit(ball) {
    const payoutMult = 15n; // 球価格の15倍出玉
    const payout = ball.cost * payoutMult;

    totalJackpotPayout += payout;
    currentSessionProfit += payout;

    window.playerData.cash = safeToBigInt(window.playerData.cash) + payout;

    // ハイスコア更新
    const currentHigh = safeToBigInt(window.playerData.highScores?.pachinko);
    if (currentSessionProfit > currentHigh) {
      if (!window.playerData.highScores) window.playerData.highScores = {};
      window.playerData.highScores.pachinko = currentSessionProfit;
    }

    if (typeof window.applyDebtInterest === 'function') {
      window.applyDebtInterest();
    } else if (typeof window.saveData === 'function') {
      window.saveData();
    }

    updateCashDisplay();
  }

  // 8. メインゲーム物理演算＆描画ループ
  function gameLoop() {
    animFrameId = requestAnimationFrame(gameLoop);

    // アタッカータイマー
    if (isJackpot) {
      jackpotTimer--;
      if (jackpotTimer <= 0) {
        isJackpot = false;
        isAttackerOpen = false;
        const msgEl = document.getElementById('pachinko-message');
        if (msgEl) {
          msgEl.textContent = `大当り終了！ 獲得配当: ${formatMoney(totalJackpotPayout)}`;
        }
        totalJackpotPayout = 0n;
      }
    }

    // 描画クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 8-1. 外枠＆ガイドレール描画
    ctx.strokeStyle = '#dfb15b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(200, 200, 185, Math.PI * 0.85, Math.PI * 2.15);
    ctx.stroke();

    // 8-2. 液晶画面領域描画
    ctx.fillStyle = '#0a1020';
    ctx.strokeStyle = '#05d9e8';
    ctx.lineWidth = 3;
    ctx.fillRect(120, 180, 160, 110);
    ctx.strokeRect(120, 180, 160, 110);

    // リール数字描画
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isFeverMode ? '#ff2a6d' : '#fcd581';
    ctx.fillText(slotReels[0], 150, 235);
    ctx.fillText(slotReels[1], 200, 235);
    ctx.fillText(slotReels[2], 250, 235);

    // 8-3. スタートチャッカー描画
    ctx.fillStyle = '#ff2a6d';
    ctx.fillRect(chacker.x - chacker.w / 2, chacker.y - chacker.h / 2, chacker.w, chacker.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('START', chacker.x, chacker.y + 3);

    // 8-4. アタッカー描画
    ctx.fillStyle = isAttackerOpen ? '#2ecc71' : '#555555';
    ctx.fillRect(attacker.x - attacker.w / 2, attacker.y - attacker.h / 2, attacker.w, attacker.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(isAttackerOpen ? 'OPEN!!' : 'GREAT', attacker.x, attacker.y + 4);

    // 8-5. 釘の描画
    ctx.fillStyle = '#dfb15b';
    pegs.forEach(peg => {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 8-6. 玉の物理シミュレーション＆描画
    const gravity = 0.22;
    const bounce = 0.55;

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];

      b.vy += gravity;
      b.x += b.vx;
      b.y += b.vy;

      // 天井カーブガイドレール反射
      const distFromCenter = Math.hypot(b.x - 200, b.y - 200);
      if (distFromCenter > 180 && b.y < 350) {
        const angle = Math.atan2(b.y - 200, b.x - 200);
        b.x = 200 + Math.cos(angle) * 179;
        b.y = 200 + Math.sin(angle) * 179;
        b.vx = -b.vx * bounce + (Math.random() - 0.5);
        b.vy = -b.vy * bounce;
      }

      // 釘との衝突判定
      pegs.forEach(p => {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < b.r + p.r) {
          const angle = Math.atan2(dy, dx);
          b.x = p.x + Math.cos(angle) * (b.r + p.r);
          b.y = p.y + Math.sin(angle) * (b.r + p.r);
          const speed = Math.hypot(b.vx, b.vy) * bounce;
          b.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 0.5;
          b.vy = Math.sin(angle) * speed;
        }
      });

      // スタートチャッカー入賞判定
      if (
        Math.abs(b.x - chacker.x) < chacker.w / 2 &&
        Math.abs(b.y - chacker.y) < chacker.h / 2
      ) {
        onChackerHit(b);
        balls.splice(i, 1);
        continue;
      }

      // アタッカー入賞判定
      if (
        isAttackerOpen &&
        Math.abs(b.x - attacker.x) < attacker.w / 2 &&
        Math.abs(b.y - attacker.y) < attacker.h / 2
      ) {
        onAttackerHit(b);
        balls.splice(i, 1);
        continue;
      }

      // 画面外（アウト）消去
      if (b.y > 530 || b.x < 10 || b.x > 390) {
        balls.splice(i, 1);
        continue;
      }

      // 玉の描画 (銀玉グラデーション)
      const grad = ctx.createRadialGradient(b.x - 1, b.y - 1, 1, b.x, b.y, b.r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.7, '#a0a0a0');
      grad.addColorStop(1, '#404040');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function triggerWinParticles() {
    const container = document.getElementById('particle-container') || document.body;
    const items = ['🎉', '🪙', '✨', '🎰', '💎'];

    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = items[Math.floor(Math.random() * items.length)];
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDelay = Math.random() * 0.8 + 's';
      container.appendChild(p);

      setTimeout(() => p.remove(), 3000);
    }
  }

  // 初期化イベント
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.loadData === 'function') window.loadData();
    updateCashDisplay();
    initBoard();

    const shootBtn = document.getElementById('shoot-btn');
    const autoBtn = document.getElementById('auto-btn');

    if (shootBtn) shootBtn.addEventListener('click', shootBall);
    if (autoBtn) autoBtn.addEventListener('click', toggleAutoFire);
  });

})();