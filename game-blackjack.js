/**
 * ==========================================
 * Fever Casino - ブラックジャックPRO制御スクリプト (game-blackjack.js)
 * ==========================================
 */

let deck = [];
let dealerHand = [];
let playerHands = []; // [{ cards: [], bet: 100, isDone: false }]
let activeHandIndex = 0;
let isDealing = false;

const SUITS = [
  { symbol: '♠', color: 'black' },
  { symbol: '♥', color: 'red' },
  { symbol: '♦', color: 'red' },
  { symbol: '♣', color: 'black' }
];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ★ 画面の所持金・借金・プレイヤー名を完全同期 ★
 */
function updateCashDisplay() {
  if (typeof updateUI === 'function') {
    updateUI();
  }
}

function createDeck() {
  deck = [];
  for (let suit of SUITS) {
    for (let val of VALUES) {
      let numVal = parseInt(val, 10);
      if (val === 'A') numVal = 11;
      else if (['J', 'Q', 'K'].includes(val)) numVal = 10;

      deck.push({
        suit: suit.symbol,
        color: suit.color,
        value: val,
        numVal: numVal
      });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function calculateScore(cards) {
  let score = 0;
  let aceCount = 0;

  for (let card of cards) {
    score += card.numVal;
    if (card.value === 'A') aceCount++;
  }

  while (score > 21 && aceCount > 0) {
    score -= 10;
    aceCount--;
  }

  return score;
}

/**
 * カードエレメントの作成
 */
function createCardElement(card, isHidden = false, isNew = false) {
  const cardDiv = document.createElement('div');
  
  if (isHidden) {
    cardDiv.className = 'card back';
  } else {
    cardDiv.className = `card ${card.color}`;
    cardDiv.innerHTML = `
      <div class="card-top">${card.value}${card.suit}</div>
      <div class="card-center">${card.suit}</div>
      <div class="card-bottom">${card.value}</div>
    `;
  }

  if (isNew) {
    cardDiv.classList.add('deal-animate');
  }

  return cardDiv;
}

/**
 * UIの全体更新 ＆ 画面の所持金・借金表示を完全同期
 */
function updateGameUI(hideDealerCard = true) {
  updateCashDisplay();

  // 1. ディーラー描画
  const dealerContainer = document.getElementById('dealer-cards');
  dealerHand.forEach((card, index) => {
    const isHidden = (index === 1 && hideDealerCard);
    
    if (!card.element) {
      card.element = createCardElement(card, isHidden, true);
      dealerContainer.appendChild(card.element);
    } else {
      if (!isHidden && card.element.classList.contains('back')) {
        const newEl = createCardElement(card, false, false);
        dealerContainer.replaceChild(newEl, card.element);
        card.element = newEl;
      }
    }
  });

  const dScore = hideDealerCard ? (dealerHand[0] ? dealerHand[0].numVal : '?') : calculateScore(dealerHand);
  document.getElementById('dealer-score').textContent = dScore;

  // 2. プレイヤー手札描画
  const handsContainer = document.getElementById('player-hands-container');

  playerHands.forEach((handObj, index) => {
    let handBox = document.getElementById(`hand-box-${index}`);

    if (!handBox) {
      handBox = document.createElement('div');
      handBox.id = `hand-box-${index}`;
      handBox.className = 'hand-box';
      handBox.innerHTML = `
        <div class="hand-header">
          ${playerHands.length > 1 ? `ハンド ${index + 1} - ` : ''}ベット: $<span class="bet-val">${handObj.bet}</span>
          <span class="score-badge">0</span>
        </div>
        <div class="cards-container"></div>
      `;
      handsContainer.appendChild(handBox);
    }

    if (index === activeHandIndex && playerHands.length > 1 && !handObj.isDone) {
      handBox.classList.add('active-hand');
    } else {
      handBox.classList.remove('active-hand');
    }

    const score = calculateScore(handObj.cards);
    handBox.querySelector('.score-badge').textContent = score;
    handBox.querySelector('.bet-val').textContent = handObj.bet;

    const cardsComp = handBox.querySelector('.cards-container');

    handObj.cards.forEach(card => {
      if (!card.element) {
        card.element = createCardElement(card, false, true);
        cardsComp.appendChild(card.element);
      }
    });
  });

  // ボタンの有効化状態チェック
  const activeHand = playerHands[activeHandIndex];
  if (activeHand && !activeHand.isDone && !isDealing) {
    const doubleBtn = document.getElementById('double-btn');
    const splitBtn = document.getElementById('split-btn');

    doubleBtn.disabled = !(activeHand.cards.length === 2 && playerData.cash >= activeHand.bet);
    splitBtn.disabled = !(activeHand.cards.length === 2 && playerHands.length === 1 && activeHand.cards[0].value === activeHand.cards[1].value && playerData.cash >= activeHand.bet);
  }
}

/**
 * ゲーム開始 (ディール)
 */
async function startDeal() {
  if (isDealing) return;

  const betBtn = document.getElementById('bet-select-btn');
  const betVal = parseInt(betBtn.getAttribute('data-amount'), 10) || 0;

  if (betVal <= 0) {
    alert('1以上の賭け金を選択してください。');
    return;
  }

  if (betVal > playerData.cash) {
    alert('所持金が足りません！');
    return;
  }

  // ベット額引き落とし＆即時同期
  playerData.cash -= betVal;
  saveData();

  hideOverlays();
  createDeck();
  dealerHand = [];
  playerHands = [{ cards: [], bet: betVal, isDone: false }];
  activeHandIndex = 0;
  isDealing = true;

  document.getElementById('dealer-cards').innerHTML = '';
  document.getElementById('player-hands-container').innerHTML = '';

  document.getElementById('open-atm-btn').disabled = true;
  document.getElementById('bet-controls').classList.add('hidden');
  document.getElementById('game-controls').classList.remove('hidden');
  document.getElementById('next-controls').classList.add('hidden');
  document.getElementById('message-display').textContent = 'カードを配っています...';

  // 時間差配付
  playerHands[0].cards.push(deck.pop());
  updateGameUI(true);
  await delay(300);

  dealerHand.push(deck.pop());
  updateGameUI(true);
  await delay(300);

  playerHands[0].cards.push(deck.pop());
  updateGameUI(true);
  await delay(300);

  dealerHand.push(deck.pop());
  updateGameUI(true);

  isDealing = false;
  document.getElementById('message-display').textContent = 'ヒット、スタンド、またはアクションを選択してください。';

  updateGameUI(true);

  // 21自動スタンド
  if (calculateScore(playerHands[0].cards) === 21) {
    document.getElementById('message-display').textContent = '21達成！自動スタンドします。';
    await delay(500);
    handleStand();
  }
}

/**
 * ヒット
 */
async function handleHit() {
  const hand = playerHands[activeHandIndex];
  if (!hand || hand.isDone || isDealing) return;

  hand.cards.push(deck.pop());
  updateGameUI(true);

  const score = calculateScore(hand.cards);

  if (score === 21) {
    document.getElementById('message-display').textContent = '21達成！自動スタンドします。';
    hand.isDone = true;
    await delay(500);
    proceedNextHandOrDealer();
  } else if (score > 21) {
    hand.isDone = true;
    document.getElementById('message-display').textContent = 'バーストしました！';
    await delay(600);
    proceedNextHandOrDealer();
  }
}

/**
 * スタンド
 */
function handleStand() {
  const hand = playerHands[activeHandIndex];
  if (!hand || hand.isDone || isDealing) return;

  hand.isDone = true;
  proceedNextHandOrDealer();
}

/**
 * ダブルダウン
 */
async function handleDoubleDown() {
  const hand = playerHands[activeHandIndex];
  if (!hand || hand.isDone || isDealing) return;

  if (playerData.cash < hand.bet) {
    alert('ダブルダウンに必要な所持金が足りません！');
    return;
  }

  playerData.cash -= hand.bet;
  hand.bet *= 2;
  saveData(); // 即座に所持金減額を反映

  document.getElementById('message-display').textContent = 'ダブルダウン！';

  hand.cards.push(deck.pop());
  updateGameUI(true);
  await delay(600);

  hand.isDone = true;
  proceedNextHandOrDealer();
}

/**
 * スプリット
 */
async function handleSplit() {
  const hand = playerHands[0];
  if (!hand || hand.cards.length !== 2 || isDealing) return;

  if (playerData.cash < hand.bet) {
    alert('スプリットに必要な所持金が足りません！');
    return;
  }

  playerData.cash -= hand.bet;
  saveData(); // 即座に所持金減額を反映

  isDealing = true;
  document.getElementById('message-display').textContent = '手札をスプリットしました！';

  const card1 = hand.cards[0];
  const card2 = hand.cards[1];

  delete card1.element;
  delete card2.element;

  playerHands = [
    { cards: [card1], bet: hand.bet, isDone: false },
    { cards: [card2], bet: hand.bet, isDone: false }
  ];
  activeHandIndex = 0;

  document.getElementById('player-hands-container').innerHTML = '';
  updateGameUI(true);
  await delay(300);

  playerHands[0].cards.push(deck.pop());
  updateGameUI(true);
  await delay(300);

  playerHands[1].cards.push(deck.pop());
  updateGameUI(true);

  isDealing = false;
  updateGameUI(true);

  if (calculateScore(playerHands[0].cards) === 21) {
    document.getElementById('message-display').textContent = 'ハンド1が21達成！自動スタンドします。';
    playerHands[0].isDone = true;
    await delay(500);
    proceedNextHandOrDealer();
  }
}

/**
 * 次のハンドまたはディーラーのターンへ
 */
function proceedNextHandOrDealer() {
  const nextUnfinished = playerHands.findIndex(h => !h.isDone);

  if (nextUnfinished !== -1) {
    activeHandIndex = nextUnfinished;
    updateGameUI(true);
    document.getElementById('message-display').textContent = `ハンド ${activeHandIndex + 1} のプレイを選択してください。`;
  } else {
    playDealerTurn();
  }
}

/**
 * ディーラーの自動ターン
 */
async function playDealerTurn() {
  isDealing = true;
  document.getElementById('game-controls').classList.add('hidden');
  document.getElementById('message-display').textContent = 'ディーラーのターンです...';

  const allBusted = playerHands.every(h => calculateScore(h.cards) > 21);

  // 伏せカードオープン
  updateGameUI(false);
  await delay(600);

  if (!allBusted) {
    while (calculateScore(dealerHand) < 17) {
      dealerHand.push(deck.pop());
      updateGameUI(false);
      await delay(600);
    }
  }

  isDealing = false;
  evaluateAllResults();
}

/**
 * 勝敗判定 ＆ 配当計算
 */
function evaluateAllResults() {
  const dScore = calculateScore(dealerHand);
  let totalPayout = 0;
  let totalBet = 0;
  let winCount = 0;
  let loseCount = 0;

  playerHands.forEach(hand => {
    totalBet += hand.bet;
    const pScore = calculateScore(hand.cards);

    if (pScore > 21) {
      loseCount++;
    } else if (dScore > 21) {
      totalPayout += hand.bet * 2;
      winCount++;
    } else if (pScore > dScore) {
      if (pScore === 21 && hand.cards.length === 2 && playerHands.length === 1) {
        totalPayout += Math.floor(hand.bet * 2.5);
      } else {
        totalPayout += hand.bet * 2;
      }
      winCount++;
    } else if (pScore < dScore) {
      loseCount++;
    } else {
      totalPayout += hand.bet;
    }
  });

  if (totalPayout > 0) {
    playerData.cash += totalPayout;

    const profit = totalPayout - totalBet;
    if (profit > (playerData.highScores.blackjack || 0)) {
      playerData.highScores.blackjack = profit;
    }
  }

  // 借金利子の適用 ＆ 保存（saveData内で即時UI更新）
  if (typeof applyDebtInterest === 'function') {
    applyDebtInterest();
  } else {
    saveData();
  }

  const msgEl = document.getElementById('message-display');
  if (winCount > 0 && loseCount === 0) {
    msgEl.textContent = `🎉 勝利！ 配当 $${totalPayout.toLocaleString()} を獲得！`;
    showWinEffect();
  } else if (winCount === 0 && loseCount > 0) {
    msgEl.textContent = `ディーラーの勝ちです。`;
    showLoseEffect();
  } else {
    msgEl.textContent = `ゲーム終了 （配当: $${totalPayout.toLocaleString()}）`;
  }

  document.getElementById('next-controls').classList.remove('hidden');
}

function showWinEffect() {
  document.getElementById('win-overlay').classList.remove('hidden');

  const container = document.getElementById('particle-container');
  container.innerHTML = '';
  const items = ['🎉', '🪙', '✨', '💎'];

  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = items[Math.floor(Math.random() * items.length)];
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDelay = Math.random() * 0.8 + 's';
    container.appendChild(p);

    setTimeout(() => p.remove(), 3000);
  }

  setTimeout(hideOverlays, 2500);
}

function showLoseEffect() {
  document.getElementById('lose-overlay').classList.remove('hidden');
  setTimeout(hideOverlays, 2000);
}

function hideOverlays() {
  document.getElementById('win-overlay').classList.add('hidden');
  document.getElementById('lose-overlay').classList.add('hidden');
}

/**
 * 次のゲームの準備
 */
function prepareNextGame() {
  hideOverlays();
  document.getElementById('open-atm-btn').disabled = false;
  document.getElementById('next-controls').classList.add('hidden');
  document.getElementById('bet-controls').classList.remove('hidden');
  document.getElementById('message-display').textContent = '賭け金を選択して「ディール開始」を押してください';

  document.getElementById('dealer-cards').innerHTML = '';
  document.getElementById('player-hands-container').innerHTML = '';
  document.getElementById('dealer-score').textContent = '?';

  updateCashDisplay();
}

/**
 * 初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadData === 'function') loadData();
  updateCashDisplay();

  document.getElementById('deal-btn').addEventListener('click', startDeal);
  document.getElementById('hit-btn').addEventListener('click', handleHit);
  document.getElementById('stand-btn').addEventListener('click', handleStand);
  document.getElementById('double-btn').addEventListener('click', handleDoubleDown);
  document.getElementById('split-btn').addEventListener('click', handleSplit);
  document.getElementById('next-btn').addEventListener('click', prepareNextGame);
});
