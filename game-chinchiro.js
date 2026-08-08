/**
 * ==========================================
 * Fever Casino - チンチロ PRO 制御スクリプト (game-chinchiro.js)
 * 対戦型役判定 ＆ 物理Canvasサイコロアニメーション
 * ==========================================
 */

(function () {
  let canvas, ctx;
  let animFrameId = null;
  let isRolling = false;

  let currentBet = 100n;
  let diceList = [
    { x: 140, y: 130, vx: 0, vy: 0, val: 1, angle: 0, va: 0 },
    { x: 190, y: 130, vx: 0, vy: 0, val: 1, angle: 0, va: 0 },
    { x: 240, y: 130, vx: 0, vy: 0, val: 1, angle: 0, va: 0 }
  ];

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

  // 役の判定関数 (ダイス3個)
  function evaluateHand(d1, d2, d3, isShomben = false) {
    if (isShomben) {
      return { rank: -2, name: '💀 ションベン (丼外落下)', score: -2, mult: 0 };
    }

    const arr = [d1, d2, d3].sort((a, b) => a - b);
    const s1 = arr[0], s2 = arr[1], s3 = arr[2];

    // ピンゾロ (1-1-1)
    if (s1 === 1 && s2 === 1 && s3 === 1) {
      return { rank: 10, name: '🎉 ピンゾロ (1-1-1)', score: 1000, mult: 5 };
    }
    // ゾロ目 (2~6)
    if (s1 === s2 && s2 === s3) {
      return { rank: 9, name: `🔥 ${s1}のゾロ目`, score: 800 + s1, mult: 3 };
    }
    // シゴロ (4-5-6)
    if (s1 === 4 && s2 === 5 && s3 === 6) {
      return { rank: 8, name: '✨ シゴロ (4-5-6)', score: 600, mult: 2 };
    }
    // ヒフミ (1-2-3)
    if (s1 === 1 && s2 === 2 && s3 === 3) {
      return { rank: -1, name: '💀 ヒフミ (1-2-3)', score: -1, mult: -2 };
    }

    // 通常の目 (ペア+1個)
    if (s1 === s2) return { rank: 1, name: `🎲 ${s3}の目`, score: s3, mult: 1 };
    if (s2 === s3) return { rank: 1, name: `🎲 ${s1}の目`, score: s1, mult: 1 };
    if (s1 === s3) return { rank: 1, name: `🎲 ${s2}の目`, score: s2, mult: 1 };

    // 役なし
    return { rank: 0, name: '役なし (目なし)', score: 0, mult: 0 };
  }

  // 1回分のロールシミュレーション (再振り最大3回含む)
  function rollDiceSequence() {
    return new Promise((resolve) => {
      let rollCount = 0;

      function attemptRoll() {
        rollCount++;
        // ションベン確率 2.5%
        const isShomben = Math.random() < 0.025;

        // サイコロ物理アニメーション発動
        animateDiceRoll(isShomben).then(() => {
          if (isShomben) {
            resolve({ hand: evaluateHand(0, 0, 0, true), dice: [0, 0, 0] });
            return;
          }

          const d1 = diceList[0].val;
          const d2 = diceList[1].val;
          const d3 = diceList[2].val;
          const hand = evaluateHand(d1, d2, d3);

          if (hand.rank === 0 && rollCount < 3) {
            // 目なし ➔ 再振り
            document.getElementById('chinchiro-message').textContent = `役なし... 再振り (${rollCount}/3回目)`;
            setTimeout(attemptRoll, 600);
          } else {
            resolve({ hand: hand, dice: [d1, d2, d3] });
          }
        });
      }

      attemptRoll();
    });
  }

  // サイコロコロコロ物理アニメーション
  function animateDiceRoll(isShomben) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const duration = 1200;

      // 初速と回転の設定
      diceList.forEach((d, i) => {
        d.x = 190 + (i - 1) * 40;
        d.y = 130;
        d.vx = (Math.random() - 0.5) * 14;
        d.vy = (Math.random() - 0.5) * 14;
        d.va = (Math.random() - 0.5) * 0.4;
        d.angle = Math.random() * Math.PI * 2;
      });

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        diceList.forEach((d) => {
          d.x += d.vx;
          d.y += d.vy;
          d.angle += d.va;

          d.vx *= 0.94;
          d.vy *= 0.94;
          d.va *= 0.94;

          // 丼フチ衝突跳ね返り
          const dx = d.x - 190;
          const dy = d.y - 130;
          const dist = Math.hypot(dx, dy);

          if (isShomben && progress > 0.7) {
            // ションベン：外へ飛び出す
          } else if (dist > 95) {
            const angle = Math.atan2(dy, dx);
            d.x = 190 + Math.cos(angle) * 94;
            d.y = 130 + Math.sin(angle) * 94;
            d.vx *= -0.7;
            d.vy *= -0.7;
          }

          if (progress < 1) {
            d.val = Math.floor(Math.random() * 6) + 1;
          }
        });

        drawStage();

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(step);
    });
  }

  function drawStage() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // サイコロ描画
    diceList.forEach((d) => {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);

      // ダイス本体
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(-16, -16, 32, 32, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 目（ドット）描画
      ctx.fillStyle = (d.val === 1) ? '#ff2a6d' : '#222222';
      drawDiceDots(ctx, d.val);

      ctx.restore();
    });
  }

  function drawDiceDots(ctx, val) {
    const dotR = (val === 1) ? 6 : 3.5;
    const posMap = {
      1: [[0, 0]],
      2: [[-7, -7], [7, 7]],
      3: [[-7, -7], [0, 0], [7, 7]],
      4: [[-7, -7], [7, -7], [-7, 7], [7, 7]],
      5: [[-7, -7], [7, -7], [0, 0], [-7, 7], [7, 7]],
      6: [[-7, -7], [7, -7], [-7, 0], [7, 0], [-7, 7], [7, 7]]
    };

    const dots = posMap[val] || posMap[1];
    dots.forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // メイン勝負フロー
  async function startGameSequence() {
    if (isRolling) return;

    const betBtn = document.getElementById('bet-select-btn');
    const betVal = safeToBigInt(betBtn ? betBtn.getAttribute('data-amount') : '100');

    if (betVal <= 0n) { alert('1以上の賭け金を選択してください。'); return; }
    if (betVal > safeToBigInt(playerData.cash)) { alert('所持金が足りません！'); return; }

    currentBet = betVal;
    playerData.cash = safeToBigInt(playerData.cash) - currentBet;
    saveData();

    isRolling = true;
    document.getElementById('roll-btn').disabled = true;
    document.getElementById('open-atm-btn').disabled = true;

    document.getElementById('dealer-hand-text').textContent = '振るのを待っています...';
    document.getElementById('player-hand-text').textContent = '---';

    // 1. 親（ディーラー）の振出し
    document.getElementById('chinchiro-message').textContent = '親（ディーラー）がサイコロを振っています...';
    const dealerRes = await rollDiceSequence();
    document.getElementById('dealer-hand-text').textContent = dealerRes.hand.name;

    await new Promise(r => setTimeout(r, 1000));

    // 2. 子（プレイヤー）の振出し
    document.getElementById('chinchiro-message').textContent = '子（あなた）がサイコロを振ります！';
    const playerRes = await rollDiceSequence();
    document.getElementById('player-hand-text').textContent = playerRes.hand.name;

    await new Promise(r => setTimeout(r, 800));

    // 3. 勝敗判定 ＆ 配当計算
    evaluateFinalOutcome(dealerRes.hand, playerRes.hand);

    isRolling = false;
    document.getElementById('roll-btn').disabled = false;
    document.getElementById('open-atm-btn').disabled = false;
  }

  function evaluateFinalOutcome(dHand, pHand) {
    let payout = 0n;
    let isWin = false;

    // 役ごとの特殊判定
    if (pHand.rank === -2 || pHand.rank === -1) {
      // 子がションベンまたはヒフミ ➔ 2倍没収または全額没収
      payout = 0n;
      isWin = false;
    } else if (dHand.rank === -2 || dHand.rank === -1) {
      // 親がションベンまたはヒフミ ➔ 子の勝利 (2倍配当)
      payout = currentBet * 2n;
      isWin = true;
    } else if (pHand.mult > 1) {
      // 子が強役 (ピンゾロ5倍, ゾロ目3倍, シゴロ2倍) ➔ その倍率配当獲得
      payout = currentBet * BigInt(pHand.mult + 1);
      isWin = true;
    } else if (dHand.mult > 1) {
      // 親が強役 ➔ 没収
      payout = 0n;
      isWin = false;
    } else {
      // 通常目同士の強さ比較 (score比較)
      if (pHand.score > dHand.score) {
        payout = currentBet * 2n;
        isWin = true;
      } else if (pHand.score < dHand.score) {
        payout = 0n;
        isWin = false;
      } else {
        // 引き分け (引き分けは賭け金返還)
        payout = currentBet;
        isWin = null;
      }
    }

    const msgEl = document.getElementById('chinchiro-message');

    if (isWin === true) {
      playerData.cash = safeToBigInt(playerData.cash) + payout;
      const profit = payout > currentBet ? payout - currentBet : 0n;

      const currentHigh = safeToBigInt(playerData.highScores?.chinchiro);
      if (profit > currentHigh) {
        if (!playerData.highScores) playerData.highScores = {};
        playerData.highScores.chinchiro = profit;
      }

      msgEl.textContent = `🎉 勝利！ 【${pHand.name}】 配当 ${formatMoney(payout)} を獲得！`;
      triggerWinEffects();
    } else if (isWin === false) {
      msgEl.textContent = `💀 敗北... 親【${dHand.name}】 子【${pHand.name}】 賭け金没収`;
      showLoseEffect();
    } else {
      playerData.cash = safeToBigInt(playerData.cash) + payout;
      msgEl.textContent = `🤝 引き分け (同点) - 賭け金 ${formatMoney(payout)} が返還されました。`;
    }

    if (typeof applyDebtInterest === 'function') applyDebtInterest();
    else saveData();

    updateCashDisplay();
  }

  function triggerWinEffects() {
    const overlay = document.getElementById('win-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      setTimeout(() => overlay.classList.add('hidden'), 2200);
    }

    const container = document.getElementById('particle-container');
    if (!container) return;
    container.innerHTML = '';
    const items = ['🪙', '🎲', '✨', '💎'];

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

  function showLoseEffect() {
    const overlay = document.getElementById('lose-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      setTimeout(() => overlay.classList.add('hidden'), 2000);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadData === 'function') loadData();
    updateCashDisplay();

    canvas = document.getElementById('dice-canvas');
    if (canvas) ctx = canvas.getContext('2d');

    drawStage();

    const rollBtn = document.getElementById('roll-btn');
    if (rollBtn) rollBtn.addEventListener('click', startGameSequence);
  });
})();