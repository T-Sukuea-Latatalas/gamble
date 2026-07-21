/**
 * js/games/slots.js
 * 
 * 3x3グリッド・5ペイラインの高性能スロットゲーム。
 * ダークグリーンとゴールドのUIにマッチ。
 * window.CasinoStorage、window.CasinoNumpad、window.CasinoRanking、SoundEffects、createParticles との連携に対応。
 */

(function() {
    // --- 既存システム（CasinoStorage）との安全な連携ヘルパー ---
    function getBalance() {
        if (window.CasinoStorage && typeof window.CasinoStorage.getBankroll === 'function') {
            return window.CasinoStorage.getBankroll();
        }
        // 万が一オブジェクトが未定義の場合の一時的なメモリ上での仮保持フォールバック
        if (typeof window._temp_balance === 'undefined') {
            window._temp_balance = 1000;
        }
        return window._temp_balance;
    }

    function setBalance(val) {
        if (window.CasinoStorage && typeof window.CasinoStorage.setBankroll === 'function') {
            window.CasinoStorage.setBankroll(val);
        } else {
            window._temp_balance = val;
        }
    }

    function getDebt() {
        if (window.CasinoStorage && typeof window.CasinoStorage.getDebt === 'function') {
            return window.CasinoStorage.getDebt();
        }
        if (typeof window._temp_debt === 'undefined') {
            window._temp_debt = 0;
        }
        return window._temp_debt;
    }

    function setDebt(val) {
        if (window.CasinoStorage && typeof window.CasinoStorage.setDebt === 'function') {
            window.CasinoStorage.setDebt(val);
        } else {
            window._temp_debt = val;
        }
    }

    function saveStorage() {
        if (window.CasinoStorage && typeof window.CasinoStorage.save === 'function') {
            window.CasinoStorage.save();
        }
    }

    // --- スロットのシンボル（絵柄）設定 ---
    const SYMBOLS = [
        { char: '🍒', name: 'Cherry', multiplier: 2, weight: 40 },
        { char: '🍋', name: 'Lemon', multiplier: 3, weight: 28 },
        { char: '🔔', name: 'Bell', multiplier: 5, weight: 16 },
        { char: '💎', name: 'Diamond', multiplier: 10, weight: 11 },
        { char: '7️⃣', name: 'Seven', multiplier: 25, weight: 5 }
    ];

    // 重みに基づくランダムな絵柄の選定
    function getRandomSymbol() {
        const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const symbol of SYMBOLS) {
            if (rand < symbol.weight) {
                return symbol;
            }
            rand -= symbol.weight;
        }
        return SYMBOLS[0];
    }

    // ゲームオブジェクトの定義
    const SlotsGame = {
        container: null,
        currentBet: 10,
        isSpinning: false,
        prevGrid: null, // 前回の3x3出目

        init(containerElement) {
            this.container = containerElement;
            this.currentBet = 10;
            this.isSpinning = false;
            
            this.insertStyles();
            this.render();
            this.setupInitialReels();
            this.updateUI();
        },

        // 初期状態でリール画面にランダムな出目を配置
        setupInitialReels() {
            this.prevGrid = [];
            for (let col = 0; col < 3; col++) {
                const colSymbols = [];
                const stripEl = document.getElementById(`slots-strip-${col}`);
                if (!stripEl) continue;
                
                stripEl.innerHTML = '';
                stripEl.style.transition = 'none';
                stripEl.style.transform = 'translateY(0)';
                
                for (let row = 0; row < 3; row++) {
                    const sym = getRandomSymbol();
                    colSymbols.push(sym);
                    const cell = document.createElement('div');
                    cell.className = 'slots-cell';
                    cell.textContent = sym.char;
                    stripEl.appendChild(cell);
                }
                this.prevGrid.push(colSymbols);
            }
        },

        // HTML描画
        render() {
            this.container.innerHTML = `
                <div class="slots-game-wrapper">
                    <!-- ヘッダーエリア -->
                    <div class="slots-header">
                        <button class="slots-btn slots-lobby-btn" id="slots-lobby-btn">← LOBBY</button>
                        <div class="slots-title">🎰 GOLDEN SLOTS 🎰</div>
                        <div style="width: 90px;"></div> <!-- レイアウトの左右バランス用 -->
                    </div>
                    
                    <!-- 資金情報ステータス -->
                    <div class="slots-status-bar">
                        <div class="status-item">
                            <span class="status-label">BALANCE</span>
                            <span class="status-value" id="slots-balance-val">$0</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">DEBT</span>
                            <span class="status-value" id="slots-debt-val">$0</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">NET WORTH</span>
                            <span class="status-value text-gold" id="slots-networth-val">$0</span>
                        </div>
                    </div>
                    
                    <!-- スロット筐体 -->
                    <div class="slots-machine">
                        <div class="slots-reels-container">
                            <div class="slots-reel-window">
                                <!-- ペイラインガイドライン（装飾） -->
                                <div class="slots-payline-indicator line-top"></div>
                                <div class="slots-payline-indicator line-mid"></div>
                                <div class="slots-payline-indicator line-bot"></div>
                                
                                <div class="slots-reel" id="slots-reel-0">
                                    <div class="slots-strip" id="slots-strip-0"></div>
                                </div>
                                <div class="slots-reel" id="slots-reel-1">
                                    <div class="slots-strip" id="slots-strip-1"></div>
                                </div>
                                <div class="slots-reel" id="slots-reel-2">
                                    <div class="slots-strip" id="slots-strip-2"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- メッセージ表示エリア -->
                    <div class="slots-message-bar" id="slots-message-bar">
                        Place your bet and spin!
                    </div>
                    
                    <!-- コントロールエリア -->
                    <div class="slots-controls">
                        <div class="bet-display-row">
                            <span class="bet-label">CURRENT BET:</span>
                            <span class="bet-value text-gold" id="slots-bet-val">$10</span>
                        </div>
                        
                        <!-- ベット用チップ選択 -->
                        <div class="chips-container">
                            <button class="chip-btn" data-amount="1">$1</button>
                            <button class="chip-btn" data-amount="5">$5</button>
                            <button class="chip-btn" data-amount="10">$10</button>
                            <button class="chip-btn" data-amount="50">$50</button>
                            <button class="chip-btn" data-amount="100">$100</button>
                            <button class="chip-btn" data-amount="500">$500</button>
                            <button class="slots-btn slots-btn-sm" id="slots-btn-allin">ALL IN</button>
                            <button class="slots-btn slots-btn-sm" id="slots-btn-clear">CLEAR</button>
                        </div>
                        
                        <!-- バンキング・スピンアクション -->
                        <div class="action-row">
                            <div class="banking-buttons">
                                <button class="slots-btn" id="slots-btn-borrow">Borrow</button>
                                <button class="slots-btn" id="slots-btn-repay">Repay</button>
                            </div>
                            <button class="slots-btn slots-btn-gold slots-btn-lg" id="slots-btn-spin">SPIN</button>
                        </div>
                    </div>
                </div>
            `;
            
            this.bindEvents();
        },

        // イベントの紐付け
        bindEvents() {
            // ロビーに戻る
            document.getElementById('slots-lobby-btn').addEventListener('click', () => {
                if (this.isSpinning) return;
                if (window.CasinoLobby && typeof window.CasinoLobby.renderLobby === 'function') {
                    window.CasinoLobby.renderLobby();
                } else {
                    console.log('Lobby object is not found. Fallback: Reloading.');
                    location.reload();
                }
            });
            
            // スピン実行
            document.getElementById('slots-btn-spin').addEventListener('click', () => {
                this.spin();
            });
            
            // 各種チップボタン
            const chips = this.container.querySelectorAll('.chip-btn');
            chips.forEach(chip => {
                chip.addEventListener('click', (e) => {
                    if (this.isSpinning) return;
                    const amount = parseInt(e.target.getAttribute('data-amount'), 10);
                    this.currentBet += amount; // 上限10000の判定を削除
                    this.updateUI();
                    
                    if (window.SoundEffects && typeof window.SoundEffects.playCoin === 'function') {
                        window.SoundEffects.playCoin();
                    }
                });
            });
            
            // ALL IN
            document.getElementById('slots-btn-allin').addEventListener('click', () => {
                if (this.isSpinning) return;
                const bal = getBalance();
                if (bal > 0) {
                    this.currentBet = bal; // 上限10000の判定を削除
                    this.updateUI();
                    if (window.SoundEffects && typeof window.SoundEffects.playCoin === 'function') {
                        window.SoundEffects.playCoin();
                    }
                } else {
                    this.showMessage("No balance to All In. Try to 'Borrow' money first!");
                }
            });
            
            // CLEAR
            document.getElementById('slots-btn-clear').addEventListener('click', () => {
                if (this.isSpinning) return;
                this.currentBet = 0;
                this.updateUI();
                if (window.SoundEffects && typeof window.SoundEffects.playCoin === 'function') {
                    window.SoundEffects.playCoin();
                }
            });
            
            // 手動借金 (Borrow) - テンキー連携 (二重反映バグを防ぎUI/ランキングを単に更新)
            document.getElementById('slots-btn-borrow').addEventListener('click', () => {
                if (this.isSpinning) return;
                if (window.CasinoNumpad && typeof window.CasinoNumpad.open === 'function') {
                    window.CasinoNumpad.open('borrow', () => {
                        this.updateUI();
                        this.syncCloudNetWorth();
                        this.showMessage("Borrowed successfully via keypad.");
                    });
                } else {
                    // テンキーが未定義の場合のフォールバック
                    const amount = parseInt(prompt("Borrow Amount (Max $10,000):", "1000"), 10);
                    if (!isNaN(amount) && amount > 0) {
                        const balance = getBalance();
                        const debt = getDebt();
                        setBalance(balance + amount);
                        setDebt(debt + amount);
                        saveStorage();
                        this.updateUI();
                        this.syncCloudNetWorth();
                        this.showMessage(`Borrowed $${amount.toLocaleString()}`);
                    }
                }
            });
            
            // 手動返済 (Repay) - テンキー連携 (二重反映バグを防ぎUI/ランキングを単に更新)
            document.getElementById('slots-btn-repay').addEventListener('click', () => {
                if (this.isSpinning) return;
                const currentDebt = getDebt();
                const currentBalance = getBalance();
                const maxRepay = Math.min(currentDebt, currentBalance);
                
                if (maxRepay <= 0) {
                    this.showMessage("No debt to repay or insufficient balance.");
                    return;
                }
                
                if (window.CasinoNumpad && typeof window.CasinoNumpad.open === 'function') {
                    window.CasinoNumpad.open('repay', () => {
                        this.updateUI();
                        this.syncCloudNetWorth();
                        this.showMessage("Repaid successfully via keypad.");
                    });
                } else {
                    // テンキーが未定義の場合のフォールバック
                    const amount = parseInt(prompt(`Repay Amount (Max: $${maxRepay.toLocaleString()}):`, maxRepay.toString()), 10);
                    if (!isNaN(amount) && amount > 0) {
                        const balance = getBalance();
                        const debt = getDebt();
                        if (amount > balance) {
                            this.showMessage("Insufficient balance to repay this amount.");
                            return;
                        }
                        
                        const actualRepay = amount > debt ? debt : amount;
                        setBalance(balance - actualRepay);
                        setDebt(debt - actualRepay);
                        saveStorage();
                        this.updateUI();
                        this.syncCloudNetWorth();
                        this.showMessage(`Repaid $${actualRepay.toLocaleString()}`);
                    }
                }
            });
        },

        // 状態表示更新
        updateUI() {
            const balance = getBalance();
            const debt = getDebt();
            const netWorth = balance - debt;
            
            document.getElementById('slots-balance-val').textContent = `$${balance.toLocaleString()}`;
            document.getElementById('slots-debt-val').textContent = `$${debt.toLocaleString()}`;
            
            const nwEl = document.getElementById('slots-networth-val');
            nwEl.textContent = `$${netWorth.toLocaleString()}`;
            if (netWorth < 0) {
                nwEl.classList.remove('text-gold');
                nwEl.classList.add('text-red');
            } else {
                nwEl.classList.remove('text-red');
                nwEl.classList.add('text-gold');
            }
            
            document.getElementById('slots-bet-val').textContent = `$${this.currentBet.toLocaleString()}`;
            
            // スピン中のUI制御
            const buttonsToDisable = [
                'slots-lobby-btn',
                'slots-btn-spin',
                'slots-btn-allin',
                'slots-btn-clear',
                'slots-btn-borrow',
                'slots-btn-repay'
            ];
            
            buttonsToDisable.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = this.isSpinning;
            });
            
            const chips = this.container.querySelectorAll('.chip-btn');
            chips.forEach(chip => {
                chip.disabled = this.isSpinning;
            });
        },

        // 純資産スコアのクラウド同期
        syncCloudNetWorth() {
            if (window.CasinoRanking && typeof window.CasinoRanking.submitScore === 'function') {
                const currentNetWorth = getBalance() - getDebt();
                window.CasinoRanking.submitScore('net_worth', currentNetWorth);
            }
        },

        // メッセージ領域へのテキスト出力
        showMessage(msg) {
            const bar = document.getElementById('slots-message-bar');
            if (bar) bar.textContent = msg;
        },

        // スロット回転処理
        spin() {
            if (this.isSpinning) return;
            
            const bet = this.currentBet;
            if (bet <= 0) {
                this.showMessage("Please set a valid bet amount.");
                return;
            }
            
            // 自動借金ロジックとプレイヤー確認ダイアログの追加
            let balance = getBalance();
            if (balance < bet) {
                const needed = bet - balance;
                const borrowUnit = 1000;
                const borrowAmount = Math.ceil(needed / borrowUnit) * borrowUnit;
                
                // 確認ダイアログの表示
                const confirmed = confirm(`残高が不足しています。自動で$${borrowAmount.toLocaleString()}を借金してスピンしますか？`);
                if (!confirmed) {
                    this.showMessage("Spin canceled. Insufficient balance.");
                    return; // 早期リターン
                }
                
                const debt = getDebt();
                setDebt(debt + borrowAmount);
                setBalance(balance + borrowAmount);
                saveStorage();
                
                this.showMessage(`Auto-borrowed $${borrowAmount.toLocaleString()} to cover the bet.`);
                balance = getBalance();
            }
            
            if (balance < bet) {
                this.showMessage("Unable to bet. Balance is insufficient.");
                return;
            }
            
            this.isSpinning = true;
            this.updateUI();
            
            // ベット額を差し引く
            setBalance(balance - bet);
            saveStorage();
            this.updateUI();
            
            // 開始効果音
            if (window.SoundEffects && typeof window.SoundEffects.playCoin === 'function') {
                window.SoundEffects.playCoin();
            }
            
            // 抽選（出目の決定）
            const nextGrid = [];
            for (let col = 0; col < 3; col++) {
                const colSymbols = [];
                for (let row = 0; row < 3; row++) {
                    colSymbols.push(getRandomSymbol());
                }
                nextGrid.push(colSymbols);
            }
            
            // アニメーション設定
            const cellHeight = 90; // セル1つの高さ（CSSと同じ値）
            const totalCells = 30;  // 1リールに並べる一時ストリップ長
            
            for (let col = 0; col < 3; col++) {
                const stripEl = document.getElementById(`slots-strip-${col}`);
                if (!stripEl) continue;
                
                stripEl.innerHTML = '';
                stripEl.style.transition = 'none';
                stripEl.style.transform = 'translateY(0)';
                
                // 表示するためのダミー＆実出目のストリップ要素を生成
                // 0, 1, 2番目 -> 前回表示されていた出目をセット（滑らかに回り出すため）
                // 中間位置(3~26) -> ランダムな絵柄
                // 27, 28, 29番目(最後尾) -> 今回の抽選出目
                for (let i = 0; i < totalCells; i++) {
                    const cell = document.createElement('div');
                    cell.className = 'slots-cell';
                    
                    let sym;
                    if (i < 3) {
                        sym = this.prevGrid[col][i];
                    } else if (i >= totalCells - 3) {
                        sym = nextGrid[col][i - (totalCells - 3)];
                    } else {
                        sym = getRandomSymbol();
                    }
                    cell.textContent = sym.char;
                    stripEl.appendChild(cell);
                }
                
                // リフロー（CSS変更の確定）
                stripEl.offsetHeight;
                
                // 停止タイミングを左から右へとずらす（1.5s, 2.0s, 2.5s）
                const duration = 1.5 + col * 0.5;
                stripEl.style.transition = `transform ${duration}s cubic-bezier(0.15, 0.85, 0.3, 1)`;
                
                const translateVal = -cellHeight * (totalCells - 3); // translateY(-2430px)
                stripEl.style.transform = `translateY(${translateVal}px)`;
                
                // 各リールが停止したタイミングでの効果音
                setTimeout(() => {
                    if (window.SoundEffects && typeof window.SoundEffects.playCoin === 'function') {
                        window.SoundEffects.playCoin();
                    }
                }, duration * 1000);
            }
            
            // 最長リール停止後（2.5秒後）に判定処理へ
            setTimeout(() => {
                this.evaluateResult(nextGrid);
            }, 2500);
        },

        // 配当判定・結果処理
        evaluateResult(nextGrid) {
            this.prevGrid = nextGrid; // 次回用に保存
            
            const bet = this.currentBet;
            let totalPayout = 0;
            const winningLines = [];
            
            // 5本のペイライン座標（[リール位置, 行位置]）
            const PAYLINES = [
                { name: 'Top Row', coords: [[0,0], [1,0], [2,0]] },
                { name: 'Middle Row', coords: [[0,1], [1,1], [2,1]] },
                { name: 'Bottom Row', coords: [[0,2], [1,2], [2,2]] },
                { name: 'Diagonal Down', coords: [[0,0], [1,1], [2,2]] },
                { name: 'Diagonal Up', coords: [[0,2], [1,1], [2,0]] }
            ];
            
            // ペイラインごとに揃っているかチェック（トータルベット基準の配当に修正）
            for (const line of PAYLINES) {
                const c0 = nextGrid[line.coords[0][0]][line.coords[0][1]];
                const c1 = nextGrid[line.coords[1][0]][line.coords[1][1]];
                const c2 = nextGrid[line.coords[2][0]][line.coords[2][1]];
                
                if (c0.name === c1.name && c1.name === c2.name) {
                    const payout = Math.floor(bet * c0.multiplier);
                    totalPayout += payout;
                    winningLines.push({
                        line: line,
                        symbol: c0,
                        payout: payout
                    });
                }
            }
            
            const payoutProfit = totalPayout - bet;
            let hasSeven = false;
            
            if (totalPayout > 0) {
                // 配当を口座に加算
                const balance = getBalance();
                setBalance(balance + totalPayout);
                saveStorage();
                
                if (window.SoundEffects && typeof window.SoundEffects.playWin === 'function') {
                    window.SoundEffects.playWin();
                }
                
                // 揃ったセルのハイライト表示
                for (const wl of winningLines) {
                    if (wl.symbol.name === 'Seven') {
                        hasSeven = true;
                    }
                    for (const coord of wl.line.coords) {
                        const col = coord[0];
                        const row = coord[1];
                        const stripEl = document.getElementById(`slots-strip-${col}`);
                        if (stripEl) {
                            // 画面に表示されているセルのインデックスは27〜29
                            const cellIndex = 27 + row;
                            const cellEl = stripEl.children[cellIndex];
                            if (cellEl) {
                                cellEl.classList.add('win-highlight');
                            }
                        }
                    }
                }
                
                // 7️⃣揃い、または5倍以上の勝利時にゴールド紙吹雪
                if (hasSeven || totalPayout >= bet * 5) {
                    if (typeof createParticles === 'function') {
                        createParticles('gold');
                    } else if (window.createParticles) {
                        window.createParticles('gold');
                    }
                }
                
                const lineDetails = winningLines.map(wl => `${wl.line.name} (${wl.symbol.char} x${wl.symbol.multiplier})`).join(', ');
                this.showMessage(`🎉 WIN! Payout: $${totalPayout.toLocaleString()} [${lineDetails}]`);
            } else {
                // 敗北
                if (window.SoundEffects && typeof window.SoundEffects.playLose === 'function') {
                    window.SoundEffects.playLose();
                }
                this.showMessage(`Better luck next time! Lost $${bet.toLocaleString()}`);
            }
            
            // クラウドランキングへのデータ同期
            if (window.CasinoRanking && typeof window.CasinoRanking.submitScore === 'function') {
                const currentNetWorth = getBalance() - getDebt();
                window.CasinoRanking.submitScore('net_worth', currentNetWorth);
                
                if (payoutProfit > 0) {
                    window.CasinoRanking.submitScore('slots_max_win', payoutProfit);
                }
            }
            
            this.isSpinning = false;
            this.updateUI();
        },

        // CSSスタイルの動的注入
        insertStyles() {
            if (document.getElementById('slots-game-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'slots-game-styles';
            style.textContent = `
                .slots-game-wrapper {
                    background: radial-gradient(circle, #0e351d 0%, #05180c 100%);
                    color: #fff;
                    padding: 24px;
                    border-radius: 16px;
                    border: 3px solid #d4af37;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.6);
                    max-width: 640px;
                    margin: 0 auto;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                
                .slots-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid rgba(212, 175, 55, 0.3);
                    padding-bottom: 12px;
                }
                
                .slots-title {
                    font-size: 1.8rem;
                    font-weight: 900;
                    color: #d4af37;
                    text-shadow: 0 0 10px rgba(212, 175, 55, 0.6);
                    letter-spacing: 2px;
                }
                
                .slots-status-bar {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-bottom: 24px;
                    background: rgba(0,0,0,0.4);
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid rgba(212, 175, 55, 0.2);
                }
                
                .status-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                
                .status-label {
                    font-size: 0.75rem;
                    color: #888;
                    margin-bottom: 4px;
                    letter-spacing: 1px;
                }
                
                .status-value {
                    font-size: 1.2rem;
                    font-weight: bold;
                }
                
                .text-gold {
                    color: #d4af37;
                    text-shadow: 0 0 5px rgba(212, 175, 55, 0.4);
                }
                
                .text-red {
                    color: #ff4d4d;
                    text-shadow: 0 0 5px rgba(255, 77, 77, 0.4);
                }
                
                .slots-machine {
                    background: #082212;
                    border: 4px solid #d4af37;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 20px;
                    box-shadow: 0 0 25px rgba(212, 175, 55, 0.2), inset 0 0 20px rgba(0,0,0,0.8);
                    position: relative;
                }
                
                .slots-reels-container {
                    background: #000;
                    border-radius: 8px;
                    padding: 8px;
                    border: 2px solid rgba(212, 175, 55, 0.5);
                }
                
                .slots-reel-window {
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                    height: 270px;
                    overflow: hidden;
                    position: relative;
                    background: #050505;
                    border-radius: 4px;
                }
                
                .slots-payline-indicator {
                    position: absolute;
                    left: 0;
                    right: 0;
                    border-top: 1px dashed rgba(212, 175, 55, 0.15);
                    pointer-events: none;
                    z-index: 2;
                }
                .line-top { top: 45px; }
                .line-mid { top: 135px; }
                .line-bot { top: 225px; }
                
                .slots-reel {
                    width: 150px;
                    height: 270px;
                    overflow: hidden;
                    position: relative;
                    background: #0f0f0f;
                    border: 1px solid rgba(212, 175, 55, 0.2);
                    border-radius: 6px;
                }
                
                .slots-strip {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    position: absolute;
                    top: 0;
                    left: 0;
                }
                
                .slots-cell {
                    height: 90px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3rem;
                    user-select: none;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    box-sizing: border-box;
                    background: radial-gradient(circle, #1c1c1c 0%, #0c0c0c 100%);
                    transition: background 0.3s ease;
                }
                
                @keyframes win-blink {
                    0% { background: radial-gradient(circle, #d4af37 0%, #151000 100%); transform: scale(1); }
                    100% { background: radial-gradient(circle, #ffe270 0%, #302400 100%); transform: scale(1.05); }
                }
                
                .win-highlight {
                    animation: win-blink 0.4s ease-in-out infinite alternate;
                    border: 2px solid #d4af37;
                    box-shadow: 0 0 15px #d4af37;
                    z-index: 5;
                }
                
                .slots-message-bar {
                    background: rgba(0,0,0,0.5);
                    border: 1px solid rgba(212, 175, 55, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                    text-align: center;
                    font-size: 1rem;
                    min-height: 24px;
                    margin-bottom: 20px;
                    color: #d4af37;
                    font-weight: bold;
                    letter-spacing: 1px;
                }
                
                .slots-controls {
                    background: rgba(0,0,0,0.3);
                    border-radius: 12px;
                    padding: 16px;
                    border: 1px solid rgba(212, 175, 55, 0.15);
                }
                
                .bet-display-row {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    font-size: 1.1rem;
                    font-weight: bold;
                    margin-bottom: 12px;
                }
                
                .chips-container {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 8px;
                    margin-bottom: 18px;
                }
                
                .chip-btn {
                    background: radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%);
                    color: #fff;
                    border: 2px solid #fff;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-weight: 900;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                    transition: all 0.15s ease;
                }
                .chip-btn[data-amount="1"] { border-color: #ffffff; color: #ffffff; }
                .chip-btn[data-amount="5"] { border-color: #3b82f6; color: #3b82f6; }
                .chip-btn[data-amount="10"] { border-color: #ef4444; color: #ef4444; }
                .chip-btn[data-amount="50"] { border-color: #10b981; color: #10b981; }
                .chip-btn[data-amount="100"] { border-color: #f59e0b; color: #f59e0b; }
                .chip-btn[data-amount="500"] { border-color: #ec4899; color: #ec4899; }
                
                .chip-btn:hover:not(:disabled) {
                    transform: scale(1.15) rotate(15deg);
                    box-shadow: 0 0 10px rgba(255,255,255,0.4);
                }
                .chip-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                    transform: none !important;
                }
                
                .slots-btn-sm {
                    padding: 6px 12px !important;
                    font-size: 0.8rem !important;
                    border-radius: 20px !important;
                }
                
                .action-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                }
                
                .banking-buttons {
                    display: flex;
                    gap: 8px;
                }
                
                .slots-btn {
                    background: #082212;
                    color: #d4af37;
                    border: 1.5px solid #d4af37;
                    padding: 10px 18px;
                    font-size: 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.2s ease;
                    outline: none;
                }
                
                .slots-btn:hover:not(:disabled) {
                    background: #d4af37;
                    color: #082212;
                    box-shadow: 0 0 12px rgba(212, 175, 55, 0.4);
                }
                
                .slots-btn:disabled {
                    background: #111;
                    color: #555;
                    border-color: #333;
                    cursor: not-allowed;
                    box-shadow: none;
                }
                
                .slots-btn-gold {
                    background: #d4af37;
                    color: #082212;
                    border-color: #d4af37;
                }
                
                .slots-btn-gold:hover:not(:disabled) {
                    background: #fff;
                    color: #000;
                    box-shadow: 0 0 18px rgba(255, 215, 0, 0.8);
                }
                
                .slots-btn-lg {
                    padding: 14px 36px;
                    font-size: 1.3rem;
                    border-radius: 8px;
                    flex-grow: 1;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }
                
                .slots-lobby-btn {
                    padding: 6px 12px;
                    font-size: 0.85rem;
                }
            `;
            document.head.appendChild(style);
        }
    };

    // グローバルオブジェクトに登録
    window.SlotsGame = SlotsGame;
})();
