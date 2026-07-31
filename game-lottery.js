/**
 * ==========================================
 * Fever Casino - ワールドロト制御スクリプト (game-lottery.js)
 * BigInt & API / オフラインフォールバック完全対応版
 * ==========================================
 */

(function () {
    // --- 設定定数 ---
    const GAS_LOTTERY_API_URL = "https://script.google.com/macros/s/AKfycbyixcbek1sZ0e-BAZ7kcpcTrOG37qxEvG7o7jZTXncvDCcqSx57hJ_5OWeKQu1R2KdS/exec";
    const TICKET_PRICE = 1000n;   // 1枚 $1,000
    const MAX_TICKETS = 10;       // 1人最大10枚
    const WIN_MULTIPLIER = 1000n; // 当選配当 (1000倍)

    // --- 状態管理変数 ---
    let currentDrawId = 0;
    let nextDrawTime = null;
    let serverHistory = [];
    let isProcessing = false;
    let timerInterval = null;

    /**
     * 1. ユーティリティ: Safe BigInt 変換
     */
    function safeToBigInt(v) {
        if (typeof window.toBigInt === 'function') return window.toBigInt(v);
        try { return BigInt(v || 0); } catch (e) { return 0n; }
    }

    /**
     * 2. 通貨フォーマットヘルパー
     */
    function formatMoney(val) {
        const bigVal = safeToBigInt(val);
        if (typeof window.formatCurrency === 'function') {
            return window.formatCurrency(bigVal);
        }
        return '$' + bigVal.toLocaleString('en-US');
    }

    /**
     * 3. UI更新: 所持金・借金表示
     */
    function refreshCurrencyUI() {
        if (typeof window.updateUI === 'function') {
            window.updateUI();
        } else if (typeof window.updateCashDisplay === 'function') {
            window.updateCashDisplay();
        }
    }

    /**
     * 4. オフライン/フォールバック用: 次回金曜日 08:15 (JST) のエポックミリ秒を計算
     */
    function calculateNextFriday815JST() {
        const nowMs = Date.now();
        const jstOffsetMs = 9 * 60 * 60 * 1000;
        const jstDate = new Date(nowMs + jstOffsetMs);

        const day = jstDate.getUTCDay(); // 0(日) - 6(土)
        const hours = jstDate.getUTCHours();
        const minutes = jstDate.getUTCMinutes();

        let daysToAdd = (5 - day + 7) % 7;

        // すでに金曜日の 8:15 JST を過ぎている場合は来週の金曜日へ
        if (daysToAdd === 0 && (hours > 8 || (hours === 8 && minutes >= 15))) {
            daysToAdd = 7;
        }

        const targetJstDate = new Date(Date.UTC(
            jstDate.getUTCFullYear(),
            jstDate.getUTCMonth(),
            jstDate.getUTCDate() + daysToAdd,
            8, 15, 0, 0
        ));

        return targetJstDate.getTime() - jstOffsetMs;
    }

    /**
     * 5. フォールバック用: 回号(DrawID)生成 (年 + 通算週番号)
     */
    function generateFallbackDrawId() {
        const now = new Date();
        const year = now.getFullYear();
        const start = new Date(year, 0, 1);
        const week = Math.ceil((((now - start) / 86400000) + start.getDay() + 1) / 7);
        return parseInt(`${year}${String(week).padStart(2, '0')}`, 10);
    }

    /**
     * 6. カウントダウンタイマーロジック
     */
    function startCountdown() {
        if (timerInterval) clearInterval(timerInterval);

        const timerEl = document.getElementById('countdown-timer');
        if (!timerEl) return;

        timerInterval = setInterval(() => {
            if (!nextDrawTime) return;

            const now = Date.now();
            const target = typeof nextDrawTime === 'number' ? nextDrawTime : new Date(nextDrawTime).getTime();
            const diff = target - now;

            if (diff <= 0) {
                timerEl.textContent = "00日 00:00:00 (抽選処理中...)";
                fetchLotteryStatus();
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            timerEl.textContent = `${days}日 ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }, 1000);
    }

    /**
     * 7. ロトステータス取得 (GET 通信 + フォールバック)
     */
    async function fetchLotteryStatus() {
        let isSuccess = false;

        if (GAS_LOTTERY_API_URL && !GAS_LOTTERY_API_URL.includes("ここに") && !GAS_LOTTERY_API_URL.includes("YOUR_GAS")) {
            try {
                const response = await fetch(GAS_LOTTERY_API_URL);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.currentDrawId) {
                        currentDrawId = data.currentDrawId;
                        nextDrawTime = data.nextDrawTime;
                        serverHistory = data.history || [];
                        isSuccess = true;
                    }
                }
            } catch (error) {
                console.warn("GAS通信エラー。フォールバックタイマーを作動させます:", error);
            }
        }

        // オフライン / 通信失敗時のフォールバック処理
        if (!isSuccess) {
            currentDrawId = generateFallbackDrawId();
            nextDrawTime = calculateNextFriday815JST();
        }

        // UI反映
        const drawIdEl = document.getElementById('current-draw-id');
        if (drawIdEl) drawIdEl.textContent = currentDrawId;

        updateHistoryTable();
        updateMyTicketsList();
        startCountdown();
    }

    /**
     * 8. 番号選択ボタンからの数字正規化抽出 (000〜999)
     */
    function getSelectedNumber() {
        const numBtn = document.getElementById('lottery-num-btn');
        if (!numBtn) return "000";

        let rawVal = numBtn.getAttribute('data-amount') || numBtn.textContent || "0";
        const cleanDigits = String(rawVal).replace(/\D/g, '');
        const numStr = cleanDigits === "" ? "0" : cleanDigits;
        return numStr.padStart(3, '0').slice(-3);
    }

    /**
     * 9. チケット購入処理 (POST 通信 + ローカル保存フォールバック)
     */
    async function buyTicket() {
        if (isProcessing) return;

        const selectedNum = getSelectedNumber();
        const cash = safeToBigInt(window.playerData?.cash);

        // バリデーション: 所持金不足
        if (cash < TICKET_PRICE) {
            alert(`所持金が足りません！（必要額: ${formatMoney(TICKET_PRICE)}）`);
            return;
        }

        // バリデーション: 購入上限枚数
        const myTickets = getMyTicketsLocally();
        const currentDrawTickets = myTickets.filter(t => t.drawId === currentDrawId);
        if (currentDrawTickets.length >= MAX_TICKETS) {
            alert(`第 ${currentDrawId} 回のチケットはすでに上限（${MAX_TICKETS}枚）まで購入済みです。`);
            return;
        }

        if (!confirm(`チケット #${selectedNum} を ${formatMoney(TICKET_PRICE)} で購入しますか？`)) {
            return;
        }

        isProcessing = true;
        const buyBtn = document.getElementById('buy-ticket-btn');
        if (buyBtn) {
            buyBtn.disabled = true;
            buyBtn.textContent = "購入処理中...";
        }

        try {
            // 1. 所持金の引き落とし ＆ 保存
            window.playerData.cash = cash - TICKET_PRICE;
            if (typeof window.saveData === 'function') window.saveData();

            // 2. サーバー送信試行
            let isServerSuccess = false;
            if (GAS_LOTTERY_API_URL && !GAS_LOTTERY_API_URL.includes("ここに") && !GAS_LOTTERY_API_URL.includes("YOUR_GAS")) {
                try {
                    const payload = {
                        userId: window.playerData.userId || "guest",
                        userName: window.playerData.userName || "ゲスト",
                        drawId: currentDrawId,
                        numbers: [selectedNum]
                    };

                    const response = await fetch(GAS_LOTTERY_API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "text/plain" },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result && result.status === "success") {
                            isServerSuccess = true;
                        }
                    }
                } catch (err) {
                    console.warn("GAS送信失敗。ローカル購入モードを適用します:", err);
                }
            }

            // 3. ローカルに保存
            saveTicketLocally(currentDrawId, selectedNum);

            if (isServerSuccess) {
                alert(`🎉 チケット #${selectedNum} を購入しました！`);
            } else {
                alert(`🎟️ チケット #${selectedNum} を購入しました！（ローカル保存完了）`);
            }

            updateMyTicketsList();

        } catch (error) {
            console.error("購入処理エラー:", error);
            alert("購入処理中にエラーが発生しました。");
        } finally {
            isProcessing = false;
            if (buyBtn) {
                buyBtn.disabled = false;
                buyBtn.textContent = "🎟️ 購入を確定";
            }
            refreshCurrencyUI();
        }
    }

    /**
     * 10. 当選確認 & 配当受取
     */
    async function checkResults() {
        const myTickets = getMyTicketsLocally();
        if (!myTickets || myTickets.length === 0) {
            alert("購入済みのチケットがありません。");
            return;
        }

        const uncheckedTickets = myTickets.filter(t => !t.checked);
        if (uncheckedTickets.length === 0) {
            alert("未確認のチケットはありません。すべてのチケットの確認が完了しています。");
            return;
        }

        // 最新の抽選ステータスを更新
        await fetchLotteryStatus();

        // サーバー履歴がない場合のローカルフォールバック生成
        if (serverHistory.length === 0) {
            const drawIds = [...new Set(uncheckedTickets.map(t => t.drawId))];
            drawIds.forEach(id => {
                const dummyWinNum = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
                serverHistory.push({
                    drawId: id,
                    date: "ローカル抽選",
                    winningNumber: dummyWinNum
                });
            });
            updateHistoryTable();
        }

        let totalWinAmount = 0n;
        let winCount = 0;
        let checkedCount = 0;

        serverHistory.forEach(draw => {
            const drawId = draw.drawId;
            const winningNum = String(draw.winningNumber).padStart(3, '0').slice(-3);

            myTickets.forEach(ticket => {
                if (ticket.drawId === drawId && !ticket.checked) {
                    checkedCount++;
                    if (ticket.number === winningNum) {
                        totalWinAmount += TICKET_PRICE * WIN_MULTIPLIER;
                        winCount++;
                        ticket.isWin = true;
                    }
                    ticket.checked = true;
                }
            });
        });

        if (checkedCount === 0) {
            alert("まだ抽選が実施されていないチケットです。抽選日時まで楽しみにお待ちください！");
            return;
        }

        if (winCount > 0) {
            window.playerData.cash = safeToBigInt(window.playerData.cash) + totalWinAmount;
            if (typeof window.saveData === 'function') window.saveData();

            alert(`🎉🎉 JACKPOT!! おめでとうございます！\n\n${winCount}件の当選があり、${formatMoney(totalWinAmount)} を獲得しました！`);
            triggerWinEffects();
        } else {
            alert(`💀 抽選照合完了 (${checkedCount}枚)\n\n残念ながら今回の当選はありませんでした... 次回の挑戦をお待ちしています！`);
        }

        saveAllTicketsLocally(myTickets);
        updateMyTicketsList();
        refreshCurrencyUI();
    }

    /**
     * 11. ローカルストレージ操作（チケット保存・取得）
     */
    function getStorageKey() {
        const uid = window.playerData?.userId || "guest";
        return `lottery_tickets_${uid}`;
    }

    function getMyTicketsLocally() {
        try {
            return JSON.parse(localStorage.getItem(getStorageKey()) || "[]");
        } catch (e) {
            return [];
        }
    }

    function saveTicketLocally(drawId, number) {
        const tickets = getMyTicketsLocally();
        tickets.push({ drawId, number, checked: false, isWin: false, timestamp: Date.now() });
        saveAllTicketsLocally(tickets);
    }

    function saveAllTicketsLocally(tickets) {
        try {
            localStorage.setItem(getStorageKey(), JSON.stringify(tickets));
        } catch (e) {
            console.error("ローカルストレージ保存失敗:", e);
        }
    }

    /**
     * 12. UI描画: 履歴テーブル
     */
    function updateHistoryTable() {
        const body = document.getElementById('draw-history-body');
        if (!body) return;

        body.innerHTML = "";

        if (serverHistory.length === 0) {
            body.innerHTML = `<tr><td colspan="3">履歴はありません</td></tr>`;
            return;
        }

        serverHistory.forEach(draw => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>第 ${draw.drawId} 回</td>
                <td>${draw.date || '-'}</td>
                <td><span class="win-num-badge">${String(draw.winningNumber).padStart(3, '0')}</span></td>
            `;
            body.appendChild(tr);
        });
    }

    /**
     * 13. UI描画: マイチケットリスト
     */
    function updateMyTicketsList() {
        const listContainer = document.getElementById('my-tickets-list');
        const countEl = document.getElementById('bought-count');
        if (!listContainer) return;

        const tickets = getMyTicketsLocally();
        const currentDrawTickets = tickets.filter(t => t.drawId === currentDrawId);

        listContainer.innerHTML = "";

        if (countEl) countEl.textContent = currentDrawTickets.length;

        if (currentDrawTickets.length === 0) {
            listContainer.innerHTML = `<div class="empty-list-msg">第 ${currentDrawId} 回のチケットを購入していません</div>`;
            return;
        }

        currentDrawTickets.forEach(t => {
            const div = document.createElement('div');
            div.className = "lottery-ticket";
            div.textContent = t.number;
            if (t.checked) {
                div.style.opacity = "0.6";
            }
            listContainer.appendChild(div);
        });
    }

    /**
     * 14. クイックピック (ランダム 3桁番号生成)
     */
    function quickPick() {
        const randomNum = Math.floor(Math.random() * 1000);
        const formatted = String(randomNum).padStart(3, '0');
        const numBtn = document.getElementById('lottery-num-btn');
        if (numBtn) {
            numBtn.setAttribute('data-amount', formatted);
            numBtn.textContent = formatted;
        }
    }

    /**
     * 15. 当選お祝い粒子エフェクト
     */
    function triggerWinEffects() {
        const container = document.getElementById('particle-container') || document.body;
        const items = ['🎉', '🎟️', '✨', '💎', '🪙', '👑'];

        for (let i = 0; i < 45; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.textContent = items[Math.floor(Math.random() * items.length)];
            p.style.left = Math.random() * 100 + 'vw';
            p.style.animationDelay = Math.random() * 1.5 + 's';
            p.style.fontSize = (Math.random() * 20 + 20) + 'px';
            container.appendChild(p);

            setTimeout(() => p.remove(), 4000);
        }
    }

    /**
     * 16. 初期化
     */
    function initLottery() {
        if (typeof window.loadData === 'function') window.loadData();
        refreshCurrencyUI();

        const buyBtn = document.getElementById('buy-ticket-btn');
        const quickBtn = document.getElementById('quick-pick-btn');
        const checkBtn = document.getElementById('check-results-btn');

        if (buyBtn) buyBtn.addEventListener('click', buyTicket);
        if (quickBtn) quickBtn.addEventListener('click', quickPick);
        if (checkBtn) checkBtn.addEventListener('click', checkResults);

        // 初期ステータス取得＆タイマー始動
        fetchLotteryStatus();
    }

    // DOM構築完了後に初期化実行
    document.addEventListener('DOMContentLoaded', initLottery);

})();