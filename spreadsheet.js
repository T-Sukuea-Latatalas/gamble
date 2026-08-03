/**
 * ==========================================
 * Fever Casino - Googleスプレッドシート連携 (spreadsheet.js)
 * BigInt JSONシリアライズ完全安全対応版 (宝くじ・パチンコ拡張)
 * ==========================================
 */

const SPREADSHEET_STORAGE_KEY = 'fever_casino_player_data';
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzUjFUO4ZqCHsxcgsMNow_jUzkgUz-Tj7zvzv4_NNHccXQ5w2rTZ53puhnvNHi36qFJLw/exec";

function safeToBigInt(v) {
  if (typeof window.toBigInt === 'function') return window.toBigInt(v);
  try { return BigInt(v || 0); } catch (e) { return 0n; }
}

function ensurePlayerDataInitialized() {
  if (!window.playerData) {
    window.playerData = {
      userId: '',
      userName: 'ゲストプレイヤー',
      cash: 1000n,
      bank: 0n,
      debt: 0n,
      debtPlayCount: 0,
      highScores: { blackjack: 0n, slots: 0n, roulette: 0n, poker: 0n, lottery: 0n, pachinko: 0n }
    };
  }

  try {
    const saved = localStorage.getItem(SPREADSHEET_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      window.playerData.userId = parsed.userId || window.playerData.userId;
      window.playerData.userName = parsed.userName || window.playerData.userName;
      window.playerData.cash = safeToBigInt(parsed.cash);
      window.playerData.bank = safeToBigInt(parsed.bank);
      window.playerData.debt = safeToBigInt(parsed.debt);
      window.playerData.debtPlayCount = typeof parsed.debtPlayCount === 'number' ? parsed.debtPlayCount : 0;

      const hs = parsed.highScores || {};
      window.playerData.highScores = {
        blackjack: safeToBigInt(hs.blackjack),
        slots: safeToBigInt(hs.slots),
        roulette: safeToBigInt(hs.roulette),
        poker: safeToBigInt(hs.poker),
        lottery: safeToBigInt(hs.lottery),
        pachinko: safeToBigInt(hs.pachinko)
      };
    }
  } catch (e) {
    console.error("セーブデータの復元に失敗しました:", e);
  }

  if (!window.playerData.userId || String(window.playerData.userId).trim() === '') {
    if (window.crypto && window.crypto.randomUUID) {
      window.playerData.userId = window.crypto.randomUUID();
    } else {
      window.playerData.userId = 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    }
  }
}

async function sendDataToSpreadsheet(isManualTest = false) {
  if (!GAS_API_URL || GAS_API_URL.trim() === "" || GAS_API_URL.includes("ここに") || GAS_API_URL.includes("YOUR_GAS")) {
    const msg = "【スプレッドシート未連携】GAS_API_URL が設定されていないため通信をスキップします。";
    console.log(msg);
    if (isManualTest) alert(msg);
    return;
  }

  try {
    ensurePlayerDataInitialized();

    const cash = safeToBigInt(window.playerData.cash);
    const bank = safeToBigInt(window.playerData.bank);
    const debt = safeToBigInt(window.playerData.debt);
    const netWorth = cash + bank - debt;

    const hs = window.playerData.highScores || {};

    const payload = {
      userId: window.playerData.userId,
      userName: window.playerData.userName || "ゲスト",
      netWorth: netWorth.toString(),
      highScores: {
        blackjack: safeToBigInt(hs.blackjack).toString(),
        slots: safeToBigInt(hs.slots).toString(),
        roulette: safeToBigInt(hs.roulette).toString(),
        poker: safeToBigInt(hs.poker).toString(),
        lottery: safeToBigInt(hs.lottery).toString(),
        pachinko: safeToBigInt(hs.pachinko).toString()
      }
    };

    console.log("【スプレッドシートへ送信中データ】", payload);

    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`送信エラー HTTP Status: ${response.status}`);
    }

    const result = await response.json();
    console.log("スプレッドシート送信成功結果:", result);

    if (isManualTest) {
      alert(`⚡ スプレッドシート通信成功！\n\nレスポンス: ${result.status}\nメッセージ: ${result.message || 'データが正しく反映されました。'}`);
    }

    fetchRankingFromSpreadsheet();

  } catch (error) {
    console.error("スプレッドシートへのデータ送信に失敗しました:", error);
    if (isManualTest) {
      alert(`❌ 通信エラーが発生しました！\n\nエラー内容:\n${error.message}`);
    }
  }
}

