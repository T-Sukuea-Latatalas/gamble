/**
 * ==========================================
 * Fever Casino - Googleスプレッドシート連携 (spreadsheet.js)
 * ==========================================
 */

// ★デプロイ後に発行された「Web アプリの URL」を貼り付けます
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzUjFUO4ZqCHsxcgsMNow_jUzkgUz-Tj7zvzv4_NNHccXQ5w2rTZ53puhnvNHi36qFJLw/exec";

/**
 * 1. 現在のプレイヤーデータをスプレッドシートへ送信（送信後に最新ランキングも取得）
 */
async function sendDataToSpreadsheet() {
  // URLが未設定、または初期ダミー文字列の場合のみ通信をスキップ
  if (!GAS_API_URL || GAS_API_URL.trim() === "" || GAS_API_URL.includes("https://script.google.com/macros/s/AKfycbzUjFUO4ZqCHsxcgsMNow_jUzkgUz-Tj7zvzv4_NNHccXQ5w2rTZ53puhnvNHi36qFJLw/exec") || GAS_API_URL.includes("YOUR_GAS")) {
    console.log("【スプレッドシート未連携】GAS_API_URL が設定されていないためオンライン更新をスキップします。");
    return;
  }

  try {
    // playerDataのロード確認（未初期化の場合は安全にロードを試みる）
    if (typeof loadData === 'function' && (!window.playerData || !playerData.userId)) {
      loadData();
    }

    // playerData や userId の存在チェックを厳密に行う
    if (!window.playerData || !playerData.userId) {
      console.warn("【スプレッドシート送信スキップ】プレイヤーデータが未初期化のため一時待機します。");
      return;
    }

    const netWorth = (Number(playerData.cash) || 0) + (Number(playerData.bank) || 0) - (Number(playerData.debt) || 0);
    const payload = {
      userId: playerData.userId,
      userName: playerData.userName || "ゲスト",
      netWorth: netWorth,
      highScores: playerData.highScores || { blackjack: 0, slots: 0, roulette: 0, poker: 0 }
    };

    console.log("スプレッドシートへ送信中...:", payload);

    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // GASの仕様に合わせた通信設定
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`送信エラー Status: ${response.status}`);
    }

    const result = await response.json();
    console.log("スプレッドシート送信成功結果:", result);

    // 送信成功後、最新ランキングを取得して画面を再描画
    fetchRankingFromSpreadsheet();

  } catch (error) {
    console.error("スプレッドシートへのデータ送信に失敗しました:", error);
  }
}

/**
 * 2. スプレッドシートから最新のランキングデータを取得して画面に反映
 */
async function fetchRankingFromSpreadsheet() {
  if (!GAS_API_URL || GAS_API_URL.trim() === "" || GAS_API_URL.includes("https://script.google.com/macros/s/AKfycbzUjFUO4ZqCHsxcgsMNow_jUzkgUz-Tj7zvzv4_NNHccXQ5w2rTZ53puhnvNHi36qFJLw/exec") || GAS_API_URL.includes("YOUR_GAS")) {
    console.log("【スプレッドシート未連携】GAS_API_URL が未設定のためランキング取得をスキップします。");
    return;
  }

  // 通信開始時に「データを読み込み中...」を表示
  showLoadingStatus();

  try {
    const response = await fetch(GAS_API_URL);
    if (!response.ok) {
      throw new Error(`HTTPエラー! Status: ${response.status}`);
    }

    const rankings = await response.json();

    // 各ランキングの描画
    updateRankingList('ranking-net-worth', rankings.netWorth, 'netWorth');
    updateRankingList('ranking-blackjack', rankings.blackjack, 'blackjack');
    updateRankingList('ranking-slots', rankings.slots, 'slots');
    updateRankingList('ranking-roulette', rankings.roulette, 'roulette');
    updateRankingList('ranking-poker', rankings.poker, 'poker');

  } catch (error) {
    console.error("ランキングデータの取得に失敗しました:", error);
    showErrorStatus();
  }
}

/**
 * ランキングエリアに「読み込み中...」の仮表示を行う関数
 */
function showLoadingStatus() {
  const rankingIds = [
    'ranking-net-worth',
    'ranking-blackjack',
    'ranking-slots',
    'ranking-roulette',
    'ranking-poker'
  ];

  rankingIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<li class="loading-text">データを読み込み中... 🏆</li>';
    }
  });
}

/**
 * 通信失敗時のエラー表示関数
 */
function showErrorStatus() {
  const rankingIds = [
    'ranking-net-worth',
    'ranking-blackjack',
    'ranking-slots',
    'ranking-roulette',
    'ranking-poker'
  ];

  rankingIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<li>ランキングの読み込みに失敗しました</li>';
    }
  });
}

/**
 * 3. HTMLの <ol> タグ内にランキング要素（<li>）を動的生成して書き換える関数
 */
function updateRankingList(elementId, listData, valueKey) {
  const olElement = document.getElementById(elementId);
  if (!olElement) return;

  olElement.innerHTML = '';

  if (!listData || !Array.isArray(listData) || listData.length === 0) {
    olElement.innerHTML = '<li>データがありません</li>';
    return;
  }

  listData.forEach((player, index) => {
    const li = document.createElement('li');
    const rank = index + 1;
    const value = Number(player[valueKey]) || 0;

    // 自分自身かどうかを判定（IDの比較）
    const isMe = (window.playerData && playerData.userId && String(player.userId) === String(playerData.userId));
    
    // 自分自身の場合は名前の後ろに「(あなた)」と明記
    const displayName = isMe ? `${player.userName} (あなた)` : player.userName;

    li.textContent = `${rank}位: ${displayName} ($${value.toLocaleString()})`;

    // 1位の色付け
    if (rank === 1) {
      li.style.color = 'var(--gold)';
    }

    // 自分自身である場合、CSSの強調用クラス 'my-rank' を付与
    if (isMe) {
      li.classList.add('my-rank');
    }

    olElement.appendChild(li);
  });
}

/**
 * 4. ★ 読み込み順バグの完全対策 ★
 * 全てのゲームスクリプトがロード完了した後に saveData 関数を上書き・拡張します
 */
let isSaveDataHooked = false;

function applySaveDataHook() {
  if (isSaveDataHooked) return; // 二重フック防止

  if (typeof saveData === 'function') {
    const originalSaveData = saveData;

    saveData = function() {
      // 1. 本来のローカルストレージ保存を実行
      originalSaveData();
      
      // 2. スプレッドシートへ自動送信
      sendDataToSpreadsheet();
    };

    isSaveDataHooked = true;
    console.log("【スプレッドシート連携】セーブフックを完了しました。データ変更時に自動送信されます。");
  }
}

// 画面のすべてのファイルが完全に読み込まれたタイミング（load）で確実に実行
window.addEventListener('load', () => {
  applySaveDataHook();

  // ランキングを初回取得
  setTimeout(() => {
    fetchRankingFromSpreadsheet();
  }, 100);
});
