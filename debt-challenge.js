/**
 * ==========================================
 * Fever Casino - 借金相殺チャンス（3Dコイントス救済システム）
 * BigInt & 超巨大数値完全対応版 (debt-challenge.js)
 * ==========================================
 */

(function () {
  let isTossing = false;
  let timerInterval = null;
  let currentCoinRotation = 0;

  function safeToBigInt(v) {
    if (typeof window.toBigInt === 'function') return window.toBigInt(v);
    try { return BigInt(v || 0); } catch (e) { return 0n; }
  }

  // 1. 救済モーダルDOMを自動生成
  function createChallengeModalDOM() {
    if (document.getElementById('debt-challenge-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'debt-challenge-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content challenge-modal-content">
        <div class="modal-header">
          <h2>🔥 借金相殺チャンス (コイントス3連続)</h2>
          <button type="button" id="close-challenge-btn" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p class="challenge-desc">
            <b>3回連続で「表（👑）」</b>を出せば<b>借金全額チャラ！</b><br>
            <span class="warning-text">※1回でも「裏（💀）」が出ると<b>借金＆金利が2倍</b>になり、長時間挑戦不可となります。</span>
          </p>

          <div class="coins-history">
            <div class="coin-step-badge" id="step-badge-1">1回目: -</div>
            <div class="coin-step-badge" id="step-badge-2">2回目: -</div>
            <div class="coin-step-badge" id="step-badge-3">3回目: -</div>
          </div>

          <!-- 3D コインステージ -->
          <div class="coin-stage">
            <div class="coin-3d" id="coin-3d">
              <div class="coin-face coin-front">👑<br><span class="face-label">表</span></div>
              <div class="coin-face coin-back">💀<br><span class="face-label">裏</span></div>
            </div>
          </div>

          <div id="challenge-status-msg" class="challenge-status-msg">
            覚悟を決めて「コイントス開始」を押してください！
          </div>

          <div class="challenge-action-row">
            <button type="button" id="start-toss-btn" class="start-toss-btn">🎲 コイントス開始 (一発勝負)</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('close-challenge-btn').addEventListener('click', closeChallengeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', () => {
      if (!isTossing) closeChallengeModal();
    });
    document.getElementById('start-toss-btn').addEventListener('click', executeCoinTossChallenge);
  }

  // 2. モーダル表示制御
  window.openDebtChallengeModal = function () {
    if (isTossing) return;

    const now = Date.now();
    const nextTime = window.playerData?.nextDebtChallengeTime || 0;

    if (now < nextTime) {
      alert('現在はペナルティ待機時間中です。次回挑戦可能になるまでお待ちください。');
      return;
    }

    createChallengeModalDOM();
    resetChallengeUI();

    const modal = document.getElementById('debt-challenge-modal');
    if (modal) modal.classList.remove('hidden');
  };

  function closeChallengeModal() {
    if (isTossing) return;
    const modal = document.getElementById('debt-challenge-modal');
    if (modal) modal.classList.add('hidden');
  }

  function resetChallengeUI() {
    isTossing = false;
    currentCoinRotation = 0;
    const coin = document.getElementById('coin-3d');
    if (coin) {
      coin.style.transition = 'none';
      coin.style.transform = 'rotateY(0deg)';
    }

    for (let i = 1; i <= 3; i++) {
      const badge = document.getElementById(`step-badge-${i}`);
      if (badge) {
        badge.textContent = `${i}回目: -`;
        badge.className = 'coin-step-badge';
      }
    }

    const msg = document.getElementById('challenge-status-msg');
    if (msg) msg.textContent = '覚悟を決めて「コイントス開始」を押してください！';

    const btn = document.getElementById('start-toss-btn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🎲 コイントス開始 (一発勝負)';
    }
  }

  // 3. 3Dコイントス実行ロジック
  async function executeCoinTossChallenge() {
    if (isTossing) return;
    isTossing = true;

    const tossBtn = document.getElementById('start-toss-btn');
    const closeBtn = document.getElementById('close-challenge-btn');
    tossBtn.disabled = true;
    closeBtn.disabled = true;

    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const coin = document.getElementById('coin-3d');
    const msg = document.getElementById('challenge-status-msg');

    let allSuccess = true;

    for (let step = 1; step <= 3; step++) {
      msg.textContent = `🪙 【${step}回目】 コイントス中...！`;

      // 50%の確率で「表(isHeads = true)」
      const isHeads = Math.random() < 0.5;

      // 3D回転アングル計算 (5回転以上 + 表裏の補正)
      const extraSpins = 5 + Math.floor(Math.random() * 3);
      const targetDegree = currentCoinRotation + (extraSpins * 360) + (isHeads ? (360 - (currentCoinRotation % 360)) : (360 - (currentCoinRotation % 360) + 180));
      currentCoinRotation = targetDegree;

      coin.style.transition = 'transform 1.8s cubic-bezier(0.15, 0.85, 0.35, 1.15)';
      coin.style.transform = `rotateY(${targetDegree}deg)`;

      await delay(1900); // アニメーション待ち

      const badge = document.getElementById(`step-badge-${step}`);

      if (isHeads) {
        if (badge) {
          badge.textContent = `${step}回目: 👑 表 (成功)`;
          badge.classList.add('success');
        }

        if (step < 3) {
          msg.textContent = `🎉 ${step}回目「表」成功！ 息をのむ第${step + 1}回目へ...`;
          await delay(1200); // タメの時間
        }
      } else {
        if (badge) {
          badge.textContent = `${step}回目: 💀 裏 (失敗)`;
          badge.classList.add('fail');
        }
        allSuccess = false;
        break; // 1回でも失敗したら即終了
      }
    }

    // 4. 勝敗判定 ＆ ペナルティ処理
    if (allSuccess) {
      // 【大勝利】借金完全チャラ
      window.playerData.debt = 0n;
      window.playerData.debtPlayCount = 0;
      window.playerData.debtChallengeFailCount = 0;
      window.playerData.nextDebtChallengeTime = 0;

      msg.innerHTML = `<span class="win-msg">🎉🎉 大勝利！！ 🎉🎉<br>借金が完全帳消しになりました！</span>`;
      if (typeof window.triggerWinEffects === 'function') window.triggerWinEffects();
    } else {
      // 【失敗ペナルティ】
      const currentDebt = safeToBigInt(window.playerData.debt);
      window.playerData.debt = currentDebt * 2n; // 借金2倍
      window.playerData.debtPlayCount = (window.playerData.debtPlayCount || 0) * 2; // 金利ペナルティ2倍

      const failCount = (window.playerData.debtChallengeFailCount || 0) + 1;
      window.playerData.debtChallengeFailCount = failCount;

      // 待機時間計算 (失敗回数 × 24時間。最大168時間=7日間)
      const waitHours = Math.min(failCount * 24, 168);
      window.playerData.nextDebtChallengeTime = Date.now() + (waitHours * 3600 * 1000);

      const formattedNewDebt = (typeof window.formatCurrency === 'function')
        ? window.formatCurrency(window.playerData.debt)
        : '$' + window.playerData.debt.toLocaleString();

      msg.innerHTML = `<span class="lose-msg">💀 挑戦失敗... 💀<br>借金が2倍 (${formattedNewDebt}) に膨れ上がりました！<br>次回挑戦まで ${waitHours} 時間ロックされます。</span>`;
    }

    if (typeof window.saveData === 'function') window.saveData();
    if (typeof window.updateUI === 'function') window.updateUI();

    isTossing = false;
    closeBtn.disabled = false;
    tossBtn.textContent = '閉じる';
    tossBtn.disabled = false;
    tossBtn.onclick = closeChallengeModal;
  }

  // 5. タイマー ＆ ボタン自動生成・状態監視
  function updateDebtChallengeButtons() {
    const debt = safeToBigInt(window.playerData?.debt);
    const playCount = window.playerData?.debtPlayCount || 0;
    const nextTime = window.playerData?.nextDebtChallengeTime || 0;
    const now = Date.now();

    // 未返済プレイ15回以上 & 借金あり で条件解禁
    const isEligible = (playCount >= 15 && debt > 0n);

    // ATMモーダルやロビー内の救済枠コンテナを探す / 自動生成
    let challengeContainers = document.querySelectorAll('.debt-challenge-widget-container');

    challengeContainers.forEach(container => {
      if (!isEligible && debt === 0n) {
        container.classList.add('hidden');
        return;
      }
      container.classList.remove('hidden');

      const btn = container.querySelector('.debt-challenge-btn');
      const timerEl = container.querySelector('.debt-challenge-timer');

      if (!isEligible) {
        if (btn) {
          btn.disabled = true;
          btn.textContent = `🔥 借金相殺チャンス (金利15以上で解放: 現在${playCount}/15)`;
        }
        if (timerEl) timerEl.textContent = '';
        return;
      }

      if (now < nextTime) {
        // クールダウン中
        const diffMs = nextTime - now;
        const totalSec = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;

        const timeStr = `${hours}時間${String(mins).padStart(2, '0')}分${String(secs).padStart(2, '0')}秒`;

        if (btn) {
          btn.disabled = true;
          btn.textContent = `🔒 借金相殺チャンス (ロック中)`;
        }
        if (timerEl) {
          timerEl.textContent = `次回挑戦可能まで: ${timeStr}`;
        }
      } else {
        // 挑戦可能
        if (btn) {
          btn.disabled = false;
          btn.textContent = `🔥 借金相殺チャンスに挑戦する！`;
        }
        if (timerEl) {
          timerEl.textContent = `⚡ 3連続「表」で借金チャラ！ (一発逆転)`;
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    createChallengeModalDOM();
    updateDebtChallengeButtons();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateDebtChallengeButtons, 1000);
  });

  window.updateDebtChallengeButtons = updateDebtChallengeButtons;
})();
