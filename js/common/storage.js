// js/common/storage.js
const CasinoStorage = {
    _bankroll: 1000,
    _debt: 0,
    _maxDebt: 999999999, // 借金上限を事実上撤廃
    _uuid: '',
    _username: '',
    _atm: 0, // ATM預金高 (圧縮単位: 1,000ドル = 1)
    _interestRate: 0.01, // 初期金利 1%

    init() {
        this.load();
        this.initIdentity();
    },

    load() {
        const savedBankroll = localStorage.getItem('bj_classic_bankroll');
        const savedDebt = localStorage.getItem('bj_classic_debt');
        const savedAtm = localStorage.getItem('bj_classic_atm');
        const savedRate = localStorage.getItem('bj_classic_interest_rate');
        
        let loadedBankroll = 1000;
        if (savedBankroll !== null) {
            const parsed = parseInt(savedBankroll, 10);
            if (!isNaN(parsed)) {
                loadedBankroll = Math.max(0, parsed);
            }
        }
        this._bankroll = loadedBankroll;

        let loadedDebt = 0;
        if (savedDebt !== null) {
            const parsed = parseInt(savedDebt, 10);
            if (!isNaN(parsed)) {
                loadedDebt = Math.max(0, parsed);
            }
        }
        this._debt = loadedDebt;

        let loadedAtm = 0;
        if (savedAtm !== null) {
            const parsed = parseInt(savedAtm, 10);
            if (!isNaN(parsed)) {
                loadedAtm = Math.max(0, parsed);
            }
        }
        this._atm = loadedAtm;

        let loadedRate = 0.01;
        if (savedRate !== null) {
            const parsed = parseFloat(savedRate);
            if (!isNaN(parsed)) {
                loadedRate = Math.max(0.01, parsed);
            }
        }
        this._interestRate = loadedRate;
    },

    // ユーザー識別情報（UUIDとユーザー名）の初期化
    initIdentity() {
        let uuid = localStorage.getItem('bj_classic_uuid');
        if (!uuid) {
            uuid = this.generateUUID();
            localStorage.setItem('bj_classic_uuid', uuid);
        }
        this._uuid = uuid;

        let username = localStorage.getItem('bj_classic_username');
        if (!username) {
            const randNum = Math.floor(1000 + Math.random() * 9000);
            username = `Guest_${randNum}`;
            localStorage.setItem('bj_classic_username', username);
        }
        this._username = username;
    },

    generateUUID() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        // フォールバック用のUUID生成アルゴリズム
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    save() {
        localStorage.setItem('bj_classic_bankroll', this._bankroll);
        localStorage.setItem('bj_classic_debt', this._debt);
        localStorage.setItem('bj_classic_atm', this._atm);
        localStorage.setItem('bj_classic_interest_rate', this._interestRate);
    },

    getBankroll() {
        return this._bankroll;
    },

    setBankroll(value) {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
            this._bankroll = Math.max(0, parsed);
            this.save();
        }
    },

    // --- エイリアスメソッド（各種インターフェースとの互換性確保） ---
    getWallet() {
        return this.getBankroll();
    },

    saveWallet(value) {
        this.setBankroll(value);
    },

    getBalance() {
        return this.getBankroll();
    },

    setBalance(value) {
        this.setBankroll(value);
    },

    getDebt() {
        return this._debt;
    },

    setDebt(value) {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
            this._debt = Math.max(0, parsed);
            if (this._debt === 0) {
                this._interestRate = 0.01; // 完済時に金利リセット
            }
            this.save();
        }
    },

    saveDebt(value) {
        this.setDebt(value);
    },

    /**
     * 借金上限額の取得
     */
    getMaxDebt() {
        return this._maxDebt;
    },

    /**
     * 追加で借入可能な残り枠を取得
     */
    getRemainingBorrowLimit() {
        return 999999999;
    },

    /**
     * 指定額の借入が可能か判定
     */
    canBorrow(amount) {
        return true;
    },

    /**
     * ATM関連メソッド (1,000ドル単位で圧縮して永続化)
     */
    getAtm() {
        return this._atm * 1000;
    },

    setAtm(value) {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
            this._atm = Math.max(0, Math.floor(parsed / 1000));
            this.save();
        }
    },

    saveAtm(value) {
        this.setAtm(value);
    },

    depositAtm(amount) {
        const rounded = Math.floor(amount / 1000) * 1000;
        if (rounded > 0 && this._bankroll >= rounded) {
            this._bankroll -= rounded;
            this._atm += (rounded / 1000);
            this.save();
            return rounded;
        }
        return 0;
    },

    withdrawAtm(amount) {
        const rounded = Math.floor(amount / 1000) * 1000;
        const available = this.getAtm();
        if (rounded > 0 && available >= rounded) {
            this._bankroll += rounded;
            this._atm -= (rounded / 1000);
            this.save();
            return rounded;
        }
        return 0;
    },

    /**
     * 遅延利息システムを組み込んだ自動利息取り立てメソッド
     * 借金が残っている間、ゲームプレイごとに金利が上昇し続けます。
     * @returns {{collected: number, addedToDebt: number}} 実際に徴収した金額と借金に上乗せされた金額
     */
    applyInterest() {
        if (this._debt <= 0) {
            this._interestRate = 0.01; // 借金ゼロなら金利リセット
            this.save();
            return { collected: 0, addedToDebt: 0 };
        }

        const rate = this._interestRate;
        // 利息計算（端数は切り上げ）
        const rawInterest = Math.ceil(this._debt * rate);
        if (rawInterest <= 0) return { collected: 0, addedToDebt: 0 };

        let collected = 0;
        let addedToDebt = 0;

        if (this._bankroll >= rawInterest) {
            this._bankroll -= rawInterest;
            collected = rawInterest;
        } else {
            // 残高の全額を徴収し、不足分は自動融資として借金を上乗せ
            collected = this._bankroll;
            this._bankroll = 0;
            const unpaid = rawInterest - collected;
            this._debt += unpaid;
            addedToDebt = unpaid;
        }

        // 次回から金利を +0.1% (+0.001) 上昇
        this._interestRate = parseFloat((rate + 0.001).toFixed(4));
        this.save();
        return { collected, addedToDebt };
    },

    getUUID() {
        return this._uuid;
    },

    getUsername() {
        return this._username;
    },

    setUsername(name) {
        if (name && name.trim().length > 0) {
            const trimmed = name.trim().substring(0, 15); // 最大15文字に制限
            this._username = trimmed;
            localStorage.setItem('bj_classic_username', trimmed);
        }
    }
};

// ロード時オートロード
CasinoStorage.init();
window.CasinoStorage = CasinoStorage;