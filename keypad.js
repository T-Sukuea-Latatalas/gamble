/**
 * ==========================================
 * Fever Casino - 共通バーチャルテンキー制御スクリプト (keypad.js)
 * シンプル整数表記 ＆ ベット上限解除・Maxボタン所持金全額対応版
 * ==========================================
 */

(function () {
  let activeTarget = null;
  let currentValueStr = "0";
  let keypadOverlay = null;
  let keypadContainer = null;
  let displayElement = null;

  function safeToBigInt(v) {
    if (typeof window.toBigInt === 'function') return window.toBigInt(v);
    try { return BigInt(v || 0); } catch (e) { return 0n; }
  }

  function getFormatted(val) {
    if (typeof window.formatCurrency === 'function') {
      return window.formatCurrency(val);
    }
    const b = safeToBigInt(val);
    return '$' + b.toLocaleString('en-US');
  }

  function createKeypadDOM() {
    if (document.getElementById('virtual-keypad')) return;

    keypadOverlay = document.createElement('div');
    keypadOverlay.className = 'keypad-overlay';

    keypadContainer = document.createElement('div');
    keypadContainer.id = 'virtual-keypad';
    keypadContainer.className = 'virtual-keypad';

    keypadContainer.innerHTML = `
      <div class="keypad-header">
        <span class="keypad-title">🔢 金額入力キーパッド</span>
        <button type="button" class="keypad-close-btn" id="keypad-close">&times;</button>
      </div>

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

  function updateDisplay() {
    const bigNum = safeToBigInt(currentValueStr);
    if (displayElement) {
      displayElement.textContent = getFormatted(bigNum);
    }
  }

  function openKeypad(targetElement) {
    activeTarget = targetElement;

    let initVal = "0";
    if (activeTarget.tagName === 'BUTTON') {
      initVal = activeTarget.getAttribute('data-amount') || "0";
    } else if (activeTarget.tagName === 'INPUT') {
      initVal = activeTarget.value || "0";
      activeTarget.setAttribute('inputmode', 'none');
    }

    const bigVal = safeToBigInt(initVal);
    currentValueStr = bigVal.toString();

    updateDisplay();

    keypadOverlay.classList.add('show');
    keypadContainer.classList.add('show');
  }

  function closeKeypad() {
    if (keypadOverlay) keypadOverlay.classList.remove('show');
    if (keypadContainer) keypadContainer.classList.remove('show');

    if (activeTarget) {
      if (activeTarget.blur) activeTarget.blur();
      activeTarget = null;
    }
  }

  function confirmValue() {
    if (!activeTarget) return;

    const bigVal = safeToBigInt(currentValueStr);
    const strVal = bigVal.toString();

    if (activeTarget.tagName === 'BUTTON') {
      activeTarget.setAttribute('data-amount', strVal);

      const prefix = activeTarget.getAttribute('data-label') || "金額を入力: ";
      activeTarget.textContent = `${prefix}${getFormatted(bigVal)}`;

      activeTarget.value = strVal;
    } else if (activeTarget.tagName === 'INPUT') {
      activeTarget.value = strVal;
    }

    activeTarget.dispatchEvent(new Event('input', { bubbles: true }));
    activeTarget.dispatchEvent(new Event('change', { bubbles: true }));

    closeKeypad();
  }

  function handleButtonClick(e) {
    const btn = e.target.closest('button');
    if (!btn || !activeTarget) return;

    if (btn.classList.contains('num-btn')) {
      const num = btn.getAttribute('data-val');
      if (currentValueStr === '0') {
        currentValueStr = (num === '00') ? '0' : num;
      } else {
        if (currentValueStr.length < 50) {
          currentValueStr += num;
        }
      }
      updateDisplay();
      return;
    }

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
        const addVal = safeToBigInt(btn.getAttribute('data-val'));
        const currentBig = safeToBigInt(currentValueStr);
        currentValueStr = (currentBig + addVal).toString();
        updateDisplay();
        break;

      case 'max':
        const cash = safeToBigInt(window.playerData?.cash);
        const bank = safeToBigInt(window.playerData?.bank);
        const debt = safeToBigInt(window.playerData?.debt);

        const isAtmTarget = activeTarget && (activeTarget.id === 'atm-amount-btn' || activeTarget.classList.contains('atm-amount-btn'));
        const mode = window.selectedAtmMode || null;

        let maxVal = cash;

        if (isAtmTarget) {
          if (mode === 'deposit') {
            maxVal = cash;
          } else if (mode === 'withdraw') {
            maxVal = bank;
          } else if (mode === 'repay') {
            maxVal = debt < cash ? debt : cash;
          } else if (mode === 'borrow') {
            maxVal = 99999999999999999999999999999999999999999999999999n;
          } else {
            maxVal = cash;
          }
        } else {
          // ベット入力時は上限（data-max）を無視して所持金全額（cash）を設定
          maxVal = cash;
        }

        currentValueStr = (maxVal < 0n ? 0n : maxVal).toString();
        updateDisplay();
        break;
    }
  }

  function setupKeypadEvents() {
    document.getElementById('keypad-close').addEventListener('click', closeKeypad);
    keypadOverlay.addEventListener('click', closeKeypad);

    keypadContainer.addEventListener('click', handleButtonClick);

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
