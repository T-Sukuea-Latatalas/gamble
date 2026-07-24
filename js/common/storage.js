// js/common/storage.js
const CasinoStorage = {
    _bankroll: 1000,
    _debt: 0,
    _maxDebt: 999999999, // 借金上限を事実上撤廃
    _uuid: '',
    _username: '',

    init() {
        this.load();
        this.initIdentity();
    },

    load() {
        const savedBankroll = localStorage.getItem('bj_classic_bankroll');
        const savedDebt = localStorage.getItem('bj_classic_debt');
        
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
            this.save();
        }
    },

    /**
     * 借金上限額の取得（上限を事実上撤廃したため、大きな値を返します）
     */
    getMaxDebt() {
        return this._maxDebt;
    },

    /**
     * 追加で借入可能な残り枠を取得（常に十分な上限のない値を返します）
     */
    getRemainingBorrowLimit() {
        return 999999999;
    },

    /**
     * 指定額の借入が可能か判定（常に制限なしで借入可能とします）
     */
    canBorrow(amount) {
        return true;
    },

    /**
     * 破産チェックおよびリセット処理
     * 残高が$1未満（0以下など）になった場合に破産を発火
     * @returns {boolean} 破産処理が実行されたかどうか
     */
    checkAndHandleBankruptcy() {
        if (this._bankroll < 1) {
            alert(`【 BANKRUPT / 破産発生 】\n残高が底を突きました。\n救済措置として、残高$1,000 / 借金$0 にリセットして再スタートします。`);
            
            this._bankroll = 1000;
            this._debt = 0;
            this.save();

            // クラウドランキングへ純資産$1,000を即座に送信
            if (window.CasinoRanking && typeof window.CasinoRanking.submitScore === 'function') {
                window.CasinoRanking.submitScore('net_worth', 1000);
            }
            return true;
        }
        return false;
    },

    /**
     * 自動利息取り立てメソッド
     * 借金の指定パーセンテージを残高（bankroll）から徴収します。
     * 残高が足りない場合は、引ききれなかった未払額が現在の借金（debt）に自動加算されます。
     * @param {number} interestRate 金利（デフォルトは1% = 0.01）
     * @returns {{collected: number, addedToDebt: number}} 実際に徴収した金額と借金に上乗せされた金額
     */
    applyInterest(interestRate = 0.01) {
        if (this._debt <= 0) return { collected: 0, addedToDebt: 0 };

        // 利息計算（端数は切り上げ）
        const rawInterest = Math.ceil(this._debt * interestRate);
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
