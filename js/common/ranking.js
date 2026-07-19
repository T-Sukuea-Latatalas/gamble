// js/common/ranking.js
const CasinoRanking = {
    // ⚠️ 設定手順4で取得したご自身のGASウェブアプリURLをここに設定してください。
    GAS_URL: 'YOUR_GAS_WEB_APP_URL_HERE',

    /**
     * ユーザー名の新規登録および更新要求
     * @param {string} username 
     */
    async registerUser(username) {
        if (!this._isValidUrl()) {
            console.warn("GAS_URL is not set. Offline mode.");
            return;
        }

        const uuid = window.CasinoStorage.getUUID();
        const payload = {
            action: 'register',
            uuid: uuid,
            username: username
        };

        try {
            // CORSのOPTIONSプリフライトを回避するため、あえてContent-Typeをtext/plainに設定
            await fetch(this.GAS_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error('Failed to register user to cloud:', e);
        }
    },

    /**
     * 指定したゲーム部門へスコアを送信
     * @param {string} gameId - 'net_worth' | 'blackjack_max_win' | 'slots_max_win' など
     * @param {number} score 
     */
    async submitScore(gameId, score) {
        if (!this._isValidUrl()) return;

        const uuid = window.CasinoStorage.getUUID();
        const username = window.CasinoStorage.getUsername();
        const payload = {
            action: 'submit',
            uuid: uuid,
            username: username,
            gameId: gameId,
            score: parseInt(score, 10)
        };

        try {
            await fetch(this.GAS_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error(`Failed to submit score for ${gameId}:`, e);
        }
    },

    /**
     * スプレッドシートから各部門のリーダーボード情報を取得
     * @returns {Promise<Object>}
     */
    async fetchLeaderboard() {
        if (!this._isValidUrl()) {
            return this.getDummyData();
        }

        try {
            const targetUrl = `${this.GAS_URL}?action=get_leaderboard&t=${Date.now()}`;
            const res = await fetch(targetUrl, { method: 'GET', mode: 'cors' });
            if (res.ok) {
                const data = await res.json();
                return data;
            }
        } catch (e) {
            console.error('Failed to fetch leaderboard from cloud:', e);
        }

        return this.getDummyData();
    },

    _isValidUrl() {
        return this.GAS_URL && this.GAS_URL !== 'YOUR_GAS_WEB_APP_URL_HERE' && this.GAS_URL.startsWith('http');
    },

    /**
     * GASと通信できない場合に表示するフォールバックデータ
     */
    getDummyData() {
        return {
            net_worth: [
                { username: 'ゴールデン・ハイローラー', score: 150000, uuid: 'dummy1' },
                { username: 'ラッキー・セブン', score: 85000, uuid: 'dummy2' },
                { username: 'カード・カウンタ', score: 32000, uuid: 'dummy3' },
                { username: 'ビギナーズ・ラック', score: 1000, uuid: 'dummy4' }
            ],
            blackjack_max_win: [
                { username: 'カード・カウンタ', score: 12500, uuid: 'dummy3' },
                { username: 'ゴールデン・ハイローラー', score: 5000, uuid: 'dummy1' },
                { username: 'ラッキー・セブン', score: 2500, uuid: 'dummy2' }
            ],
            slots_max_win: []
        };
    }
};

window.CasinoRanking = CasinoRanking;
