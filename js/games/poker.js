/**
 * Video Poker (Jacks or Better) - Game Module
 * 既存のカジノシステムおよび css/poker.css と完全同期された1人プレイ用ビデオポーカー。
 */
(function() {
    'use strict';

    window.PokerGame = {
        container: null,
        wallet: 0,
        atm: 0,
        debt: 0,
        betAmount: 10,
        sfx: null,

        deck: [],
        hand: [], // 5枚のカードオブジェクト: { suit, value, hold }
        state: 'BETTING', // 'BETTING', 'ANIMATING', 'HOLD_PHASE', 'FINISHED'

        // Jacks or Better 役の定義と配当倍率
        payoutTable: [
            { key: 'ROYAL_FLUSH', name: 'ロイヤルストレートフラッシュ', mult: 250 },
            { key: 'STRAIGHT_FLUSH', name: 'ストレートフラッシュ', mult: 50 },
            { key: 'FOUR_OF_A_KIND', name: 'フォーカード', mult: 25 },
            { key: 'FULL_HOUSE', name: 'フルハウス', mult: 9 },
            { key: 'FLUSH', name: 'フラッシュ', mult: 6 },
            { key: 'STRAIGHT', name: 'ストレート', mult: 4 },
            { key: 'THREE_OF_A_KIND', name: 'スリーカード', mult: 3 },
            { key: 'TWO_PAIR', name: 'ツーペア', mult: 2 },
            { key: 'JACKS_OR_BETTER', name: 'ワンペア (J以上)', mult: 1 }
        ],

        /**
         * ゲーム初期化
         * @param {HTMLElement|string} viewport - ゲームを描画するコンテナ(DOM要素またはID)
         */
        init: function(viewport) {
            this.container = (typeof viewport === 'string') 
                ? document.getElementById(viewport) 
                : (viewport || document.body);

            // 音響効果インスタンスの生成
            if (window.SoundEffects && typeof window.SoundEffects === 'function') {
                try {
                    this.sfx = new window.SoundEffects();
                } catch (e) {
                    console.warn('SoundEffects init failed:', e);
                }
            }

            this.injectStyles(); // css/poker.css を優先するためインラインのCSS上書きを排除
            this.loadPlayerData();
            this.renderUI();
            this.updateDisplay();
            this.setState('BETTING');
        },

        /**
         * プレイヤーデータの読み込み (CasinoStorageとの正確かつ型安全な同期)
         */
        loadPlayerData: function() {
            if (window.CasinoStorage && typeof window.CasinoStorage.getBankroll === 'function') {
                const rawWallet = window.CasinoStorage.getBankroll();
                const rawAtm = window.CasinoStorage.getAtm();
                const rawDebt = window.CasinoStorage.getDebt();

                this.wallet = (typeof rawWallet === 'number' && !isNaN(rawWallet)) ? Math.max(0, rawWallet) : 0;
                this.atm = (typeof rawAtm === 'number' && !isNaN(rawAtm)) ? Math.max(0, rawAtm) : 0;
                this.debt = (typeof rawDebt === 'number' && !isNaN(rawDebt)) ? Math.max(0, rawDebt) : 0;
            } else {
                // フォールバック用のローカルストレージ
                const parsedW = parseInt(localStorage.getItem('casino_wallet') || '1000', 10);
                const parsedA = parseInt(localStorage.getItem('casino_atm') || '10000', 10);
                const parsedD = parseInt(localStorage.getItem('casino_debt') || '0', 10);

                this.wallet = (!isNaN(parsedW)) ? Math.max(0, parsedW) : 1000;
                this.atm = (!isNaN(parsedA)) ? Math.max(0, parsedA) : 10000;
                this.debt = (!isNaN(parsedD)) ? Math.max(0, parsedD) : 0;
            }
        },

        /**
         * プレイヤーデータの保存 (CasinoStorageとの正確かつ型安全な同期)
         */
        savePlayerData: function() {
            this.wallet = isNaN(this.wallet) ? 0 : Math.max(0, this.wallet);
            this.atm = isNaN(this.atm) ? 0 : Math.max(0, this.atm);
            this.debt = isNaN(this.debt) ? 0 : Math.max(0, this.debt);

            if (window.CasinoStorage && typeof window.CasinoStorage.setBankroll === 'function') {
                window.CasinoStorage.setBankroll(this.wallet);
                window.CasinoStorage.setAtm(this.atm);
                window.CasinoStorage.setDebt(this.debt);
            } else {
                // フォールバック用のローカルストレージ
                localStorage.setItem('casino_wallet', this.wallet.toString());
                localStorage.setItem('casino_atm', this.atm.toString());
                localStorage.setItem('casino_debt', this.debt.toString());
            }
        },

        /**
         * 共通システムへのスコア送信
         * @param {number} payout - 今回の配当額
         */
        submitScores: function(payout) {
            this.loadPlayerData();
            const netWorth = this.wallet + this.atm - this.debt;

            // クラウドランキングへの同期
            if (window.CasinoRanking && typeof window.CasinoRanking.submitScore === 'function') {
                window.CasinoRanking.submitScore('net_worth', netWorth);
                
                const profit = payout - this.betAmount;
                if (profit > 0) {
                    window.CasinoRanking.submitScore('poker_max_win', profit);
                }
            }
        },

        /**
         * 効果音の再生
         * @param {string} type - 'card', 'chip', 'click', 'win', 'lose'
         */
        playSound: function(type) {
            if (!this.sfx && window.SoundEffects && typeof window.SoundEffects === 'function') {
                try {
                    this.sfx = new window.SoundEffects();
                } catch (e) {
                    // Ignore sound error
                }
            }

            if (!this.sfx) return;

            try {
                switch (type) {
                    case 'card':
                        if (typeof this.sfx.playCard === 'function') this.sfx.playCard();
                        break;
                    case 'chip':
                    case 'click':
                        if (typeof this.sfx.playCoin === 'function') this.sfx.playCoin();
                        break;
                    case 'win':
                        if (typeof this.sfx.playWin === 'function') this.sfx.playWin();
                        break;
                    case 'lose':
                        if (typeof this.sfx.playLose === 'function') this.sfx.playLose();
                        break;
                    default:
                        if (typeof this.sfx.playCoin === 'function') this.sfx.playCoin();
                        break;
                }
            } catch (e) {
                console.warn('Sound play failed:', e);
            }
        },

        /**
         * スタイル管理
         * css/poker.css で高度な100dvhフレックス設計を定義しているためインライン上書きを無効化
         */
        injectStyles: function() {
            // css/poker.css の構造定義と競合しないよう動的注入を防止
        },

        /**
         * UIの動的構築
         */
        renderUI: function() {
            this.container.innerHTML = '';

            const wrapper = document.createElement('div');
            wrapper.id = 'poker-game-wrapper';

            // 1. ヘッダー
            const header = document.createElement('div');
            header.className = 'poker-header';

            const lobbyBtn = document.createElement('button');
            lobbyBtn.className = 'action-btn';
            lobbyBtn.innerText = '← ロビー';
            lobbyBtn.onclick = () => {
                this.playSound('click');
                if (window.CasinoLobby && typeof window.CasinoLobby.show === 'function') {
                    window.CasinoLobby.show();
                } else if (typeof window.showLobby === 'function') {
                    window.showLobby();
                } else {
                    alert('ロビーに戻るための関数が見つかりません。');
                }
            };

            const title = document.createElement('h2');
            title.innerText = 'VIDEO POKER';

            const atmBtn = document.createElement('button');
            atmBtn.className = 'action-btn';
            atmBtn.innerText = 'ATM 🏦';
            atmBtn.onclick = () => {
                this.playSound('click');
                if (window.CasinoAtm && typeof window.CasinoAtm.open === 'function') {
                    this.savePlayerData();
                    window.CasinoAtm.open(() => {
                        this.loadPlayerData();
                        this.updateDisplay();
                    });
                } else {
                    alert('共通ATMシステムがロードされていません。');
                }
            };

            header.appendChild(lobbyBtn);
            header.appendChild(title);
            header.appendChild(atmBtn);
            wrapper.appendChild(header);

            // 2. ステータスパネル
            const statusPanel = document.createElement('div');
            statusPanel.className = 'poker-status-panel';

            const statuses = [
                { label: 'Wallet', id: 'poker-wallet', val: `$${this.wallet.toLocaleString()}` },
                { label: 'ATM Balance', id: 'poker-atm', val: `$${this.atm.toLocaleString()}` },
                { label: 'Debt', id: 'poker-debt', val: `$${this.debt.toLocaleString()}` },
                { label: 'Current Bet', id: 'poker-bet', val: `$${this.betAmount.toLocaleString()}` }
            ];

            statuses.forEach(st => {
                const item = document.createElement('div');
                item.className = 'status-item';

                const label = document.createElement('div');
                label.className = 'status-label';
                label.innerText = st.label;

                const value = document.createElement('div');
                value.className = 'status-value';
                value.id = st.id;
                value.innerText = st.val;

                item.appendChild(label);
                item.appendChild(value);
                statusPanel.appendChild(item);
            });

            wrapper.appendChild(statusPanel);

            // 3. メインエリア（役とカード）
            const mainArea = document.createElement('div');
            mainArea.style.width = '100%';
            mainArea.style.display = 'flex';
            mainArea.style.flexDirection = 'column';
            mainArea.style.alignItems = 'center';

            // 役と配当倍率一覧
            const payoutTable = document.createElement('div');
            payoutTable.className = 'payout-table-summary';
            this.payoutTable.forEach(p => {
                const item = document.createElement('div');
                item.className = 'payout-item';
                item.id = `payout-${p.key}`;
                
                const nameSpan = document.createElement('span');
                nameSpan.innerText = p.name;
                
                const multSpan = document.createElement('span');
                multSpan.innerText = `x${p.mult}`;
                
                item.appendChild(nameSpan);
                item.appendChild(multSpan);
                payoutTable.appendChild(item);
            });
            mainArea.appendChild(payoutTable);

            // カードスロット（5枚分）
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'poker-cards-container';
            cardsContainer.id = 'poker-cards-container';

            for (let i = 0; i < 5; i++) {
                const slot = document.createElement('div');
                slot.className = 'poker-card-slot';
                slot.dataset.index = i;

                const wrapper3D = document.createElement('div');
                wrapper3D.className = 'card-wrapper-3d';

                const inner = document.createElement('div');
                inner.className = 'card-inner';

                const front = document.createElement('div');
                front.className = 'card-front';

                const back = document.createElement('div');
                back.className = 'card-back';

                inner.appendChild(front);
                inner.appendChild(back);
                wrapper3D.appendChild(inner);

                const holdInd = document.createElement('div');
                holdInd.className = 'hold-indicator';
                holdInd.innerText = 'HOLD';

                slot.appendChild(wrapper3D);
                slot.appendChild(holdInd);

                slot.onclick = () => {
                    if (this.state === 'HOLD_PHASE') {
                        this.toggleHold(i);
                    }
                };

                cardsContainer.appendChild(slot);
            }

            mainArea.appendChild(cardsContainer);
            wrapper.appendChild(mainArea);

            // 4. メッセージバー
            const messageBar = document.createElement('div');
            messageBar.className = 'message-bar';
            messageBar.id = 'poker-message-bar';
            messageBar.innerText = 'ベットを決めて、DEALボタンを押してください。';
            wrapper.appendChild(messageBar);

            // 5. コントロールパネル
            const controls = document.createElement('div');
            controls.className = 'poker-controls';

            const betPanel = document.createElement('div');
            betPanel.className = 'poker-bet-panel';

            // チップセレクター
            const chipSelector = document.createElement('div');
            chipSelector.className = 'chip-selector';
            const chipValues = [10, 50, 100, 500, 1000];
            chipValues.forEach(val => {
                const chipBtn = document.createElement('button');
                chipBtn.className = 'chip-btn';
                chipBtn.dataset.value = val;
                chipBtn.innerText = val >= 1000 ? `${val/1000}k` : val;
                chipBtn.onclick = () => {
                    if (this.state === 'BETTING' || this.state === 'FINISHED') {
                        this.playSound('chip');
                        if (val <= this.wallet) {
                            this.betAmount = val;
                        } else {
                            this.betAmount = this.wallet;
                        }
                        this.updateDisplay();
                    }
                };
                chipSelector.appendChild(chipBtn);
            });
            betPanel.appendChild(chipSelector);

            // Numpad連携ボタン群
            const betActionGroup = document.createElement('div');
            betActionGroup.style.display = 'flex';
            betActionGroup.style.gap = '6px';

            // ベット設定ボタン
            const betInputBtn = document.createElement('button');
            betInputBtn.className = 'action-btn';
            betInputBtn.innerText = 'ベット設定';
            betInputBtn.onclick = () => {
                if (this.state !== 'BETTING' && this.state !== 'FINISHED') return;
                this.playSound('click');
                if (window.CasinoNumpad && typeof window.CasinoNumpad.open === 'function') {
                    window.CasinoNumpad.open('bet', (val) => {
                        if (val === null) return;
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                            this.betAmount = Math.min(parsed, this.wallet);
                            this.updateDisplay();
                        }
                    });
                } else {
                    const val = prompt('ベット額を入力してください:', this.betAmount.toString());
                    if (val !== null) {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                            this.betAmount = Math.min(parsed, this.wallet);
                            this.updateDisplay();
                        }
                    }
                }
            };

            // 借入ボタン
            const borrowBtn = document.createElement('button');
            borrowBtn.className = 'action-btn';
            borrowBtn.innerText = '借入';
            borrowBtn.onclick = () => {
                this.playSound('click');
                if (window.CasinoNumpad && typeof window.CasinoNumpad.open === 'function') {
                    window.CasinoNumpad.open('borrow', (val) => {
                        this.loadPlayerData();
                        this.updateDisplay();
                        this.submitScores(0);
                        if (val !== null && val > 0) {
                            this.showMessage(`$${val.toLocaleString()} 借入しました。`);
                        }
                    });
                } else {
                    const val = prompt('借入額を入力してください:', '1000');
                    if (val !== null) {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                            this.loadPlayerData();
                            this.wallet += parsed;
                            this.debt += parsed;
                            this.savePlayerData();
                            this.updateDisplay();
                            this.submitScores(0);
                            this.showMessage(`$${parsed.toLocaleString()} 借入しました。`);
                        }
                    }
                }
            };

            // 返済ボタン
            const repayBtn = document.createElement('button');
            repayBtn.className = 'action-btn';
            repayBtn.innerText = '返済';
            repayBtn.onclick = () => {
                this.playSound('click');
                this.loadPlayerData();
                const maxRepay = Math.min(this.wallet, this.debt);
                if (maxRepay <= 0) {
                    this.showMessage('返済できる借金または十分な所持金がありません。');
                    return;
                }
                if (window.CasinoNumpad && typeof window.CasinoNumpad.open === 'function') {
                    window.CasinoNumpad.open('repay', (val) => {
                        this.loadPlayerData();
                        this.updateDisplay();
                        this.submitScores(0);
                        if (val !== null && val > 0) {
                            this.showMessage(`$${val.toLocaleString()} 返済しました。`);
                        }
                    });
                } else {
                    const val = prompt(`返済額を入力してください (最大 $${maxRepay.toLocaleString()}):`, maxRepay.toString());
                    if (val !== null) {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                            this.loadPlayerData();
                            const actualRepay = Math.min(parsed, this.wallet, this.debt);
                            this.wallet -= actualRepay;
                            this.debt -= actualRepay;
                            this.savePlayerData();
                            this.updateDisplay();
                            this.submitScores(0);
                            this.showMessage(`$${actualRepay.toLocaleString()} 返済しました。`);
                        }
                    }
                }
            };

            betActionGroup.appendChild(betInputBtn);
            betActionGroup.appendChild(borrowBtn);
            betActionGroup.appendChild(repayBtn);
            betPanel.appendChild(betActionGroup);
            controls.appendChild(betPanel);

            // DEAL / DRAW ボタン
            const actionRow = document.createElement('div');
            actionRow.className = 'action-row';

            const dealBtn = document.createElement('button');
            dealBtn.id = 'poker-btn-deal';
            dealBtn.className = 'action-btn btn-deal';
            dealBtn.innerText = 'DEAL';
            dealBtn.onclick = () => {
                if (this.state === 'BETTING' || this.state === 'FINISHED') {
                    this.deal();
                }
            };

            const drawBtn = document.createElement('button');
            drawBtn.id = 'poker-btn-draw';
            drawBtn.className = 'action-btn btn-draw';
            drawBtn.innerText = 'DRAW';
            drawBtn.disabled = true;
            drawBtn.onclick = () => {
                if (this.state === 'HOLD_PHASE') {
                    this.draw();
                }
            };

            actionRow.appendChild(dealBtn);
            actionRow.appendChild(drawBtn);
            controls.appendChild(actionRow);

            wrapper.appendChild(controls);
            this.container.appendChild(wrapper);
        },

        /**
         * 表示状況、ボタンの活性状態等の更新
         */
        updateDisplay: function() {
            this.loadPlayerData();

            // ベット額の最大上限調整
            if (this.betAmount > this.wallet) {
                this.betAmount = this.wallet;
            }
            if (this.wallet === 0) {
                this.betAmount = 0;
            } else if (this.betAmount === 0 && this.wallet > 0) {
                this.betAmount = Math.min(10, this.wallet);
            }

            const walletEl = document.getElementById('poker-wallet');
            const atmEl = document.getElementById('poker-atm');
            const debtEl = document.getElementById('poker-debt');
            const betEl = document.getElementById('poker-bet');

            if (walletEl) walletEl.innerText = `$${this.wallet.toLocaleString()}`;
            if (atmEl) atmEl.innerText = `$${this.atm.toLocaleString()}`;
            if (debtEl) debtEl.innerText = `$${this.debt.toLocaleString()}`;
            if (betEl) betEl.innerText = `$${this.betAmount.toLocaleString()}`;

            // チップのスタイル状態を同期
            const chipBtns = document.querySelectorAll('.chip-btn');
            chipBtns.forEach(btn => {
                const val = parseInt(btn.dataset.value, 10);
                if (val === this.betAmount) {
                    btn.classList.add('selected');
                } else {
                    btn.classList.remove('selected');
                }

                if (val > this.wallet || this.state === 'ANIMATING' || this.state === 'HOLD_PHASE') {
                    btn.disabled = true;
                    btn.style.opacity = '0.4';
                } else {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            });

            // アクションボタンの状態
            const dealBtn = document.getElementById('poker-btn-deal');
            const drawBtn = document.getElementById('poker-btn-draw');

            if (this.state === 'BETTING' || this.state === 'FINISHED') {
                if (dealBtn) dealBtn.disabled = (this.betAmount <= 0 || this.betAmount > this.wallet);
                if (drawBtn) drawBtn.disabled = true;
            } else if (this.state === 'HOLD_PHASE') {
                if (dealBtn) dealBtn.disabled = true;
                if (drawBtn) drawBtn.disabled = false;
            } else {
                if (dealBtn) dealBtn.disabled = true;
                if (drawBtn) drawBtn.disabled = true;
            }
        },

        /**
         * メッセージバーへの表示更新
         */
        showMessage: function(msg) {
            const msgEl = document.getElementById('poker-message-bar');
            if (msgEl) {
                msgEl.innerText = msg;
            }
        },

        /**
         * ゲーム状況（フェーズ）の設定
         */
        setState: function(state) {
            this.state = state;
            this.updateDisplay();
        },

        /**
         * カードを描画スロットに同期
         */
        updateCardSlot: function(index, card) {
            const slot = document.querySelector(`.poker-card-slot[data-index="${index}"]`);
            if (!slot) return;

            const front = slot.querySelector('.card-front');
            if (!front) return;

            front.className = `card-front suit-${card.suit} rank-${card.value}`;

            const suitSymbols = { 'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣' };
            const suitSymbol = suitSymbols[card.suit] || '';
            
            let rankText = card.value.toString();
            if (card.value === 1) rankText = 'A';
            if (card.value === 11) rankText = 'J';
            if (card.value === 12) rankText = 'Q';
            if (card.value === 13) rankText = 'K';

            front.innerHTML = `
                <div class="card-corner top-left">
                    <span class="rank">${rankText}</span>
                    <span class="suit">${suitSymbol}</span>
                </div>
                <div class="card-center">${suitSymbol}</div>
                <div class="card-corner bottom-right">
                    <span class="rank">${rankText}</span>
                    <span class="suit">${suitSymbol}</span>
                </div>
            `;
        },

        /**
         * HOLDの切り替え
         */
        toggleHold: function(index) {
            if (this.state !== 'HOLD_PHASE') return;

            this.hand[index].hold = !this.hand[index].hold;

            const slot = document.querySelector(`.poker-card-slot[data-index="${index}"]`);
            if (slot) {
                if (this.hand[index].hold) {
                    slot.classList.add('held');
                    this.playSound('chip');
                } else {
                    slot.classList.remove('held');
                    this.playSound('click');
                }
            }
        },

        /**
         * 52枚デッキの作成
         */
        createDeck: function() {
            const suits = ['S', 'H', 'D', 'C'];
            const deck = [];
            for (const suit of suits) {
                for (let v = 1; v <= 13; v++) {
                    deck.push({ suit: suit, value: v, hold: false });
                }
            }
            return deck;
        },

        /**
         * デッキのシャッフル
         */
        shuffleDeck: function(deck) {
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const temp = deck[i];
                deck[i] = deck[j];
                deck[j] = temp;
            }
            return deck;
        },

        /**
         * DEALアクション
         */
        deal: async function() {
            this.loadPlayerData();

            if (this.betAmount <= 0) {
                this.showMessage('ベット額を設定してください。');
                return;
            }
            if (this.betAmount > this.wallet) {
                this.showMessage('残高が不足しています。借入するかATMをご利用ください。');
                return;
            }

            this.setState('ANIMATING');

            // ベット額引き落とし
            this.wallet -= this.betAmount;

            // 共通システム：自動利息徴収（1行で流れるメッセージを生成）
            let interestMsg = '';
            if (window.CasinoStorage && typeof window.CasinoStorage.applyInterest === 'function') {
                try {
                    const interestRes = window.CasinoStorage.applyInterest();
                    if (interestRes) {
                        if (interestRes.collected > 0) {
                            interestMsg = `【自動金利】利息 $${interestRes.collected.toLocaleString()} 徴収。`;
                        } else if (interestRes.addedToDebt > 0) {
                            interestMsg = `【自動金利】利息 $${interestRes.addedToDebt.toLocaleString()} 借金上乗せ。`;
                        }
                    }
                } catch (e) {
                    console.warn('Apply interest failed:', e);
                }
            }

            this.savePlayerData();
            this.updateDisplay();

            // 役のハイライトリセット
            document.querySelectorAll('.payout-item').forEach(el => el.classList.remove('active-win'));

            // デッキの作成・シャッフル
            this.deck = this.shuffleDeck(this.createDeck());

            // 5枚ドロー
            this.hand = [];
            for (let i = 0; i < 5; i++) {
                const card = this.deck.pop();
                card.hold = false;
                this.hand.push(card);
            }

            this.showMessage('ディールしています...');

            // スロットの初期表示リセット（すべて裏向き）
            for (let i = 0; i < 5; i++) {
                const slot = document.querySelector(`.poker-card-slot[data-index="${i}"]`);
                if (slot) {
                    slot.classList.remove('held');
                    const wrapper = slot.querySelector('.card-wrapper-3d');
                    if (wrapper) wrapper.classList.remove('flipped');
                }
            }

            // カードのディレイ付きオープンアニメーション
            for (let i = 0; i < 5; i++) {
                await this.delay(200);
                this.updateCardSlot(i, this.hand[i]);
                const slot = document.querySelector(`.poker-card-slot[data-index="${i}"]`);
                if (slot) {
                    const wrapper = slot.querySelector('.card-wrapper-3d');
                    if (wrapper) {
                        wrapper.classList.add('flipped');
                        this.playSound('card');
                    }
                }
            }

            await this.delay(300);
            this.setState('HOLD_PHASE');

            let msg = 'キープするカードをタップし、DRAWを押してください。';
            if (interestMsg) {
                msg = `${interestMsg} ${msg}`;
            }
            this.showMessage(msg);
        },

        /**
         * DRAWアクション
         */
        draw: async function() {
            if (this.state !== 'HOLD_PHASE') return;

            this.setState('ANIMATING');
            this.showMessage('カードを交換しています...');

            let needsReplace = 0;
            // HOLDしていないカードを一度裏返して隠す
            for (let i = 0; i < 5; i++) {
                if (!this.hand[i].hold) {
                    needsReplace++;
                    const slot = document.querySelector(`.poker-card-slot[data-index="${i}"]`);
                    if (slot) {
                        const wrapper = slot.querySelector('.card-wrapper-3d');
                        if (wrapper) wrapper.classList.remove('flipped');
                    }
                }
            }

            if (needsReplace > 0) {
                await this.delay(400); // 裏返りモーション待機

                // カードの入れ替えとオープン
                for (let i = 0; i < 5; i++) {
                    if (!this.hand[i].hold) {
                        this.hand[i] = this.deck.pop();
                        this.hand[i].hold = false;
                        
                        this.updateCardSlot(i, this.hand[i]);
                        await this.delay(150);

                        const slot = document.querySelector(`.poker-card-slot[data-index="${i}"]`);
                        if (slot) {
                            const wrapper = slot.querySelector('.card-wrapper-3d');
                            if (wrapper) {
                                wrapper.classList.add('flipped');
                                this.playSound('card');
                            }
                        }
                    }
                }
                await this.delay(300);
            }

            // 役判定
            const result = this.evaluateHand(this.hand);
            const payout = this.betAmount * result.multiplier;

            this.loadPlayerData();
            this.wallet += payout;
            this.savePlayerData();

            // クラウド同期
            this.submitScores(payout);

            this.setState('FINISHED');
            this.updateDisplay();

            // 成立役のハイライト
            if (result.multiplier > 0) {
                const activeEl = document.getElementById(`payout-${result.rank}`);
                if (activeEl) {
                    activeEl.classList.add('active-win');
                }
                this.playSound('win');
                this.showMessage(`【${result.label}】成立！ 配当: $${payout.toLocaleString()} (x${result.multiplier})`);
            } else {
                this.playSound('lose');
                this.showMessage('役なし... ベット没収。次のゲームに挑戦しましょう！');
            }
        },

        /**
         * Jacks or Better 判定ロジック
         * @param {Array} cards - 5枚のカード配列
         * @returns {Object} 判定結果 { rank, multiplier, label }
         */
        evaluateHand: function(cards) {
            const counts = {};
            cards.forEach(c => {
                counts[c.value] = (counts[c.value] || 0) + 1;
            });

            const countValues = Object.values(counts).sort((a, b) => b - a);
            const uniqueValuesCount = Object.keys(counts).length;

            const isFlush = cards.every(c => c.suit === cards[0].suit);

            // ストレート判定
            let isStraight = false;
            let isRoyal = false;

            if (uniqueValuesCount === 5) {
                // Aを1とする場合(valsNormal)とAを14とする場合(valsAceHigh)を考慮
                const valsNormal = cards.map(c => c.value).sort((a, b) => a - b);
                const valsAceHigh = cards.map(c => c.value === 1 ? 14 : c.value).sort((a, b) => a - b);

                const checkStraight = (arr) => {
                    for (let i = 0; i < 4; i++) {
                        if (arr[i+1] - arr[i] !== 1) return false;
                    }
                    return true;
                };

                if (checkStraight(valsNormal)) {
                    isStraight = true;
                } else if (checkStraight(valsAceHigh)) {
                    isStraight = true;
                    // Aceがハイカード扱いでストレート（10, J, Q, K, A）
                    if (valsAceHigh[0] === 10) {
                        isRoyal = true;
                    }
                }
            }

            // 役の判定（強い役から順に）
            if (isFlush && isStraight && isRoyal) {
                return { rank: 'ROYAL_FLUSH', multiplier: 250, label: 'ロイヤルストレートフラッシュ' };
            }
            if (isFlush && isStraight) {
                return { rank: 'STRAIGHT_FLUSH', multiplier: 50, label: 'ストレートフラッシュ' };
            }
            if (countValues[0] === 4) {
                return { rank: 'FOUR_OF_A_KIND', multiplier: 25, label: 'フォーカード' };
            }
            if (countValues[0] === 3 && countValues[1] === 2) {
                return { rank: 'FULL_HOUSE', multiplier: 9, label: 'フルハウス' };
            }
            if (isFlush) {
                return { rank: 'FLUSH', multiplier: 6, label: 'フラッシュ' };
            }
            if (isStraight) {
                return { rank: 'STRAIGHT', multiplier: 4, label: 'ストレート' };
            }
            if (countValues[0] === 3) {
                return { rank: 'THREE_OF_A_KIND', multiplier: 3, label: 'スリーカード' };
            }
            if (countValues[0] === 2 && countValues[1] === 2) {
                return { rank: 'TWO_PAIR', multiplier: 2, label: 'ツーペア' };
            }
            if (countValues[0] === 2 && countValues[1] === 1) {
                // Jacks or Betterの判定
                let pairValue = 0;
                for (const valStr in counts) {
                    if (counts[valStr] === 2) {
                        pairValue = parseInt(valStr, 10);
                        break;
                    }
                }
                // J=11, Q=12, K=13, A=1
                if (pairValue === 11 || pairValue === 12 || pairValue === 13 || pairValue === 1) {
                    return { rank: 'JACKS_OR_BETTER', multiplier: 1, label: 'ワンペア (J以上)' };
                }
            }

            return { rank: 'HIGH_CARD', multiplier: 0, label: 'ノーハンド (役なし)' };
        },

        /**
         * 待機プロミス
         */
        delay: function(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    };
})();