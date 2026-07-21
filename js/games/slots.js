// js/slots.js
// 既存のスロット初期化およびゲーム制御ロジックへのレスポンシブ拡張
window.SlotsGame = {
    _viewport: null,
    _reels: [],
    _strips: [],
    _spinning: false,
    _currentBet: 10,
    _sfx: null,
    _symbols: ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣','™️'],
    _payouts: { '™️': 100, '7️⃣': 50, '💎': 25, '🔔': 15, '🍇': 10, '🍊': 5, '🍋': 3, '🍒': 2 },
    
    // リールシンボルインデックス管理
    _reelConfigs: [
        [7, 6, 0, 1, 2, 3, 4, 5, 0, 3, 2, 4, 1, 5, 6, 0, 2, 4, 3, 1, 5],
        [7, 5, 1, 2, 0, 4, 3, 6, 1, 4, 0, 3, 2, 5, 6, 1, 3, 0, 4, 2, 5],
        [7, 4, 2, 3, 1, 0, 5, 6, 2, 5, 1, 0, 3, 4, 6, 2, 0, 1, 5, 3, 4]
    ],
    _currentPositions: [0, 0, 0],

    init(viewport) {
        this._viewport = viewport;
        this._sfx = window.CasinoSfx || null;
        this.render();
        this.setupEventListeners();
        this.resizeReelCells();
        
        // リサイズ時のセル高さ調整
        window.addEventListener('resize', () => this.resizeReelCells());
    },

    // 画面の高さに応じて各セルの高さを正しく動的再配置する
    resizeReelCells() {
        const windowEl = document.querySelector('.slots-reel-window');
        if (!windowEl) return;
        
        const windowHeight = windowEl.clientHeight;
        const cellHeight = Math.floor(windowHeight / 3); // 3行表示のため

        const cells = document.querySelectorAll('.slots-cell');
        cells.forEach(cell => {
            cell.style.height = `${cellHeight}px`;
            cell.style.lineHeight = `${cellHeight}px`;
        });

        // 停止中ポジションをリセット
        this._reels.forEach((strip, reelIdx) => {
            if (!this._spinning) {
                const pos = this._currentPositions[reelIdx];
                strip.style.transform = `translateY(-${pos * cellHeight}px)`;
            }
        });
    },

    render() {
        const bankroll = window.CasinoStorage.getBankroll();
        const debt = window.CasinoStorage.getDebt();

        this._viewport.innerHTML = `
            <div class="slots-game-wrapper">
                <!-- ヘッダー -->
                <div class="slots-header">
                    <button class="slots-btn slots-btn-sm" id="slots-btn-lobby">LOBBY</button>
                    <div class="slots-title">🎰 Golden Slots</div>
                    <div style="width: 60px;"></div> <!-- レイアウト均一用スペース -->
                </div>

                <!-- 資金情報ステータスバー -->
                <div class="slots-status-bar">
                    <div class="status-item">
                        <span class="status-label">BALANCE</span>
                        <span class="status-value text-gold" id="slots-val-balance">$${bankroll.toLocaleString()}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">DEBT</span>
                        <span class="status-value text-red" id="slots-val-debt">$${debt.toLocaleString()}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">NET WORTH</span>
                        <span class="status-value" id="slots-val-net">$${(bankroll - debt).toLocaleString()}</span>
                    </div>
                </div>

                <!-- スロットマシン本体 -->
                <div class="slots-machine">
                    <div class="slots-reels-container">
                        <div class="slots-reel-window">
                            <!-- デコレーション用ペイライン -->
                            <div class="slots-payline-indicator line-top"></div>
                            <div class="slots-payline-indicator line-mid"></div>
                            <div class="slots-payline-indicator line-bot"></div>

                            <!-- リール1 -->
                            <div class="slots-reel">
                                <div class="slots-strip" id="slots-strip-0"></div>
                            </div>
                            <!-- リール2 -->
                            <div class="slots-reel">
                                <div class="slots-strip" id="slots-strip-1"></div>
                            </div>
                            <!-- リール3 -->
                            <div class="slots-reel">
                                <div class="slots-strip" id="slots-strip-2"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- メッセージバー -->
                <div class="slots-message-bar" id="slots-msg">
                    チップを選択し、SPIN！
                </div>

                <!-- 操作パネル -->
                <div class="slots-controls">
                    <div class="bet-display-row">
                        <span>BET:</span>
                        <span class="text-gold" id="slots-val-bet">$${this._currentBet}</span>
                    </div>

                    <!-- チップ選択 -->
                    <div class="chips-container">
                        <button class="chip-btn" data-amount="1">$1</button>
                        <button class="chip-btn" data-amount="5">$5</button>
                        <button class="chip-btn" data-amount="10">$10</button>
                        <button class="chip-btn" data-amount="50">$50</button>
                        <button class="chip-btn" data-amount="100">$100</button>
                        <button class="chip-btn" data-amount="500">$500</button>
                        <button class="slots-btn slots-btn-sm" id="slots-btn-custom-bet">CUSTOM</button>
                    </div>

                    <!-- 各種操作ボタン -->
                    <div class="action-row">
                        <div class="banking-buttons">
                            <button class="slots-btn" id="slots-btn-borrow">BORROW</button>
                            <button class="slots-btn" id="slots-btn-repay">REPAY</button>
                        </div>
                        <button class="slots-btn slots-btn-gold slots-btn-lg" id="slots-btn-spin">SPIN</button>
                    </div>
                </div>
            </div>
        `;

        this._reels = [
            document.getElementById('slots-strip-0'),
            document.getElementById('slots-strip-1'),
            document.getElementById('slots-strip-2')
        ];

        this.buildReels();
        this.updateUI();
    },

    buildReels() {
        this._reels.forEach((strip, idx) => {
            const config = this._reelConfigs[idx];
            let html = '';
            // 無限ループ風に見せるための複製パディングを付与
            const expandedConfig = [...config, ...config, ...config];
            expandedConfig.forEach(symIdx => {
                html += `<div class="slots-cell">${this._symbols[symIdx]}</div>`;
            });
            strip.innerHTML = html;
        });
    },

    setupEventListeners() {
        document.getElementById('slots-btn-lobby').addEventListener('click', () => {
            if (this._spinning) return;
            window.CasinoLobby.init();
        });

        document.getElementById('slots-btn-spin').addEventListener('click', () => {
            this.spin();
        });

        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amt = parseInt(e.target.getAttribute('data-amount'), 10);
                this._currentBet = amt;
                this.updateUI();
                if (this._sfx) this._sfx.playCoin();
            });
        });

        document.getElementById('slots-btn-custom-bet').addEventListener('click', () => {
            window.CasinoNumpad.open('bet', (val) => {
                this._currentBet = val;
                this.updateUI();
            });
        });

        document.getElementById('slots-btn-borrow').addEventListener('click', () => {
            window.CasinoNumpad.open('borrow', () => {
                this.updateUI();
            });
        });

        document.getElementById('slots-btn-repay').addEventListener('click', () => {
            window.CasinoNumpad.open('repay', () => {
                this.updateUI();
            });
        });
    },

    updateUI() {
        const bankroll = window.CasinoStorage.getBankroll();
        const debt = window.CasinoStorage.getDebt();

        document.getElementById('slots-val-balance').textContent = `$${bankroll.toLocaleString()}`;
        document.getElementById('slots-val-debt').textContent = `$${debt.toLocaleString()}`;
        document.getElementById('slots-val-net').textContent = `$${(bankroll - debt).toLocaleString()}`;
        document.getElementById('slots-val-bet').textContent = `$${this._currentBet.toLocaleString()}`;

        // チップボタン活性状況制御
        document.querySelectorAll('.chip-btn').forEach(btn => {
            const amt = parseInt(btn.getAttribute('data-amount'), 10);
            btn.disabled = (amt > bankroll || this._spinning);
        });

        document.getElementById('slots-btn-spin').disabled = (this._currentBet > bankroll || this._currentBet <= 0 || this._spinning);
        document.getElementById('slots-btn-borrow').disabled = this._spinning;
        document.getElementById('slots-btn-repay').disabled = (debt <= 0 || bankroll <= 0 || this._spinning);
        document.getElementById('slots-btn-custom-bet').disabled = this._spinning;
    },

    spin() {
        if (this._spinning) return;

        const bankroll = window.CasinoStorage.getBankroll();
        if (this._currentBet > bankroll) {
            alert("残高が不足しています。");
            return;
        }

        // ベットを差し引く
        window.CasinoStorage.setBankroll(bankroll - this._currentBet);
        this._spinning = true;
        this.updateUI();

        // 以前のハイライトを除去
        document.querySelectorAll('.slots-cell').forEach(c => c.classList.remove('win-highlight'));

        document.getElementById('slots-msg').textContent = "リール回転中...";

        if (this._sfx) {
            this._sfx.playChips(); // 開始効果音
        }

        // スピン開始（ブラーの適用とアニメーション活性化）
        this._reels.forEach((strip, reelIdx) => {
            strip.classList.add('spinning');
            strip.classList.add('spin-active-loop');
        });

        // 停止位置を決定 (ランダム)
        const targetPositions = [
            Math.floor(Math.random() * this._reelConfigs[0].length),
            Math.floor(Math.random() * this._reelConfigs[1].length),
            Math.floor(Math.random() * this._reelConfigs[2].length)
        ];

        const windowEl = document.querySelector('.slots-reel-window');
        const cellHeight = windowEl ? Math.floor(windowEl.clientHeight / 3) : 80;

        // 各リールを時間差で停止させる
        this._reels.forEach((strip, reelIdx) => {
            setTimeout(() => {
                strip.classList.remove('spin-active-loop');
                strip.classList.remove('spinning');

                const targetPos = targetPositions[reelIdx];
                // パディングを考慮して綺麗に着地させる
                const configLength = this._reelConfigs[reelIdx].length;
                const finalPos = targetPos + configLength; // 中段のコピーエリアに着地

                strip.style.transform = `translateY(-${finalPos * cellHeight}px)`;
                this._currentPositions[reelIdx] = finalPos;

                if (this._sfx) this._sfx.playCoin();

                // 最終リールが停止したタイミングで勝敗判定
                if (reelIdx === 2) {
                    setTimeout(() => {
                        this.evaluateResult(targetPositions);
                    }, 500);
                }
            }, 800 + reelIdx * 500);
        });
    },

    evaluateResult(stopPositions) {
        // 表示中のシンボルを抽出 (3リール×3行)
        // 着地位置 stopPositions は上段にあたる
        const visibleGrid = [];
        for (let r = 0; r < 3; r++) {
            const config = this._reelConfigs[r];
            const len = config.length;
            const stopPos = stopPositions[r];
            
            // 上、中、下の3セル
            visibleGrid.push([
                config[stopPos % len],
                config[(stopPos + 1) % len],
                config[(stopPos + 2) % len]
            ]);
        }

        // ペイライン定義: [r1_row, r2_row, r3_row]
        const paylines = [
            { id: 'top', line: [0, 0, 0], cells: [[0, 0], [1, 0], [2, 0]] },
            { id: 'mid', line: [1, 1, 1], cells: [[0, 1], [1, 1], [2, 1]] },
            { id: 'bot', line: [2, 2, 2], cells: [[0, 2], [1, 2], [2, 2]] },
            { id: 'diag1', line: [0, 1, 2], cells: [[0, 0], [1, 1], [2, 2]] },
            { id: 'diag2', line: [2, 1, 0], cells: [[0, 2], [1, 1], [2, 0]] }
        ];

        let totalWin = 0;
        const winLines = [];

        paylines.forEach(p => {
            const sym0 = this._symbols[visibleGrid[0][p.line[0]]];
            const sym1 = this._symbols[visibleGrid[1][p.line[1]]];
            const sym2 = this._symbols[visibleGrid[2][p.line[2]]];

            if (sym0 === sym1 && sym1 === sym2) {
                const symVal = sym0;
                const payoutMultiplier = this._payouts[symVal] || 1;
                const winAmt = this._currentBet * payoutMultiplier;
                totalWin += winAmt;
                winLines.push(p);
            }
        });

        if (totalWin > 0) {
            const bankroll = window.CasinoStorage.getBankroll();
            window.CasinoStorage.setBankroll(bankroll + totalWin);

            // 最大勝利額の同期
            window.CasinoRanking.submitScore('slots_max_win', totalWin);

            document.getElementById('slots-msg').textContent = `🎉 WIN! $${totalWin.toLocaleString()} 獲得！`;

            // 紙吹雪エフェクト
            this.triggerConfetti();

            // 揃ったラインのセルをハイライト
            winLines.forEach(p => {
                p.cells.forEach(coord => {
                    const reelIdx = coord[0];
                    const rowIdx = coord[1];
                    // パディングを加味して、画面上で露出しているセルDOMを見つける
                    const strip = this._reels[reelIdx];
                    const finalPos = this._currentPositions[reelIdx];
                    const domIndex = finalPos + rowIdx;
                    const cellDom = strip.children[domIndex];
                    if (cellDom) {
                        cellDom.classList.add('win-highlight');
                    }
                });
            });

            if (this._sfx) this._sfx.playWin();
        } else {
            document.getElementById('slots-msg').textContent = "残念！もう一度挑戦しよう。";
        }

        // 同期
        const currentNetWorth = window.CasinoStorage.getBankroll() - window.CasinoStorage.getDebt();
        window.CasinoRanking.submitScore('net_worth', currentNetWorth);

        this._spinning = false;
        this.updateUI();
    },

    triggerConfetti() {
        const wrapper = document.querySelector('.slots-game-wrapper');
        if (!wrapper) return;

        const colors = ['#ffd700', '#ff007f', '#00e5ff', '#39ff14', '#ff9100'];
        for (let i = 0; i < 40; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            const size = Math.random() * 8 + 6;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;

            // 中央から四方へ飛び散る
            p.style.left = '50%';
            p.style.top = '40%';

            const tx = (Math.random() - 0.5) * 400;
            const ty = (Math.random() - 0.5) * 400 - 100;
            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);

            wrapper.appendChild(p);

            setTimeout(() => p.remove(), 1200);
        }
    }
};
