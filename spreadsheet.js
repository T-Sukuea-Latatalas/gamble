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
  // ★バグ修正: URLが未設定、または初期ダミー文字列の場合のみスキップ
  if (!GAS_API_URL || GAS_API_URL.trim() === "" || GAS_API_URL.includes("https://script.google.com/macros/s/AKfycbzUjFUO4ZqCHsxcgsMNow_jUzkgUz-Tj7zvzv4_NNHccXQ5w2rTZ53puhnvNHi36qFJLw/exec")) {
    console.log("【スプレッドシート未連携】GAS_API_URL が設定されていないためオンライン更新をスキップします。");
    return;
  }

  // playerDataの読み込み確認
  if (typeof loadData === 'function' && (!window.playerData || !playerData.userId)) {
    loadData();
  }

  if (!window.playerData || !playerData.userId) {
    console.warn("プレイヤーデータが未初期化のため、送信をスキップします。");
    return;
  }

  const netWorth = (playerData.cash || 0) + (playerData.bank || 0) - (playerData.debt || 0);
  const payload = {
    userId: playerData.userId,
    userName: playerData.userName || "ゲスト",
    netWorth: netWorth,
    highScores: playerData.highScores || { blackjack: 0, slots: 0, roulette: 0, poker: 0 }
  };

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("スプレッドシート送信結果:", result);

    // 送信成功後、最新ランキングを取得して描画
    fetchRankingFromSpreadsheet();

  } catch (error) {
    console.error("スプレッドシートへのデータ送信に失敗しました:", error);
  }
}

/**
 * 2. スプレッドシートから最新のランキングデータを取得して画面に反映
 */
async function fetchRankingFromSpreadsheet() {
  // ★バグ修正: 条件判定を修正
  if (!GAS_API_URL || GAS_API_URL.trim() === "" || GAS_API_URL.includes("https://script.google.com/macros/s/AKfycbzUjFUO4ZqCHsxcgsMNow_jUzkgUz-Tj7zvzv4_NNHccXQ5w2rTZ53puhnvNHi36qFJLw/exec")) {
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
  if (!olElement || !listData) return;

  olElement.innerHTML = '';

  if (listData.length === 0) {
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
 * 4. 既存のセーブ処理 (saveData) が実行されたら自動でスプレッドシートにも送信するフック処理
 */
if (typeof saveData === 'function') {
  const originalSaveData = saveData;
  
  saveData = function() {
    originalSaveData();       // ローカルストレージに保存
    sendDataToSpreadsheet();  // スプレッドシートへ自動送信
  };
}

/**
 * ページ読み込み完了時にランキングを取得
 */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    fetchRankingFromSpreadsheet();
  }, 100);
})