// js/lobby.js
const CasinoLobby = {
    init() {
        this.renderLobby();
    },

    // ポータルの共通メインコンテナにロビー画面を描画
    renderLobby() {
        const viewport = document.getElementById('game-viewport');
        if (!viewport) return;

        viewport.innerHTML = `
            <div class="lobby-container">
                <h1 class="lobby-title">♠ CASINO PORTAL LOBBY ♦</h1>
                <div class="lobby-grid">
                    <div class="lobby-card" id="btn-play-blackjack">
                        <div class="lobby-card-icon">🃏</div>
                        <h2 class="lobby-card-title">Blackjack Classic</h2>
                        <p class="lobby-card-desc">王道の4デッキブラックジャック。ダブルダウン、スプリット搭載。</p>
                    </div>
                    <div class="lobby-card disabled">
                        <div class="lobby-card-icon">🎰</div>
                        <h2 class="lobby-card-title">Slots</h2>
                        <p class="lobby-card-desc">Coming Soon...</p>
                    </div>
                    <div class="lobby-card disabled">
                        <div class="lobby-card-icon">🎡</div>
                        <h2 class="lobby-card-title">Roulette</h2>
                        <p class="lobby-card-desc">Coming Soon...</p>
                    </div>
                </div>
            </div>
        `;

        // ブラックジャック起動
        document.getElementById('btn-play-blackjack').addEventListener('click', () => {
            this.launchGame('blackjack');
        });
    },

    launchGame(gameId) {
        const viewport = document.getElementById('game-viewport');
        if (!viewport) return;

        viewport.innerHTML = ''; // ロビー画面を破棄（クリーンアンマウント）

        if (gameId === 'blackjack') {
            // ブラックジャックゲームモジュールを起動
            window.BlackjackGame.init(viewport);
        }
    }
};

// 起動開始
window.addEventListener('DOMContentLoaded', () => {
    CasinoLobby.init();
});

window.CasinoLobby = CasinoLobby;