// js/games/blackjack.js
// 汎用ウェイト用Promise（DEALやカード配布のタイミング制御用）
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const CHIP_VALUES = [1, 5, 10, 50, 100, 500, 1000, 5000];
const CHIP_CLASSES = {
    1: 'chip-1', 5: 'chip-5', 10: 'chip-10', 50: 'chip-50',
    100: 'chip-100', 500: 'chip-500', 1000: 'chip-1000', 5000: 'chip-5000'
};

const BlackjackGame = {
    currentBet: 0,
    deck: [],
    dealerHand: { cards: [], score: 0, visibleScore: 0 },
    playerHands: [],
    activeHandIndex: 0,
    gameState: 'betting',
    isProcessing: false,
    sfx: null,
    container: null,

    init(containerElement) {
        this.container = containerElement;
        this.sfx = new SoundEffects();
        
        // テンキーをブラックジャックの SoundEffects と同期してバインド
        window.CasinoNumpad.init(this.sfx);

        // UIテーブルをビューポートへレンダリング
        this.container.innerHTML = `
            <div class="blackjack-top-bar">
                <button class="back-lobby-btn" id="btn-back-lobby">← LOBBY</button>
            </div>
            <div class="header">
                <h1>♠ Blackjack Classic ♦</h1>
                <div class="balance-container">
                    <div class="info-box">残高: <span id="bankroll-val">$0</span></div>
                    <div class="info-box">ベット: <span id="bet-val">$0</span></div>
                    <div class="info-box">借金: <span id="debt-val">$0</span></div>
                </div>
            </div>
            <div class="table-area">
                <div class="dealer-section">
                    <h2 class="section-title">
                        Dealer <span id="dealer-score-badge" class="score-badge" style="display: none;">0</span>
                    </h2>
                    <div id="dealer-cards" class="cards-container"></div>
                </div>
                <div class="player-section">
                    <div id="player-hands-container" class="hands-container"></div>
                </div>
            </div>
            <div id="message-bar">チップをクリックしてベットを決め、DEALを押してください。</div>
            <div class="controls">
                <div class="chip-controls" id="chip-area"></div>
                <div class="action-controls">
                    <button class="action-btn deal-btn" id="btn-deal">DEAL</button>
                    <button class="action-btn" id="btn-hit">HIT</button>
                    <button class="action-btn" id="btn-stand">STAND</button>
                    <button class="action-btn" id="btn-double">DOUBLE</button>
                    <button class="action-btn" id="btn-split">SPLIT</button>
                </div>
            </div>
        `;

        // イベントバインド
        document.getElementById('btn-back-lobby').addEventListener('click', () => this.exitToLobby());
        document.getElementById('btn-deal').addEventListener('click', () => this.handleDealBtn());
        document.getElementById('btn-hit').addEventListener('click', () => this.hit());
        document.getElementById('btn-stand').addEventListener('click', () => this.stand());
        document.getElementById('btn-double').addEventListener('click', () => this.doubleDown());
        document.getElementById('btn-split').addEventListener('click', () => this.split());

        // デッキ再生成とゲーム状態初期化
        this.deck = this.createDeck();
        this.shuffle(this.deck);
        this.currentBet = 0;
        this.dealerHand = { cards: [], score: 0, visibleScore: 0 };
        this.playerHands = [];
        this.activeHandIndex = 0;
        this.gameState = 'betting';
        this.isProcessing = false;

        this.updateUI();
    },

    exitToLobby() {
        if (this.isProcessing) return;
        window.CasinoLobby.renderLobby();
    },

    createDeck() {
        const SUITS = ['♠', '♥', '♦', '♣'];
        const RANKS = [
            { name: 'A', value: 11 }, { name: '2', value: 2 }, { name: '3', value: 3 },
            { name: '4', value: 4 }, { name: '5', value: 5 }, { name: '6', value: 6 },
            { name: '7', value: 7 }, { name: '8', value: 8 }, { name: '9', value: 9 },
            { name: '10', value: 10 }, { name: 'J', value: 10 }, { name: 'Q', value: 10 },
            { name: 'K', value: 10 }
        ];
        const newDeck = [];
        const numDecks = 4;
        for (let d = 0; d < numDecks; d++) {
            for (const suit of SUITS) {
                for (const rank of RANKS) {
                    newDeck.push({
                        suit: suit,
                        name: rank.name,
                        value: rank.value,
                        isRed: (suit === '♥' || suit === '♦')
                    });
                }
            }
        }
        return newDeck;
    },

    shuffle(deckToShuffle) {
        for (let i = deckToShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deckToShuffle[i], deckToShuffle[j]] = [deckToShuffle[j], deckToShuffle[i]];
        }
    },

    drawCard() {
        if (this.deck.length === 0) {
            this.deck = this.createDeck();
            this.shuffle(this.deck);
            this.logMessage("シューに新しいカードを追加し、シャッフルしました。");
        }
        const card = this.deck.pop();
        card.id = 'card-' + Math.random().toString(36).substr(2, 9);
        card.isRevealed = false;
        card.hasAnimatedDeal = false;
        card.hasAnimatedReveal = false;
        return card;
    },

    calculateScore(cards) {
        let score = 0;
        let aces = 0;
        for (const card of cards) {
            score += card.value;
            if (card.name === 'A') {
                aces++;
            }
        }
        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }
        return score;
    },

    addBet(amount) {
        this.sfx.init();
        if (this.gameState !== 'betting' || this.isProcessing) return;
        
        const bankroll = window.CasinoStorage.getBankroll();
        const needed = this.currentBet + amount;
        if (bankroll >= needed) {
            this.currentBet = Math.max(0, this.currentBet + amount);
            this.sfx.playCoin();
            this.checkBankruptcy();
            this.updateUI();
        } else {
            const deficit = needed - bankroll;
            const remainingBorrowLimit = window.CasinoStorage.getRemainingBorrowLimit();

            if (remainingBorrowLimit <= 0) {
                if (window.CasinoStorage.checkAndHandleBankruptcy()) {
                    this.currentBet = 0;
                    this.updateUI();
                    return;
                }
                alert(`借金上限（$${window.CasinoStorage.getMaxDebt().toLocaleString()}）に達しているため、追加ベットできません。`);
                return;
            }

            const borrowCount = Math.ceil(deficit / 1000);
            let borrowAmount = borrowCount * 1000;
            if (borrowAmount > remainingBorrowLimit) {
                borrowAmount = remainingBorrowLimit;
            }

            if (bankroll + borrowAmount < needed) {
                alert(`借金可能額（残り $${remainingBorrowLimit.toLocaleString()}）を超過するため、$${amount} のベットを追加できません。`);
                return;
            }

            const proceed = confirm(`残高が不足しています。自動で$${borrowAmount}を借金してベットを追加しますか？`);
            if (proceed) {
                const debt = window.CasinoStorage.getDebt();
                window.CasinoStorage.setDebt(Math.max(0, debt + borrowAmount));
                window.CasinoStorage.setBankroll(Math.max(0, bankroll + borrowAmount));
                this.currentBet = Math.max(0, this.currentBet + amount);
                this.sfx.playCoin();
                this.checkBankruptcy();
                this.updateUI();
                this.syncCloudNetWorth(); // 借金発生時の純資産同期
            } else {
                this.logMessage("ベットの追加がキャンセルされました。");
            }
        }
    },

    clearBet() {
        this.sfx.init();
        if (this.gameState !== 'betting' || this.isProcessing) return;
        this.currentBet = 0;
        this.sfx.playCoin();
        this.checkBankruptcy();
        this.updateUI();
    },

    allIn() {
        this.sfx.init();
        const bankroll = window.CasinoStorage.getBankroll();
        if (this.gameState !== 'betting' || this.isProcessing || bankroll <= 0) return;
        this.currentBet = bankroll;
        this.sfx.playCoin();
        this.checkBankruptcy();
        this.updateUI();
    },

    borrow() {
        this.sfx.init();
        if (this.gameState !== 'betting' || this.isProcessing) return;
        if (window.CasinoStorage.getRemainingBorrowLimit() <= 0) {
            alert(`借金上限（$${window.CasinoStorage.getMaxDebt().toLocaleString()}）に達しているため、これ以上借入できません。`);
            return;
        }
        window.CasinoNumpad.open('borrow', () => {
            this.updateUI();
            this.syncCloudNetWorth(); // 手動借金時のクラウド同期
        });
    },

    repay() {
        this.sfx.init();
        const bankroll = window.CasinoStorage.getBankroll();
        const debt = window.CasinoStorage.getDebt();
        if (this.gameState !== 'betting' || this.isProcessing) return;
        if (debt <= 0 || bankroll <= 0) return;
        window.CasinoNumpad.open('repay', () => {
            this.checkBetValidity();
            this.updateUI();
            this.syncCloudNetWorth(); // 手動返済時のクラウド同期
        });
    },

    numpadBet() {
        this.sfx.init();
        if (this.gameState !== 'betting' || this.isProcessing) return;

        const applyBet = (amount) => {
            const betAmount = parseInt(amount, 10);
            if (isNaN(betAmount) || betAmount < 1) {
                this.logMessage("1以上の有効な数値を入力してください。");
                return;
            }
            this.currentBet = betAmount;
            this.checkBetValidity();
            this.sfx.playCoin();
            this.checkBankruptcy();
            this.updateUI();
        };

        if (window.CasinoNumpad && typeof window.CasinoNumpad.open === 'function') {
            window.CasinoNumpad.open('bet', (amount) => {
                applyBet(amount);
            });
        } else {
            const promptVal = prompt("ベット額を入力してください (最小 $1):", this.currentBet.toString());
            if (promptVal !== null) {
                applyBet(promptVal);
            }
        }
    },

    handleDealBtn() {
        this.sfx.init();
        if (this.isProcessing) return;
        if (this.gameState === 'betting') {
            this.deal();
        } else if (this.gameState === 'round-over') {
            this.nextRound();
        }
    },

    ensureFunds(amount) {
        if (isNaN(amount) || amount < 0) return false;
        let bankroll = window.CasinoStorage.getBankroll();
        if (bankroll >= amount) return true;

        const deficit = amount - bankroll;
        const remainingBorrowLimit = window.CasinoStorage.getRemainingBorrowLimit();

        if (remainingBorrowLimit <= 0) {
            if (window.CasinoStorage.checkAndHandleBankruptcy()) {
                this.currentBet = 0;
                this.updateUI();
                return false;
            }
            alert(`借金上限（$${window.CasinoStorage.getMaxDebt().toLocaleString()}）に達しているため、必要な資金（不足: $${deficit}）を借入できません。`);
            return false;
        }

        const borrowCount = Math.ceil(deficit / 1000);
        let borrowAmount = borrowCount * 1000;
        if (borrowAmount > remainingBorrowLimit) {
            borrowAmount = remainingBorrowLimit;
        }

        if (bankroll + borrowAmount < amount) {
            alert(`借金上限枠を超えるため、アクションに必要な資金を用意できません。`);
            return false;
        }

        const proceed = confirm(`アクション実行に残高が$${deficit}不足しています。自動で$${borrowAmount}を借金して処理を続行しますか？`);
        if (proceed) {
            let debt = window.CasinoStorage.getDebt();
            window.CasinoStorage.setDebt(Math.max(0, debt + borrowAmount));
            window.CasinoStorage.setBankroll(Math.max(0, bankroll + borrowAmount));
            this.updateUI();
            this.syncCloudNetWorth(); // 自動借金発生時の純資産同期
            return true;
        }
        return false;
    },

    async dealCardToPlayer(handIndex) {
        const card = this.drawCard();
        this.playerHands[handIndex].cards.push(card);
        this.updateUI();

        this.sfx.playCard();
        await sleep(50);

        card.isRevealed = true;
        const cardEl = document.getElementById(card.id);
        if (cardEl) {
            cardEl.classList.add('revealed');
        }

        await sleep(450);
        card.hasAnimatedReveal = true;

        this.playerHands[handIndex].score = this.calculateScore(this.playerHands[handIndex].cards);
        this.playerHands[handIndex].visibleScore = this.calculateScore(this.playerHands[handIndex].cards.filter(c => c.isRevealed));
        this.updateUI();
    },

    async dealCardToDealer(isHoleCard) {
        const card = this.drawCard();
        this.dealerHand.cards.push(card);
        this.updateUI();

        this.sfx.playCard();
        await sleep(50);

        if (!isHoleCard) {
            card.isRevealed = true;
            const cardEl = document.getElementById(card.id);
            if (cardEl) {
                cardEl.classList.add('revealed');
            }
            await sleep(450);
            card.hasAnimatedReveal = true;
        } else {
            await sleep(450);
        }

        this.dealerHand.score = this.calculateScore(this.dealerHand.cards);
        this.dealerHand.visibleScore = this.dealerHand.cards.filter(c => c.isRevealed).length > 0 ? this.calculateScore(this.dealerHand.cards.filter(c => c.isRevealed)) : 0;
        this.updateUI();
    },

    async revealDealerHoleCard() {
        const holeCard = this.dealerHand.cards.find(c => !c.isRevealed);
        if (holeCard) {
            holeCard.isRevealed = true;
            this.sfx.playCard();
            const cardEl = document.getElementById(holeCard.id);
            if (cardEl) {
                cardEl.classList.add('revealed');
            }
            await sleep(450);
            holeCard.hasAnimatedReveal = true;

            this.dealerHand.score = this.calculateScore(this.dealerHand.cards);
            this.dealerHand.visibleScore = this.calculateScore(this.dealerHand.cards.filter(c => c.isRevealed));
            this.updateUI();
        }
    },

    async deal() {
        if (this.currentBet <= 0 || this.gameState !== 'betting' || this.isProcessing) return;

        if (!this.ensureFunds(this.currentBet)) {
            this.logMessage("残高不足のため、DEALがキャンセルされました。");
            return;
        }

        this.isProcessing = true;

        let bankroll = window.CasinoStorage.getBankroll();
        window.CasinoStorage.setBankroll(Math.max(0, bankroll - this.currentBet));

        this.gameState = 'dealing';
        this.dealerHand = { cards: [], score: 0, visibleScore: 0 };
        this.playerHands = [{
            cards: [],
            bet: this.currentBet,
            status: 'playing',
            score: 0,
            visibleScore: 0,
            result: ''
        }];
        this.activeHandIndex = 0;
        this.updateUI();

        await this.dealCardToPlayer(0);
        await sleep(500);

        await this.dealCardToDealer(false);
        await sleep(500);

        await this.dealCardToPlayer(0);
        await sleep(500);

        await this.dealCardToDealer(true);
        await sleep(500);

        this.dealerHand.score = this.calculateScore(this.dealerHand.cards);
        this.playerHands[0].score = this.calculateScore(this.playerHands[0].cards);

        const playerHasBJ = this.playerHands[0].score === 21;
        const dealerHasBJ = this.dealerHand.score === 21;

        if (playerHasBJ || dealerHasBJ) {
            this.gameState = 'dealer-turn';
            this.updateUI();
            await this.revealDealerHoleCard();
            setTimeout(() => {
                this.endRound();
            }, 800);
        } else {
            this.gameState = 'player-turn';
            this.isProcessing = false;
            this.updateUI();
        }
    },

    async hit() {
        if (this.gameState !== 'player-turn' || this.isProcessing) return;
        this.isProcessing = true;
        const activeHand = this.playerHands[this.activeHandIndex];

        this.gameState = 'dealing';
        this.updateUI();

        await this.dealCardToPlayer(this.activeHandIndex);

        activeHand.score = this.calculateScore(activeHand.cards);

        if (activeHand.score > 21) {
            activeHand.status = 'busted';
            activeHand.result = 'LOSE';
            this.logMessage(`Hand ${this.playerHands.length > 1 ? (this.activeHandIndex + 1) : ""} がバストしました！`);
            this.gameState = 'player-turn';
            await this.moveToNextHand();
        } else if (activeHand.score === 21) {
            activeHand.status = 'stood';
            this.gameState = 'player-turn';
            await this.moveToNextHand();
        } else {
            this.gameState = 'player-turn';
            this.isProcessing = false;
            this.updateUI();
        }
    },

    async stand() {
        if (this.gameState !== 'player-turn' || this.isProcessing) return;
        this.isProcessing = true;
        const activeHand = this.playerHands[this.activeHandIndex];
        activeHand.status = 'stood';
        await this.moveToNextHand();
    },

    async doubleDown() {
        if (this.gameState !== 'player-turn' || this.isProcessing) return;
        const activeHand = this.playerHands[this.activeHandIndex];

        if (activeHand.cards.length !== 2) return;

        if (!this.ensureFunds(activeHand.bet)) {
            this.logMessage("残高不足のため、DOUBLEがキャンセルされました。");
            return;
        }

        this.isProcessing = true;
        this.gameState = 'dealing';
        let bankroll = window.CasinoStorage.getBankroll();
        window.CasinoStorage.setBankroll(Math.max(0, bankroll - activeHand.bet));
        activeHand.bet *= 2;
        this.updateUI();

        await this.dealCardToPlayer(this.activeHandIndex);

        activeHand.score = this.calculateScore(activeHand.cards);

        if (activeHand.score > 21) {
            activeHand.status = 'busted';
            activeHand.result = 'LOSE';
        } else {
            activeHand.status = 'stood';
        }

        this.gameState = 'player-turn';
        await this.moveToNextHand();
    },

    async split() {
        if (this.gameState !== 'player-turn' || this.isProcessing) return;
        const activeHand = this.playerHands[this.activeHandIndex];

        if (this.playerHands.length > 1 || activeHand.cards.length !== 2) return;
        if (activeHand.cards[0].name !== activeHand.cards[1].name) return;

        if (!this.ensureFunds(activeHand.bet)) {
            this.logMessage("残高不足のため、SPLITがキャンセルされました。");
            return;
        }

        this.isProcessing = true;
        this.gameState = 'dealing';
        let bankroll = window.CasinoStorage.getBankroll();
        window.CasinoStorage.setBankroll(Math.max(0, bankroll - activeHand.bet));

        const cardsInContainer = document.querySelectorAll('#player-hands-container .hand-wrapper .cards-container .card-wrapper-3d');
        if (cardsInContainer.length === 2) {
            const secondCardEl = cardsInContainer[1];
            secondCardEl.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s ease';
            secondCardEl.style.transform = 'translate(150px, 50px) rotate(15deg)';
            secondCardEl.style.opacity = '0.7';
            await sleep(400);
        }

        const secondCard = activeHand.cards.pop();
        const newHand = {
            cards: [secondCard],
            bet: activeHand.bet,
            status: 'playing',
            score: 0,
            visibleScore: secondCard.isRevealed ? this.calculateScore([secondCard]) : 0,
            result: ''
        };

        this.playerHands.push(newHand);
        activeHand.visibleScore = this.calculateScore(activeHand.cards);
        this.updateUI();

        await sleep(450);

        await this.dealCardToPlayer(0);
        await sleep(500);

        await this.dealCardToPlayer(1);
        await sleep(500);

        activeHand.score = this.calculateScore(activeHand.cards);
        newHand.score = this.calculateScore(newHand.cards);

        this.activeHandIndex = 0;
        this.gameState = 'player-turn';
        this.logMessage("スプリットしました。Hand 1からプレイしてください。");
        this.isProcessing = false;
        this.updateUI();
    },

    async moveToNextHand() {
        if (this.activeHandIndex < this.playerHands.length - 1) {
            this.activeHandIndex++;
            this.isProcessing = false;
            this.updateUI();
        } else {
            await this.playDealerTurn();
        }
    },

    async playDealerTurn() {
        this.gameState = 'dealer-turn';
        this.updateUI();

        await this.revealDealerHoleCard();

        const allBusted = this.playerHands.every(hand => hand.score > 21);

        if (allBusted) {
            await sleep(500);
            this.endRound();
            return;
        }

        while (this.calculateScore(this.dealerHand.cards) < 17) {
            await sleep(1000);
            await this.dealCardToDealer(false);
        }

        await sleep(500);
        this.endRound();
    },

    endRound() {
        this.gameState = 'round-over';
        const dScore = this.dealerHand.score;

        let hasWin = false;
        let hasBJ = false;
        let hasLose = false;

        let bankroll = window.CasinoStorage.getBankroll();
        let maxSingleWinProfit = 0; // スコアイベント用：今回のラウンドで獲得した純利益の最大値

        this.playerHands.forEach((hand) => {
            const pScore = hand.score;

            if (pScore > 21) {
                hand.result = 'LOSE';
                hand.status = 'busted';
                hasLose = true;
            } else if (dScore > 21) {
                if (pScore === 21 && hand.cards.length === 2 && this.playerHands.length === 1) {
                    hand.result = 'BLACKJACK';
                    hasBJ = true;
                } else {
                    hand.result = 'WIN';
                    hasWin = true;
                }
            } else if (pScore > dScore) {
                if (pScore === 21 && hand.cards.length === 2 && this.playerHands.length === 1) {
                    hand.result = 'BLACKJACK';
                    hasBJ = true;
                } else {
                    hand.result = 'WIN';
                    hasWin = true;
                }
            } else if (pScore < dScore) {
                hand.result = 'LOSE';
                hasLose = true;
            } else {
                const playerIsBJ = pScore === 21 && hand.cards.length === 2 && this.playerHands.length === 1;
                const dealerIsBJ = dScore === 21 && this.dealerHand.cards.length === 2;

                if (playerIsBJ && !dealerIsBJ) {
                    hand.result = 'BLACKJACK';
                    hasBJ = true;
                } else if (!playerIsBJ && dealerIsBJ) {
                    hand.result = 'LOSE';
                    hasLose = true;
                } else {
                    hand.result = 'PUSH';
                }
            }

            let payout = 0;
            if (hand.result === 'BLACKJACK') {
                payout = Math.max(0, Math.floor(hand.bet * 2.5));
            } else if (hand.result === 'WIN') {
                payout = Math.max(0, hand.bet * 2);
            } else if (hand.result === 'PUSH') {
                payout = Math.max(0, hand.bet);
            }
            bankroll = Math.max(0, bankroll + payout);

            // クラウド集計用：このハンドにおける純利益の計算（払戻金 - ベット額）
            const profit = payout - hand.bet;
            if (profit > maxSingleWinProfit) {
                maxSingleWinProfit = profit;
            }
        });

        window.CasinoStorage.setBankroll(bankroll);

        this.checkBetValidity();
        this.checkBankruptcy();

        if (hasBJ) {
            this.sfx.playWin();
            this.createParticles('#ffd700');
        } else if (hasWin) {
            this.sfx.playWin();
            this.createParticles('#4caf50');
        } else if (hasLose) {
            this.sfx.playLose();
        }

        this.isProcessing = false;
        this.updateUI();

        // 🏆【オンラインランキング連携】
        // 1. 純資産を即時にクラウドへ同期
        this.syncCloudNetWorth();

        // 2. 勝利ハンドが存在した場合は「ブラックジャック最大勝利部門」への登録試行
        if (maxSingleWinProfit > 0) {
            window.CasinoRanking.submitScore('blackjack_max_win', maxSingleWinProfit);
        }
    },

    /**
     * 現在の「手元残高 - 借金」で求めた純資産額をクラウドへ安全に同期する
     */
    syncCloudNetWorth() {
        const netWorth = window.CasinoStorage.getBankroll() - window.CasinoStorage.getDebt();
        window.CasinoRanking.submitScore('net_worth', netWorth);
    },

    createParticles(color) {
        const container = document.body;
        const numParticles = 40;

        for (let i = 0; i < numParticles; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.backgroundColor = color;

            const x = window.innerWidth / 2;
            const y = window.innerHeight * 0.45;

            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;

            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 250 + 100;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;

            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);

            const size = Math.random() * 7 + 4;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;

            container.appendChild(particle);

            setTimeout(() => {
                particle.remove();
            }, 1200);
        }
    },

    nextRound() {
        if (this.gameState !== 'round-over') return;

        this.checkBetValidity();
        this.checkBankruptcy();

        this.gameState = 'betting';
        this.dealerHand = { cards: [], score: 0, visibleScore: 0 };
        this.playerHands = [];
        this.activeHandIndex = 0;

        this.updateUI();
    },

    checkBetValidity() {
        const bankroll = window.CasinoStorage.getBankroll();
        if (isNaN(this.currentBet) || this.currentBet < 0) {
            this.currentBet = 0;
        }
        if (this.currentBet > bankroll) {
            this.currentBet = bankroll;
        }
        this.currentBet = Math.max(0, this.currentBet);
    },

    checkBankruptcy() {
        // 破産判定の発火
        if (window.CasinoStorage.checkAndHandleBankruptcy()) {
            this.currentBet = 0;
            this.updateUI();
            return;
        }

        const bankroll = window.CasinoStorage.getBankroll();
        if (bankroll === 0 && this.currentBet === 0) {
            if (window.CasinoStorage.getRemainingBorrowLimit() > 0) {
                this.logMessage("残高がなくなりました。借金額を入力してゲームを続行してください。");
                window.CasinoNumpad.open('borrow', () => {
                    this.updateUI();
                    this.syncCloudNetWorth(); // 破産時の借金補填後の資産同期
                });
            }
        }
    },

    logMessage(text) {
        const msgBar = document.getElementById('message-bar');
        if (msgBar) msgBar.textContent = text;
    },

    createCardHTML(card) {
        const colorClass = card.isRed ? 'red' : 'black';
        const revealedClass = card.isRevealed ? 'revealed' : '';
        const animateClass = card.hasAnimatedDeal ? '' : 'deal-animate';
        const noTransitionClass = card.hasAnimatedReveal ? 'no-transition' : '';

        card.hasAnimatedDeal = true;

        return `
            <div class="card-wrapper-3d ${animateClass} ${revealedClass} ${noTransitionClass}" id="${card.id}">
                <div class="card-inner">
                    <div class="card-front ${colorClass}">
                        <div class="card-corner-top">${card.name}<br>${card.suit}</div>
                        <div class="card-suit-center">${card.suit}</div>
                        <div class="card-corner-bottom">${card.name}<br>${card.suit}</div>
                    </div>
                    <div class="card-back"></div>
                </div>
            </div>
        `;
    },

    syncCardsDOM(container, cards) {
        const cardIds = new Set(cards.map(c => c.id));
        Array.from(container.children).forEach(child => {
            if (!cardIds.has(child.id)) {
                child.remove();
            }
        });

        cards.forEach((card, idx) => {
            let cardEl = document.getElementById(card.id);
            if (!cardEl) {
                const temp = document.createElement('div');
                temp.innerHTML = this.createCardHTML(card);
                cardEl = temp.firstElementChild;
                
                if (idx < container.children.length) {
                    container.insertBefore(cardEl, container.children[idx]);
                } else {
                    container.appendChild(cardEl);
                }
            } else {
                if (card.isRevealed && !cardEl.classList.contains('revealed')) {
                    cardEl.classList.add('revealed');
                }
                if (card.hasAnimatedReveal && !cardEl.classList.contains('no-transition')) {
                    cardEl.classList.add('no-transition');
                }
                if (container.children[idx] !== cardEl) {
                    if (idx < container.children.length) {
                        container.insertBefore(cardEl, container.children[idx]);
                    } else {
                        container.appendChild(cardEl);
                    }
                }
            }
        });
    },

    updateDealerHandDOM() {
        const dealerCardsDiv = document.getElementById('dealer-cards');
        if (!dealerCardsDiv) return;
        this.syncCardsDOM(dealerCardsDiv, this.dealerHand.cards);

        const dBadge = document.getElementById('dealer-score-badge');
        if (this.dealerHand.cards.length === 0) {
            dBadge.style.display = 'none';
        } else {
            dBadge.style.display = 'inline-block';
            const hasHoleCard = this.dealerHand.cards.some(c => !c.isRevealed);
            if (hasHoleCard) {
                dBadge.textContent = `${this.dealerHand.visibleScore} + ?`;
            } else {
                dBadge.textContent = this.dealerHand.visibleScore;
            }
        }
    },

    updatePlayerHandsDOM() {
        const playerContainer = document.getElementById('player-hands-container');
        if (!playerContainer) return;
        
        while (playerContainer.children.length < this.playerHands.length) {
            const wrapper = document.createElement('div');
            wrapper.className = 'hand-wrapper';
            wrapper.innerHTML = `
                <div class="hand-header">
                    <span class="hand-title"></span>
                    <span class="score-badge"></span>
                </div>
                <div class="cards-container"></div>
                <div class="hand-footer"></div>
                <div class="badge-placeholder"></div>
            `;
            playerContainer.appendChild(wrapper);
        }
        
        while (playerContainer.children.length > this.playerHands.length) {
            playerContainer.lastElementChild.remove();
        }

        this.playerHands.forEach((hand, index) => {
            const wrapper = playerContainer.children[index];
            
            if (this.gameState === 'player-turn' && index === this.activeHandIndex) {
                wrapper.classList.add('active');
            } else {
                wrapper.classList.remove('active');
            }

            const titleEl = wrapper.querySelector('.hand-title');
            titleEl.textContent = `Hand ${this.playerHands.length > 1 ? (index + 1) : ""}`;

            const scoreBadge = wrapper.querySelector('.score-badge');
            let scoreText = hand.visibleScore;
            if (hand.visibleScore > 21) {
                scoreText = `${hand.visibleScore} (Bust!)`;
            }
            scoreBadge.textContent = scoreText;

            const footer = wrapper.querySelector('.hand-footer');
            footer.textContent = `Bet: $${hand.bet}`;

            const badgePlaceholder = wrapper.querySelector('.badge-placeholder');
            badgePlaceholder.innerHTML = '';
            if (this.gameState === 'round-over' || hand.status === 'busted') {
                if (hand.result === 'WIN') {
                    badgePlaceholder.innerHTML = `<div class="result-badge win">WIN</div>`;
                } else if (hand.result === 'LOSE') {
                    badgePlaceholder.innerHTML = `<div class="result-badge lose">LOSE</div>`;
                } else if (hand.result === 'PUSH') {
                    badgePlaceholder.innerHTML = `<div class="result-badge push">PUSH</div>`;
                } else if (hand.result === 'BLACKJACK') {
                    badgePlaceholder.innerHTML = `<div class="result-badge bj">BLACKJACK!</div>`;
                }
            }

            const cardsContainer = wrapper.querySelector('.cards-container');
            this.syncCardsDOM(cardsContainer, hand.cards);
        });
    },

    updateChips() {
        const chipArea = document.getElementById('chip-area');
        if (!chipArea) return;
        chipArea.innerHTML = '';

        const bankroll = window.CasinoStorage.getBankroll();
        const debt = window.CasinoStorage.getDebt();
        const remainingBorrow = window.CasinoStorage.getRemainingBorrowLimit();

        CHIP_VALUES.forEach(val => {
            if (val <= bankroll) {
                const btn = document.createElement('button');
                btn.className = `chip ${CHIP_CLASSES[val]}`;
                btn.textContent = `$${val}`;
                btn.onclick = () => this.addBet(val);

                const isBettingPhase = (this.gameState === 'betting' && !this.isProcessing);
                const hasEnoughRoom = (val <= (bankroll - this.currentBet));
                btn.disabled = !(isBettingPhase && hasEnoughRoom);

                chipArea.appendChild(btn);
            }
        });

        const allInBtn = document.createElement('button');
        allInBtn.className = 'action-btn allin-btn';
        allInBtn.id = 'btn-allin';
        allInBtn.textContent = 'All In';
        allInBtn.onclick = () => this.allIn();
        allInBtn.disabled = (this.gameState !== 'betting' || this.isProcessing || bankroll <= 0 || this.currentBet === bankroll);
        chipArea.appendChild(allInBtn);

        const clearBtn = document.createElement('button');
        clearBtn.className = 'action-btn clear-btn';
        clearBtn.id = 'btn-clear';
        clearBtn.textContent = 'Clear';
        clearBtn.onclick = () => this.clearBet();
        clearBtn.disabled = (this.gameState !== 'betting' || this.isProcessing || this.currentBet <= 0);
        chipArea.appendChild(clearBtn);

        const borrowBtn = document.createElement('button');
        borrowBtn.className = 'action-btn borrow-btn';
        borrowBtn.id = 'btn-borrow';
        borrowBtn.textContent = 'Borrow';
        borrowBtn.onclick = () => this.borrow();
        borrowBtn.disabled = (this.gameState !== 'betting' || this.isProcessing || remainingBorrow <= 0);
        chipArea.appendChild(borrowBtn);

        const repayBtn = document.createElement('button');
        repayBtn.className = 'action-btn repay-btn';
        repayBtn.id = 'btn-repay';
        repayBtn.textContent = 'Repay';
        repayBtn.onclick = () => this.repay();
        repayBtn.disabled = (this.gameState !== 'betting' || this.isProcessing || debt <= 0 || bankroll <= 0);
        chipArea.appendChild(repayBtn);

        const numpadBetBtn = document.createElement('button');
        numpadBetBtn.className = 'action-btn numpad-bet-btn';
        numpadBetBtn.id = 'btn-numpad-bet';
        numpadBetBtn.textContent = 'BET INPUT';
        numpadBetBtn.onclick = () => this.numpadBet();
        numpadBetBtn.disabled = (this.gameState !== 'betting' || this.isProcessing);
        chipArea.appendChild(numpadBetBtn);
    },

    updateUI() {
        const bankroll = window.CasinoStorage.getBankroll();
        const debt = window.CasinoStorage.getDebt();

        const bankrollVal = document.getElementById('bankroll-val');
        const betVal = document.getElementById('bet-val');
        const debtVal = document.getElementById('debt-val');

        if (bankrollVal) bankrollVal.textContent = `$${bankroll}`;
        if (betVal) betVal.textContent = `$${this.currentBet}`;
        if (debtVal) debtVal.textContent = `$${debt}`;

        this.updateChips();
        this.updateDealerHandDOM();
        this.updatePlayerHandsDOM();

        const btnDeal = document.getElementById('btn-deal');
        const btnHit = document.getElementById('btn-hit');
        const btnStand = document.getElementById('btn-stand');
        const btnDouble = document.getElementById('btn-double');
        const btnSplit = document.getElementById('btn-split');

        if (!btnDeal) return;

        if (this.isProcessing) {
            btnDeal.disabled = true;
            btnHit.disabled = true;
            btnStand.disabled = true;
            btnDouble.disabled = true;
            btnSplit.disabled = true;
            return;
        }

        if (this.gameState === 'betting') {
            btnDeal.disabled = (this.currentBet <= 0);
            btnDeal.textContent = 'DEAL';
            btnHit.disabled = true;
            btnStand.disabled = true;
            btnDouble.disabled = true;
            btnSplit.disabled = true;

            if (this.currentBet === 0) {
                this.logMessage("チップをクリックしてベットを決め、DEALを押してください。");
            } else {
                this.logMessage(`$${this.currentBet} をベット中。よろしければDEALを押してください。`);
            }
        } else if (this.gameState === 'dealing') {
            btnDeal.disabled = true;
            btnHit.disabled = true;
            btnStand.disabled = true;
            btnDouble.disabled = true;
            btnSplit.disabled = true;
            this.logMessage("カードを配っています...");
        } else if (this.gameState === 'player-turn') {
            btnDeal.disabled = true;
            btnHit.disabled = false;
            btnStand.disabled = false;

            const activeHand = this.playerHands[this.activeHandIndex];
            const canDouble = activeHand.cards.length === 2 && bankroll >= activeHand.bet;
            btnDouble.disabled = !canDouble;

            const canSplit = this.playerHands.length === 1 && 
                              activeHand.cards.length === 2 && 
                              activeHand.cards[0].name === activeHand.cards[1].name && 
                              bankroll >= activeHand.bet;
            btnSplit.disabled = !canSplit;

            this.logMessage("Hand のアクションを選択してください。");
        } else {
            if (this.gameState === 'round-over') {
                btnDeal.disabled = false;
                btnDeal.textContent = 'NEXT ROUND';
            } else {
                btnDeal.disabled = (this.currentBet <= 0);
                btnDeal.textContent = 'DEAL';
            }
            btnHit.disabled = true;
            btnStand.disabled = true;
            btnDouble.disabled = true;
            btnSplit.disabled = true;

            if (this.gameState === 'dealer-turn') {
                this.logMessage("ディーラーのターンです...");
            } else if (this.gameState === 'round-over') {
                this.logMessage("ラウンド終了。NEXT ROUNDを押して次のゲームに進んでください。");
            }
        }
    }
};

window.BlackjackGame = BlackjackGame;
