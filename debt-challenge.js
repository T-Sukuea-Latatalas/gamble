/**
 * ==========================================
 * Fever Casino - 借金相殺チャンス（3Dコイントス救済システム）
 * ==========================================
 */

(function () {
  let isTossing = false;
  let countdownInterval = null;

  // 1. 救済条件のチェック
  function checkDebtEligibility() {
    if (!window.playerData) return { eligible: false, reason: 'データがありません' };

    const debt = safeToBigInt(window.playerData.debt);
    const debtPlayCount = typeof window.playerData.debtPlayCount === 'number' ? window.playerData.debtPlayCount : 0;
    const now = Date.now();
    const nextTime = typeof window.playerData.nextDebtChallengeTime === 'number' ? window.playerData.nextDebtChallengeTime : 0;

    // クールダウン中
    if (now < nextTime) {
      return { eligible: false, isCooldown: true, remainingMs: nextTime - now };
    }

    // 発動条件：借金があり、かつ未返済プレイ回数(debtPlayCount)が15回以上（金利危険域）
    if (debt > 0n && debtPlayCount >= 15) {
      return { eligible: true };
    } else if (debt <= 0n) {
      return { eligible: false, reason: '現在借金はありません' };
    } else {
      return { eligible: false, reason: `借金金利レベルが不足しています（危険度: ${debtPlayCount}/15）` };
    }
  }

  // 2. ボタン ＆ タイマーUIのリアルタイム更新
  function updateDebtChallengeButtons() {
    const btns = document.querySelectorAll('.debt-challenge-btn');
    const timers = document.querySelectorAll('.debt-challenge-timer');
    const status = checkDebtEligibility();

    btns.forEach(btn => {
      if (status.eligible) {
        btn.disabled = false;
        btn.textContent = '🔥 借金相殺チャンスに挑戦する';
        btn.title = '3回連続でコインの表を当てれば借金全額チャラ！';
      } else {
        btn.disabled = true;
        if (status.isCooldown) {
          btn.textContent = '⏳ 挑戦クールダウン中';
        } else {
          btn.textContent = '🔒 借金相殺チャンス (条件未達成)';
          btn.title = status.reason;
        }
      }
    });

    if (status.isCooldown) {
      startCountdownTimer();
    } else {
      stopCountdownTimer();
      timers.forEach(t => {
        if (status.eligible) {
          t.textContent = '⚡ 現在挑戦可能です！';
          t.style.color = '#2ecc71';
        } else {
          t.textContent = status.reason || '';
          t.style.color = '#a0b0a6';
        }
      });
    }
  }

  window.updateDebtChallengeButtons = updateDebtChallengeButtons;

  // 3. リアルタイムカウントダウンタイマー
  function startCountdownTimer() {
    if (countdownInterval) return;

    countdownInterval = setInterval(() => {
      const status = checkDebtEligibility();
      const timers = document.querySelectorAll('.debt-challenge-timer');

      if (!status.isCooldown) {
        stopCountdownTimer();
        updateDebtChallengeButtons();
        return;
      }

      const totalSec = Math.floor(status.remainingMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      const formatted = `次回挑戦可能まで: ${String(hours).padStart(2, '0')}時間${String(mins).padStart(2, '0')}分${String(secs).padStart(2, '0')}秒`;

      timers.forEach(t => {
        t.textContent = formatted;
        t.style.color = '#ff4d4d';
      });
    }, 1000);
  }

  function stopCountdownTimer() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  // 4. モーダル起動＆初期化
  function openChallengeModal() {
    const status = checkDebtEligibility();
    if (!status.eligible) {
      if (status.isCooldown) {
        alert('現在クールダウン中です。時間経過後にお試しください。');
      } else {
        alert(status.reason || '挑戦条件を満たしていません。');
      }
      return;
    }

    const modal = document.getElementById('debt-challenge-modal');
    if (!modal) return;

    resetChallengeUI();
    modal.classList.remove('hidden');

    // ATMモーダルが開いていれば閉じる
    const atmModal = document.getElementById('atm-modal');
    if (atmModal) atmModal.classList.add('hidden');
  }

  function resetChallengeUI() {
    isTossing = false;
    const coin = document.getElementById('challenge-coin-3d');
    if (coin) {
      coin.style.transition = 'none';
      coin.style.transform = 'rotateY(0deg) rotateX(0deg)';
    }

    for (let i = 1; i <= 3; i++) {
      const badge = document.getElementById(`coin-step-${i}`);
      if (badge) {
        badge.textContent = `第${i}投: 未挑戦`;
        badge.className = 'coin-step-badge';
      }
    }

    const msg = document.getElementById('challenge-status-msg');
    if (msg) {
      msg.textContent = '「コイントス開始」を押して運命の3連勝を目指せ！';
      msg.className = 'challenge-status-msg';
    }

    const startBtn = document.getElementById('start-toss-btn');
    if (startBtn) startBtn.disabled = false;
  }

  // 5. 3Dコイントスアニメーション＆進行ロジック
  async function runChallengeSequence() {
    if (isTossing) return;

    const startBtn = document.getElementById('start-toss-btn');
    if (startBtn) startBtn.disabled = true;
    isTossing = true;

    const coin = document.getElementById('challenge-coin-3d');
    const msg = document.getElementById('challenge-status-msg');

    let currentRotationY = 0;

    for (let step = 1; step <= 3; step++) {
      msg.textContent = `🪙 第 ${step} 投目... コインが舞い上がります！`;

      // 確率判定: 各投 50% で 表 (Heads = true) または 裏 (Tails = false)
      const isHeads = Math.random() < 0.5;

      // 回転数の計算（最低5回転 = 1800度 + 結果に応じた角度）
      // 表(Heads)は 360度の倍数 (0deg), 裏(Tails)は 180度オフセット (180deg)
      const targetDeg = isHeads ? 0 : 180;
      currentRotationY += 1800 + (360 - (currentRotationY % 360)) + targetDeg;

      if (coin) {
        coin.style.transition = 'transform 2.2s cubic-bezier(0.15, 0.85, 0.35, 1.2)';
        coin.style.transform = `rotateY(${currentRotationY}deg) rotateX(720deg)`;
      }

      // コイン着地待ち
      await new Promise(r => setTimeout(r, 2300));

      const stepBadge = document.getElementById(`coin-step-${step}`);

      if (isHeads) {
        if (stepBadge) {
          stepBadge.textContent = `第${step}投: 👑 表 (成功)`;
          stepBadge.classList.add('success');
        }

        if (step < 3) {
          msg.textContent = `🎉 第 ${step} 投目成功！ 緊張の次の一投へ...`;
          await new Promise(r => setTimeout(r, 1200));
        } else {
          // 3連勝達成！！【大勝利】
          await handleChallengeSuccess();
          isTossing = false;
          return;
        }
      } else {
        // 1回でも裏（失敗） 【ペナルティ処理】
        if (stepBadge) {
          stepBadge.textContent = `第${step}投: 💀 裏 (失敗)`;
          stepBadge.classList.add('fail');
        }
        await handleChallengeFailure(step);
        isTossing = false;
        return;
      }
    }
  }

  // 6. 大勝利（借金完全帳消し）
  async function handleChallengeSuccess() {
    const msg = document.getElementById('challenge-status-msg');
    if (msg) {
      msg.innerHTML = '<span class="win-msg">🎉🎉 3連続【表】達成！！ 借金が完全帳消しになりました！ 🎉🎉</span>';
    }

    // 借金ゼロ ＆ カウントリセット
    window.playerData.debt = 0n;
    window.playerData.debtPlayCount = 0;
    window.playerData.debtChallengeFailCount = 0;
    window.playerData.nextDebtChallengeTime = 0;

    if (typeof saveData === 'function') saveData();
    if (typeof updateUI === 'function') updateUI();

    triggerWinParticles();
    updateDebtChallengeButtons();
  }

  // 7. 失敗（借金・金利2倍 ＋ クールダウン発生）
  async function handleChallengeFailure(step) {
    const msg = document.getElementById('challenge-status-msg');

    // 失敗ペナルティ計算 (BigInt安全演算)
    const currentDebt = safeToBigInt(window.playerData.debt);
    window.playerData.debt = currentDebt * 2n;

    const currentPlayCount = typeof window.playerData.debtPlayCount === 'number' ? window.playerData.debtPlayCount : 0;
    window.playerData.debtPlayCount = currentPlayCount * 2;

    const failCount = (typeof window.playerData.debtChallengeFailCount === 'number' ? window.playerData.debtChallengeFailCount : 0) + 1;
    window.playerData.debtChallengeFailCount = failCount;

    // 待機時間: 失敗回数 × 24時間 (最大168時間 = 7日間)
    const hours = Math.min(168, failCount * 24);
    const cooldownMs = hours * 3600 * 1000;
    window.playerData.nextDebtChallengeTime = Date.now() + cooldownMs;

    if (typeof saveData === 'function') saveData();
    if (typeof updateUI === 'function') updateUI();

    const formattedDebt = (typeof window.formatCurrency === 'function') ? window.formatCurrency(window.playerData.debt) : '$' + window.playerData.debt.toLocaleString();

    if (msg) {
      msg.innerHTML = `<span class="lose-msg">💀 残念！第${step}投で裏が出ました...<br>借金と金利が2倍(${formattedDebt})に倍増し、${hours}時間の挑戦ロックが適用されます。</span>`;
    }

    updateDebtChallengeButtons();
  }

  // 紙吹雪・粒子エフェクト
  function triggerWinParticles() {
    const container = document.getElementById('particle-container') || document.body;
    const items = ['🎉', '🪙', '✨', '💎', '👑'];

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

  // イベントリスナーの登録
  document.addEventListener('DOMContentLoaded', () => {
    // 救済ボタンのクリックイベント
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('.debt-challenge-btn')) {
        openChallengeModal();
      }
    });

    const closeBtn = document.getElementById('close-debt-challenge-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (isTossing) {
          if (!confirm('コイントス実行中です。途中で閉じますか？（結果は保存されません）')) return;
        }
        document.getElementById('debt-challenge-modal').classList.add('hidden');
      });
    }

    const startBtn = document.getElementById('start-toss-btn');
    if (startBtn) {
      startBtn.addEventListener('click', runChallengeSequence);
    }

    setTimeout(updateDebtChallengeButtons, 300);
  });

})();