async function fetchRankingFromSpreadsheet() {
  if (!GAS_API_URL || GAS_API_URL.trim() === "" || GAS_API_URL.includes("ここに") || GAS_API_URL.includes("YOUR_GAS")) {
    return;
  }

  showLoadingStatus();

  try {
    const response = await fetch(GAS_API_URL);
    if (!response.ok) {
      throw new Error(`HTTPエラー! Status: ${response.status}`);
    }

    const rankings = await response.json();

    updateRankingList('ranking-net-worth', rankings.netWorth, 'netWorth');
    updateRankingList('ranking-blackjack', rankings.blackjack, 'blackjack');
    updateRankingList('ranking-slots', rankings.slots, 'slots');
    updateRankingList('ranking-roulette', rankings.roulette, 'roulette');
    updateRankingList('ranking-poker', rankings.poker, 'poker');
    updateRankingList('ranking-lottery', rankings.lottery, 'lottery');
    updateRankingList('ranking-pachinko', rankings.pachinko, 'pachinko');

  } catch (error) {
    console.error("ランキングデータの取得に失敗しました:", error);
    showErrorStatus();
  }
}

function showLoadingStatus() {
  const rankingIds = ['ranking-net-worth', 'ranking-blackjack', 'ranking-slots', 'ranking-roulette', 'ranking-poker', 'ranking-lottery', 'ranking-pachinko'];
  rankingIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<li class="loading-text">データを読み込み中... 🏆</li>';
  });
}

function showErrorStatus() {
  const rankingIds = ['ranking-net-worth', 'ranking-blackjack', 'ranking-slots', 'ranking-roulette', 'ranking-poker', 'ranking-lottery', 'ranking-pachinko'];
  rankingIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<li>ランキングの読み込みに失敗しました</li>';
  });
}

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
    const rawVal = player[valueKey];
    const bigVal = safeToBigInt(rawVal);

    const formattedVal = (typeof window.formatCurrency === 'function') 
      ? window.formatCurrency(bigVal) 
      : '$' + bigVal.toLocaleString('en-US');

    const isMe = (window.playerData && window.playerData.userId && String(player.userId) === String(window.playerData.userId));
    const displayName = isMe ? `${player.userName} (あなた)` : player.userName;

    li.textContent = `${rank}位: ${displayName} (${formattedVal})`;

    if (rank === 1) {
      li.style.color = 'var(--gold)';
    }

    if (isMe) {
      li.classList.add('my-rank');
    }

    olElement.appendChild(li);
  });
}

let isSaveDataHooked = false;

function applySaveDataHook() {
  if (isSaveDataHooked) return;

  if (typeof saveData === 'function') {
    const originalSaveData = saveData;

    saveData = function() {
      originalSaveData();
      sendDataToSpreadsheet();
    };

    isSaveDataHooked = true;
  }
}

function setupTestButton() {
  const testBtn = document.getElementById('test-spreadsheet-btn');
  if (testBtn) {
    testBtn.addEventListener('click', () => {
      sendDataToSpreadsheet(true);
    });
  }
}

window.addEventListener('load', () => {
  ensurePlayerDataInitialized();
  applySaveDataHook();
  setupTestButton();

  setTimeout(() => {
    fetchRankingFromSpreadsheet();
  }, 100);
});