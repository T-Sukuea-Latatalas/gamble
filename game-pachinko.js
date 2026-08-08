/**
 * ==========================================
 * Fever Casino - CR FEVER PACHINKO (game-pachinko.js)
 * 完全ガード壁・天井アーチ＆フリッパー間スロープ＆無駄のない打ち出し実装版
 * ==========================================
 */

(function () {
  let canvas, ctx;
  let animFrameId = null;

  // ゲーム状態・フラグ
  let isAutoFiring = false;
  let autoFireInterval = null;

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
  const CX = 210; // 盤面中心X
  const CY = 260; // 盤面中心Y
  const RIGHT_LANE_X = 405; // 右側プランジャー発射レーンX

  // 盤面基本オブジェクト
  let balls = [];
  let pegs = [];         // 釘
  let chacker = { x: CX, y: 430, w: 32, h: 18 };  // スタートチャッカー（ヘソ）
  let attacker = { x: CX, y: 565, w: 84, h: 22 }; // 電動アタッカー

  // ★ 左右青い壁セグメント（天井アーチ・左右壁最下部延長・フリッパー外側遮断ガイド含む） ★
  const outerWalls = [
    // 天井アーチ (右発射口上部から左上へ流れる)
    { p1: { x: 430, y: 35 }, p2: { x: 380, y: 15 } },
    { p1: { x: 380, y: 15 }, p2: { x: 200, y: 15 } },
    { p1: { x: 200, y: 15 }, p2: { x: 20, y: 55 } },

    // 左外壁 (天井からフリッパー支点直横まで隙間なく完全連動)
    { p1: { x: 20, y: 55 }, p2: { x: 12, y: 200 } },
    { p1: { x: 12, y: 200 }, p2: { x: 10, y: 380 } },
    { p1: { x: 10, y: 380 }, p2: { x: 10, y: 502 } },
    { p1: { x: 10, y: 502 }, p2: { x: 138, y: 512 } }, // 左フリッパー支点外側遮断

    // 右遊技エリア外壁 (右レーン仕切り壁からフリッパー支点直横まで完全連動)
    { p1: { x: 385, y: 80 }, p2: { x: 380, y: 200 } },
    { p1: { x: 380, y: 200 }, p2: { x: 380, y: 380 } },
    { p1: { x: 380, y: 380 }, p2: { x: 380, y: 502 } },
    { p1: { x: 380, y: 502 }, p2: { x: 282, y: 512 } }, // 右フリッパー支点外側遮断

    // 右発射レーン右外壁
    { p1: { x: 430, y: 35 }, p2: { x: 430, y: 580 } },

    // 右発射レーン左仕切り壁 (y=80 以降を開放して流入口確保)
    { p1: { x: 385, y: 80 }, p2: { x: 385, y: 580 } }
  ];

  // ★ 最下部V字傾斜床（アウトスロープ）座標定義 ★
  const drainSlopes = [
    // 左から中央凹みへ滑り下りる坂
    { p1: { x: 20, y: 575 }, p2: { x: CX - 18, y: 594 }, normalX: 0.44, normalY: -0.90 },
    // 右から中央凹みへ滑り下りる坂
    { p1: { x: RIGHT_LANE_X - 5, y: 575 }, p2: { x: CX + 18, y: 594 }, normalX: -0.44, normalY: -0.90 }
  ];

  // ★ 左右フリッパーパラメータ（角度を深めにしてスタックを完全解消） ★
  let flippers = {
    left: {
      pivotX: 138,  // 左支点
      pivotY: 510,
      length: 68,
      width: 12,
      restAngle: 0.52,       // 静止時（急な右下がりで玉溜まり防止）
      activeAngle: -0.38,    // 稼働時（跳ね上がり）
      currentAngle: 0.52,
      targetAngle: 0.52,
      isTriggered: false,
      angularVelocity: 0
    },
    right: {
      pivotX: 282,  // 右支点
      pivotY: 510,
      length: 68,
      width: 12,
      restAngle: Math.PI - 0.52,    // 静止時（急な左下がりで玉溜まり防止）
      activeAngle: Math.PI + 0.38,  // 稼働時（跳ね上がり）
      currentAngle: Math.PI - 0.52,
      targetAngle: Math.PI - 0.52,
      isTriggered: false,
      angularVelocity: 0
    }
  };

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

  // 1. パチンコ盤面初期化（正村ゲージ釘配置）
  function initBoard() {
    canvas = document.getElementById('pachinko-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    pegs = [];

    // 1-1. 天釘・天山釘
    pegs.push({ x: CX - 30, y: 70, r: 3.5 });
    pegs.push({ x: CX + 30, y: 70, r: 3.5 });
    pegs.push({ x: CX - 60, y: 85, r: 3.5 });
    pegs.push({ x: CX + 60, y: 85, r: 3.5 });

    // 1-2. ぶっコミ ＆ 上部左右誘導釘
    for (let i = 0; i < 6; i++) {
      pegs.push({ x: CX - 90 - i * 14, y: 100 + i * 16, r: 3 });
      pegs.push({ x: CX + 90 + i * 14, y: 100 + i * 16, r: 3 });
    }

    // 1-3. 液晶ユニット上部 散乱釘
    pegs.push({ x: CX, y: 140, r: 3.5 });
    pegs.push({ x: CX - 25, y: 160, r: 3 });
    pegs.push({ x: CX + 25, y: 160, r: 3 });
    pegs.push({ x: CX - 50, y: 180, r: 3 });
    pegs.push({ x: CX + 50, y: 180, r: 3 });

    // 1-4. 液晶両脇の鎧釘・谷釘
    for (let i = 0; i < 7; i++) {
      pegs.push({ x: CX - 85 - i * 8, y: 200 + i * 22, r: 3 });
      pegs.push({ x: CX + 85 + i * 8, y: 200 + i * 22, r: 3 });
    }

    // 1-5. ハカマ（スタートチャッカー上部誘導V字釘）
    pegs.push({ x: CX - 24, y: 360, r: 3 });
    pegs.push({ x: CX + 24, y: 360, r: 3 });
    pegs.push({ x: CX - 15, y: 385, r: 3 });
    pegs.push({ x: CX + 15, y: 385, r: 3 });

    // 1-6. 命釘（ヘソ直上）
    pegs.push({ x: CX - 11.5, y: 412, r: 3.5 });
    pegs.push({ x: CX + 11.5, y: 412, r: 3.5 });

    // 1-7. フリッパー横アウト誘導釘
    pegs.push({ x: CX - 105, y: 440, r: 3 });
    pegs.push({ x: CX + 105, y: 440, r: 3 });
    pegs.push({ x: CX - 118, y: 475, r: 3 });
    pegs.push({ x: CX + 118, y: 475, r: 3 });

    if (animFrameId) cancelAnimationFrame(animFrameId);
    gameLoop();
  }

  // 2. 玉の発射処理（常に最適な固定スピードで発射）
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

    // 天井をきれいに伝うベストな固定発射スピード
    const speed = 19.5 + (Math.random() - 0.5) * 0.4;

    balls.push({
      x: RIGHT_LANE_X + 12,
      y: 530,
      vx: 0,
      vy: -speed,
      r: 4.5,
      cost: ballCost,
      inShooter: true,
      stuckFrames: 0
    });
  }

  // 3. 自動発射制御
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

  // 4. チャッカー（ヘソ）入賞処理 ➔ スロット変動
  function onChackerHit(ball) {
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

  // ★ 左右フリッパー角度更新 ＆ 物理演算 ★
  function updateFlippers() {
    ['left', 'right'].forEach(side => {
      const f = flippers[side];
      const prevAngle = f.currentAngle;
      f.targetAngle = f.isTriggered ? f.activeAngle : f.restAngle;
      
      const diff = f.targetAngle - f.currentAngle;
      f.currentAngle += diff * 0.40; // スピーディな跳ね上げ
      f.angularVelocity = f.currentAngle - prevAngle;
    });
  }

  // ★ 左右フリッパー描画 ★
  function drawFlippers() {
    ['left', 'right'].forEach(side => {
      const f = flippers[side];
      ctx.save();
      ctx.translate(f.pivotX, f.pivotY);
      ctx.rotate(f.currentAngle);

      // 水色〜シアンの光沢フリッパー
      const grad = ctx.createLinearGradient(0, -f.width / 2, f.length, f.width / 2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#33c5ff');
      grad.addColorStop(1, '#0088cc');

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.roundRect(0, -f.width / 2, f.length, f.width, f.width / 2);
      ctx.fill();
      ctx.stroke();

      // 支点ピン
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  // ★ 盤面外側・天井を完全に塗りつぶす描画機能 ★
  function drawOuterWallsAndCeiling() {
    ctx.save();
    ctx.fillStyle = '#0f081c'; // 外側の完全塗りつぶし色
    ctx.strokeStyle = '#05d9e8';
    ctx.lineWidth = 4;

    // 左側〜天井外枠塗りつぶし領域
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(440, 0);
    ctx.lineTo(440, 600);
    ctx.lineTo(0, 600);
    ctx.closePath();
    ctx.fill();

    // 内部の遊技エリアをくりぬいて描画（背景黒）
    ctx.fillStyle = '#020105';
    ctx.beginPath();
    ctx.moveTo(20, 55);
    ctx.lineTo(200, 15);
    ctx.lineTo(380, 15);
    ctx.lineTo(430, 35);
    ctx.lineTo(430, 580);
    ctx.lineTo(20, 580);
    ctx.closePath();
    ctx.fill();

    // 青い壁セグメント描画（天井・外壁）
    ctx.strokeStyle = '#413cd3';
    ctx.lineWidth = 6;
    ctx.beginPath();
    outerWalls.forEach(w => {
      ctx.moveTo(w.p1.x, w.p1.y);
      ctx.lineTo(w.p2.x, w.p2.y);
    });
    ctx.stroke();

    ctx.restore();
  }

  // ★ 玉とフリッパーの物理衝突判定・打ち返し演算 ★
  function checkFlipperCollision(ball) {
    ['left', 'right'].forEach(side => {
      const f = flippers[side];
      
      const cos = Math.cos(f.currentAngle);
      const sin = Math.sin(f.currentAngle);
      const tipX = f.pivotX + f.length * cos;
      const tipY = f.pivotY + f.length * sin;

      // 線分 (Pivot -> Tip) に対する玉の最短距離点計算
      const vx = tipX - f.pivotX;
      const vy = tipY - f.pivotY;
      const px = ball.x - f.pivotX;
      const py = ball.y - f.pivotY;

      const lenSq = f.length * f.length;
      let t = (px * vx + py * vy) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const closeX = f.pivotX + t * vx;
      const closeY = f.pivotY + t * vy;

      const dx = ball.x - closeX;
      const dy = ball.y - closeY;
      const dist = Math.hypot(dx, dy);
      const minDist = ball.r + f.width / 2;

      if (dist < minDist) {
        // 衝突
        const nx = dist === 0 ? 0 : dx / dist;
        const ny = dist === 0 ? -1 : dy / dist;

        ball.x = closeX + nx * minDist;
        ball.y = closeY + ny * minDist;

        const isFlippingUp = (side === 'left' && f.angularVelocity < -0.05) ||
                             (side === 'right' && f.angularVelocity > 0.05);

        if (isFlippingUp) {
          // 強力跳ね返し
          const hitPower = 13.0 + Math.abs(f.angularVelocity) * 20.0 + (t * 5.0);
          ball.vx = nx * hitPower * 0.75 + (side === 'left' ? 3.0 : -3.0);
          ball.vy = -Math.abs(hitPower * 0.98);
        } else {
          // ゴム反発＋傾斜すべり（フリッパー先端方向・中央回収口方向へ滑り落とす）
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx = (ball.vx - 1.8 * dot * nx) * 0.65;
          ball.vy = (ball.vy - 1.8 * dot * ny) * 0.65;

          // 静止角による滑り落ち補助
          const slideForce = (side === 'left') ? 0.4 : -0.4;
          ball.vx += slideForce;
          ball.vy += 0.3;
        }
      }
    });
  }

  // ★ 青い外壁ライン線分との正確な衝突バウンド処理 ★
  function checkWallCollisions(ball) {
    const wallThick = 4.0; // 壁の半厚み
    const bounce = 0.65;

    outerWalls.forEach(w => {
      const p1 = w.p1;
      const p2 = w.p2;

      const vx = p2.x - p1.x;
      const vy = p2.y - p1.y;
      const px = ball.x - p1.x;
      const py = ball.y - p1.y;

      const lenSq = vx * vx + vy * vy;
      let t = (px * vx + py * vy) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const closeX = p1.x + t * vx;
      const closeY = p1.y + t * vy;

      const dx = ball.x - closeX;
      const dy = ball.y - closeY;
      const dist = Math.hypot(dx, dy);
      const minDist = ball.r + wallThick;

      if (dist < minDist) {
        let nx = dist === 0 ? 0 : dx / dist;
        let ny = dist === 0 ? -1 : dy / dist;

        // 壁の押し出し位置補正
        ball.x = closeX + nx * minDist;
        ball.y = closeY + ny * minDist;

        // 反発ベクトルの反映
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx = (ball.vx - (1 + bounce) * dot * nx) + (Math.random() - 0.5) * 0.2;
          ball.vy = (ball.vy - (1 + bounce) * dot * ny);
        }
      }
    });
  }

  // ★ 最下部V字傾斜床（アウトスロープ）衝突・すべり演算 ★
  function checkSlopeCollisions(ball) {
    const slopeThick = 3.0;

    drainSlopes.forEach(s => {
      const p1 = s.p1;
      const p2 = s.p2;

      const vx = p2.x - p1.x;
      const vy = p2.y - p1.y;
      const px = ball.x - p1.x;
      const py = ball.y - p1.y;

      const lenSq = vx * vx + vy * vy;
      let t = (px * vx + py * vy) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const closeX = p1.x + t * vx;
      const closeY = p1.y + t * vy;

      const dx = ball.x - closeX;
      const dy = ball.y - closeY;
      const dist = Math.hypot(dx, dy);
      const minDist = ball.r + slopeThick;

      if (dist < minDist) {
        // 法線方向押し出し
        ball.x = closeX + s.normalX * minDist;
        ball.y = closeY + s.normalY * minDist;

        // 坂に沿った加速度・速度減衰（内側中央方向へ自然に滑り落ちる）
        const dot = ball.vx * s.normalX + ball.vy * s.normalY;
        if (dot < 0) {
          ball.vx = (ball.vx - 1.5 * dot * s.normalX);
          ball.vy = (ball.vy - 1.5 * dot * s.normalY);
        }

        // 斜面すべり（中央回収口方向へ力をかける）
        const slideDir = (closeX < CX) ? 0.45 : -0.45;
        ball.vx += slideDir;
        ball.vy += 0.35;
      }
    });
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

    // フリッパー更新
    updateFlippers();

    // 描画クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 8-0. 盤面外側・天井の塗りつぶし描画
    drawOuterWallsAndCeiling();

    // 8-1. 右プランジャーレーン仕切り壁描画
    ctx.strokeStyle = '#2d226a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(RIGHT_LANE_X, 100);
    ctx.lineTo(RIGHT_LANE_X, 580);
    ctx.stroke();

    // 8-2. 最下部V字傾斜床（アウトスロープ＆中央回収ドレイン）描画
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#dfb15b';
    ctx.fillStyle = '#1c0d2e';

    // 左傾斜床
    ctx.beginPath();
    ctx.moveTo(20, 580);
    ctx.lineTo(CX - 18, 596);
    ctx.lineTo(20, 600);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 右傾斜床
    ctx.beginPath();
    ctx.moveTo(RIGHT_LANE_X - 5, 580);
    ctx.lineTo(CX + 18, 596);
    ctx.lineTo(RIGHT_LANE_X - 5, 600);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 中央回収口（ドレインホッパー）
    ctx.fillStyle = '#050308';
    ctx.fillRect(CX - 18, 592, 36, 10);
    ctx.strokeStyle = '#05d9e8';
    ctx.lineWidth = 2;
    ctx.strokeRect(CX - 18, 592, 36, 10);

    // 8-3. スタートチャッカー（ヘソ）描画
    ctx.fillStyle = '#ff2a6d';
    ctx.fillRect(chacker.x - chacker.w / 2, chacker.y - chacker.h / 2, chacker.w, chacker.h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(chacker.x - chacker.w / 2, chacker.y - chacker.h / 2, chacker.w, chacker.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', chacker.x, chacker.y + 1);

    // 8-4. 中央液晶スロットユニット描画
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, 54, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0614';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = (currentMode === 'RUSH') ? '#ff2a6d' : '#dfb15b';
    ctx.stroke();

    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = (currentMode === 'RUSH') ? '#ff2a6d' : '#fcd581';

    if (slotState === 'PUSH_WAIT') {
      ctx.fillStyle = '#ff2a6d';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('PUSH!', CX, CY);
    } else {
      ctx.fillText(`${slotReels[0]}${slotReels[1]}${slotReels[2]}`, CX, CY);
    }

    if (slotState === 'ROUND') {
      ctx.beginPath();
      ctx.arc(CX, CY, 50, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fill();

      ctx.fillStyle = '#fcd581';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`R ${currentRound}/${totalRounds}`, CX, CY - 12);
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`C: ${roundCount}/10`, CX, CY + 10);
    }
    ctx.restore();

    // 8-5. 電動アタッカー描画
    ctx.fillStyle = isAttackerOpen ? '#2ecc71' : '#444444';
    ctx.fillRect(attacker.x - attacker.w / 2, attacker.y - attacker.h / 2, attacker.w, attacker.h);
    ctx.strokeStyle = '#dfb15b';
    ctx.lineWidth = 2;
    ctx.strokeRect(attacker.x - attacker.w / 2, attacker.y - attacker.h / 2, attacker.w, attacker.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(isAttackerOpen ? 'GREAT OPEN!!' : 'GREAT ATTACKER', attacker.x, attacker.y + 4);

    // 8-6. 水色フリッパーの描画
    drawFlippers();

    // 8-7. 釘描画
    pegs.forEach(p => {
      ctx.fillStyle = '#dfb15b';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 8-8. 玉の物理演算 ＆ 描画
    const gravity = 0.22;
    const bounce = 0.6;

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];

      // ★ フリッパー間・中央下部での玉溜まり（スタック）防止補正 ★
      const speed = Math.hypot(b.vx, b.vy);
      if (b.y > 480 && Math.abs(b.x - CX) < 35) {
        // 中央ライン付近に位置する玉には常に回収口（下）へ向かう重力を付与
        b.vy += 0.15;
        b.vx += (b.x < CX) ? 0.1 : -0.1;
      }

      if (speed < 0.2) b.stuckFrames = (b.stuckFrames || 0) + 1;
      else b.stuckFrames = 0;

      if (b.stuckFrames > 25) {
        b.vx += (Math.random() - 0.5) * 4.0;
        b.vy += 2.0; // 下方向へ強制ドロップ
        b.stuckFrames = 0;
      }
      if (b.stuckFrames > 80) {
        balls.splice(i, 1);
        continue;
      }

      // ★ A. プランジャー発射レーン通過中
      if (b.inShooter) {
        b.vy += gravity * 0.7;
        b.y += b.vy;

        // レーン上部曲がり部到達
        if (b.y <= 50) {
          b.inShooter = false;
          b.x = RIGHT_LANE_X - 20;
          b.vx = -4.5 - Math.random() * 1.5;
          b.vy = 1.0;
        }
      } 
      // ★ B. 通常盤面遊技エリア
      else {
        b.vy += gravity;
        b.x += b.vx;
        b.y += b.vy;

        // 青い線の外壁との正確な線分衝突判定
        checkWallCollisions(b);

        // フリッパー衝突
        checkFlipperCollision(b);

        // 最下部V字傾斜床（アウトスロープ）衝突
        checkSlopeCollisions(b);

        // 釘との衝突
        pegs.forEach(p => {
          const dx = b.x - p.x;
          const dy = b.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < b.r + p.r) {
            const angle = Math.atan2(dy, dx);
            b.x = p.x + Math.cos(angle) * (b.r + p.r);
            b.y = p.y + Math.sin(angle) * (b.r + p.r);
            const speed = Math.hypot(b.vx, b.vy) * bounce;
            const spreadAngle = angle + (Math.random() - 0.5) * 0.35;
            b.vx = Math.cos(spreadAngle) * speed;
            b.vy = Math.sin(spreadAngle) * speed;
          }
        });

        // スタートチャッカー（ヘソ）入賞判定
        if (
          Math.abs(b.x - chacker.x) < chacker.w / 2 + b.r &&
          Math.abs(b.y - chacker.y) < chacker.h / 2 + b.r
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
      }

      // 最下部ドレイン回収口または画面外（アウト）消去
      if (b.y > 585 && Math.abs(b.x - CX) < 28) {
        balls.splice(i, 1);
        continue;
      }
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

  // 9. イベントリスナー初期化（キーボード・ボタン・タッチイベント対応）
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.loadData === 'function') window.loadData();
    updateCashDisplay();
    initBoard();

    const shootBtn = document.getElementById('shoot-btn');
    const autoBtn = document.getElementById('auto-btn');
    const screenPushBtn = document.getElementById('screen-push-btn');
    const manualPushBtn = document.getElementById('manual-push-btn');

    const leftFlipBtn = document.getElementById('flipper-left-btn');
    const rightFlipBtn = document.getElementById('flipper-right-btn');

    if (shootBtn) shootBtn.addEventListener('click', shootBall);
    if (autoBtn) autoBtn.addEventListener('click', toggleAutoFire);

    const triggerPush = () => {
      if (isPushWaiting) {
        onPushBtnClick(true, pendingWinIsFever, slotReels[0]);
      }
    };

    if (screenPushBtn) screenPushBtn.addEventListener('click', triggerPush);
    if (manualPushBtn) manualPushBtn.addEventListener('click', triggerPush);

    // フリッパー操作ボタンイベント結合
    const bindFlipperBtn = (element, side) => {
      if (!element) return;
      
      const press = (e) => {
        e.preventDefault();
        flippers[side].isTriggered = true;
        element.classList.add('active');
      };
      const release = (e) => {
        e.preventDefault();
        flippers[side].isTriggered = false;
        element.classList.remove('active');
      };

      element.addEventListener('mousedown', press);
      element.addEventListener('mouseup', release);
      element.addEventListener('mouseleave', release);
      element.addEventListener('touchstart', press, { passive: false });
      element.addEventListener('touchend', release, { passive: false });
      element.addEventListener('touchcancel', release, { passive: false });
    };

    bindFlipperBtn(leftFlipBtn, 'left');
    bindFlipperBtn(rightFlipBtn, 'right');

    // キーボード操作 (A / ← で左フリッパー, D / → で右フリッパー, Spaceで玉発射)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        flippers.left.isTriggered = true;
        if (leftFlipBtn) leftFlipBtn.classList.add('active');
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        flippers.right.isTriggered = true;
        if (rightFlipBtn) rightFlipBtn.classList.add('active');
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPushWaiting) triggerPush();
        else shootBall();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        flippers.left.isTriggered = false;
        if (leftFlipBtn) leftFlipBtn.classList.remove('active');
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        flippers.right.isTriggered = false;
        if (rightFlipBtn) rightFlipBtn.classList.remove('active');
      }
    });
  });

})();