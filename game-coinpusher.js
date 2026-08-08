/**
 * ==========================================
 * Fever Casino - 3D コインプッシャー PRO 制御スクリプト (game-coinpusher.js)
 * 2段スライド物理構造 (天面上乗載・奥壁せき止め・溢れ落ち ＆ 下段押し出し連鎖) 対応版
 * ==========================================
 */

(function () {
  // --- Three.js 基本変数 ---
  let scene, camera, renderer;
  let animFrameId = null;

  // --- メッシュ参照 ---
  let pusherMesh;          // 前後往復プッシャーテーブル
  let screwMesh;           // 3D螺旋エレベーター
  let rouletteWheelMesh;   // 3D木製ギヤ型ルーレット (全体親グループ)
  let rouletteDiscGroup;   // 3D木製ギヤ型ルーレット (回転ディスク部分)
  let digitalSignMesh;     // 3D液晶カウンター看板
  let digitalSignCanvas, digitalSignCtx, digitalSignTexture;
  let dropGuideGroup;      // 立体投下ネオンガイドマーカー

  // --- ゲーム物理状態・演出変数 ---
  let isAutoPushing = false;
  let autoPushInterval = null;

  // プッシャー位置設定（深型スライド構造）
  const PUSHER_DEPTH = 3.2;   // プッシャー奥行き寸法
  const PUSHER_MIN_Z = -3.2;
  const PUSHER_MAX_Z = -1.8;
  let pusherZ = -2.5;
  let pusherDir = 1;

  // 投下X位置状態（-2.1 ～ 2.1）
  let dropGuideX = 0;
  let isPointerDown = false;

  // フィールド・エッジ・高さ物理定数
  const PUSHER_TOP_Y = 1.15;   // プッシャー板の天面（上面）Y高さ
  const LOWER_FLOOR_Y = 0.05;  // 下段メインフィールド床Y高さ
  const BACK_WALL_Z = -3.85;   // 奥の固定せき止め壁前面Z位置
  const LOWER_EDGE_Z = 3.0;    // 下段手前獲得エッジ

  let currentCoinCost = 10n;
  let currentSessionProfit = 0n;

  let coins3D = [];  // 3Dメダル配列 [{ mesh, x, y, z, vx, vy, vz, r, cost, type }]
  let balls3D = [];  // 配当ボール配列 [{ mesh, x, y, z, vx, vy, vz, state }]

  // 払い出し用キュー (ジャラジャラ連続落下演出)
  let payoutBurstQueue = 0;
  let payoutTimer = 0;

  // ルーレット抽選状態
  let isWheelSpinning = false;
  let wheelTargetAngle = 0;
  let wheelCurrentAngle = 0;
  let activeRouletteBall = null;

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

    const countEl = document.getElementById('stat-coins-count');
    const payEl = document.getElementById('stat-payout');
    if (countEl) countEl.textContent = coins3D.length;
    if (payEl) payEl.textContent = formatMoney(currentSessionProfit);

    updateDigitalSignboard();
  }

  /* ==========================================
   * 1. Three.js 3D空間 ＆ 画角調整
   * ========================================== */
  function init3DScene() {
    const container = document.getElementById('pusher-3d-canvas');
    if (!container) return;

    container.innerHTML = '';
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 480;

    // 場面設定
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c14);

    // ★ カメラ画角（ルーレット、看板、フィールド、トレイまでが一画面に収まる最適画角） ★
    camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 1000);
    camera.position.set(0, 9.2, 11.2);
    camera.lookAt(0, 2.2, -0.5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // ライティング
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.3);
    scene.add(ambientLight);

    const mainSpot = new THREE.SpotLight(0xfffae6, 2.4);
    mainSpot.position.set(0, 16, 9);
    mainSpot.angle = Math.PI / 3;
    mainSpot.penumbra = 0.4;
    mainSpot.castShadow = true;
    scene.add(mainSpot);

    const blueSideLight = new THREE.PointLight(0x05d9e8, 1.6, 16);
    blueSideLight.position.set(-4, 6, 2);
    scene.add(blueSideLight);

    const goldSideLight = new THREE.PointLight(0xdfb15b, 1.6, 16);
    goldSideLight.position.set(4, 6, 2);
    scene.add(goldSideLight);

    // 3D 筐体構造の組み立て
    build3DCabinet();

    // ネオン投下ガイドの構築
    buildDropGuide();

    // 初期配置メダル生成
    initFieldCoins();

    // 3Dキャンバス直接タッチ/ドラッグイベントの登録
    setupPointerEvents();

    if (animFrameId) cancelAnimationFrame(animFrameId);
    animate3D();

    window.addEventListener('resize', onWindowResize);
  }

  /* ==========================================
   * 2. 3D筐体モデル・ギミックパーツ・カラー改修
   * ========================================== */
  function build3DCabinet() {
    // A. クラフト木目マテリアル
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4e2813,
      roughness: 0.65,
      metalness: 0.1
    });

    const innerWoodMat = new THREE.MeshStandardMaterial({
      color: 0x2d170a,
      roughness: 0.8,
      metalness: 0.05
    });

    // B. プッシャー台用ダークガンメタリック
    const pusherDarkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x2a2f3a,
      metalness: 0.9,
      roughness: 0.2
    });

    // C. 傾斜トレイ用ゴールド金属
    const goldMetalMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b,
      metalness: 0.85,
      roughness: 0.25
    });

    // 筐体メインバックボード ＆ サイド壁
    const backGeo = new THREE.BoxGeometry(7.2, 10, 0.6);
    const backMesh = new THREE.Mesh(backGeo, woodMat);
    backMesh.position.set(0, 4, -4.2);
    scene.add(backMesh);

    const leftWallGeo = new THREE.BoxGeometry(0.5, 8, 8);
    const leftWallMesh = new THREE.Mesh(leftWallGeo, woodMat);
    leftWallMesh.position.set(-3.5, 3, 0);
    scene.add(leftWallMesh);

    const rightWallMesh = leftWallMesh.clone();
    rightWallMesh.position.set(3.5, 3, 0);
    scene.add(rightWallMesh);

    // 下段メインテーブル (Main Field)
    const lowerTableGeo = new THREE.BoxGeometry(5.0, 0.4, 4.8);
    const lowerTableMesh = new THREE.Mesh(lowerTableGeo, innerWoodMat);
    lowerTableMesh.position.set(0, -0.2, 0.6);
    scene.add(lowerTableMesh);

    // 上段土台テーブル (Upper Base Field)
    const upperTableGeo = new THREE.BoxGeometry(4.8, 0.3, 2.2);
    const upperTableMesh = new THREE.Mesh(upperTableGeo, innerWoodMat);
    upperTableMesh.position.set(0, 0.75, -2.6);
    scene.add(upperTableMesh);

    // ★ 可動スライドプッシャー板 (幅4.6, 高さ0.5, 奥行き3.2 -> 天面Y = 0.9 + 0.25 = 1.15) ★
    const pusherGeo = new THREE.BoxGeometry(4.6, 0.5, PUSHER_DEPTH);
    pusherMesh = new THREE.Mesh(pusherGeo, pusherDarkMetalMat);
    pusherMesh.position.set(0, 0.9, PUSHER_MAX_Z);
    pusherMesh.castShadow = true;
    scene.add(pusherMesh);

    // 手前獲得斜め傾斜トレイ
    const rampGeo = new THREE.BoxGeometry(4.8, 0.2, 2.0);
    const rampMesh = new THREE.Mesh(rampGeo, goldMetalMat);
    rampMesh.position.set(0, -0.6, 3.8);
    rampMesh.rotation.x = 0.35;
    scene.add(rampMesh);

    // 筐体左奥: 3D螺旋スクリューエレベーター
    buildScrewElevator();

    // 筐体上部: 大型木製ギヤ型ルーレット
    buildRouletteWheel();

    // 筐体右上: 3D液晶デジタルカウンターボード
    buildDigitalSignboard();
  }

  // 3D螺旋スクリューエレベーターの組み立て
  function buildScrewElevator() {
    const columnGeo = new THREE.CylinderGeometry(0.35, 0.35, 7.5, 16);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x05d9e8, transparent: true, opacity: 0.4, roughness: 0.1 });
    const pipeMesh = new THREE.Mesh(columnGeo, pipeMat);
    pipeMesh.position.set(-2.8, 3.2, -1.8);
    scene.add(pipeMesh);

    const screwGroup = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfb15b, metalness: 0.8, roughness: 0.2 });

    for (let i = 0; i < 35; i++) {
      const stepGeo = new THREE.BoxGeometry(0.6, 0.08, 0.25);
      const stepMesh = new THREE.Mesh(stepGeo, bladeMat);
      stepMesh.position.y = -3.5 + i * 0.2;
      stepMesh.rotation.y = i * 0.4;
      screwGroup.add(stepMesh);
    }

    screwGroup.position.set(-2.8, 3.2, -1.8);
    screwMesh = screwGroup;
    scene.add(screwMesh);
  }

  // 大型木製ギヤ型ルーレットの組み立て（正円回転構造）
  function buildRouletteWheel() {
    const mainGroup = new THREE.Group();
    const discGroup = new THREE.Group(); // 回転体専用子グループ

    // ギヤ歯車ディスク
    const gearBaseGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.25, 24);
    const gearMat = new THREE.MeshStandardMaterial({ color: 0x6d3a1f, roughness: 0.5, metalness: 0.2 });
    const gearBase = new THREE.Mesh(gearBaseGeo, gearMat);
    discGroup.add(gearBase);

    // 歯車の突起歯
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xdfb15b, metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < 12; i++) {
      const toothGeo = new THREE.BoxGeometry(0.3, 0.22, 0.4);
      const tooth = new THREE.Mesh(toothGeo, toothMat);
      const angle = (i / 12) * Math.PI * 2;
      tooth.position.set(Math.cos(angle) * 1.85, 0, Math.sin(angle) * 1.85);
      tooth.rotation.y = -angle;
      discGroup.add(tooth);
    }

    // 中央ポケット枠
    const pocketMat = new THREE.MeshStandardMaterial({ color: 0x25130a, roughness: 0.6 });
    const innerRingGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.28, 16);
    const innerRing = new THREE.Mesh(innerRingGeo, pocketMat);
    discGroup.add(innerRing);

    mainGroup.add(discGroup);
    mainGroup.position.set(0, 6.2, -2.2);
    mainGroup.rotation.x = 0.45; // 全体傾斜角度

    rouletteWheelMesh = mainGroup;
    rouletteDiscGroup = discGroup; // ローカルY軸で回転させる対象
    scene.add(rouletteWheelMesh);
  }

  // 3D液晶デジタルカウンターボードの構築
  function buildDigitalSignboard() {
    digitalSignCanvas = document.createElement('canvas');
    digitalSignCanvas.width = 256;
    digitalSignCanvas.height = 128;
    digitalSignCtx = digitalSignCanvas.getContext('2d');

    digitalSignTexture = new THREE.CanvasTexture(digitalSignCanvas);

    const boardGeo = new THREE.BoxGeometry(2.0, 1.0, 0.15);
    const boardMat = new THREE.MeshBasicMaterial({ map: digitalSignTexture });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xdfb15b, metalness: 0.8 });

    digitalSignMesh = new THREE.Mesh(boardGeo, [frameMat, frameMat, frameMat, frameMat, boardMat, frameMat]);
    digitalSignMesh.position.set(2.4, 5.8, -2.0);
    digitalSignMesh.rotation.y = -0.25;
    scene.add(digitalSignMesh);

    updateDigitalSignboard();
  }

  function updateDigitalSignboard() {
    if (!digitalSignCtx) return;

    digitalSignCtx.fillStyle = '#050a12';
    digitalSignCtx.fillRect(0, 0, 256, 128);

    digitalSignCtx.strokeStyle = '#05d9e8';
    digitalSignCtx.lineWidth = 6;
    digitalSignCtx.strokeRect(4, 4, 248, 120);

    digitalSignCtx.font = 'bold 22px sans-serif';
    digitalSignCtx.fillStyle = '#dfb15b';
    digitalSignCtx.textAlign = 'center';
    digitalSignCtx.fillText('FEVER COUNTER', 128, 32);

    const winVal = document.getElementById('stat-jackpot-win')?.textContent || '-';
    digitalSignCtx.font = 'bold 36px monospace';
    digitalSignCtx.fillStyle = '#05d9e8';
    digitalSignCtx.fillText(winVal, 128, 85);

    if (digitalSignTexture) digitalSignTexture.needsUpdate = true;
  }

  // 投下ガイドラインの構築（ネオンサイアン立体マーカー ＆ ビーム）
  function buildDropGuide() {
    dropGuideGroup = new THREE.Group();

    // 1. 下向きポインター矢印
    const coneGeo = new THREE.ConeGeometry(0.18, 0.4, 16);
    const cyanEmissiveMat = new THREE.MeshBasicMaterial({ color: 0x05d9e8 });
    const pointerMesh = new THREE.Mesh(coneGeo, cyanEmissiveMat);
    pointerMesh.rotation.x = Math.PI; // 下向き
    pointerMesh.position.y = 4.2;
    dropGuideGroup.add(pointerMesh);

    // 2. 垂直透過ネオンガイドビーム
    const beamGeo = new THREE.CylinderGeometry(0.015, 0.015, 3.8, 8);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x05d9e8, transparent: true, opacity: 0.45 });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.y = 2.2;
    dropGuideGroup.add(beamMesh);

    dropGuideGroup.position.set(0, 0, -3.2);
    scene.add(dropGuideGroup);
  }

  /* ==========================================
   * 3. メダル（リアル小型化） ＆ ボールの3D初期配置
   * ========================================== */
  function initFieldCoins() {
    coins3D.forEach(c => scene.remove(c.mesh));
    balls3D.forEach(b => scene.remove(b.mesh));
    coins3D = [];
    balls3D = [];

    // ★ 上段スライド板の上 ＆ 下段フィールド上にリアルバランスでメダル100枚初期配置 ★
    for (let i = 0; i < 100; i++) {
      const type = Math.random() < 0.12 ? 'DIAMOND' : 'NORMAL';
      const isUpper = i < 30; // 30枚は上段スライド板の上に乗載

      const posX = (Math.random() - 0.5) * 3.6;
      const posZ = isUpper ? -3.0 + Math.random() * 1.2 : -1.0 + Math.random() * 3.5;
      const posY = isUpper ? PUSHER_TOP_Y : LOWER_FLOOR_Y;

      create3DCoinMesh(posX, posY, posZ, currentCoinCost, type);
    }

    // 初期フィールド配当ボール 2個配置
    create3DBallMesh(-1.0, LOWER_FLOOR_Y + 0.15, 0.8);
    create3DBallMesh(1.2, LOWER_FLOOR_Y + 0.15, 1.8);
  }

  function create3DCoinMesh(x, y, z, cost, type) {
    const r = type === 'MEGA' ? 0.18 : 0.12;
    const h = 0.035;
    const coinGeo = new THREE.CylinderGeometry(r, r, h, 16);

    let matColor = 0xffd700; // 輝く明るいゴールド
    if (type === 'DIAMOND') matColor = 0x05d9e8;
    if (type === 'MEGA') matColor = 0xff2a6d;

    const coinMat = new THREE.MeshStandardMaterial({
      color: matColor,
      metalness: 0.9,
      roughness: 0.15
    });

    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    scene.add(mesh);

    coins3D.push({
      mesh: mesh,
      x: x, y: y, z: z,
      vx: 0, vy: 0, vz: 0,
      r: r,
      cost: cost,
      type: type
    });
  }

  function create3DBallMesh(x, y, z) {
    const ballGeo = new THREE.SphereGeometry(0.32, 20, 20);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0x05d9e8,
      metalness: 0.2,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85
    });

    const mesh = new THREE.Mesh(ballGeo, ballMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    scene.add(mesh);

    balls3D.push({
      mesh: mesh,
      x: x, y: y, z: z,
      vx: 0, vy: 0, vz: 0,
      r: 0.32,
      state: 'FIELD' // 'FIELD' | 'LIFTING' | 'ROULETTE'
    });
  }

  /* ==========================================
   * 4. 直感操作（画面直接タッチ/ドラッグ投下 ＆ 連射）
   * ========================================== */
  function dropCoin() {
    const betBtn = document.getElementById('bet-select-btn');
    const coinCost = safeToBigInt(betBtn ? betBtn.getAttribute('data-amount') : '10');
    currentCoinCost = coinCost;

    if (coinCost <= 0n) {
      alert('1枚の価値を1以上に設定してください。');
      stopAutoPush();
      return;
    }

    const currentCash = safeToBigInt(window.playerData?.cash);
    if (currentCash < coinCost) {
      alert('所持金が足りません！');
      stopAutoPush();
      return;
    }

    window.playerData.cash = currentCash - coinCost;
    if (typeof window.saveData === 'function') window.saveData();
    updateCashDisplay();

    let type = 'NORMAL';
    const rand = Math.random();
    if (rand < 0.03) type = 'MEGA';
    else if (rand < 0.12) type = 'DIAMOND';

    // 投下ガイド座標（dropGuideX）からメダルを上部シュートより投入
    create3DCoinMesh(dropGuideX + (Math.random() - 0.5) * 0.08, 4.2, -3.2, coinCost, type);
  }

  function toggleAutoPush() {
    const autoBtn = document.getElementById('auto-btn');
    if (isAutoPushing) {
      stopAutoPush();
    } else {
      isAutoPushing = true;
      if (autoBtn) {
        autoBtn.classList.add('active');
        autoBtn.textContent = '🔄 連射: ON';
      }
      autoPushInterval = setInterval(dropCoin, 300);
    }
  }

  function stopAutoPush() {
    isAutoPushing = false;
    if (autoPushInterval) {
      clearInterval(autoPushInterval);
      autoPushInterval = null;
    }
    const autoBtn = document.getElementById('auto-btn');
    if (autoBtn) {
      autoBtn.classList.remove('active');
      autoBtn.textContent = '🔄 連射: OFF';
    }
  }

  // 画面直接タッチ / マウスドラッグ操作イベント設定
  function setupPointerEvents() {
    const wrapper = document.querySelector('.pusher-3d-wrapper');
    if (!wrapper) return;

    const updateGuideFromPointer = (e) => {
      const rect = wrapper.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const normalizedX = (clientX - rect.left) / rect.width; // 0.0 ～ 1.0

      // 3D 投下可能 X 座標範囲（-2.1 ～ 2.1）に変換
      dropGuideX = (normalizedX - 0.5) * 4.2;
      dropGuideX = Math.max(-2.1, Math.min(2.1, dropGuideX));

      if (dropGuideGroup) {
        dropGuideGroup.position.x = dropGuideX;
      }
    };

    const handlePointerDown = (e) => {
      isPointerDown = true;
      updateGuideFromPointer(e);
    };

    const handlePointerMove = (e) => {
      if (isPointerDown) {
        updateGuideFromPointer(e);
      }
    };

    const handlePointerUp = (e) => {
      if (isPointerDown) {
        isPointerDown = false;
        if (!isAutoPushing) {
          dropCoin(); // 指/ボタンを離した瞬間にコイン投下！
        }
      }
    };

    wrapper.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    wrapper.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp);
  }

  /* ==========================================
   * 5. ★ 本動 3D 2段スライド物理シミュレーション ★
   * ========================================== */
  function animate3D() {
    animFrameId = requestAnimationFrame(animate3D);

    // A. 往復可動プッシャーテーブルの滑らかなスライド運動
    const prevPusherZ = pusherZ;
    pusherZ += 0.012 * pusherDir;
    if (pusherZ >= PUSHER_MAX_Z) pusherDir = -1;
    if (pusherZ <= PUSHER_MIN_Z) pusherDir = 1;
    if (pusherMesh) pusherMesh.position.z = pusherZ;

    const deltaPusherZ = pusherZ - prevPusherZ; // このフレームでのスライド移動量
    const pusherFrontZ = pusherZ + (PUSHER_DEPTH / 2); // プッシャー前面Z位置 (-0.9 ～ 0.5)
    const pusherBackZ = pusherZ - (PUSHER_DEPTH / 2);  // プッシャー背面Z位置 (-4.8 ～ -3.4)

    // B. 螺旋スクリューの回転
    if (screwMesh) screwMesh.rotation.y += 0.08;

    // C. 大量ジャラジャラ自動払い出し演出
    if (payoutBurstQueue > 0) {
      payoutTimer++;
      if (payoutTimer % 6 === 0) {
        payoutBurstQueue--;
        create3DCoinMesh((Math.random() - 0.5) * 1.5, 4.0, -3.0, currentCoinCost, 'NORMAL');
      }
    }

    // D-1. 各メダルの位置・2段スライド床面接地・位置連動・せき止め演算
    for (let i = 0; i < coins3D.length; i++) {
      const c = coins3D[i];

      c.x += c.vx;
      c.y += c.vy;
      c.z += c.vz;

      // ★ 1. 座標に基づく接地ターゲット床高さの判定 ★
      let targetFloorY = -10.0; // 床なし（空中落下）

      // スライド板の天面上に存在する判定
      const isOnPusherRange = (c.z >= pusherBackZ - 0.1 && c.z <= pusherFrontZ && Math.abs(c.x) < 2.25);

      if (isOnPusherRange && c.y >= PUSHER_TOP_Y - 0.25) {
        targetFloorY = PUSHER_TOP_Y; // プッシャー天面 (Y = 1.15)
      } else if (c.z < LOWER_EDGE_Z && Math.abs(c.x) < 2.45 && c.y < PUSHER_TOP_Y - 0.1) {
        targetFloorY = LOWER_FLOOR_Y; // 下段メインフィールド (Y = 0.05)
      }

      // ★ 2. 接地処理 ＆ スライド板位置連動 ＆ 奥壁せき止め ★
      if (c.y <= targetFloorY + 0.01 && c.vy <= 0) {
        c.y = targetFloorY;
        c.vy = 0;

        // プッシャー天面に着地している場合、スライド移動量に完全連動！
        if (targetFloorY === PUSHER_TOP_Y) {
          c.z += deltaPusherZ; // スライド板と一緒に前後に動く

          // 奥の固定せき止め壁（BACK_WALL_Z = -3.85）に当たった場合、奥進を遮られる！
          if (c.z - c.r < BACK_WALL_Z) {
            c.z = BACK_WALL_Z + c.r;
          }
        }

        // 静止摩擦（自動で手前に滑る現象はゼロ）
        c.vx *= 0.82;
        c.vz *= 0.82;

        if (Math.abs(c.vx) < 0.0005) c.vx = 0;
        if (Math.abs(c.vz) < 0.0005) c.vz = 0;
      } else {
        // 空中重力落下
        c.vy -= 0.018;
      }

      // ★ 3. 下段メインフィールドにあるメダルに対するプッシャー前面（フロント）による押出し ★
      if (c.y < PUSHER_TOP_Y - 0.1 && c.z < pusherFrontZ + c.r && c.z > pusherFrontZ - 0.4) {
        if (pusherDir === 1 || c.z < pusherFrontZ) {
          c.z = pusherFrontZ + c.r; // 下段のメダルを前方向へ押し出す
          c.vz = Math.max(c.vz, 0.035);
        }
      }

      // 壁（左右側面）境界制限
      if (c.x < -2.35) { c.x = -2.35; c.vx = Math.abs(c.vx) * 0.5; }
      if (c.x > 2.35) { c.x = 2.35; c.vx = -Math.abs(c.vx) * 0.5; }
    }

    // D-2. メダル同士の連鎖押し出し伝達アルゴリズム（複数パス処理で力の連鎖をスムーズに解決）
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < coins3D.length; i++) {
        const c1 = coins3D[i];
        for (let j = i + 1; j < coins3D.length; j++) {
          const c2 = coins3D[j];

          // 段差違い（上段と下段）のメダル同士は衝突させない
          if (Math.abs(c1.y - c2.y) > 0.15) continue;

          const dx = c2.x - c1.x;
          const dz = c2.z - c1.z;
          const dist = Math.hypot(dx, dz);
          const minDist = c1.r + c2.r;

          if (dist < minDist && dist > 0.0001) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const nz = dz / dist;

            let ratio1 = 0.5;
            let ratio2 = 0.5;

            if (c1.z < c2.z) {
              ratio1 = 0.15;
              ratio2 = 0.85; // 奥から手前への伝達比率を強化
            } else if (c2.z < c1.z) {
              ratio1 = 0.85;
              ratio2 = 0.15;
            }

            c1.x -= nx * overlap * ratio1;
            c1.z -= nz * overlap * ratio1;
            c2.x += nx * overlap * ratio2;
            c2.z += nz * overlap * ratio2;

            const relVx = c2.vx - c1.vx;
            const relVz = c2.vz - c1.vz;
            const velAlongNormal = relVx * nx + relVz * nz;

            if (velAlongNormal < 0) {
              const impulse = -1.3 * velAlongNormal * 0.5;
              c1.vx -= impulse * nx * ratio1;
              c1.vz -= impulse * nz * ratio1;
              c2.vx += impulse * nx * ratio2;
              c2.vz += impulse * nz * ratio2;
            }
          }
        }
      }
    }

    // D-3. メッシュ座標同期 ＆ 獲得・没収判定
    for (let i = coins3D.length - 1; i >= 0; i--) {
      const c = coins3D[i];
      c.mesh.position.set(c.x, c.y, c.z);

      // 手前獲得エッジ落下判定 (Z > LOWER_EDGE_Z かつ Y < -0.1)
      if (c.z > LOWER_EDGE_Z && c.y < -0.1) {
        if (Math.abs(c.x) < 2.1) {
          onCoinCollected(c); // 正面獲得トレイ
        } else {
          onCoinSideLost(c);   // サイド没収
        }
        scene.remove(c.mesh);
        coins3D.splice(i, 1);
      }
    }

    // E. 3D 配当ボール物理 ＆ エレベーター・ルーレットループ
    for (let i = balls3D.length - 1; i >= 0; i--) {
      const b = balls3D[i];

      if (b.state === 'FIELD') {
        b.x += b.vx; b.y += b.vy; b.z += b.vz;

        let targetFloorY = -10.0;
        const isOnPusherRange = (b.z >= pusherBackZ - 0.1 && b.z <= pusherFrontZ && Math.abs(b.x) < 2.25);

        if (isOnPusherRange && b.y >= PUSHER_TOP_Y - 0.2) targetFloorY = PUSHER_TOP_Y + 0.18;
        else if (b.z < LOWER_EDGE_Z && Math.abs(b.x) < 2.45) targetFloorY = LOWER_FLOOR_Y + 0.18;

        if (b.y <= targetFloorY && b.vy <= 0) {
          b.y = targetFloorY;
          b.vy = 0;

          if (targetFloorY === PUSHER_TOP_Y + 0.18) {
            b.z += deltaPusherZ;
            if (b.z - b.r < BACK_WALL_Z) b.z = BACK_WALL_Z + b.r;
          }

          b.vx *= 0.85;
          b.vz *= 0.85;
        } else {
          b.vy -= 0.018;
        }

        // メダルからボールへの押出し伝達
        coins3D.forEach(c => {
          if (Math.abs(c.y - b.y) < 0.20) {
            const dx = b.x - c.x;
            const dz = b.z - c.z;
            const dist = Math.hypot(dx, dz);
            const minDist = b.r + c.r;
            if (dist < minDist && dist > 0) {
              const overlap = minDist - dist;
              b.x += (dx / dist) * overlap;
              b.z += (dz / dist) * overlap;
              b.vx += c.vx * 0.5;
              b.vz += c.vz * 0.5;
            }
          }
        });

        b.mesh.position.set(b.x, b.y, b.z);

        if (b.z > LOWER_EDGE_Z && b.y < -0.1) {
          b.state = 'LIFTING';
          const msgEl = document.getElementById('pusher-message');
          if (msgEl) msgEl.textContent = '🔮 ボール獲得！ 螺旋エレベーターでルーレット抽選機へ昇降中...';
        }
      } else if (b.state === 'LIFTING') {
        b.x = -2.8 + Math.sin(Date.now() * 0.005) * 0.1;
        b.z = -1.8 + Math.cos(Date.now() * 0.005) * 0.1;
        b.y += 0.04;
        b.mesh.position.set(b.x, b.y, b.z);

        if (b.y >= 6.2) {
          b.state = 'ROULETTE';
          startRouletteWheelSpin(b);
        }
      }
    }

    // F. ★ 大型木製ギヤルーレット回転演出（正円ローカルY軸回転） ★
    if (isWheelSpinning && rouletteDiscGroup) {
      rouletteDiscGroup.rotation.y += 0.05; // 軸ブレゼロの綺麗な正円回転！
      wheelCurrentAngle += 0.05;

      if (wheelCurrentAngle >= wheelTargetAngle) {
        isWheelSpinning = false;
        finishRouletteWheelSpin();
      }
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  /* ==========================================
   * 6. イベント ＆ 抽選処理
   * ========================================== */
  function onCoinCollected(c) {
    let mult = 2n;
    if (c.type === 'DIAMOND') mult = 10n;
    if (c.type === 'MEGA') mult = 20n;

    const payout = c.cost * mult;
    window.playerData.cash = safeToBigInt(window.playerData.cash) + payout;
    currentSessionProfit += payout;

    const currentHigh = safeToBigInt(window.playerData.highScores?.coinpusher);
    if (currentSessionProfit > currentHigh) {
      if (!window.playerData.highScores) window.playerData.highScores = {};
      playerData.highScores.coinpusher = currentSessionProfit;
    }

    if (typeof applyDebtInterest === 'function') applyDebtInterest();
    else saveData();

    const msgEl = document.getElementById('pusher-message');
    if (msgEl) msgEl.textContent = `🎉 3Dメダル獲得！ ${formatMoney(payout)} GET!`;

    triggerWinParticles();
    updateCashDisplay();
  }

  function onCoinSideLost(c) {
    // サイド没収
  }

  function startRouletteWheelSpin(ball) {
    activeRouletteBall = ball;
    isWheelSpinning = true;
    wheelCurrentAngle = 0;
    wheelTargetAngle = Math.PI * 8 + Math.random() * Math.PI * 2;

    const msgEl = document.getElementById('pusher-message');
    if (msgEl) msgEl.textContent = '🎡 大型木製ギヤルーレット回転中... 高配当を狙え！';
  }

  function finishRouletteWheelSpin() {
    const payouts = [10, 50, 100, 500];
    const chosenPayout = payouts[Math.floor(Math.random() * payouts.length)];

    const jackpotWinEl = document.getElementById('stat-jackpot-win');
    if (jackpotWinEl) jackpotWinEl.textContent = `${chosenPayout}枚`;

    const msgEl = document.getElementById('pusher-message');
    if (msgEl) msgEl.textContent = `🎉🎉 ルーレット当選！ 【 ${chosenPayout} 枚 】 大量ジャラジャラ払い出し発動！！`;

    payoutBurstQueue += chosenPayout;

    triggerWinParticles();
    updateDigitalSignboard();

    if (activeRouletteBall) {
      scene.remove(activeRouletteBall.mesh);
      const idx = balls3D.indexOf(activeRouletteBall);
      if (idx !== -1) balls3D.splice(idx, 1);
      activeRouletteBall = null;
    }

    setTimeout(() => {
      create3DBallMesh((Math.random() - 0.5) * 2, LOWER_FLOOR_Y + 0.15, 0);
    }, 4000);
  }

  function triggerWinParticles() {
    const container = document.getElementById('particle-container') || document.body;
    const items = ['🪙', '✨', '💎', '🎉', '👑'];

    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = items[Math.floor(Math.random() * items.length)];
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDelay = Math.random() * 0.8 + 's';
      container.appendChild(p);
      setTimeout(() => p.remove(), 2500);
    }
  }

  function onWindowResize() {
    const container = document.getElementById('pusher-3d-canvas');
    if (!container || !renderer || !camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  /* ==========================================
   * 7. イベントリスナー登録 ＆ 初期化
   * ========================================== */
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadData === 'function') loadData();
    updateCashDisplay();

    setTimeout(() => {
      init3DScene();
    }, 100);

    const dropBtn = document.getElementById('drop-btn');
    const autoBtn = document.getElementById('auto-btn');

    if (dropBtn) dropBtn.addEventListener('click', dropCoin);
    if (autoBtn) autoBtn.addEventListener('click', toggleAutoPush);
  });
})();