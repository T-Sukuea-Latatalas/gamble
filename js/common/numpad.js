// js/common/numpad.js
const CasinoNumpad = {
    _mode: 'borrow', // 'borrow' | 'repay' | 'bet' | 'atm_deposit' | 'atm_withdraw'
    _currentValStr: '0',
    _onConfirmCallback: null,
    _sfx: null,

    init(sfxInstance) {
        this._sfx = sfxInstance || new SoundEffects();
        this._createDOM();
    },

    _createDOM() {
        if (document.getElementById('numpad-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'numpad-overlay';
        overlay.className = 'numpad-overlay';
        overlay.style.display = 'none';
        overlay.style.zIndex = '9999'; // 他のモーダルより前面に表示するためのz-index設定

        overlay.innerHTML = `
            <div class="numpad-modal">
                <div class="numpad-header" id="numpad-title">金額を入力</div>
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
                    <button class="numpad-btn" data-val="C" data-action="clear">C</button>
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

        overlay.querySelectorAll('.numpad-grid button[data-val]').forEach(btn => {
            const val = btn.getAttribute('data-val');
            if (val !== 'C') {
                btn.addEventListener('click', () => this._pressNum(val));
            }
        });

        overlay.querySelector('button[data-action="clear"]').addEventListener('click', () => this._clearNum());
        overlay.querySelector('button[data-action="back"]').addEventListener('click', () => this._pressBackspace());
        overlay.querySelector('button[data-action="max"]').addEventListener('click', () => this._pressMax());

        document.getElementById('numpad-cancel-btn').addEventListener('click', () => this._cancel());
        document.getElementById('numpad-confirm-btn').addEventListener('click', () => this._confirm());
    },

    open(mode, onConfirmCallback) {
        this._createDOM();
        this._mode = mode;
        this._currentValStr = '0';
        this._onConfirmCallback = onConfirmCallback || null;

        const titleEl = document.getElementById('numpad-title');
        const maxBtn = document.getElementById('numpad-max-btn');

        if (mode === 'borrow') {
            titleEl.textContent = `借金額を入力 (上限なし)`;
            maxBtn.style.display = 'block';
        } else if (mode === 'repay') {
            titleEl.textContent = '返済額を入力';
            maxBtn.style.display = 'block';
        } else if (mode === 'bet') {
            titleEl.textContent = 'ベットする額を入力';
            maxBtn.style.display = 'block';
        } else if (mode === 'atm_deposit') {
            titleEl.textContent = 'ATM預金額を入力 ($1,000単位)';
            maxBtn.style.display = 'block';
        } else if (mode === 'atm_withdraw') {
            titleEl.textContent = 'ATM引出額を入力 ($1,000単位)';
            maxBtn.style.display = 'block';
        } else {
            titleEl.textContent = '数値を入力';
            maxBtn.style.display = 'none';
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

    _cancel() {
        if (this._onConfirmCallback) {
            this._onConfirmCallback(null, this._mode);
        }
        this.close();
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

        const inputVal = parseInt(this._currentValStr, 10);

        if (this._mode === 'borrow') {
            if (isNaN(inputVal) || inputVal < 0) {
                this._currentValStr = '0';
            } else if (inputVal > 999999999) {
                this._currentValStr = '999999999';
            }
        } else if (this._mode === 'repay') {
            const limit = Math.min(window.CasinoStorage.getDebt(), window.CasinoStorage.getBankroll());
            if (isNaN(inputVal) || inputVal < 0) {
                this._currentValStr = '0';
            } else if (inputVal > limit) {
                this._currentValStr = String(limit);
            }
        } else if (this._mode === 'bet') {
            const limit = window.CasinoStorage.getBankroll();
            if (isNaN(inputVal) || inputVal < 0) {
                this._currentValStr = '0';
            } else if (inputVal > limit) {
                this._currentValStr = String(limit);
            }
        } else if (this._mode === 'atm_deposit') {
            const limit = Math.floor(window.CasinoStorage.getBankroll() / 1000) * 1000;
            if (isNaN(inputVal) || inputVal < 0) {
                this._currentValStr = '0';
            } else if (inputVal > limit) {
                this._currentValStr = String(limit);
            }
        } else if (this._mode === 'atm_withdraw') {
            const limit = window.CasinoStorage.getAtm();
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
        if (this._mode === 'borrow') {
            this._currentValStr = '999999999';
            this._updateDisplay();
        } else if (this._mode === 'repay') {
            const limit = Math.min(window.CasinoStorage.getDebt(), window.CasinoStorage.getBankroll());
            this._currentValStr = String(limit);
            this._updateDisplay();
        } else if (this._mode === 'bet') {
            const limit = window.CasinoStorage.getBankroll();
            this._currentValStr = String(limit);
            this._updateDisplay();
        } else if (this._mode === 'atm_deposit') {
            const limit = Math.floor(window.CasinoStorage.getBankroll() / 1000) * 1000;
            this._currentValStr = String(limit);
            this._updateDisplay();
        } else if (this._mode === 'atm_withdraw') {
            const limit = window.CasinoStorage.getAtm();
            this._currentValStr = String(limit);
            this._updateDisplay();
        }
    },

    _confirm() {
        let val = parseInt(this._currentValStr, 10);
        // 入力値が数値でない場合のみキャンセル扱い（null）として終了
        if (isNaN(val)) {
            if (this._onConfirmCallback) {
                this._onConfirmCallback(null, this._mode);
            }
            this.close();
            return;
        }

        val = Math.max(0, val);

        let bankroll = window.CasinoStorage.getBankroll();
        let debt = window.CasinoStorage.getDebt();

        if (this._mode === 'borrow') {
            if (val > 0) {
                debt = Math.max(0, debt + val);
                bankroll = Math.max(0, bankroll + val);
                window.CasinoStorage.setDebt(debt);
                window.CasinoStorage.setBankroll(bankroll);
            }
        } else if (this._mode === 'repay') {
            const limit = Math.min(debt, bankroll);
            const actualRepay = Math.min(val, limit);
            if (actualRepay > 0) {
                bankroll = Math.max(0, bankroll - actualRepay);
                debt = Math.max(0, debt - actualRepay);
                window.CasinoStorage.setBankroll(bankroll);
                window.CasinoStorage.setDebt(debt);
            }
            val = actualRepay; // 実際の返済完了額を結果として返却
        } else if (this._mode === 'bet') {
            const limit = bankroll;
            if (val > limit) {
                val = limit;
            }
        } else if (this._mode === 'atm_deposit') {
            // 1,000ドル単位に切り捨てて預金
            val = Math.floor(val / 1000) * 1000;
            if (val > 0) {
                window.CasinoStorage.depositAtm(val);
            }
        } else if (this._mode === 'atm_withdraw') {
            // 1,000ドル単位に切り捨てて引き出し
            val = Math.floor(val / 1000) * 1000;
            if (val > 0) {
                window.CasinoStorage.withdrawAtm(val);
            }
        }

        if (this._onConfirmCallback) {
            this._onConfirmCallback(val, this._mode);
        }

        this.close();
    }
};

window.CasinoNumpad = CasinoNumpad;