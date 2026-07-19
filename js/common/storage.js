// js/common/storage.js
const CasinoStorage = {
    _bankroll: 1000,
    _debt: 0,
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
