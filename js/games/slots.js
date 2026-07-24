// js/slots.js
window.SlotsGame = {
    _viewport: null,
    _reels: [],
    _strips: [],
    _spinning: false,
    _currentBet: 10,
    _sfx: null,
    _feverSpinsLeft: 0, // 確変（確率変動）モードの残り回数
    _activeSpinConfigs: null, // 現在のスピンで使用したリール配列
    _isCurrentFeverSpin: false, // 今回のスピンが確変スピンかどうか
    
    // 図柄（シンボル）を 8種類から 5種類に削減し、当たりやすさを大幅に向上
    _symbols: ['🍒', '🥑', '🛰️', '🗿', '📎'],
    _payouts: { '📎': 100, '🗿': 30, '🛰️': 15, '🥑': 5, '🍒': 2 },
    
    // 通常時のリール配列：全体的に図柄種が減ったことで、通常スピンでも非常に当たりやすくなっています
    _reelConfigs: [
        [4, 3, 0, 1, 2, 0, 1, 2, 3, 0, 4, 4, 4, 1, 2, 0, 3, 1, 2, 0, 4, 3, 1, 2],
        [4, 2, 1, 0, 3, 1, 0, 2, 3, 1, 4, 4, 4, 0, 2, 1, 3, 0, 2, 1, 4, 3, 0, 2],
        [4, 1, 2, 3, 0, 2, 3, 1, 0, 2, 4, 4, 4, 3, 1, 2, 0, 3, 1, 2, 4, 0, 3, 1]
    ],

    // 確変時のリール配列：高配当図柄（'📎', '🗿'）の構成比率を極端に高めた超高確率配列
    _feverReelConfigs: [
        [4, 3, 4, 1, 3, 2, 4, 3, 4, 1, 3, 2, 4, 3, 4, 1, 3, 2, 4, 3, 4],
        [4, 3, 2, 4, 3, 4, 4, 3, 2, 4, 3, 4, 4, 3, 2, 4, 3, 4, 4, 3, 4],
        [4, 3, 1, 2, 4, 3, 4, 2, 4, 3, 1, 4, 4, 3, 1, 2, 4, 3, 1, 4, 3]
    ],
    
    _currentPositions: [0, 0, 0],

    init(viewport) {
        this._viewport = viewport;
        this._sfx = window.CasinoSfx || null;
        this.injectStyles(); // 配当表と確変演出用のCSSスタイルを動的適用
        this.render();
        this.setupEventListeners();
        this.resizeReelCells();
        
        window.addEventListener('resize', () => this.resizeReelCells());
    },

    // UIを崩さず、レスポンシブに対応させるための独自スタイルの注入
    injectStyles() {
        if (document.getElementById('slots-extended-styles')) return;
        const style = document.createElement('style');
        style.id = 'slots-extended-styles';
        style.textContent = `
            .slots-main-container {
                display: flex;
                flex-direction: row;
                gap: 15px;
                margin-top: 15px;
                align-items: stretch;
                width: 100%;
            }
            .slots-paytable {
                flex: 0 0 160px;
                background: rgba(15, 15, 25, 0.9);
                border: 2px solid #ffd700;
                border-radius: 12px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
                color: #fff;
            }
            .paytable-title {
                color: #ffd700;
                text-align: center;
                font-weight: bold;
                font-size: 0.95rem;
                border-bottom: 2px solid #ffd700;
                padding-bottom: 6px;
                margin-bottom: 12px;
                letter-spacing: 1px;
            }
            .paytable-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .paytable-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 0.85rem;
                padding: 4px 0;
                border-bottom: 1px dashed rgba(255,255,255,0.1);
            }
            .paytable-item:last-child {
                border-bottom: none;
            }
            .pay-sym-wrapper {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .pay-sym {
                font-size: 1.3rem;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            }
            .pay-mul {
                color: #ffd700;
                font-weight: bold;
                font-family: monospace;
                text-align: right;
            }
            .pay-desc {
                font-size: 0.65rem;
                color: #ff4500;
                font-weight: bold;
                text-align: right;
                display: block;
            }
            .slots-machine-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 12px;
                min-width: 0;
            }
            
            /* コントロール・ボタン操作エリアのレスポンシブレイアウト */
            .slots-controls {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 15px;
                background: rgba(20, 20, 30, 0.9);
                border: 1px solid rgba(255, 215, 0, 0.15);
                border-radius: 12px;
                width: 100%;
                box-sizing: border-box;
            }
            .bet-display-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: bold;
                font-size: 1.1rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 6px;
            }
            .chips-container {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                justify-content: center;
                width: 100%;
            }
            .chip-btn {
                flex: 1 1 calc(33.3% - 6px); /* モバイル縦画面では横3〜4列 */
                min-width: 55px;
                padding: 8px 4px;
                font-size: 0.85rem;
                box-sizing: border-box;
            }
            #slots-btn-custom-bet {
                flex: 1 1 calc(33.3% - 6px);
                min-width: 55px;
                padding: 8px 4px;
                font-size: 0.85rem;
                box-sizing: border-box;
            }
            .action-row {
                display: flex;
                flex-direction: column;
                gap: 12px;
                width: 100%;
            }
            .banking-buttons {
                display: grid;
                grid-template-columns: repeat(2, 1fr); /* モバイルは誤タップしにくい2x2構成 */
                gap: 8px;
                width: 100%;
            }
            .banking-buttons .slots-btn {
                width: 100%;
                box-sizing: border-box;
                padding: 10px 4px;
                font-size: 0.85rem;
            }
            #slots-btn-spin {
                width: 100%;
                padding: 14px;
                font-size: 1.3rem;
                font-weight: bold;
                box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2);
            }
            
            /* 確変時の枠線・視覚的演出 */
            .fever-active-wrapper {
                border: 3px solid #ff4500 !important;
                box-shadow: 0 0 25px #ff4500, inset 0 0 15px rgba(255, 69, 0, 0.4) !important;
                animation: slotsFeverGlow 1.5s ease-in-out infinite alternate;
            }
            @keyframes slotsFeverGlow {
                0% { border-color: #ff4500; box-shadow: 0 0 20px #ff4500, inset 0 0 10px rgba(255, 69, 0, 0.3); }
                100% { border-color: #ff8c00; box-shadow: 0 0 35px #ff8c00, inset 0 0 25px rgba(255, 140, 0, 0.6); }
            }
            
            .text-fever {
                color: #ff4500 !important;
                text-shadow: 0 0 8px rgba(255, 69, 0, 0.8);
                font-weight: bold;
                animation: slotsFeverPulse 1s infinite alternate;
            }
            @keyframes slotsFeverPulse {
                0% { opacity: 0.8; transform: scale(1); }
                100% { opacity: 1; transform: scale(1.03); }
            }

            .fever-badge {
                background: linear-gradient(135deg, #ff4500, #ff8c00);
                color: #fff;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: bold;
                animation: slotsFeverPulse 0.5s infinite alternate;
                margin-left: 8px;
                display: inline-block;
                vertical-align: middle;
            }

            /* 横画面・大画面 (min-width: 769px) 用のレイアウト自動調整 */
            @media (min-width: 769px) {
                .chip-btn {
                    flex: 1; /* 横並びで均一に配置 */
                }
                #slots-btn-custom-bet {
                    flex: 1;
                }
                .action-row {
                    flex-direction: row;
                    align-items: stretch;
                }
                .banking-buttons {
                    flex: 1;
                    grid-template-columns: repeat(4, 1fr); /* 4ボタンを横1行に整列 */
                }
                #slots-btn-spin {
                    flex: 0 0 160px; /* デスクトップでは右側に適度な幅で配置 */
                    padding: 0 10px;
                    margin-top: 0;
                }
            }

            @media (max-width: 768px) {
                .slots-main-container {
                    flex-direction: column;
                }
                .slots-paytable {
                    flex: none;
                    width: 100%;
                    box-sizing: border-box;
                }
                .paytable-list {
                    flex-direction: row;
                    flex-wrap: wrap;
                    justify-content: space-around;
                    gap: 10px;
                }
                .paytable-item {
                    flex: 0 0 45%;
                    border-bottom: none;
                    background: rgba(255,255,255,0.05);
                    padding: 6px 10px;
                    border-radius: 6px;
                }
            }
        `;
        document.head.appendChild(style);
    },

    resizeReelCells() {
        const windowEl = document.querySelector('.slots-reel-window');
        if (!windowEl) return;
        
        const windowHeight = windowEl.clientHeight;
        const cellHeight = Math.floor(windowHeight / 3);

        const cells = document.querySelectorAll('.slots-cell');
        cells.forEach(cell => {
            cell.style.height = `${cellHeight}px`;
            cell.style.lineHeight = `${cellHeight}px`;
        });

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
        const atm = window.CasinoStorage.getAtm();

        this._viewport.innerHTML = `
            <div class="slots-game-wrapper">
                <div class="slots-header">
                    <button class="slots-btn slots-btn-sm" id="slots-btn-lobby">LOBBY</button>
                    <div class="slots-title">
                        🎰 Golden Slots
                        <span id="slots-fever-badge" class="fever-badge" style="display: none;">FEVER</span>
                    </div>
                    <div style="width: 60px;"></div>
                </div>

                <div class="slots-status-bar">
                    <div class="status-item">
                        <span class="status-label">BALANCE</span>
                        <span class="status-value text-gold" id="slots-val-balance">$${bankroll.toLocaleString()}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">ATM</span>
                        <span class="status-value text-gold" id="slots-val-atm">$${atm.toLocaleString()}</span>
                    </div>
                    <div class="status-item" id="slots-status-fever" style="display: none;">
                        <span class="status-label text-red">FEVER LEFT</span>
                        <span class="status-value text-fever" id="slots-val-fever">0</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">DEBT</span>
                        <span class="status-value text-red" id="slots-val-debt">$${debt.toLocaleString()}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">NET WORTH</span>
                        <span class="status-value" id="slots-val-net">$${(bankroll + atm - debt).toLocaleString()}</span>
                    </div>
                </div>

                <div class="slots-main-container">
                    <!-- 左側：配当表パネル -->
                    <div class="slots-paytable">
                        <div class="paytable-title">PAYTABLE</div>
                        <div class="paytable-list">
                            <div class="paytable-item">
                                <div class="pay-sym-wrapper">
                                    <span class="pay-sym">📎</span>
                                    <span>3つ揃い</span>
                                </div>
                                <div>
                                    <span class="pay-mul">x100</span>
                                    <span class="pay-desc">確変 +10回</span>
                                </div>
                            </div>
                            <div class="paytable-item">
                                <div class="pay-sym-wrapper">
                                    <span class="pay-sym">🗿</span>
                                    <span>3つ揃い</span>
                                </div>
                                <div>
                                    <span class="pay-mul">x30</span>
                                    <span class="pay-desc">確変 +5回</span>
                                </div>
                            </div>
                            <div class="paytable-item">
                                <div class="pay-sym-wrapper">
                                    <span class="pay-sym">🛰️</span>
                                    <span>3つ揃い</span>
                                </div>
                                <span class="pay-mul">x15</span>
                            </div>
                            <div class="paytable-item">
                                <div class="pay-sym-wrapper">
                                    <span class="pay-sym">🥑</span>
                                    <span>3つ揃い</span>
                                </div>
                                <span class="pay-mul">x5</span>
                            </div>
                            <div class="paytable-item">
                                <div class="pay-sym-wrapper">
                                    <span class="pay-sym">🍒</span>
                                    <span>3つ揃い</span>
                                </div>
                                <span class="pay-mul">x2</span>
                            </div>
                        </div>
                    </div>

                    <!-- 右側：スロットマシンメイン -->
                    <div class="slots-machine-area">
                        <div class="slots-machine">
                            <div class="slots-reels-container">
                                <div class="slots-reel-window">
                                    <div class="slots-payline-indicator line-top"></div>
                                    <div class="slots-payline-indicator line-mid"></div>
                                    <div class="slots-payline-indicator line-bot"></div>

                                    <div class="slots-reel">
                                        <div class="slots-strip" id="slots-strip-0"></div>
                                    </div>
                                    <div class="slots-reel">
                                        <div class="slots-strip" id="slots-strip-1"></div>
                                    </div>
                                    <div class="slots-reel">
                                        <div class="slots-strip" id="slots-strip-2"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="slots-message-bar" id="slots-msg">
                            チップを選択し、SPIN！
                        </div>

                        <div class="slots-controls">
                            <div class="bet-display-row">
                                <span>BET:</span>
                                <span class="text-gold" id="slots-val-bet">$${this._currentBet}</span>
                            </div>

                            <div class="chips-container">
                                <button class="chip-btn" data-amount="1">$1</button>
                                <button class="chip-btn" data-amount="5">$5</button>
                                <button class="chip-btn" data-amount="10">$10</button>
                                <button class="chip-btn" data-amount="50">$50</button>
                                <button class="chip-btn" data-amount="100">$100</button>
                                <button class="chip-btn" data-amount="500">$500</button>
                                <button class="slots-btn slots-btn-sm" id="slots-btn-custom-bet">CUSTOM</button>
                            </div>

                            <div class="action-row">
                                <div class="banking-buttons">
                                    <button class="slots-btn" id="slots-btn-borrow">BORROW</button>
                                    <button class="slots-btn" id="slots-btn-repay">REPAY</button>
                                    <button class="slots-btn" id="slots-btn-atm-dep">ATM DEP</button>
                                    <button class="slots-btn" id="slots-btn-atm-wdl">ATM WDL</button>
                                </div>
                                <button class="slots-btn slots-btn-gold slots-btn-lg" id="slots-btn-spin">SPIN</button>
                            </div>
                        </div>
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
        // 現在確変中かどうかに応じて参照するリール配列を切り替える
        const configs = this._feverSpinsLeft > 0 ? this._feverReelConfigs : this._reelConfigs;
        this._reels.forEach((strip, idx) => {
            const config = configs[idx];
            let html = '';
            const expandedConfig = [...config, ...config, ...config, ...config, ...config];
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
                this.syncNetWorthToCloud();
            });
        });

        document.getElementById('slots-btn-repay').addEventListener('click', () => {
            window.CasinoNumpad.open('repay', () => {
                this.updateUI();
                this.syncNetWorthToCloud();
            });
        });

        document.getElementById('slots-btn-atm-dep').addEventListener('click', () => {
            window.CasinoNumpad.open('atm_deposit', () => {
                this.updateUI();
                this.syncNetWorthToCloud();
            });
        });

        document.getElementById('slots-btn-atm-wdl').addEventListener('click', () => {
            window.CasinoNumpad.open('atm_withdraw', () => {
                this.updateUI();
                this.syncNetWorthToCloud();
            });
        });
    },

    updateUI() {
        const bankroll = window.CasinoStorage.getBankroll();
        const debt = window.CasinoStorage.getDebt();
        const atm = window.CasinoStorage.getAtm();

        document.getElementById('slots-val-balance').textContent = `$${bankroll.toLocaleString()}`;
        document.getElementById('slots-val-atm').textContent = `$${atm.toLocaleString()}`;
        document.getElementById('slots-val-debt').textContent = `$${debt.toLocaleString()}`;
        document.getElementById('slots-val-net').textContent = `$${(bankroll + atm - debt).toLocaleString()}`;
        document.getElementById('slots-val-bet').textContent = `$${this._currentBet.toLocaleString()}`;

        // 確変（FEVER）状態のUI制御
        const feverStatusEl = document.getElementById('slots-status-fever');
        const feverValEl = document.getElementById('slots-val-fever');
        const feverBadgeEl = document.getElementById('slots-fever-badge');
        const wrapper = document.querySelector('.slots-game-wrapper');

        if (this._feverSpinsLeft > 0) {
            if (feverStatusEl) feverStatusEl.style.display = 'flex';
            if (feverValEl) feverValEl.textContent = `${this._feverSpinsLeft}回`;
            if (feverBadgeEl) feverBadgeEl.style.display = 'inline-block';
            if (wrapper) wrapper.classList.add('fever-active-wrapper');

            if (!this._spinning) {
                const msgEl = document.getElementById('slots-msg');
                if (msgEl) {
                    msgEl.textContent = `🔥 確変中！残り ${this._feverSpinsLeft} 回 🔥`;
                    msgEl.className = 'slots-message-bar text-fever';
                }
            }
        } else {
            if (feverStatusEl) feverStatusEl.style.display = 'none';
            if (feverBadgeEl) feverBadgeEl.style.display = 'none';
            if (wrapper) wrapper.classList.remove('fever-active-wrapper');

            if (!this._spinning) {
                const msgEl = document.getElementById('slots-msg');
                if (msgEl) {
                    msgEl.className = 'slots-message-bar';
                    msgEl.textContent = "チップを選択し、SPIN！";
                }
            }
        }

        document.querySelectorAll('.chip-btn').forEach(btn => {
            const amt = parseInt(btn.getAttribute('data-amount'), 10);
            btn.disabled = (amt > bankroll || this._spinning);
        });

        document.getElementById('slots-btn-spin').disabled = (this._currentBet > bankroll || this._currentBet <= 0 || this._spinning);
        document.getElementById('slots-btn-borrow').disabled = this._spinning;
        document.getElementById('slots-btn-repay').disabled = (debt <= 0 || bankroll <= 0 || this._spinning);
        document.getElementById('slots-btn-atm-dep').disabled = (bankroll < 1000 || this._spinning);
        document.getElementById('slots-btn-atm-wdl').disabled = (atm <= 0 || this._spinning);
        document.getElementById('slots-btn-custom-bet').disabled = this._spinning;
    },

    spin() {
        if (this._spinning) return;

        const bankroll = window.CasinoStorage.getBankroll();

        // 残高不足時の判定（シンプルな警告）
        if (this._currentBet > bankroll) {
            alert("残高が不足しています。BORROWから借金するか、ATMから引き出してください。");
            return;
        }

        window.CasinoStorage.setBankroll(bankroll - this._currentBet);

        // ★ 遅延利息システムによる自動利息徴収の実行 ★
        const interestResult = window.CasinoStorage.applyInterest();

        this._spinning = true;

        // 確変（FEVER）スピン判定と減算処理
        const isFeverSpin = this._feverSpinsLeft > 0;
        this._isCurrentFeverSpin = isFeverSpin;
        this._activeSpinConfigs = isFeverSpin ? this._feverReelConfigs : this._reelConfigs;
        if (isFeverSpin) {
            this._feverSpinsLeft--;
        }

        // リール構成およびセルの高さを現在のモードに即座に同期
        this.buildReels();
        this.resizeReelCells();
        this.updateUI();

        // 以前の各種演出用クラスをリセット
        document.querySelectorAll('.slots-cell').forEach(c => {
            c.className = 'slots-cell'; 
        });
        const msgEl = document.getElementById('slots-msg');
        msgEl.className = 'slots-message-bar';

        // 自動利息徴収の発生に応じた文面と確変中の処理
        if (interestResult.collected > 0 || interestResult.addedToDebt > 0) {
            let msg = `【利息徴収】金利として $${interestResult.collected.toLocaleString()} が徴収されました！`;
            if (interestResult.addedToDebt > 0) {
                msg += `（不足分 $${interestResult.addedToDebt.toLocaleString()} 借金上乗せ）`;
            }
            msgEl.textContent = msg;
            msgEl.classList.add('text-fever');
        } else if (isFeverSpin) {
            msgEl.textContent = `🔥 確変スピン！残り ${this._feverSpinsLeft} 回 🔥`;
            msgEl.classList.add('text-fever');
        } else {
            msgEl.textContent = "リール回転中...";
        }

        const wrapper = document.querySelector('.slots-game-wrapper');
        if (wrapper) wrapper.classList.remove('jackpot-shake');

        if (this._sfx) {
            this._sfx.playChips();
        }

        const windowEl = document.querySelector('.slots-reel-window');
        const cellHeight = windowEl ? Math.floor(windowEl.clientHeight / 3) : 80;
        const configLength = this._activeSpinConfigs[0].length;

        // 【巻き戻しフェーズ】
        this._reels.forEach((strip, reelIdx) => {
            const currentPos = this._currentPositions[reelIdx];
            const equivalentPos = currentPos % configLength;
            
            strip.style.transition = 'none';
            strip.style.transform = `translateY(-${equivalentPos * cellHeight}px)`;
            this._currentPositions[reelIdx] = equivalentPos;
        });

        // 強制リフロー
        this._reels.forEach(strip => {
            void strip.offsetHeight;
        });

        // 【回転開始: 予備動作】
        this._reels.forEach((strip, reelIdx) => {
            const currentPos = this._currentPositions[reelIdx];
            strip.style.transition = 'transform 0.15s cubic-bezier(0.36, 0.07, 0.19, 0.97)';
            strip.style.transform = `translateY(-${currentPos * cellHeight - 20}px)`;
        });

        // 予備動作完了後、高速スピンへ移行
        setTimeout(() => {
            this._reels.forEach((strip, reelIdx) => {
                strip.style.transition = 'transform 2.0s cubic-bezier(0.5, 0, 0.7, 0.2)';
                const cruisePos = this._currentPositions[reelIdx] + configLength * 3.5;
                strip.style.transform = `translateY(-${cruisePos * cellHeight}px)`;
                strip.classList.add('spinning');
            });
        }, 150);

        // 各リールの最終停止ターゲット位置
        const targetPositions = [
            Math.floor(Math.random() * this._activeSpinConfigs[0].length),
            Math.floor(Math.random() * this._activeSpinConfigs[1].length),
            Math.floor(Math.random() * this._activeSpinConfigs[2].length)
        ];

        // 各リールを時間差で減速開始
        const startDelay = [600, 1100, 1600];
        const decelerationDurations = [1.8, 2.4, 3.0];

        this._reels.forEach((strip, reelIdx) => {
            setTimeout(() => {
                const style = window.getComputedStyle(strip);
                const transform = style.transform || style.webkitTransform;
                let currentY = 0;
                if (transform && transform !== 'none') {
                    const matrix = window.DOMMatrix ? new DOMMatrix(transform) : new WebKitCSSMatrix(transform);
                    currentY = matrix.m42;
                }

                strip.style.transition = 'none';
                strip.style.transform = `translateY(${currentY}px)`;
                strip.classList.remove('spinning');

                void strip.offsetHeight;

                const currentCellPos = Math.abs(currentY) / cellHeight;
                const targetPos = targetPositions[reelIdx];
                
                const minDistance = configLength * 1.5;
                let finalPos = Math.ceil((currentCellPos + minDistance) / configLength) * configLength + targetPos;

                const maxSafePos = configLength * 5 - 3;
                if (finalPos > maxSafePos) {
                    finalPos = Math.floor(maxSafePos / configLength) * configLength + targetPos;
                    if (finalPos > maxSafePos) finalPos -= configLength;
                }

                const duration = decelerationDurations[reelIdx];

                strip.style.transition = `transform ${duration}s cubic-bezier(0.15, 0.85, 0.3, 1.12)`;
                strip.style.transform = `translateY(-${finalPos * cellHeight}px)`;
                this._currentPositions[reelIdx] = finalPos;

                setTimeout(() => {
                    this.triggerStopShake();
                    if (this._sfx) this._sfx.playCoin();

                    if (reelIdx === 2) {
                        setTimeout(() => {
                            this.evaluateResult(targetPositions);
                        }, 350);
                    }
                }, duration * 1000);

            }, 150 + startDelay[reelIdx]);
        });
    },

    triggerStopShake() {
        const machine = document.querySelector('.slots-machine');
        if (!machine) return;
        machine.classList.add('stop-shake');
        setTimeout(() => {
            machine.classList.remove('stop-shake');
        }, 150);
    },

    evaluateResult(stopPositions) {
        const configs = this._activeSpinConfigs || this._reelConfigs;
        const visibleGrid = [];
        for (let r = 0; r < 3; r++) {
            const config = configs[r];
            const len = config.length;
            const stopPos = stopPositions[r];
            
            visibleGrid.push([
                config[stopPos % len],
                config[(stopPos + 1) % len],
                config[(stopPos + 2) % len]
            ]);
        }

        const paylines = [
            { id: 'top', line: [0, 0, 0], cells: [[0, 0], [1, 0], [2, 0]] },
            { id: 'mid', line: [1, 1, 1], cells: [[0, 1], [1, 1], [2, 1]] },
            { id: 'bot', line: [2, 2, 2], cells: [[0, 2], [1, 2], [2, 2]] },
            { id: 'diag1', line: [0, 1, 2], cells: [[0, 0], [1, 1], [2, 2]] },
            { id: 'diag2', line: [2, 1, 0], cells: [[0, 2], [1, 1], [2, 0]] }
        ];

        let totalWin = 0;
        const winLines = [];
        let feverSpinsWon = 0;

        paylines.forEach(p => {
            const sym0 = this._symbols[visibleGrid[0][p.line[0]]];
            const sym1 = this._symbols[visibleGrid[1][p.line[1]]];
            const sym2 = this._symbols[visibleGrid[2][p.line[2]]];

            if (sym0 === sym1 && sym1 === sym2) {
                const symVal = sym0;
                
                // 確変中の確変回数上乗せ禁止判定
                if (!this._isCurrentFeverSpin) {
                    if (symVal === '📎') {
                        feverSpinsWon += 10;
                    } else if (symVal === '🗿') {
                        feverSpinsWon += 5;
                    }
                }

                const payoutMultiplier = this._payouts[symVal] || 1;
                const winAmt = this._currentBet * payoutMultiplier;
                totalWin += winAmt;
                winLines.push(p);
            }
        });

        let feverTriggered = false;
        if (feverSpinsWon > 0) {
            this._feverSpinsLeft += feverSpinsWon;
            feverTriggered = true;
        }

        if (totalWin > 0) {
            const bankroll = window.CasinoStorage.getBankroll();
            window.CasinoStorage.setBankroll(bankroll + totalWin);

            // 最大勝利額の同期
            window.CasinoRanking.submitScore('slots_max_win', totalWin);

            const multiplier = totalWin / this._currentBet;

            // 当選倍率によるTier判定
            let tier = 1;
            if (multiplier >= 25 || feverTriggered) {
                tier = 3;
            } else if (multiplier >= 10) {
                tier = 2;
            }

            this.triggerWinEffects(tier, totalWin, winLines, feverTriggered, feverSpinsWon);

            if (this._sfx) this._sfx.playWin();
        } else {
            document.getElementById('slots-msg').textContent = "残念！もう一度挑戦しよう。";
            this._spinning = false;
            this.updateUI();
        }

        this.syncNetWorthToCloud();
    },

    syncNetWorthToCloud() {
        const currentNetWorth = window.CasinoStorage.getBankroll() + window.CasinoStorage.getAtm() - window.CasinoStorage.getDebt();
        window.CasinoRanking.submitScore('net_worth', currentNetWorth);
    },

    triggerWinEffects(tier, totalWin, winLines, feverTriggered = false, feverSpinsWon = 0) {
        const msgEl = document.getElementById('slots-msg');
        
        if (feverTriggered) {
            msgEl.textContent = `🔥 FEVER MODE 突入！確変 +${feverSpinsWon}回 (+$${totalWin.toLocaleString()}) 🔥`;
            msgEl.className = 'slots-message-bar text-fever';
        } else if (tier === 1) {
            msgEl.textContent = `🎉 WIN! $${totalWin.toLocaleString()} 獲得！`;
            msgEl.classList.add('win-tier1');
        } else if (tier === 2) {
            msgEl.textContent = `🌟 BIG WIN!! $${totalWin.toLocaleString()} 獲得！`;
            msgEl.classList.add('win-tier2');
        } else {
            msgEl.textContent = `👑 JACKPOT!!! $${totalWin.toLocaleString()} 獲得！`;
            msgEl.classList.add('win-tier3');
        }

        // 揃ったシンボルのハイライト
        winLines.forEach(p => {
            p.cells.forEach(coord => {
                const reelIdx = coord[0];
                const rowIdx = coord[1];
                const strip = this._reels[reelIdx];
                const finalPos = this._currentPositions[reelIdx];
                const domIndex = finalPos + rowIdx;
                const cellDom = strip.children[domIndex];
                if (cellDom) {
                    if (feverTriggered || tier === 3) {
                        cellDom.classList.add('win-highlight-tier3');
                        this.spawnParticlesAroundCell(cellDom);
                    } else if (tier === 2) {
                        cellDom.classList.add('win-highlight-tier2');
                        this.spawnParticlesAroundCell(cellDom);
                    } else {
                        cellDom.classList.add('win-highlight-tier1');
                    }
                }
            });
        });

        // 特殊物理エフェクト
        if (feverTriggered || tier === 3) {
            const wrapper = document.querySelector('.slots-game-wrapper');
            if (wrapper) {
                wrapper.classList.add('jackpot-shake');
                setTimeout(() => wrapper.classList.remove('jackpot-shake'), 2500);
            }
            this.triggerConfetti(80, true);
        } else if (tier === 2) {
            this.triggerConfetti(25, false);
        }

        // カウントアップ演出 & 同期制御
        if (tier === 3 || feverTriggered) {
            this.animateCountUp(totalWin, () => {
                this._spinning = false;
                this.updateUI();
            });
        } else {
            this._spinning = false;
            this.updateUI();
        }
    },

    spawnParticlesAroundCell(cellDom) {
        const rect = cellDom.getBoundingClientRect();
        const wrapper = document.querySelector('.slots-game-wrapper');
        if (!wrapper) return;
        const wrapperRect = wrapper.getBoundingClientRect();

        const x = rect.left - wrapperRect.left + rect.width / 2;
        const y = rect.top - wrapperRect.top + rect.height / 2;

        const colors = ['#ffd700', '#ff4500', '#ff8c00', '#39ff14', '#ffffff'];
        for (let i = 0; i < 12; i++) {
            const p = document.createElement('div');
            p.className = 'spark-particle';
            p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            const size = Math.random() * 4 + 4;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.left = `${x}px`;
            p.style.top = `${y}px`;

            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 60 + 20;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;

            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);

            wrapper.appendChild(p);
            setTimeout(() => p.remove(), 800);
        }
    },

    triggerConfetti(count = 40, isGoldOnly = false) {
        const wrapper = document.querySelector('.slots-game-wrapper');
        if (!wrapper) return;

        const colors = isGoldOnly 
            ? ['#ffd700', '#f3e5ab', '#ffdf7a', '#ffb300', '#ffffff']
            : ['#ffd700', '#ff4500', '#00e5ff', '#39ff14', '#ff9100'];

        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            const size = Math.random() * 8 + 6;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;

            p.style.left = `${Math.random() * 100}%`;
            p.style.top = `${Math.random() * 20}%`;

            const tx = (Math.random() - 0.5) * 300;
            const ty = Math.random() * 400 + 200;
            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);

            wrapper.appendChild(p);
            setTimeout(() => p.remove(), 1600);
        }
    },

    animateCountUp(targetAmount, onComplete) {
        const startBankroll = window.CasinoStorage.getBankroll() - targetAmount;
        const startTime = performance.now();
        const duration = 2000;
        const balanceValEl = document.getElementById('slots-val-balance');
        const netValEl = document.getElementById('slots-val-net');
        const debt = window.CasinoStorage.getDebt();
        const atm = window.CasinoStorage.getAtm();

        const update = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentAmount = Math.floor(startBankroll + targetAmount * easeProgress);

            if (balanceValEl) {
                balanceValEl.textContent = `$${currentAmount.toLocaleString()}`;
                balanceValEl.classList.add('pulse-text');
            }
            if (netValEl) {
                netValEl.textContent = `$${(currentAmount + atm - debt).toLocaleString()}`;
            }

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                if (balanceValEl) {
                    balanceValEl.classList.remove('pulse-text');
                }
                onComplete();
            }
        };

        requestAnimationFrame(update);
    }
};
