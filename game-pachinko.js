/**
 * ==========================================
 * Fever Casino - CR FEVER PACHINKO 本格正村ゲージシミュレーター (game-pachinko.js)
 * 極座標アーチ発射エンジン・スタック解除・ステージ誘導・正村ゲージ完全対応版
 * ==========================================
 */

(function () {
  let canvas, ctx;
  let animFrameId = null;

  // ゲーム状態・フラグ
  let isAutoFiring = false;
  let autoFireInterval = null;
  let shootPower = 75; // 打ち出し強度 (30~100)
  
  // モード定義: 'NORMAL' (1/99), 'RUSH' (1/15), 'JITAN' (1/99 時短100回)
  let currentMode = 'NORMAL';
  let jitanSpinsLeft = 0;
  let rushCount = 0;

  // 統計カウンタ
  let totalSpins = 0;
  let totalJackpots = 0;
  let currentSessionProfit = 0n;

  // 保留管理 (最大4個)
  let holdQueue = [];
  let isSlotSpinning = false;

  // 大当り・ラウンド管理
  let isJackpot = false;
  let jackpotType = null; // 'SUPER' (15R 777 RUSH) | 'REGULAR' (10R)
  let currentRound = 0;
  let totalRounds = 10;
  let roundCount = 0; // 現ラウンドのアタッカー入賞数 (10C)
  let roundTimer = 0;
  let isAttackerOpen = false;
  let totalJackpotPayout = 0n;

  // 液晶スロット ＆ 演出制御
  let slotState = 'IDLE'; // 'IDLE', 'SPINNING', 'REACH_NORMAL', 'REACH_SP', 'PUSH_WAIT', 'JACKPOT_FANFARE', 'ROUND', 'ROUND_RESULT'
  let slotReels = ['7', '7', '7'];
  const SYMBOLS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  // 演出タイマー
  let pushTimer = 0;
  let isPushWaiting = false;
  let pendingWinIsFever = false;
  let currentBallCost = 10n;

  // 盤面中心・寸法定数
  const CX = 220; // 盤面中心X
  const CY = 260; // 中央ユニット中心Y
  const RAIL_R = 196; // 発射真鍮ガイドレール半径

  // 盤面物理オブジェクト群
  let balls = [];
  let pegs = []; // 正村ゲージの釘
  let spinners = []; // 風車
  let tulips = []; // 開閉式チューリップ入賞口
  let chacker = { x: CX, y: 430, w: 34, h: 20 }; // ヘソ（スタートチャッカー）
  let attacker = { x: CX, y: 535, w: 84, h: 26 }; // 電動アタッカー

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
    
    // データカウンタ更新
    const spinEl = document.getElementById('stat-spins');
    const jackEl = document.getElementById('stat-jackpots');
    const rushEl = document.getElementById('stat-rush-count');
    const payEl = document.getElementById('stat-payout');

    if (spinEl) spinEl.textContent = totalSpins;
    if (jackEl) jackEl.textContent = totalJackpots;
    if (rushEl) rushEl.textContent = rushCount;
    if (payEl) payEl.textContent = formatMoney(currentSessionProfit);
  }

  // 1. 正村ゲージ盤面初期化・釘・風車・チューリップ配置
  function initBoard() {
    canvas = document.getElementById('pachinko-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    pegs = [];
    spinners = [];
    tulips = [];

    // 1-1. 正村ゲージ（幾何学的・左右対称の美しい釘配列）
    // 天釘・天山釘
    pegs.push({ x: CX - 25, y: 95, r: 3.5 });
    pegs.push({ x: CX + 25, y: 95, r: 3.5 });
    pegs.push({ x: CX - 50, y: 110, r: 3.5 });
    pegs.push({ x: CX + 50, y: 110, r: 3.5 });

    // ぶっコミ＆山釘（左右上部）
    for (let i = 0; i < 5; i++) {
      pegs.push({ x: CX - 88 - i * 16, y: 125 + i * 14, r: 3 });
      pegs.push({ x: CX + 88 + i * 16, y: 125 + i * 14, r: 3 });
    }

    // 谷釘・鎧釘（中央ユニット両脇の流れ）
    for (let i = 0; i < 6; i++) {
      pegs.push({ x: CX - 75 - i * 10, y: 220 + i * 22, r: 3 });
      pegs.push({ x: CX + 75 + i * 10, y: 220 + i * 22, r: 3 });
    }

    // ハカマ（チャッカー上部のV字釘）
    pegs.push({ x: CX - 28, y: 380, r: 3 });
    pegs.push({ x: CX + 28, y: 380, r: 3 });
    pegs.push({ x: CX - 18, y: 398, r: 3 });
    pegs.push({ x: CX + 18, y: 398, r: 3 });

    // 命釘（ヘソ直上）
    pegs.push({ x: CX - 20, y: 418, r: 3.5 });
    pegs.push({ x: CX + 20, y: 418, r: 3.5 });

    // 1-2. 風車（回転ギミック 左右2箇所）
    spinners.push({ x: CX - 120, y: 310, radius: 16, angle: 0, speed: 0 });
    spinners.push({ x: CX + 120, y: 310, radius: 16, angle: 0, speed: 0 });

    // 1-3. チューリップ入賞口（開閉ギミック）
    // 中央（ヘソと連動）
    tulips.push({ x: CX, y: 430, wClosed: 26, wOpen: 46, h: 18, isOpen: false, isChacker: true });
    // 左右チューリップ
    tulips.push({ x: CX - 110, y: 380, wClosed: 24, wOpen: 42, h: 18, isOpen: false, isChacker: false });
    tulips.push({ x: CX + 110, y: 380, wClosed: 24, wOpen: 42, h: 18, isOpen: false, isChacker: false });
    // 下部左右チューリップ
    tulips.push({ x: CX - 65, y: 480, wClosed: 24, wOpen: 42, h: 18, isOpen: false, isChacker: false });
    tulips.push({ x: CX + 65, y: 480, wClosed: 24, wOpen: 42, h: 18, isOpen: false, isChacker: false });

    if (animFrameId) cancelAnimationFrame(animFrameId);
    gameLoop();
  }

  // 2. 玉の発射処理 (極座標発射エンジン)
  function shootBall() {
    const betBtn = document.getElementById('bet-select-btn');
    const ballCost = safeToBigInt(betBtn ? betBtn.getAttribute('data-amount') : '10');
    currentBallCost = ballCost;

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

    // ハンドルパワー (30 ~ 100 ➔ 初速 13.5 ~ 20.5)
    const baseSpeed = 13.2 + (shootPower / 100) * 7.2;
    const speed = baseSpeed + (Math.random() - 0.5) * 0.4;

    balls.push({
      x: CX + RAIL_R, // 416
      y: 540,
      vx: 0,
      vy: -speed,
      r: 4.5,
      cost: ballCost,
      inShooter: true,    // シューター線状/円弧走行フラグ
      shooterMode: 'LINE', // 'LINE' (直線) ➔ 'ARC' (極座標アーチ)
      arcAngle: 0,        // アーチ区間の角度 (0 = 真右, -PI/2 = 真上, -PI = 真左)
      arcSpeed: speed / RAIL_R, // 角速度
      stuckFrames: 0      // スタック検出カウンタ
    });
  }

  // 3. 自動発射 ＆ パワーハンドル制御
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
      autoFireInterval = setInterval(shootBall, 320);
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

  function setShootPower(val) {
    shootPower = Math.max(30, Math.min(100, parseInt(val, 10) || 75));
    const slider = document.getElementById('power-slider');
    const text = document.getElementById('power-val-text');
    if (slider) slider.value = shootPower;
    if (text) text.textContent = `${shootPower}%`;

    document.querySelectorAll('.preset-btn').forEach(b => {
      const p = parseInt(b.getAttribute('data-power'), 10);
      if (p === shootPower) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  // 4. チャッカー（ヘソ）およびチューリップ入賞処理
  function onChackerHit(ball) {
    if (tulips[0]) tulips[0].isOpen = true; // 中央チューリップ開口連動

    if (holdQueue.length < 4) {
      const winRate = (currentMode === 'RUSH') ? 15 : 99;
      
      let isWin = false;
      let isFeverWin = false;

      if (window.debugFlags?.forceWin) {
        isWin = true;
        isFeverWin = Math.random() < 0.6;
      } else if (window.debugFlags?.forceLose) {
        isWin = false;
        isFeverWin = false;
      } else {
        isWin = Math.floor(Math.random() * winRate) === 0;
        isFeverWin = isWin && (Math.random() < 0.5 || currentMode === 'RUSH');
      }

      let reachType = 'NONE';
      if (isWin) {
        reachType = 'SP';
      } else if (Math.random() < 0.25) {
        reachType = Math.random() < 0.4 ? 'SP' : 'NORMAL';
      }

      let color = 'white';
      if (isFeverWin) {
        color = Math.random() < 0.7 ? 'gold' : 'red';
      } else if (isWin) {
        color = Math.random() < 0.6 ? 'red' : 'green';
      } else if (reachType === 'SP') {
        color = Math.random() < 0.5 ? 'green' : 'blue';
      } else if (reachType === 'NORMAL') {
        color = Math.random() < 0.4 ? 'blue' : 'white';
      }

      holdQueue.push({
        color: color,
        isWin: isWin,
        isFeverWin: isFeverWin,
        reachType: reachType
      });

      updateHoldDisplay();

      if (slotState === 'IDLE' && !isSlotSpinning) {
        consumeHoldAndSpin();
      }
    }
  }

  // 袖チューリップ入賞
  function onTulipHit(tulip, ball) {
    tulip.isOpen = !tulip.isOpen; // 開閉反転

    const payout = ball.cost * 5n;
    window.playerData.cash = safeToBigInt(window.playerData.cash) + payout;
    currentSessionProfit += payout;

    if (typeof window.saveData === 'function') window.saveData();
    updateCashDisplay();
  }

  function updateHoldDisplay() {
    for (let i = 0; i < 4; i++) {
      const lamp = document.getElementById(`hl-${i}`);
      if (!lamp) continue;
      lamp.className = 'hold-lamp';
      if (i < holdQueue.length) {
        lamp.classList.add(holdQueue[i].color);
      }
    }
  }

  // 5. 保留消化 ＆ 液晶スロット演出処理
  function consumeHoldAndSpin() {
    if (holdQueue.length === 0 || isSlotSpinning || isJackpot) return;

    const currentData = holdQueue.shift();
    updateHoldDisplay();

    totalSpins++;
    if (currentMode === 'JITAN') {
      jitanSpinsLeft--;
      if (jitanSpinsLeft <= 0) {
        setMode('NORMAL');
      }
    }
    updateCashDisplay();

    isSlotSpinning = true;
    slotState = 'SPINNING';

    const msgEl = document.getElementById('pachinko-message');
    if (msgEl) {
      if (currentMode === 'RUSH') msgEl.textContent = '🔥 RUSH高速回転中...！';
      else msgEl.textContent = '🎰 液晶スロット回転中...！';
    }

    const spinDuration = (currentMode === 'RUSH') ? 600 : 1600;
    const startTime = Date.now();

    const spinInterval = setInterval(() => {
      slotReels[0] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      slotReels[1] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      slotReels[2] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

      if (Date.now() - startTime > spinDuration) {
        clearInterval(spinInterval);

        if (currentData.isWin) {
          if (currentMode === 'RUSH') {
            slotReels = currentData.isFeverWin ? ['7', '7', '7'] : ['3', '3', '3'];
            startJackpotSequence(currentData.isFeverWin);
          } else {
            startReachSequence(currentData, true);
          }
        } else if (currentData.reachType !== 'NONE' && currentMode !== 'RUSH') {
          startReachSequence(currentData, false);
        } else {
          let s1 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          let s2 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          let s3 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          if (s1 === s2 && s2 === s3) s3 = (parseInt(s3) % 9 + 1).toString();
          slotReels = [s1, s2, s3];

          slotState = 'IDLE';
          isSlotSpinning = false;
          if (msgEl) msgEl.textContent = 'ハズレ... 次の変動に期待！';
          
          if (holdQueue.length > 0) {
            setTimeout(consumeHoldAndSpin, 250);
          }
        }
      }
    }, 50);
  }

  // 6. リーチ演出
  function startReachSequence(data, isWin) {
    slotState = 'REACH_NORMAL';
    const msgEl = document.getElementById('pachinko-message');

    const targetSym = data.isFeverWin ? '7' : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    slotReels[0] = targetSym;
    slotReels[1] = targetSym;
    slotReels[2] = '?';

    if (msgEl) msgEl.textContent = '🔥 リーチ発生!! 期待が高まる...！';

    setTimeout(() => {
      if (data.reachType === 'SP' || isWin) {
        slotState = 'REACH_SP';
        if (msgEl) msgEl.textContent = '⚡⚡ 激熱正村SPバトルリーチへ発展！！ ⚡⚡';

        setTimeout(() => {
          slotState = 'PUSH_WAIT';
          isPushWaiting = true;
          pendingWinIsFever = data.isFeverWin;

          const pushOverlay = document.getElementById('push-overlay');
          if (pushOverlay) pushOverlay.classList.remove('hidden');
          if (msgEl) msgEl.textContent = '🔴 PUSHボタンを押して大当りを掴み取れ！！';

          pushTimer = setTimeout(() => {
            if (isPushWaiting) {
              onPushBtnClick(isWin, data.isFeverWin, targetSym);
            }
          }, 5000);

        }, 1800);

      } else {
        slotReels[2] = (parseInt(targetSym) % 9 + 1).toString();
        slotState = 'IDLE';
        isSlotSpinning = false;
        if (msgEl) msgEl.textContent = 'ノーマルリーチ失速... ハズレ';
        if (holdQueue.length > 0) setTimeout(consumeHoldAndSpin, 400);
      }
    }, 1200);
  }

  function onPushBtnClick(isWin, isFeverWin, targetSym) {
    if (!isPushWaiting) return;
    isPushWaiting = false;
    clearTimeout(pushTimer);

    const pushOverlay = document.getElementById('push-overlay');
    if (pushOverlay) pushOverlay.classList.add('hidden');

    const msgEl = document.getElementById('pachinko-message');

    if (isWin) {
      slotReels = isFeverWin ? ['7', '7', '7'] : [targetSym, targetSym, targetSym];
      if (msgEl) msgEl.textContent = '🎉🎉 大当りGET!!!!!! 🎉🎉';
      triggerWinParticles();
      setTimeout(() => startJackpotSequence(isFeverWin), 800);
    } else {
      let failSym = (parseInt(targetSym) % 9 + 1).toString();
      slotReels = [targetSym, targetSym, failSym];
      slotState = 'IDLE';
      isSlotSpinning = false;
      if (msgEl) msgEl.textContent = '💀 悔しい！ リーチ失敗...';
      if (holdQueue.length > 0) setTimeout(consumeHoldAndSpin, 500);
    }
  }

  // 7. 大当り ＆ ラウンドアタッカー消化
  function startJackpotSequence(isFeverWin) {
    isJackpot = true;
    totalJackpots++;
    jackpotType = isFeverWin ? 'SUPER' : 'REGULAR';
    totalRounds = isFeverWin ? 15 : 10;
    currentRound = 1;
    roundCount = 0;
    totalJackpotPayout = 0n;

    slotState = 'JACKPOT_FANFARE';
    const msgEl = document.getElementById('pachinko-message');
    if (msgEl) {
      msgEl.textContent = isFeverWin
        ? '🎉🎉 超大当り(777)!! 15ラウンド ＆ 確変RUSH獲得確定！'
        : '🎉 大当り!! 10ラウンドアタッカーオープン！';
    }

    setTimeout(() => {
      startRound(1);
    }, 2000);
  }

  function startRound(roundNum) {
    currentRound = roundNum;
    roundCount = 0;
    isAttackerOpen = true;
    slotState = 'ROUND';
    roundTimer = 240;

    const msgEl = document.getElementById('pachinko-message');
    if (msgEl) {
      msgEl.textContent = `ROUND ${currentRound}/${totalRounds} - アタッカーを狙え！`;
    }
  }

  function onAttackerHit(ball) {
    if (!isAttackerOpen || roundCount >= 10) return;

    roundCount++;
    const payoutMult = 15n;
    const payout = ball.cost * payoutMult;

    totalJackpotPayout += payout;
    currentSessionProfit += payout;

    window.playerData.cash = safeToBigInt(window.playerData.cash) + payout;

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

    if (roundCount >= 10) {
      isAttackerOpen = false;
      setTimeout(nextRoundOrFinish, 400);
    }
  }

  function nextRoundOrFinish() {
    if (currentRound < totalRounds) {
      startRound(currentRound + 1);
    } else {
      finishJackpot();
    }
  }

  function finishJackpot() {
    isJackpot = false;
    isAttackerOpen = false;
    slotState = 'ROUND_RESULT';

    const msgEl = document.getElementById('pachinko-message');
    
    if (jackpotType === 'SUPER') {
      rushCount++;
      setMode('RUSH');
      if (msgEl) msgEl.textContent = `🎉 大当り終了！ 獲得出玉: ${formatMoney(totalJackpotPayout)} ➔ 超確変RUSH突入！`;
    } else {
      if (Math.random() < 0.4 || currentMode === 'RUSH') {
        rushCount++;
        setMode('RUSH');
        if (msgEl) msgEl.textContent = `⚡ 昇格演出成功！ 獲得出玉: ${formatMoney(totalJackpotPayout)} ➔ RUSH継続！`;
      } else {
        rushCount = 0;
        setMode('JITAN');
        if (msgEl) msgEl.textContent = `大当り終了。獲得出玉: ${formatMoney(totalJackpotPayout)} ➔ 時短100回突入！`;
      }
    }

    setTimeout(() => {
      slotState = 'IDLE';
      isSlotSpinning = false;
      if (holdQueue.length > 0) consumeHoldAndSpin();
    }, 2500);
  }

  function setMode(newMode) {
    currentMode = newMode;
    const banner = document.getElementById('fever-banner');
    const badgeText = document.getElementById('mode-badge-text');
    const container = document.getElementById('pachinko-container');

    if (!banner || !container) return;

    banner.className = 'fever-banner';
    container.classList.remove('fever-mode', 'jitan-mode');

    if (newMode === 'RUSH') {
      banner.classList.add('mode-rush');
      container.classList.add('fever-mode');
      if (badgeText) badgeText.textContent = '🔥 超確変FEVER RUSH継続中！ (大当り確率 1/15)';
    } else if (newMode === 'JITAN') {
      jitanSpinsLeft = 100;
      banner.classList.add('mode-jitan');
      container.classList.add('jitan-mode');
      if (badgeText) badgeText.textContent = `⚡ 時短モード中 (残り ${jitanSpinsLeft} 回)`;
    } else {
      banner.classList.add('mode-normal');
      if (badgeText) badgeText.textContent = '通常モード (大当り確率 1/99)';
    }
  }

  // 8. メイン物理演算 ＆ Canvas描画ループ
  function gameLoop() {
    animFrameId = requestAnimationFrame(gameLoop);

    // アタッカータイマー制御
    if (isJackpot && slotState === 'ROUND' && isAttackerOpen) {
      roundTimer--;
      if (roundTimer <= 0) {
        isAttackerOpen = false;
        setTimeout(nextRoundOrFinish, 300);
      }
    }

    // 風車アニメーション更新
    spinners.forEach(s => {
      s.angle += s.speed;
      s.speed *= 0.95;
    });

    // 描画クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 8-1. 真鍮正円レール ＆ 外枠描画
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(CX, CY, RAIL_R, Math.PI * 0.82, Math.PI * 2.18);
    ctx.stroke();

    ctx.strokeStyle = '#fcd581';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CX, CY, RAIL_R - 2, Math.PI * 0.82, Math.PI * 2.18);
    ctx.stroke();

    // 発射レーン（右側仕切り壁）
    ctx.strokeStyle = 'rgba(184, 134, 11, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(CX + RAIL_R - 12, 570);
    ctx.lineTo(CX + RAIL_R - 12, CY);
    ctx.stroke();

    // 8-2. 中央10番モチーフ円形ドラムユニット（液晶）描画
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, 54, 0, Math.PI * 2);
    ctx.fillStyle = '#100a06';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = (currentMode === 'RUSH') ? '#ff2a6d' : '#dfb15b';
    ctx.stroke();

    // 二重飾り円
    ctx.beginPath();
    ctx.arc(CX, CY, 48, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fcd581';
    ctx.stroke();

    // ドラム/スロット数字描画
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = (currentMode === 'RUSH') ? '#ff2a6d' : '#fcd581';

    if (slotState === 'PUSH_WAIT') {
      ctx.fillStyle = '#ff2a6d';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('激熱一撃!', CX, CY);
    } else {
      ctx.fillText(slotReels[0], CX - 28, CY);
      ctx.fillText(slotReels[1], CX, CY);
      ctx.fillText(slotReels[2], CX + 28, CY);
    }

    // 大当りラウンド演出オーバーレイ
    if (slotState === 'ROUND') {
      ctx.beginPath();
      ctx.arc(CX, CY, 48, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fill();

      ctx.fillStyle = '#fcd581';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`R ${currentRound}/${totalRounds}`, CX, CY - 16);
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`C: ${roundCount}/10`, CX, CY + 4);
      ctx.fillStyle = '#05d9e8';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`+${formatMoney(totalJackpotPayout)}`, CX, CY + 24);
    }
    ctx.restore();

    // 8-3. 風車ギミック描画
    spinners.forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 3;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(14 * Math.cos(k * Math.PI / 2), 14 * Math.sin(k * Math.PI / 2));
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 8-4. チューリップ入賞口（開閉連動ギミック）描画
    tulips.forEach(t => {
      const w = t.isOpen ? t.wOpen : t.wClosed;
      
      // 中央ベース
      ctx.fillStyle = t.isChacker ? '#ff2a6d' : '#3498db';
      ctx.fillRect(t.x - t.wClosed / 2, t.y - t.h / 2, t.wClosed, t.h);

      // 開閉羽（チューリップの花びら）
      ctx.fillStyle = t.isOpen ? '#f39c12' : '#e74c3c';
      ctx.beginPath();
      // 左羽
      ctx.moveTo(t.x - t.wClosed / 2, t.y + t.h / 2);
      ctx.lineTo(t.x - w / 2, t.y - t.h / 2 - (t.isOpen ? 6 : 0));
      ctx.lineTo(t.x - t.wClosed / 2, t.y - t.h / 2);
      ctx.fill();

      // 右羽
      ctx.beginPath();
      ctx.moveTo(t.x + t.wClosed / 2, t.y + t.h / 2);
      ctx.lineTo(t.x + w / 2, t.y - t.h / 2 - (t.isOpen ? 6 : 0));
      ctx.lineTo(t.x + t.wClosed / 2, t.y - t.h / 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.isChacker ? 'START' : 'OPEN', t.x, t.y + 3);
    });

    // 8-5. 電動アタッカー描画
    ctx.fillStyle = isAttackerOpen ? '#2ecc71' : '#444444';
    ctx.fillRect(attacker.x - attacker.w / 2, attacker.y - attacker.h / 2, attacker.w, attacker.h);
    ctx.strokeStyle = '#dfb15b';
    ctx.lineWidth = 2;
    ctx.strokeRect(attacker.x - attacker.w / 2, attacker.y - attacker.h / 2, attacker.w, attacker.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(isAttackerOpen ? 'GREAT OPEN!!' : 'GREAT ATTACKER', attacker.x, attacker.y + 4);

    // 8-6. 正村ゲージの真鍮釘描画
    pegs.forEach(p => {
      ctx.fillStyle = '#dfb15b';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x - 0.8, p.y - 0.8, p.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 8-7. 玉の完全物理シミュレーション ＆ 描画
    const gravity = 0.22;
    const bounce = 0.55;

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];

      // ★ スタック（挟まり・詰まり）判定・自動復帰
      const speed = Math.hypot(b.vx, b.vy);
      if (speed < 0.25) {
        b.stuckFrames = (b.stuckFrames || 0) + 1;
      } else {
        b.stuckFrames = 0;
      }

      // 40フレーム(約0.6秒)停止したらランダム振動インパルスで復帰！
      if (b.stuckFrames > 40) {
        b.vx += (Math.random() - 0.5) * 3.0;
        b.vy += -1.5 - Math.random() * 2.0;
        b.stuckFrames = 0;
      }
      // 120フレーム以上抜け出せない極端なスタックは安全除去
      if (b.stuckFrames > 120) {
        balls.splice(i, 1);
        continue;
      }

      // ★ A. 発射レーン通過中 (`inShooter === true`) - 極座標・アーチ完璧シミュレーション
      if (b.inShooter) {
        if (b.shooterMode === 'LINE') {
          b.vy += gravity * 0.8; // 直線部は低摩擦
          b.y += b.vy;

          // 発射直後のy=260 (円弧開始位置) に達したら極座標アーチモードに移行
          if (b.y <= CY) {
            b.shooterMode = 'ARC';
            b.arcAngle = 0; // 0 = 真右 (CX + RAIL_R, CY)
            b.arcSpeed = Math.abs(b.vy) / RAIL_R; // 角速度に変換
          }
        } else if (b.shooterMode === 'ARC') {
          // 重力による角減速
          const gravityAngleEffect = gravity * Math.cos(b.arcAngle) / RAIL_R;
          b.arcSpeed -= gravityAngleEffect * 0.8;
          b.arcAngle -= b.arcSpeed; // 反時計回り（角度減少）

          b.x = CX + RAIL_R * Math.cos(b.arcAngle);
          b.y = CY + RAIL_R * Math.sin(b.arcAngle);

          // アーチを抜け出す（角度が -0.28*PI 以降、または失速してvy>0）
          if (b.arcAngle < -Math.PI * 0.28 || b.arcSpeed <= 0) {
            // 極座標から直交座標速度 (vx, vy) に変換して盤面内へ放出！
            const tangentialSpeed = b.arcSpeed * RAIL_R;
            b.vx = -tangentialSpeed * Math.sin(b.arcAngle) + (Math.random() - 0.5) * 0.5;
            b.vy = tangentialSpeed * Math.cos(b.arcAngle);
            b.inShooter = false;
          }
        }
      } 
      // ★ B. 通常の盤面遊技エリア通過中 (`inShooter === false`)
      else {
        b.vy += gravity;
        b.x += b.vx;
        b.y += b.vy;

        // 外枠円形ガイドレール（半径196の円弧）による跳ね返し
        const distFromCenter = Math.hypot(b.x - CX, b.y - CY);
        if (distFromCenter > 192 && b.y < 420) {
          const angle = Math.atan2(b.y - CY, b.x - CX);
          b.x = CX + Math.cos(angle) * 191;
          b.y = CY + Math.sin(angle) * 191;
          
          const normalX = Math.cos(angle);
          const normalY = Math.sin(angle);
          const dot = b.vx * normalX + b.vy * normalY;

          b.vx = (b.vx - 2 * dot * normalX) * bounce + (Math.random() - 0.5) * 0.5;
          b.vy = (b.vy - 2 * dot * normalY) * bounce;
        }

        // ★ 中央10番ドラムユニット（反発 ＆ ステージヘソ誘導効果）
        if (distFromCenter < 58) {
          const angle = Math.atan2(b.y - CY, b.x - CX);
          b.x = CX + Math.cos(angle) * 59;
          b.y = CY + Math.sin(angle) * 59;
          
          // ステージ効果：ユニット真上（b.y < CY - 30）付近に乗った球は円のフチを滑り落ちてヘソに吸い込まれやすくするアシスト
          if (b.y < CY - 20 && Math.abs(b.x - CX) < 30) {
            b.vx = (b.x < CX) ? 0.8 : -0.8; // 中央真下へ向かう滑り
            b.vy = 1.2;
          } else {
            // カツンとリアルな弾性反発 (0.72)
            const normalX = Math.cos(angle);
            const normalY = Math.sin(angle);
            const dot = b.vx * normalX + b.vy * normalY;

            b.vx = (b.vx - 2 * dot * normalX) * 0.72 + (Math.random() - 0.5) * 0.4;
            b.vy = (b.vy - 2 * dot * normalY) * 0.72;
          }
        }

        // 風車との衝突
        spinners.forEach(s => {
          const dx = b.x - s.x;
          const dy = b.y - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist < b.r + s.radius) {
            const angle = Math.atan2(dy, dx);
            b.x = s.x + Math.cos(angle) * (b.r + s.radius);
            b.y = s.y + Math.sin(angle) * (b.r + s.radius);
            b.vx = Math.cos(angle) * 3.2 + (Math.random() - 0.5) * 2;
            b.vy = Math.sin(angle) * 3.2;
            s.speed += (b.vx > 0 ? 0.35 : -0.35);
          }
        });

        // 正村ゲージ釘との衝突判定（カツカツカツ…と微小散乱）
        pegs.forEach(p => {
          const dx = b.x - p.x;
          const dy = b.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < b.r + p.r) {
            const angle = Math.atan2(dy, dx);
            b.x = p.x + Math.cos(angle) * (b.r + p.r);
            b.y = p.y + Math.sin(angle) * (b.r + p.r);
            const speed = Math.hypot(b.vx, b.vy) * bounce;
            
            // 釘の反発角度にランダムな微小幅を与えて枝分かれさせる
            const spreadAngle = angle + (Math.random() - 0.5) * 0.35;
            b.vx = Math.cos(spreadAngle) * speed;
            b.vy = Math.sin(spreadAngle) * speed;
          }
        });

        // チューリップ入賞判定（中央ヘソ・袖口）
        tulips.forEach(t => {
          const w = t.isOpen ? t.wOpen : t.wClosed;
          if (
            Math.abs(b.x - t.x) < w / 2 &&
            Math.abs(b.y - t.y) < t.h / 2
          ) {
            if (t.isChacker) {
              onChackerHit(b);
            } else {
              onTulipHit(t, b);
            }
            balls.splice(i, 1);
            return;
          }
        });

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
      }

      // 画面外（アウト）消去
      if (b.y > 610 || b.x < 5 || b.x > 435) {
        balls.splice(i, 1);
        continue;
      }

      // 銀玉のリアルグラデーション描画
      const grad = ctx.createRadialGradient(b.x - 1, b.y - 1, 1, b.x, b.y, b.r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.7, '#b0b0b0');
      grad.addColorStop(1, '#303030');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function triggerWinParticles() {
    const container = document.getElementById('particle-container') || document.body;
    const items = ['🎉', '🪙', '✨', '🎰', '💎', '🔴'];

    for (let i = 0; i < 35; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = items[Math.floor(Math.random() * items.length)];
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDelay = Math.random() * 0.8 + 's';
      container.appendChild(p);

      setTimeout(() => p.remove(), 3000);
    }
  }

  // 9. イベントリスナー初期化
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.loadData === 'function') window.loadData();
    updateCashDisplay();
    initBoard();

    const shootBtn = document.getElementById('shoot-btn');
    const autoBtn = document.getElementById('auto-btn');
    const slider = document.getElementById('power-slider');
    const screenPushBtn = document.getElementById('screen-push-btn');
    const manualPushBtn = document.getElementById('manual-push-btn');

    if (shootBtn) shootBtn.addEventListener('click', shootBall);
    if (autoBtn) autoBtn.addEventListener('click', toggleAutoFire);

    if (slider) {
      slider.addEventListener('input', (e) => {
        setShootPower(e.target.value);
      });
    }

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-power');
        setShootPower(p);
      });
    });

    const triggerPush = () => {
      if (isPushWaiting) {
        onPushBtnClick(true, pendingWinIsFever, slotReels[0]);
      }
    };

    if (screenPushBtn) screenPushBtn.addEventListener('click', triggerPush);
    if (manualPushBtn) manualPushBtn.addEventListener('click', triggerPush);

    // SPACEキーで玉発射 / PUSHボタン操作
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPushWaiting) triggerPush();
        else shootBall();
      }
    });
  });

})();