// js/lobby.js
const CasinoLobby = {
    init() {
        this.renderLobby();
    },

    renderLobby() {
        const viewport = document.getElementById('game-viewport');
        if (!viewport) return;

        const currentUsername = window.CasinoStorage.getUsername();

        // 左右2カラムのレイアウト構造をレンダリング（モバイル対応済みの共通CSSに対応）
        // ランキングタブに「poker_max_win」用のタブを含み、ロビーグリッドにポーカーカードを配置
        viewport.innerHTML = `
            <div class="lobby-container-two-column">
                <!-- 左ペイン (ランキングエリア) -->
                <div class="lobby-left-pane">
                    <div class="ranking-container">
                        <div class="ranking-top-bar">
                            <h1 class="ranking-title">🏆 Leaderboard</h1>
                        </div>

                        <div class="username-setting-area" style="display: flex; flex-direction: column; gap: 8px;">
                            <div class="username-display-label">
                                ユーザー名:<strong id="display-username-val">${currentUsername}</strong>
                            </div>
                            <div class="username-input-group">
                                <input type="text" class="username-input" id="input-new-username" placeholder="変更して確定" maxlength="15" value="${currentUsername}">
                            </div>
                            <div class="lobby-atm-area" style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.2);">
                                <span style="font-size: 0.85rem; color: #ffd700;">ATM残高: <strong id="lobby-atm-val">$${window.CasinoStorage.getAtm().toLocaleString()}</strong></span>
                                <button class="lobby-atm-btn" id="btn-lobby-atm" style="background: linear-gradient(135deg, #ffd700, #ffa500); color: #000; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">ATM操作</button>
                            </div>
                        </div>

                        <div class="ranking-tabs">
                            <button class="ranking-tab active" data-tab="net_worth">純資産</button>
                            <button class="ranking-tab" data-tab="blackjack_max_win">BJ最大勝利</button>
                            <button class="ranking-tab" data-tab="slots_max_win">スロット</button>
                            <button class="ranking-tab" data-tab="poker_max_win">ポーカー</button>
                        </div>

                        <div id="ranking-content-area" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                            <div class="ranking-loading">
                                <div class="spinner"></div>
                                <p>ランキング情報を取得中...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右ペイン (ゲーム選択エリア) -->
                <div class="lobby-right-pane">
                    <div class="lobby-container">
                        <h1 class="lobby-title">♠ CASINO PORTAL LOBBY ♦</h1>
                        <div class="lobby-grid">
                            <div class="lobby-card" id="btn-play-blackjack">
                                <div class="lobby-card-icon">🃏</div>
                                <h2 class="lobby-card-title">Blackjack Classic</h2>
                                <p class="lobby-card-desc">ダブルダウン・スプリットを完全搭載した王道ルールブラックジャック。</p>
                            </div>
                            <div class="lobby-card" id="btn-play-slots">
                                <div class="lobby-card-icon">🎰</div>
                                <h2 class="lobby-card-title">Golden Slots</h2>
                                <p class="lobby-card-desc">5本のラインが織り成す高配当。ダークグリーンとゴールドの豪華スロット機。</p>
                            </div>
                            <div class="lobby-card" id="btn-play-poker">
                                <div class="lobby-card-icon">👑</div>
                                <h2 class="lobby-card-title">Poker Classic</h2>
                                <p class="lobby-card-desc">配られた5枚のカードから残すものを選択し、最強の役（Jacks or Better）を狙おう。</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Blackjack起動イベント登録
        document.getElementById('btn-play-blackjack').addEventListener('click', () => {
            this.launchGame('blackjack');
        });

        // Slots起動イベント登録
        document.getElementById('btn-play-slots').addEventListener('click', () => {
            this.launchGame('slots');
        });

        // Poker起動イベント登録
        document.getElementById('btn-play-poker').addEventListener('click', () => {
            this.launchGame('poker');
        });

        // ロビー専用 ATM同期・更新用共通ヘルパー
        const updateLobbyUIAndSync = async () => {
            const atmVal = window.CasinoStorage.getAtm();
            const atmEl = document.getElementById('lobby-atm-val');
            if (atmEl) {
                atmEl.textContent = `$${atmVal.toLocaleString()}`;
            }
            const netWorth = window.CasinoStorage.getBankroll() + window.CasinoStorage.getAtm() - window.CasinoStorage.getDebt();
            await window.CasinoRanking.submitScore('net_worth', netWorth);
            loadAndRenderTables();
        };

        // ロビーでのATM操作イベント登録
        document.getElementById('btn-lobby-atm').addEventListener('click', () => {
            if (window.CasinoAtm) {
                window.CasinoAtm.open(updateLobbyUIAndSync);
            } else {
                console.warn("CasinoAtm module is not loaded.");
            }
        });

        // ユーザー名更新処理
        const inputEl = document.getElementById('input-new-username');
        let currentStoredName = currentUsername;

        const updateUsernameProcess = async () => {
            const newName = inputEl.value.trim();
            if (newName.length === 0) {
                alert("有効なユーザー名を入力してください。");
                inputEl.value = currentStoredName;
                return;
            }

            if (newName === currentStoredName) {
                return;
            }

            currentStoredName = newName;

            // ローカル保存
            window.CasinoStorage.setUsername(newName);
            document.getElementById('display-username-val').textContent = newName;

            // クラウド同期
            await window.CasinoRanking.registerUser(newName);
            const netWorth = window.CasinoStorage.getBankroll() + window.CasinoStorage.getAtm() - window.CasinoStorage.getDebt();
            await window.CasinoRanking.submitScore('net_worth', netWorth);

            // 更新を即座に反映
            loadAndRenderTables();
        };

        // モバイルの仮想キーボード閉鎖時に発火
        inputEl.addEventListener('blur', updateUsernameProcess);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                inputEl.blur(); 
            }
        });

        // タブ切り替え制御
        let activeTab = 'net_worth';
        let leaderboardData = null;
        const myUUID = window.CasinoStorage.getUUID();

        const tabButtons = viewport.querySelectorAll('.ranking-tab');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.target.getAttribute('data-tab');

                tabButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                activeTab = targetTab;
                renderActiveTable();
            });
        });

        const loadAndRenderTables = async () => {
            const contentArea = document.getElementById('ranking-content-area');
            if (!contentArea) return;

            contentArea.innerHTML = `
                <div class="ranking-loading">
                    <div class="spinner"></div>
                    <p>ランキングをロード中...</p>
                </div>
            `;
            leaderboardData = await window.CasinoRanking.fetchLeaderboard();
            renderActiveTable();
        };

        const renderActiveTable = () => {
            const contentArea = document.getElementById('ranking-content-area');
            if (!contentArea || !leaderboardData) return;

            const list = leaderboardData[activeTab] || [];
            let tableRowsHTML = '';

            if (list.length === 0) {
                tableRowsHTML = `<tr><td colspan="3" style="text-align: center; color: #888; padding: 30px;">記録がありません</td></tr>`;
            } else {
                list.forEach((item, index) => {
                    const rank = index + 1;
                    let rankClass = `rank-num`;
                    if (rank <= 3) {
                        rankClass += ` rank-${rank}`;
                    }
                    const isMe = item.uuid === myUUID;
                    const rowClass = isMe ? 'class="my-rank-row"' : '';

                    let formattedScore = `$${item.score.toLocaleString()}`;

                    tableRowsHTML += `
                        <tr ${rowClass}>
                            <td class="${rankClass}">${rank}</td>
                            <td>${escapeHTML(item.username)} ${isMe ? ' (あなた)' : ''}</td>
                            <td>${formattedScore}</td>
                        </tr>
                    `;
                });
            }

            contentArea.innerHTML = `
                <div class="ranking-table-wrapper">
                    <table class="ranking-table">
                        <thead>
                            <tr>
                                <th>順位</th>
                                <th>ユーザー名</th>
                                <th>${activeTab === 'net_worth' ? '純資産' : '最大勝利額'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHTML}
                        </tbody>
                    </table>
                </div>
            `;
        };

        const escapeHTML = (str) => {
            return str.replace(/[&<>'"]/g, 
                tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
            );
        };

        loadAndRenderTables();
    },

    launchGame(gameId) {
        const viewport = document.getElementById('game-viewport');
        if (!viewport) return;

        viewport.innerHTML = '';

        if (gameId === 'blackjack') {
            window.BlackjackGame.init(viewport);
        } else if (gameId === 'slots') {
            window.SlotsGame.init(viewport);
        } else if (gameId === 'poker') {
            // ビデオポーカー起動（DOM要素viewportを渡す形に統一）
            window.PokerGame.init(viewport);
        }
    },

    // 外部（ゲーム側）からロビーに戻るための呼び出し受付用インターフェース
    show() {
        this.renderLobby();
    }
};

window.addEventListener('DOMContentLoaded', () => {
    CasinoLobby.init();
});

window.CasinoLobby = CasinoLobby;