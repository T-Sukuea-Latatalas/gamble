// js/common/numpad.js
const CasinoNumpad = {
    _mode: 'borrow', // 'borrow' | 'repay'
    _currentValStr: '0',
    _onConfirmCallback: null,
    _sfx: null,

    init(sfxInstance) {
        this._sfx = sfxInstance || new SoundEffects();
        this._createDOM();
    },

    // テンキーDOMが存在しない場合は、body直下へ動的にレンダリングする（ポータルでの共用化）
    _createDOM() {
        if (document.getElementById('numpad-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'numpad-overlay';
        overlay.className = 'numpad-overlay';
        overlay.style.display = 'none';

        overlay.innerHTML = `
            <div class="numpad-modal">
                <div class="numpad-header" id="numpad-title">借金額を入力</div>
                <div class="numpad-display-container">
                    <span class="numpad-currency">$</span>
                    <div id="numpad-val" class="numpad-value">0</div>
                </div>
                <div class="numpad-grid">
                    <button class="numpad-btn" data-val="1">1</button>
                    <button class="numpad-btn" data-val="2">2</button>
                    <button class="numpad-btn" data-val="3">3</button>
                    <button class="numpad-btn" data-val="4">4</button>
                    <button class="numpad-btn" data-val="5">5</button>
                    <button class="numpad-btn" data-val="6">6</button>
                    <button class="numpad-btn" data-val="7">7</button>
                    <button class="numpad-btn" data-val="8">8</button>
                    <button class="numpad-btn" data-val="9">9</button>
                    <button class="numpad-btn numpad-btn-c" data-action="clear">C</button>
                    <button class="numpad-btn" data-val="0">0</button>
                    <button class="numpad-btn" data-val="00">00</button>
                    <button class="numpad-btn numpad-btn-back" data-action="back">←</button>
                    <button class="numpad-btn numpad-btn-max" id="numpad-max-btn" data-action="max">MAX</button>
                </div>
                <div class="numpad-footer-btns">
                    <button class="numpad-footer-btn cancel" id="numpad-cancel-btn">CANCEL</button>
                    <button class="numpad-footer-btn confirm" id="numpad-confirm-btn">CONFIRM</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // イベントバインド
        overlay.querySelectorAll('.numpad-grid button[data-val]').forEach(btn => {
            btn.addEventListener('click', (e) => this._pressNum(e.target.getAttribute('data-val')));
        });

        overlay.querySelector('button[data-action="clear"]').addEventListener('click', () => this._clearNum());
        overlay.querySelector('button[data-action="back"]').addEventListener('click', () => this._pressBackspace());
        overlay.querySelector('button[data-action="max"]').addEventListener('click', () => this._pressMax());

        document.getElementById('numpad-cancel-btn').addEventListener('click', () => this.close());
        document.getElementById('numpad-confirm-btn').addEventListener('click', () => this._confirm());
    },

    open(mode, onConfirmCallback) {
        this._createDOM(); // 安全対策
        this._mode = mode;
        this._currentValStr = '0';
        this._onConfirmCallback = onConfirmCallback || null;

        const titleEl = document.getElementById('numpad-title');
        const maxBtn = document.getElementById('numpad-max-btn');

        if (mode === 'borrow') {
            titleEl.textContent = '借金額を入力';
            maxBtn.style.display = 'none'; // 借金時は上限なしのためMAXボタンを排除
        } else {
            titleEl.textContent = '返済額を入力';
            maxBtn.style.display = 'block';
        }

        this._updateDisplay();
        document.getElementById('numpad-overlay').style.display = 'flex';
    },

    close() {
        const overlay = document.getElementById('numpad-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    },

    _updateDisplay() {
        const valEl = document.getElementById('numpad-val');
        let parsed = parseInt(this._currentValStr, 10);
        if (isNaN(parsed) || parsed < 0) {
            parsed = 0;
            this._currentValStr = '0';
        }
        valEl.textContent = parsed.toLocaleString();
    },

    _pressNum(val) {
        if (this._sfx) {
            this._sfx.init();
            this._sfx.playCoin();
        }

        if (this._currentValStr === '0') {
            if (val === '00' || val === '0') return;
            this._currentValStr = String(val);
        } else {
            this._currentValStr += String(val);
        }

        // 返済時はリアルタイムで上限を制限
        if (this._mode === 'repay') {
            const limit = Math.min(window.CasinoStorage.getDebt(), window.CasinoStorage.getBankroll());
            const inputVal = parseInt(this._currentValStr, 10);
            if (isNaN(inputVal) || inputVal < 0) {
                this._currentValStr = '0';
            } else if (inputVal > limit) {
                this._currentValStr = String(limit);
            }
        }

        this._updateDisplay();
    },

    _pressBackspace() {
        if (this._sfx) {
            this._sfx.init();
            this._sfx.playCoin();
        }

        if (this._currentValStr.length > 1) {
            this._currentValStr = this._currentValStr.slice(0, -1);
        } else {
            this._currentValStr = '0';
        }
        this._updateDisplay();
    },

    _clearNum() {
        if (this._sfx) {
            this._sfx.init();
            this._sfx.playCoin();
        }
        this._currentValStr = '0';
        this._updateDisplay();
    },

    _pressMax() {
        if (this._sfx) {
            this._sfx.init();
            this._sfx.playCoin();
        }
        if (this._mode === 'repay') {
            const limit = Math.min(window.CasinoStorage.getDebt(), window.CasinoStorage.getBankroll());
            this._currentValStr = String(limit);
            this._updateDisplay();
        }
    },

    _confirm() {
        let val = parseInt(this._currentValStr, 10);
        if (isNaN(val) || val <= 0) {
            this.close();
            return;
        }
        val = Math.max(0, val);

        let bankroll = window.CasinoStorage.getBankroll();
        let debt = window.CasinoStorage.getDebt();

        if (this._mode === 'borrow') {
            debt = Math.max(0, debt + val);
            bankroll = Math.max(0, bankroll + val);
            window.CasinoStorage.setDebt(debt);
            window.CasinoStorage.setBankroll(bankroll);
        } else if (this._mode === 'repay') {
            const limit = Math.min(debt, bankroll);
            const actualRepay = Math.min(val, limit);
            if (actualRepay <= 0 || isNaN(actualRepay)) {
                this.close();
                return;
            }
            bankroll = Math.max(0, bankroll - actualRepay);
            debt = Math.max(0, debt - actualRepay);
            window.CasinoStorage.setBankroll(bankroll);
            window.CasinoStorage.setDebt(debt);
        }

        // コールバック通知により各ゲームのUIを自動更新させる（疎結合設計）
        if (this._onConfirmCallback) {
            this._onConfirmCallback(val, this._mode);
        }

        this.close();
    }
};

window.CasinoNumpad = CasinoNumpad;
