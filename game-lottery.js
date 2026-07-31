/**
 * ==========================================
 * Fever Casino - ワールドロト制御スクリプト (game-lottery.js)
 * BigInt & GAS API 連携完全対応版
 * ==========================================
 */

(function () {
    // --- 設定定数 ---
    const GAS_LOTTERY_API_URL = "https://script.google.com/macros/s/AKfycbw04W_6LCH7EisWjYQ3_7h6M9zI6o6N_X3t4f_g0Y5Z_example/exec"; // ※デプロイしたURLに差し替えてください
    const TICKET_PRICE = 1000n; // 1枚 1,000ドル
    const MAX_TICKETS = 10;     // 1人最大10枚
    const WIN_MULTIPLIER = 1000n; // 当選配当 (例: 1000倍)

    // --- 状態管理変数 ---
    let currentDrawId = 0;
    let nextDrawTime = null;
    let serverHistory = [];
    let isProcessing = false;
    let timerInterval = null;

    /**
     * 1. ユーティリティ: BigInt安全変換
     */
    function safeToBigInt(v) {
        if (typeof window.toBigInt === 'function') return window.toBigInt(v);
        try { return BigInt(v || 0); } catch (e) { return 0n; }
    }

    /**
     * 2. UI更新: 所持金・借金表示
     */
    function refreshCurrencyUI() {
        if (typeof window.updateUI === 'function') {
            window.updateUI();
        }
    }

    /**
     * 3. カウントダウンタイマーロジック
     */
    function startCountdown() {
        if (timerInterval) clearInterval(timerInterval);

        const timerEl = document.getElementById('countdown-timer');

        timerInterval = setInterval(() => {
            if (!nextDrawTime) return;

            const now = new Date().getTime();
            const target = new Date(nextDrawTime).getTime();
            const diff = target - now;

            if (diff <= 0) {
                timerEl.textContent = "抽選中... 発表をお楽しみに！";
                // 抽選時刻を過ぎたらサーバー情報を再取得
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
     * 4. GAS API通信: ステータス取得 (GET)
     */
    async function fetchLotteryStatus() {
        try {
            const response = await fetch(GAS_LOTTERY_API_URL);
            const data = await response.json();

            currentDrawId = data.currentDrawId;
            nextDrawTime = data.nextDrawTime;
            serverHistory = data.history || [];

            // UI反映
            document.getElementById('current-draw-id').textContent = currentDrawId;
            updateHistoryTable();
            updateMyTicketsList();
            startCountdown();

        } catch (error) {
            console.error("ロトステータスの取得に失敗:", error);
        }
    }

    /**
     * 5. チケット購入処理 (POST)
     */
    async function buyTicket() {
        if (isProcessing) return;

        const numBtn = document.getElementById('lottery-num-btn');
        const selectedNum = numBtn.getAttribute('data-amount').padStart(3, '0');
        const cash = safeToBigInt(window.playerData.cash);

        // バリデーション
        if (cash < TICKET_PRICE) {
            alert("所持金が足りません！");
            return;
        }

        // 現在の購入数確認
        const myTickets = getMyTicketsLocally();
        const currentDrawTickets = myTickets.filter(t => t.drawId === currentDrawId);
        if (currentDrawTickets.length >= MAX_TICKETS) {
            alert(`第${currentDrawId}回のチケットは上限（${MAX_TICKETS}枚）まで購入済みです。`);
            return;
        }

        if (!confirm(`チケット #${selectedNum} を ${window.formatCurrency(TICKET_PRICE)} で購入しますか？`)) {
            return;
        }

        isProcessing = true;
        const buyBtn = document.getElementById('buy-ticket-btn');
        buyBtn.disabled = true;
        buyBtn.textContent = "通信中...";

        try {
            // 1. 所持金引き落とし
            window.playerData.cash = cash - TICKET_PRICE;
            if (typeof window.saveData === 'function') window.saveData();

            // 2. サーバーに送信
            const payload = {
                userId: window.playerData.userId,
                userName: window.playerData.userName,
                drawId: currentDrawId,
                numbers: [selectedNum]
            };

            const response = await fetch(GAS_LOTTERY_API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.status === "success") {
                // 3. ローカルに保存（当選照合用）
                saveTicketLocally(currentDrawId, selectedNum);
                alert("購入完了！幸運を祈ります！");
                updateMyTicketsList();
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            alert("エラーが発生しました: " + error.message);
            // 失敗時はお金を戻す（簡易的）
            window.playerData.cash += TICKET_PRICE;
            window.saveData();
        } finally {
            isProcessing = false;
            buyBtn.disabled = false;
            buyBtn.textContent = "🎟️ 購入を確定";
            refreshCurrencyUI();
        }
    }

    /**
     * 6. 当選確認 & 配当受取
     */
    async function checkResults() {
        const myTickets = getMyTicketsLocally();
        if (myTickets.length === 0) {
            alert("購入済みのチケットがありません。");
            return;
        }

        let totalWinAmount = 0n;
        let winCount = 0;
        let processedAny = false;

        // 過去の当選番号履歴と照合
        serverHistory.forEach(draw => {
            const drawId = draw.drawId;
            const winningNum = String(draw.winningNumber).padStart(3, '0');

            myTickets.forEach(ticket => {
                if (ticket.drawId === drawId && !ticket.checked) {
                    processedAny = true;
                    if (ticket.number === winningNum) {
                        totalWinAmount += TICKET_PRICE * WIN_MULTIPLIER;
                        winCount++;
                        ticket.isWin = true;
                    }
                    ticket.checked = true; // 照合済みマーク
                }
            });
        });

        if (!processedAny) {
            alert("新しい抽選結果はありませんでした。");
            return;
        }

        if (winCount > 0) {
            window.playerData.cash = safeToBigInt(window.playerData.cash) + totalWinAmount;
            window.saveData();
            alert(`🎉 おめでとうございます！ ${winCount}件の当選があり、${window.formatCurrency(totalWinAmount)} を獲得しました！`);
            triggerWinEffects();
        } else {
            alert("残念！今回はハズレでした。");
        }

        saveAllTicketsLocally(myTickets);
        updateMyTicketsList();
        refreshCurrencyUI();
    }

    /**
     * 7. ローカルストレージ操作（チケット保存）
     */
    function getMyTicketsLocally() {
        const key = `lottery_tickets_${window.playerData.userId}`;
        return JSON.parse(localStorage.getItem(key) || "[]");
    }

    function saveTicketLocally(drawId, number) {
        const tickets = getMyTicketsLocally();
        tickets.push({ drawId, number, checked: false, isWin: false, timestamp: Date.now() });
        saveAllTicketsLocally(tickets);
    }

    function saveAllTicketsLocally(tickets) {
        const key = `lottery_tickets_${window.playerData.userId}`;
        localStorage.setItem(key, JSON.stringify(tickets));
    }

    /**
     * 8. UI描画: 履歴テーブル
     */
    function updateHistoryTable() {
        const body = document.getElementById('draw-history-body');
        body.innerHTML = "";

        if (serverHistory.length === 0) {
            body.innerHTML = `<tr><td colspan="3">履歴はありません</td></tr>`;
            return;
        }

        serverHistory.forEach(draw => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>第${draw.drawId}回</td>
                <td>${draw.date}</td>
                <td><span class="win-num-badge">${String(draw.winningNumber).padStart(3, '0')}</span></td>
            `;
            body.appendChild(tr);
        });
    }

    /**
     * 9. UI描画: マイチケットリスト
     */
    function updateMyTicketsList() {
        const listContainer = document.getElementById('my-tickets-list');
        const tickets = getMyTicketsLocally();
        const currentDrawTickets = tickets.filter(t => t.drawId === currentDrawId);

        listContainer.innerHTML = "";

        if (currentDrawTickets.length === 0) {
            listContainer.innerHTML = `<div class="empty-list-msg">第${currentDrawId}回のチケットを購入していません</div>`;
            document.getElementById('bought-count').textContent = "0";
            return;
        }

        document.getElementById('bought-count').textContent = currentDrawTickets.length;

        currentDrawTickets.forEach(t => {
            const div = document.createElement('div');
            div.className = "lottery-ticket";
            div.textContent = t.number;
            listContainer.appendChild(div);
        });
    }

    /**
     * 10. クイックピック (ランダム生成)
     */
    function quickPick() {
        const randomNum = Math.floor(Math.random() * 1000);
        const numBtn = document.getElementById('lottery-num-btn');
        numBtn.setAttribute('data-amount', String(randomNum));
        numBtn.textContent = String(randomNum).padStart(3, '0');
    }

    /**
     * 11. 当選時エフェクト
     */
    function triggerWinEffects() {
        const container = document.getElementById('particle-container');
        const items = ['🎉', '🎟️', '✨', '💎', '🪙'];
        for (let i = 0; i < 40; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.textContent = items[Math.floor(Math.random() * items.length)];
            p.style.left = Math.random() * 100 + 'vw';
            p.style.animationDelay = Math.random() * 2 + 's';
            p.style.fontSize = (Math.random() * 20 + 20) + 'px';
            container.appendChild(p);
            setTimeout(() => p.remove(), 4000);
        }
    }

    /**
     * 12. 初期化
     */
    function initLottery() {
        // 所持金等のデータロード
        if (typeof window.loadData === 'function') window.loadData();
        refreshCurrencyUI();

        // ボタンイベント登録
        document.getElementById('buy-ticket-btn').addEventListener('click', buyTicket);
        document.getElementById('quick-pick-btn').addEventListener('click', quickPick);
        document.getElementById('check-results-btn').addEventListener('click', checkResults);

        // サーバーから初期データ取得
        fetchLotteryStatus();
    }

    // DOMロード後に実行
    document.addEventListener('DOMContentLoaded', initLottery);

})();