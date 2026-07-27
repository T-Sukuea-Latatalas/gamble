/**
 * ==========================================
 * Fever Casino - 共通バーチャルテンキー制御スクリプト (keypad.js)
 * ==========================================
 */

(function () {
  let activeTarget = null; // 現在入力中の要素 (button または input)
  let currentValueStr = "0"; // 現在入力中の数値文字列
  let keypadOverlay = null;
  let keypadContainer = null;
  let displayElement = null;

  /**
   * 1. テンキーのHTML構造（ディスプレイ含む）を画面内に自動生成する関数
   */
  function createKeypadDOM() {
    if (document.getElementById('virtual-keypad')) return;

    // オーバーレイ背景の生成
    keypadOverlay = document.createElement('div');
    keypadOverlay.className = 'keypad-overlay';

    // テンキー本体の生成
    keypadContainer = document.createElement('div');
    keypadContainer.id = 'virtual-keypad';
    keypadContainer.className = 'virtual-keypad';

    keypadContainer.innerHTML = `
      <div class="keypad-header">
        <span class="keypad-title">🔢 金額入力キーパッド</span>
        <button type="button" class="keypad-close-btn" id="keypad-close">&times;</button>
      </div>

      <!-- 入力中金額ディスプレイ -->
      <div class="keypad-display-wrapper">
        <span class="keypad-display-label">選択金額:</span>
        <div id="keypad-display" class="keypad-display">$0</div>
      </div>

      <div class="keypad-body">
        <div class="keypad-quick-row">
          <button type="button" class="quick-btn" data-action="min">Min ($1)</button>
          <button type="button" class="quick-btn" data-action="add" data-val="100">+100</button>
          <button type="button" class="quick-btn" data-action="add" data-val="1000">+1,000</button>
          <button type="button" class="quick-btn" data-action="max">Max</button>
        </div>
        <div class="keypad-grid">
          <button type="button" class="key-btn num-btn" data-val="7">7</button>
          <button type="button" class="key-btn num-btn" data-val="8">8</button>
          <button type="button" class="key-btn num-btn" data-val="9">9</button>
          <button type="button" class="key-btn action-btn" data-action="bs">BS</button>

          <button type="button" class="key-btn num-btn" data-val="4">4</button>
          <button type="button" class="key-btn num-btn" data-val="5">5</button>
          <button type="button" class="key-btn num-btn" data-val="6">6</button>
          <button type="button" class="key-btn action-btn" data-action="clear">C</button>

          <button type="button" class="key-btn num-btn" data-val="1">1</button>
          <button type="button" class="key-btn num-btn" data-val="2">2</button>
          <button type="button" class="key-btn num-btn" data-val="3">3</button>
          <button type="button" class="key-btn enter-btn" data-action="enter">確定</button>

          <button type="button" class="key-btn num-btn zero-btn" data-val="0">0</button>
          <button type="button" class="key-btn num-btn" data-val="00">00</button>
        </div>
      </div>
    `;

    document.body.appendChild(keypadOverlay);
    document.body.appendChild(keypadContainer);

    displayElement = document.getElementById('keypad-display');
    setupKeypadEvents();
  }

  /**
   * 2. ディスプレイ表示のリアルタイム更新（3桁カンマ区切り）
   */
  function updateDisplay() {
    const num = parseInt(currentValueStr, 10) || 0;
    if (displayElement) {
      displayElement.textContent = '$' + num.toLocaleString();
    }
  }

  /**
   * 3. テンキーを開く処理
   */
  function openKeypad(targetElement) {
    activeTarget = targetElement;

    // 現在のターゲットの初期値を取得
    let initVal = "0";
    if (activeTarget.tagName === 'BUTTON') {
      initVal = activeTarget.getAttribute('data-amount') || "0";
    } else if (activeTarget.tagName === 'INPUT') {
      initVal = activeTarget.value || "0";
      activeTarget.setAttribute('inputmode', 'none'); // スマホキーボード無効化
    }

    currentValueStr = parseInt(initVal, 10).toString();
    if (isNaN(currentValueStr)) currentValueStr = "0";

    updateDisplay();

    keypadOverlay.classList.add('show');
    keypadContainer.classList.add('show');
  }

  /**
   * 4. テンキーを閉じる処理
   */
  function closeKeypad() {
    if (keypadOverlay) keypadOverlay.classList.remove('show');
    if (keypadContainer) keypadContainer.classList.remove('show');

    if (activeTarget) {
      if (activeTarget.blur) activeTarget.blur();
      activeTarget = null;
    }
  }

  /**
   * 5. 値の確定 ＆ 他のスクリプト（ATMやゲーム）へ通知
   */
  function confirmValue() {
    if (!activeTarget) return;

    const numVal = parseInt(currentValueStr, 10) || 0;

    if (activeTarget.tagName === 'BUTTON') {
      // ボタンの場合：data-amount 属性を更新し、見た目のラベルも変更
      activeTarget.setAttribute('data-amount', numVal.toString());

      // プレフィックス（「賭け金: 」など）を維持しながら金額を書き換える
      const prefix = activeTarget.getAttribute('data-label') || "金額を入力: ";
      activeTarget.textContent = `${prefix}$${numVal.toLocaleString()}`;

      // inputと同等の .value プロパティを持たせる
      activeTarget.value = numVal;

    } else if (activeTarget.tagName === 'INPUT') {
      activeTarget.value = numVal.toString();
    }

    // イベントを発火して他スクリプトに金額変更を知らせる
    activeTarget.dispatchEvent(new Event('input', { bubbles: true }));
    activeTarget.dispatchEvent(new Event('change', { bubbles: true }));

    closeKeypad();
  }

  /**
   * 6. ボタンクリック時の数字・アクション制御
   */
  function handleButtonClick(e) {
    const btn = e.target.closest('button');
    if (!btn || !activeTarget) return;

    // ① 数字ボタン
    if (btn.classList.contains('num-btn')) {
      const num = btn.getAttribute('data-val');
      if (currentValueStr === '0') {
        currentValueStr = (num === '00') ? '0' : num;
      } else {
        // 桁数オーバー防止（最大9桁 $999,999,999 まで）
        if (currentValueStr.length < 9) {
          currentValueStr += num;
        }
      }
      updateDisplay();
      return;
    }

    // ② アクションボタン
    const action = btn.getAttribute('data-action');

    switch (action) {
      case 'clear':
        currentValueStr = '0';
        updateDisplay();
        break;

      case 'bs':
        currentValueStr = currentValueStr.slice(0, -1);
        if (currentValueStr === '' || currentValueStr === '-') {
          currentValueStr = '0';
        }
        updateDisplay();
        break;

      case 'enter':
        confirmValue();
        break;

      case 'min':
        currentValueStr = '1';
        updateDisplay();
        break;

      case 'add':
        const addVal = parseInt(btn.getAttribute('data-val'), 10) || 0;
        const currentNum = parseInt(currentValueStr, 10) || 0;
        currentValueStr = (currentNum + addVal).toString();
        updateDisplay();
        break;

      case 'max':
        // ★ スマートMax入力化ロジック ★
        const cash = (window.playerData && typeof window.playerData.cash === 'number') ? Math.max(0, window.playerData.cash) : 0;
        const bank = (window.playerData && typeof window.playerData.bank === 'number') ? Math.max(0, window.playerData.bank) : 0;
        const debt = (window.playerData && typeof window.playerData.debt === 'number') ? Math.max(0, window.playerData.debt) : 0;

        const isAtmTarget = activeTarget && (activeTarget.id === 'atm-amount-btn' || activeTarget.classList.contains('atm-amount-btn'));
        const mode = window.selectedAtmMode || null;

        let maxVal = cash;

        if (isAtmTarget) {
          // ATMコンテキスト
          if (mode === 'deposit') {
            maxVal = cash;
          } else if (mode === 'withdraw') {
            maxVal = bank;
          } else if (mode === 'repay') {
            maxVal = Math.min(debt, cash);
          } else if (mode === 'borrow') {
            maxVal = 999999999;
          } else {
            maxVal = cash;
          }
        } else {
          // ゲームのベット額選択などのコンテキスト
          const maxAttr = activeTarget.getAttribute('data-max');
          if (maxAttr) {
            const parsedMax = parseInt(maxAttr, 10);
            if (!isNaN(parsedMax)) {
              maxVal = Math.min(cash, parsedMax);
            } else {
              maxVal = cash;
            }
          } else {
            maxVal = cash;
          }
        }

        currentValueStr = Math.max(0, maxVal).toString();
        updateDisplay();
        break;
    }
  }

  /**
   * 7. イベントリスナー登録（ボタン・INPUTのクリック監視）
   */
  function setupKeypadEvents() {
    document.getElementById('keypad-close').addEventListener('click', closeKeypad);
    keypadOverlay.addEventListener('click', closeKeypad);

    keypadContainer.addEventListener('click', handleButtonClick);

    // 画面内の「金額選択ボタン」または「INPUT」のクリックを監視
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('.amount-select-btn, .use-keypad');
      if (target) {
        openKeypad(target);
      }
    });

    document.body.addEventListener('focusin', (e) => {
      const target = e.target;
      if (target.tagName === 'INPUT' && (target.classList.contains('use-keypad') || target.type === 'number')) {
        openKeypad(target);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', createKeypadDOM);
})();
