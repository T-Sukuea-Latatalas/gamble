/**
 * ==========================================
 * Fever Casino - 3Dコイントス救済システム (debt-challenge.js)
 * 明るいライティング ＆ 金銭表現統一版
 * ==========================================
 */

(function () {
  let isTossing = false;
  let countdownInterval = null;

  // Three.js 関連変数
  let scene, camera, renderer;
  let coinMesh, oceanMesh, cliffMesh;
  let animFrameId = null;
  let waveTime = 0;

  // Web Audio API 関連変数
  let audioCtx = null;
  let ambientGainNode = null;
  let ambientSourceNode = null;

  // 1. 安全な BigInt 変換関数
  function safeToBigInt(v) {
    if (typeof window.toBigInt === 'function') return window.toBigInt(v);
    try { return BigInt(v || 0); } catch (e) { return 0n; }
  }

  // 2. 救済条件のチェック
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

  // 3. ボタン ＆ タイマーUIのリアルタイム更新
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

  // カウントダウンタイマー制御
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

  /* ==========================================
   * 4. Web Audio API による効果音 ＆ BGMリアルタイム合成機能
   * ========================================== */
  function initAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // 環境音合成
  function startAmbientSounds() {
    initAudioContext();
    if (!audioCtx) return;

    stopAmbientSounds();

    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    ambientSourceNode = audioCtx.createBufferSource();
    ambientSourceNode.buffer = noiseBuffer;
    ambientSourceNode.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, audioCtx.currentTime);

    const lfo = audioCtx.createOscillator();
    lfo.frequency.setValueAtTime(0.2, audioCtx.currentTime);
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(150, audioCtx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    ambientGainNode = audioCtx.createGain();
    ambientGainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);

    ambientSourceNode.connect(filter);
    filter.connect(ambientGainNode);
    ambientGainNode.connect(audioCtx.destination);

    ambientSourceNode.start();
  }

  function stopAmbientSounds() {
    if (ambientGainNode && audioCtx) {
      ambientGainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
      setTimeout(() => {
        if (ambientSourceNode) {
          try { ambientSourceNode.stop(); } catch (e) {}
          ambientSourceNode = null;
        }
      }, 500);
    }
  }

  // コイントス金属音
  function playCoinTossSound() {
    initAudioContext();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  }

  // コイン着地/判定音
  function playCoinLandSound() {
    initAudioContext();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  }

  // 成功時ファンファーレ
  function playWinFanfare() {
    initAudioContext();
    if (!audioCtx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.12);

      gain.gain.setValueAtTime(0.25, audioCtx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.12 + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(audioCtx.currentTime + idx * 0.12);
      osc.stop(audioCtx.currentTime + idx * 0.12 + 0.6);
    });
  }

  // 失敗時衝撃音
  function playPushSound() {
    initAudioContext();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  }

  // 落下時の音
  function playFallingWindSound() {
    initAudioContext();
    if (!audioCtx) return;

    const bufferSize = audioCtx.sampleRate * 2.5;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2500, audioCtx.currentTime + 2.0);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.8, audioCtx.currentTime + 1.8);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2.2);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    src.start();
  }

  // 着水音
  function playSplashSound() {
    initAudioContext();
    if (!audioCtx) return;

    const bufferSize = audioCtx.sampleRate * 1.5;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 1.2);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    src.start();
  }

  /* ==========================================
   * 5. Three.js 3D空間の構築（明るさ大幅強化）
   * ========================================== */
  function init3DScene() {
    const container = document.getElementById('debt-challenge-3d-canvas');
    if (!container) return;

    container.innerHTML = '';

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 500;

    // 明るく見やすい夕暮れ〜黄昏時の空背景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x23384d);
    scene.fog = new THREE.FogExp2(0x23384d, 0.003); // 超極薄フォグ

    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 2.2, 7.5);
    camera.lookAt(0, 0, -20);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 強力なアンビエント＆ヘミスフィアライトで全体を均一に明るく
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 1.2);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffae6, 2.2);
    sunLight.position.set(20, 40, 20);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // コイン照射用ポイントライト
    const coinLight = new THREE.PointLight(0xffd700, 2.5, 20);
    coinLight.position.set(0, 4, 6);
    scene.add(coinLight);

    // 明るい地面（スタンド）
    const cliffGeo = new THREE.BoxGeometry(20, 30, 15);
    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0x8a735c, // 明るめの岩・土色
      roughness: 0.6,
      metalness: 0.1
    });
    cliffMesh = new THREE.Mesh(cliffGeo, cliffMat);
    cliffMesh.position.set(0, -15, 2.5);
    scene.add(cliffMesh);

    // 明るいマリンブルーの海面
    const oceanGeo = new THREE.PlaneGeometry(300, 300, 48, 48);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0088cc, // 明るい青
      roughness: 0.1,
      metalness: 0.6
    });
    oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.set(0, -28, -50);
    scene.add(oceanMesh);

    // 3Dコインメッシュ作成
    createCoinMesh();

    if (animFrameId) cancelAnimationFrame(animFrameId);
    animate3D();

    window.addEventListener('resize', onWindowResize);
  }

  // 3Dコインの生成（表/裏識別テクスチャ付き）
  function createCoinMesh() {
    const coinGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 32);

    const headsTex = createCoinFaceTexture('👑', '表', '#ffe082', '#ffb300');
    const tailsTex = createCoinFaceTexture('💀', '裏', '#78909c', '#ff5252');

    const sideMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
    const headsMat = new THREE.MeshStandardMaterial({ map: headsTex, metalness: 0.8, roughness: 0.2 });
    const tailsMat = new THREE.MeshStandardMaterial({ map: tailsTex, metalness: 0.8, roughness: 0.2 });

    coinMesh = new THREE.Mesh(coinGeo, [sideMat, headsMat, tailsMat]);
    coinMesh.position.set(0, 1.2, 4.8);
    scene.add(coinMesh);
  }

  // 2D Canvas によるコイン面テクスチャ動的生成
  function createCoinFaceTexture(icon, text, bg1, bg2) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, bg1);
    grad.addColorStop(1, bg2);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#dfb15b';
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.font = '80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 128, 110);

    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, 128, 190);

    return new THREE.CanvasTexture(canvas);
  }

  // 3Dアニメーションループ
  function animate3D() {
    animFrameId = requestAnimationFrame(animate3D);

    waveTime += 0.03;
    if (oceanMesh) {
      const pos = oceanMesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i);
        const v = pos.getY(i);
        const z = Math.sin(u * 0.1 + waveTime) * 0.5 + Math.cos(v * 0.1 + waveTime) * 0.5;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
    }

    if (!isTossing && coinMesh) {
      coinMesh.rotation.y += 0.012;
      coinMesh.position.y = 1.2 + Math.sin(waveTime * 2) * 0.08;
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function onWindowResize() {
    const container = document.getElementById('debt-challenge-3d-canvas');
    if (!container || !renderer || !camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  /* ==========================================
   * 6. モーダル起動 ＆ 初期化
   * ========================================== */
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

    const atmModal = document.getElementById('atm-modal');
    if (atmModal) atmModal.classList.add('hidden');

    setTimeout(() => {
      init3DScene();
      startAmbientSounds();
    }, 50);
  }

  function resetChallengeUI() {
    isTossing = false;

    const splash = document.getElementById('cliff-water-splash');
    const dark = document.getElementById('cliff-dark-overlay');
    const content = document.querySelector('.cliff-modal-content');

    if (splash) splash.classList.remove('show');
    if (dark) dark.classList.remove('show');
    if (content) content.classList.remove('plunge-shaking');

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

  /* ==========================================
   * 7. 3Dコイントス進行ロジック
   * ========================================== */
  async function runChallengeSequence() {
    if (isTossing) return;

    const startBtn = document.getElementById('start-toss-btn');
    if (startBtn) startBtn.disabled = true;
    isTossing = true;

    const msg = document.getElementById('challenge-status-msg');

    for (let step = 1; step <= 3; step++) {
      msg.textContent = `🪙 第 ${step} 投目... コインが舞い上がります！`;
      playCoinTossSound();

      // 50% 確率判定
      const isHeads = Math.random() < 0.5;

      await animateCoinToss(isHeads);

      playCoinLandSound();

      const stepBadge = document.getElementById(`coin-step-${step}`);

      if (isHeads) {
        if (stepBadge) {
          stepBadge.textContent = `第${step}投: 👑 表 (成功)`;
          stepBadge.classList.add('success');
        }

        if (step < 3) {
          msg.textContent = `🎉 第 ${step} 投目成功！ 緊張の次の一投へ...`;
          await new Promise(r => setTimeout(r, 1000));
        } else {
          // 3連勝達成！！【成功】
          await handleChallengeSuccess();
          isTossing = false;
          return;
        }
      } else {
        // 1回でも裏（失敗）
        if (stepBadge) {
          stepBadge.textContent = `第${step}投: 💀 裏 (失敗)`;
          stepBadge.classList.add('fail');
        }

        msg.textContent = `💀 第 ${step} 投で裏が出ました... チャレンジ失敗です！`;
        await new Promise(r => setTimeout(r, 800));

        await runFallingAnimation();

        await handleChallengeFailure(step);
        isTossing = false;
        return;
      }
    }
  }

  // コインの飛翔 ＆ 回転物理アニメーション
  function animateCoinToss(isHeads) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const duration = 2000;

      const startY = 1.2;
      const peakY = 6.5;

      const targetRotX = isHeads ? Math.PI * 12 : Math.PI * 13;

      function stepAnim(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const currentY = startY + (4 * (peakY - startY) * progress * (1 - progress));
        coinMesh.position.y = currentY;

        coinMesh.rotation.x = progress * targetRotX;
        coinMesh.rotation.y = progress * Math.PI * 8;

        if (progress < 1) {
          requestAnimationFrame(stepAnim);
        } else {
          coinMesh.position.y = startY;
          coinMesh.rotation.x = isHeads ? 0 : Math.PI;
          coinMesh.rotation.y = 0;
          resolve();
        }
      }

      requestAnimationFrame(stepAnim);
    });
  }

  /* ==========================================
   * 8. 失敗時の演出
   * ========================================== */
  function runFallingAnimation() {
    return new Promise((resolve) => {
      playPushSound();

      const modalContent = document.querySelector('.cliff-modal-content');
      if (modalContent) modalContent.classList.add('plunge-shaking');

      playFallingWindSound();

      const startCamPos = camera.position.clone();
      const startCamRotX = camera.rotation.x;

      const startTime = performance.now();
      const duration = 2200;

      function fallStep(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const fallEase = progress * progress;

        camera.rotation.x = startCamRotX - fallEase * 0.8;
        camera.rotation.z = Math.sin(progress * 20) * 0.15;

        camera.position.y = startCamPos.y - fallEase * 28;
        camera.position.z = startCamPos.z - fallEase * 20;

        if (progress > 0.85) {
          const splash = document.getElementById('cliff-water-splash');
          if (splash && !splash.classList.contains('show')) {
            splash.classList.add('show');
            playSplashSound();
          }
        }

        if (progress < 1) {
          requestAnimationFrame(fallStep);
        } else {
          const dark = document.getElementById('cliff-dark-overlay');
          if (dark) dark.classList.add('show');

          setTimeout(() => {
            if (modalContent) modalContent.classList.remove('plunge-shaking');
            resolve();
          }, 800);
        }
      }

      requestAnimationFrame(fallStep);
    });
  }

  /* ==========================================
   * 9. 大勝利（借金完全帳消し）
   * ========================================== */
  async function handleChallengeSuccess() {
    playWinFanfare();

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

    setTimeout(() => {
      closeChallengeModal();
    }, 3500);
  }

  /* ==========================================
   * 10. 失敗（借金・金利2倍 ＋ クールダウン発生）
   * ========================================== */
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
      msg.innerHTML = `<span class="lose-msg">💀 チャレンジ失敗！第${step}投で裏が出ました...<br>借金と金利が2倍(${formattedDebt})に倍増し、${hours}時間の挑戦ロックが適用されます。</span>`;
    }

    updateDebtChallengeButtons();

    setTimeout(() => {
      closeChallengeModal();
    }, 3000);
  }

  function closeChallengeModal() {
    stopAmbientSounds();

    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    const modal = document.getElementById('debt-challenge-modal');
    if (modal) modal.classList.add('hidden');
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

  /* ==========================================
   * 11. イベントリスナー登録
   * ========================================== */
  document.addEventListener('DOMContentLoaded', () => {
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
        closeChallengeModal();
      });
    }

    const startBtn = document.getElementById('start-toss-btn');
    if (startBtn) {
      startBtn.addEventListener('click', runChallengeSequence);
    }

    setTimeout(updateDebtChallengeButtons, 300);
  });

})();
