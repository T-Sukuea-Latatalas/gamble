// js/common/storage.js
const CasinoStorage = {
    _bankroll: 1000,
    _debt: 0,

    init() {
        this.load();
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
    }
};

// ロード時オートロード
CasinoStorage.init();
window.CasinoStorage = CasinoStorage;