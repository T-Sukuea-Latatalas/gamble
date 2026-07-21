// js/slots.js
window.SlotsGame = {
    _viewport: null,
    _reels: [],
    _strips: [],
    _spinning: false,
    _currentBet: 10,
    _sfx: null,
    _symbols: ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣','™️'],
    _payouts: { '™️': 100, '7️⃣': 50, '💎': 25, '🔔': 15, '🍇': 10, '🍊': 5, '🍋': 3, '🍒': 2 },
    
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
        
        window.addEventListener('resize', () => this.resizeReelCells());
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

        this._viewport.innerHTML = `
            <div class="slots-game-wrapper">
                <div class="slots-header">
                    <button class="slots-btn slots-btn-sm" id="slots-btn-lobby">LOBBY</button>
                    <div class="slots-title">🎰 Golden Slots</div>
                    <div style="width: 60px;"></div>
                </div>

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

        window.CasinoStorage.setBankroll(bankroll - this._currentBet);
        this._spinning = true;
        this.updateUI();

        // 以前の各種演出用クラスをリセット
        document.querySelectorAll('.slots-cell').forEach(c => {
            c.className = 'slots-cell'; 
        });
        const msgEl = document.getElementById('slots-msg');
        msgEl.className = 'slots-message-bar';
        msgEl.textContent = "リール回転中...";

        const wrapper = document.querySelector('.slots-game-wrapper');
        if (wrapper) wrapper.classList.remove('jackpot-shake');

        if (this._sfx) {
            this._sfx.playChips();
        }

        const windowEl = document.querySelector('.slots-reel-window');
        const cellHeight = windowEl ? Math.floor(windowEl.clientHeight / 3) : 80;

        // 【回転開始: 予備動作（一瞬上に跳ね上がる）】
        this._reels.forEach((strip, reelIdx) => {
            const currentPos = this._currentPositions[reelIdx];
            strip.style.transition = 'transform 0.15s cubic-bezier(0.36, 0.07, 0.19, 0.97)';
            // 通常の位置より上に20px引っ張り、その後に加速回転へ
            strip.style.transform = `translateY(-${currentPos * cellHeight - 20}px)`;
        });

        // 予備動作完了後、高速巡航スピンへと移行
        setTimeout(() => {
            this._reels.forEach((strip) => {
                strip.style.transition = 'none'; // アニメーション中は transition を干渉させない
                strip.classList.add('spinning');
                strip.classList.add('spin-active-loop');
            });
        }, 150);

        const targetPositions = [
            Math.floor(Math.random() * this._reelConfigs[0].length),
            Math.floor(Math.random() * this._reelConfigs[1].length),
            Math.floor(Math.random() * this._reelConfigs[2].length)
        ];

        // 各リールを時間差で滑らかにバウンス停止させる
        this._reels.forEach((strip, reelIdx) => {
            setTimeout(() => {
                strip.classList.remove('spin-active-loop');
                strip.classList.remove('spinning');

                // 【オーバーシュート（バウンス）を表現するカスタムイージング】
                strip.style.transition = 'transform 0.6s cubic-bezier(0.15, 0.85, 0.3, 1.25)';

                const targetPos = targetPositions[reelIdx];
                const configLength = this._reelConfigs[reelIdx].length;
                const finalPos = targetPos + configLength; // 中段のコピーエリアに着地

                strip.style.transform = `translateY(-${finalPos * cellHeight}px)`;
                this._currentPositions[reelIdx] = finalPos;

                // 【時間差：停止時の画面揺れ（Screen Shake）】
                this.triggerStopShake();

                if (this._sfx) this._sfx.playCoin();

                if (reelIdx === 2) {
                    setTimeout(() => {
                        this.evaluateResult(targetPositions);
                    }, 650);
                }
            }, 800 + reelIdx * 500 + 150); // 予備動作時間(150ms)分オフセット
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
        const visibleGrid = [];
        for (let r = 0; r < 3; r++) {
            const config = this._reelConfigs[r];
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
        let hasJackpotSymbol = false;

        paylines.forEach(p => {
            const sym0 = this._symbols[visibleGrid[0][p.line[0]]];
            const sym1 = this._symbols[visibleGrid[1][p.line[1]]];
            const sym2 = this._symbols[visibleGrid[2][p.line[2]]];

            if (sym0 === sym1 && sym1 === sym2) {
                const symVal = sym0;
                if (symVal === '™️') {
                    hasJackpotSymbol = true;
                }
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

            const multiplier = totalWin / this._currentBet;

            // 当選倍率によるTier判定
            let tier = 1;
            if (multiplier >= 25 || hasJackpotSymbol) {
                tier = 3; // Tier 3: ジャックポット (x25〜 または TM揃い)
            } else if (multiplier >= 10) {
                tier = 2; // Tier 2: 高額当選 (x10〜)
            }

            // 特殊配当演出の発火
            this.triggerWinEffects(tier, totalWin, winLines);

            if (this._sfx) this._sfx.playWin();
        } else {
            document.getElementById('slots-msg').textContent = "残念！もう一度挑戦しよう。";
            this._spinning = false;
            this.updateUI();
        }

        const currentNetWorth = window.CasinoStorage.getBankroll() - window.CasinoStorage.getDebt();
        window.CasinoRanking.submitScore('net_worth', currentNetWorth);
    },

    triggerWinEffects(tier, totalWin, winLines) {
        const msgEl = document.getElementById('slots-msg');
        
        // 1. 各当選に応じたメッセージ表現
        if (tier === 1) {
            msgEl.textContent = `🎉 WIN! $${totalWin.toLocaleString()} 獲得！`;
            msgEl.classList.add('win-tier1');
        } else if (tier === 2) {
            msgEl.textContent = `🌟 BIG WIN!! $${totalWin.toLocaleString()} 獲得！`;
            msgEl.classList.add('win-tier2');
        } else {
            msgEl.textContent = `👑 JACKPOT!!! $${totalWin.toLocaleString()} 獲得！`;
            msgEl.classList.add('win-tier3');
        }

        // 2. 揃ったシンボルのハイライト
        winLines.forEach(p => {
            p.cells.forEach(coord => {
                const reelIdx = coord[0];
                const rowIdx = coord[1];
                const strip = this._reels[reelIdx];
                const finalPos = this._currentPositions[reelIdx];
                const domIndex = finalPos + rowIdx;
                const cellDom = strip.children[domIndex];
                if (cellDom) {
                    if (tier === 1) {
                        cellDom.classList.add('win-highlight-tier1');
                    } else if (tier === 2) {
                        cellDom.classList.add('win-highlight-tier2');
                        this.spawnParticlesAroundCell(cellDom);
                    } else {
                        cellDom.classList.add('win-highlight-tier3');
                    }
                }
            });
        });

        // 3. 特殊物理エフェクト（Confetti, Screen Shake）
        if (tier === 2) {
            this.triggerConfetti(25, false); // 中規模のカラフル紙吹雪
        } else if (tier === 3) {
            // ジャックポット全画面激震
            const wrapper = document.querySelector('.slots-game-wrapper');
            if (wrapper) {
                wrapper.classList.add('jackpot-shake');
                setTimeout(() => wrapper.classList.remove('jackpot-shake'), 2500);
            }
            this.triggerConfetti(80, true); // 大規模ゴールド紙吹雪
        }

        // 4. カウントアップ演出 & 同期制御
        if (tier === 3) {
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

        const colors = ['#ffd700', '#ff007f', '#00e5ff', '#39ff14', '#ffffff'];
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
            : ['#ffd700', '#ff007f', '#00e5ff', '#39ff14', '#ff9100'];

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
            const ty = Math.random() * 400 + 200; // 画面下部へ落下
            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);

            wrapper.appendChild(p);
            setTimeout(() => p.remove(), 1600);
        }
    },

    animateCountUp(targetAmount, onComplete) {
        const startBankroll = window.CasinoStorage.getBankroll() - targetAmount;
        const startTime = performance.now();
        const duration = 2000; // 2秒かけて上昇
        const balanceValEl = document.getElementById('slots-val-balance');
        const netValEl = document.getElementById('slots-val-net');
        const debt = window.CasinoStorage.getDebt();

        const update = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // イージング(3次曲線)で後半を緩やかに
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentAmount = Math.floor(startBankroll + targetAmount * easeProgress);

            if (balanceValEl) {
                balanceValEl.textContent = `$${currentAmount.toLocaleString()}`;
                balanceValEl.classList.add('pulse-text');
            }
            if (netValEl) {
                netValEl.textContent = `$${(currentAmount - debt).toLocaleString()}`;
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
