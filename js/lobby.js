// js/lobby.js
const CasinoLobby = {
    init() {
        this.renderLobby();
    },

    renderLobby() {
        const viewport = document.getElementById('game-viewport');
        if (!viewport) return;

        const currentUsername = window.CasinoStorage.getUsername();
        const bankroll = window.CasinoStorage.getBankroll();
        const atm = window.CasinoStorage.getAtm();
        const debt = window.CasinoStorage.getDebt();

        // レイアウト構造
        viewport.innerHTML = `
            <div class="lobby-container-two-column">
                <!-- 左ペイン (ランキングエリア) -->
                <div class="lobby-left-pane">
                    <div class="ranking-container">
                        <div class="ranking-top-bar">
                            <h1 class="ranking-title">🏆 Leaderboard</h1>
                            <button class="lobby-atm-master-btn" id="btn-lobby-atm">🏧 ATM Menu</button>
                        </div>

                        <div class="username-setting-area">
                            <div class="username-display-label">
                                ユーザー: <strong id="display-username-val">${currentUsername}</strong>
                            </div>
                            <div class="lobby-mini-stats">
                                Balance: <span class="text-gold">$${bankroll.toLocaleString()}</span> | 
                                ATM: <span class="text-gold">$${atm.toLocaleString()}</span>
                            </div>
                            <div class="username-input-group">
                                <input type="text" class="username-input" id="input-new-username" placeholder="名前変更" maxlength="15" value="${currentUsername}">
                            </div>
                        </div>

                        <div class="ranking-tabs">
                            <button class="ranking-tab active" data-tab="net_worth">純資産</button>
                            <button class="ranking-tab" data-tab="blackjack_max_win">BJ勝利</button>
                            <button class="ranking-tab" data-tab="slots_max_win">スロット</button>
                        </div>

                        <div id="ranking-content-area" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                            <div class="ranking-loading">
                                <div class="spinner"></div>
                                <p>ロード中...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右ペイン (ゲーム選択エリア) -->
                <div class="lobby-right-pane">
                    <div class="lobby-container">
                        <h1 class="lobby-title">♠ CASINO PORTAL ♦</h1>
                        <div class="lobby-grid">
                            <div class="lobby-card" id="btn-play-blackjack">
                                <div class="lobby-card-icon">🃏</div>
                                <h2 class="lobby-card-title">Blackjack</h2>
                                <p class="lobby-card-desc">ダブルダウン・スプリット完備の王道BJ。</p>
                            </div>
                            <div class="lobby-card" id="btn-play-slots">
                                <div class="lobby-card-icon">🎰</div>
                                <h2 class="lobby-card-title">Golden Slots</h2>
                                <p class="lobby-card-desc">高配当5ライン、確変（FEVER）搭載モデル。</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // イベント登録
        document.getElementById('btn-play-blackjack').addEventListener('click', () => this.launchGame('blackjack'));
        document.getElementById('btn-play-slots').addEventListener('click', () => this.launchGame('slots'));
        
        // ATMメニュー起動
        document.getElementById('btn-lobby-atm').addEventListener('click', () => this.openAtmMenu());

        // ユーザー名更新処理
        const inputEl = document.getElementById('input-new-username');
        let currentStoredName = currentUsername;

        const updateUsernameProcess = async () => {
            const newName = inputEl.value.trim();
            if (newName.length === 0 || newName === currentStoredName) {
                inputEl.value = currentStoredName;
                return;
            }
            currentStoredName = newName;
            window.CasinoStorage.setUsername(newName);
            document.getElementById('display-username-val').textContent = newName;
            await window.CasinoRanking.registerUser(newName);
            this.syncNetWorth();
            loadAndRenderTables();
        };

        inputEl.addEventListener('blur', updateUsernameProcess);
        inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') inputEl.blur(); });

        // タブ切り替え
        let activeTab = 'net_worth';
        let leaderboardData = null;
        const myUUID = window.CasinoStorage.getUUID();

        const tabButtons = viewport.querySelectorAll('.ranking-tab');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                activeTab = e.target.getAttribute('data-tab');
                renderActiveTable();
            });
        });

        const loadAndRenderTables = async () => {
            const contentArea = document.getElementById('ranking-content-area');
            if (!contentArea) return;
            leaderboardData = await window.CasinoRanking.fetchLeaderboard();
            renderActiveTable();
        };

        const renderActiveTable = () => {
            const contentArea = document.getElementById('ranking-content-area');
            if (!contentArea || !leaderboardData) return;

            const list = leaderboardData[activeTab] || [];
            let tableRowsHTML = '';

            if (list.length === 0) {
                tableRowsHTML = `<tr><td colspan="3" style="text-align: center; color: #888; padding: 30px;">記録なし</td></tr>`;
            } else {
                list.forEach((item, index) => {
                    const rank = index + 1;
                    const isMe = item.uuid === myUUID;
                    tableRowsHTML += `
                        <tr ${isMe ? 'class="my-rank-row"' : ''}>
                            <td class="rank-num ${rank <= 3 ? 'rank-' + rank : ''}">${rank}</td>
                            <td>${escapeHTML(item.username)}${isMe ? ' (あなた)' : ''}</td>
                            <td>$${item.score.toLocaleString()}</td>
                        </tr>
                    `;
                });
            }

            contentArea.innerHTML = `
                <div class="ranking-table-wrapper">
                    <table class="ranking-table">
                        <thead>
                            <tr><th>順位</th><th>ユーザー</th><th>${activeTab === 'net_worth' ? '純資産' : '最大勝利'}</th></tr>
                        </thead>
                        <tbody>${tableRowsHTML}</tbody>
                    </table>
                </div>
            `;
        };

        const escapeHTML = (str) => str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));

        loadAndRenderTables();
    },

    openAtmMenu() {
        const choice = prompt("ATM操作を選択してください:\n1: 預金する (ATM DEPOSIT)\n2: 引き出す (ATM WITHDRAW)\n※キャンセルは空欄で確定またはキャンセルボタン");
        
        if (choice === '1') {
            window.CasinoNumpad.open('atm_deposit', () => {
                this.syncNetWorth();
                this.renderLobby();
            });
        } else if (choice === '2') {
            window.CasinoNumpad.open('atm_withdraw', () => {
                this.syncNetWorth();
                this.renderLobby();
            });
        }
    },

    syncNetWorth() {
        const netWorth = window.CasinoStorage.getBankroll() + window.CasinoStorage.getAtm() - window.CasinoStorage.getDebt();
        window.CasinoRanking.submitScore('net_worth', netWorth);
    },

    launchGame(gameId) {
        const viewport = document.getElementById('game-viewport');
        if (!viewport) return;
        viewport.innerHTML = '';
        if (gameId === 'blackjack') window.BlackjackGame.init(viewport);
        else if (gameId === 'slots') window.SlotsGame.init(viewport);
    }
};

window.addEventListener('DOMContentLoaded', () => CasinoLobby.init());
window.CasinoLobby = CasinoLobby;
