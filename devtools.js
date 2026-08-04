/**
 * ==========================================
 * Fever Casino - 開発者ツール ＆ お知らせ送信制御 (devtools.js)
 * セキュアハッシュ照合認証・パラメータ書き換え・デバッグフラグ
 * ==========================================
 */

(function () {
    // デフォルト管理者パスワード "admin1234" のSHA-256ハッシュ
    const ADMIN_PASS_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";

    // グローバルゲームデバッグフラグ
    window.debugFlags = {
        forceWin: false,
        forceJackpot: false,
        forceLose: false
    };

    /**
     * SHA-256 ハッシュ関数 (Web Crypto API)
     */
    async function sha256(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 認証状態の確認
     */
    function isAuthenticated() {
        return sessionStorage.getItem('fever_casino_admin_auth') === 'true';
    }

    /**
     * ログイン処理
     */
    async function loginAdmin(pass) {
        const hashed = await sha256(pass);
        if (hashed === ADMIN_PASS_HASH) {
            sessionStorage.setItem('fever_casino_admin_auth', 'true');
            sessionStorage.setItem('fever_casino_admin_pass_hash', hashed);
            return true;
        }
        return false;
    }

    /**
     * ショートカット＆トリガーの監視
     * (Ctrl + Shift + Alt + D) またはタイトル5回連続タップ
     */
    function setupTriggerListeners() {
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.altKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                toggleDevTools();
            }
        });

        // スマホ用隠しタップ (ロビータイトルの5回連打)
        let tapCount = 0;
        let tapTimer = null;
        document.body.addEventListener('click', (e) => {
            const titleEl = e.target.closest('.game-title, h1');
            if (titleEl) {
                tapCount++;
                clearTimeout(tapTimer);
                tapTimer = setTimeout(() => { tapCount = 0; }, 2000);
                if (tapCount >= 5) {
                    tapCount = 0;
                    toggleDevTools();
                }
            }
        });
    }

    /**
     * パネルの切り替え表示
     */
    function toggleDevTools() {
        if (isAuthenticated()) {
            openDevPanel();
        } else {
            openLoginModal();
        }
    }

    /**
     * ログインモーダルの表示
     */
    function openLoginModal() {
        const modal = document.getElementById('devtools-login-modal');
        if (!modal) return;

        const input = document.getElementById('devtools-pass-input');
        if (input) input.value = '';

        modal.classList.remove('hidden');
    }

    function closeLoginModal() {
        const modal = document.getElementById('devtools-login-modal');
        if (modal) modal.classList.add('hidden');
    }

    /**
     * 開発者パネルの表示・更新
     */
    function openDevPanel() {
        closeLoginModal();
        const panel = document.getElementById('devtools-panel-modal');
        if (!panel) return;

        refreshDevPanelData();
        panel.classList.remove('hidden');
    }

    function closeDevPanel() {
        const panel = document.getElementById('devtools-panel-modal');
        if (panel) panel.classList.add('hidden');
    }

    /**
     * プレイヤーデータの読み込み・パネルフォーム反映
     */
    function refreshDevPanelData() {
        if (typeof window.loadData === 'function') window.loadData();
        const p = window.playerData || {};

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('dev-input-cash', window.toBigInt ? window.toBigInt(p.cash).toString() : (p.cash || 0));
        setVal('dev-input-bank', window.toBigInt ? window.toBigInt(p.bank).toString() : (p.bank || 0));
        setVal('dev-input-debt', window.toBigInt ? window.toBigInt(p.debt).toString() : (p.debt || 0));
        setVal('dev-input-playcount', p.debtPlayCount || 0);

        // フラグ情報
        const winChk = document.getElementById('dev-chk-force-win');
        const loseChk = document.getElementById('dev-chk-force-lose');
        if (winChk) winChk.checked = !!window.debugFlags.forceWin;
        if (loseChk) loseChk.checked = !!window.debugFlags.forceLose;
    }

    /**
     * 開発者設定の適用・書き換え
     */
    function applyPlayerDataChanges() {
        if (!isAuthenticated()) return;

        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : "0";
        };

        const safeBig = (v) => window.toBigInt ? window.toBigInt(v) : BigInt(v || 0);

        window.playerData.cash = safeBig(getVal('dev-input-cash'));
        window.playerData.bank = safeBig(getVal('dev-input-bank'));
        window.playerData.debt = safeBig(getVal('dev-input-debt'));
        window.playerData.debtPlayCount = parseInt(getVal('dev-input-playcount'), 10) || 0;

        if (typeof window.saveData === 'function') {
            window.saveData();
        }

        if (typeof window.updateUI === 'function') {
            window.updateUI();
        }

        alert('✅ プレイヤーデータを書き換え・保存しました！');
    }

    /**
     * 一括データリセット
     */
    function resetAllPlayerData() {
        if (!confirm('⚠️ 本当に全てのステータス・スコアを初期状態にリセットしますか？')) return;

        window.playerData.cash = 1000n;
        window.playerData.bank = 0n;
        window.playerData.debt = 0n;
        window.playerData.debtPlayCount = 0;
        window.playerData.debtChallengeFailCount = 0;
        window.playerData.nextDebtChallengeTime = 0;
        window.playerData.highScores = {
            blackjack: 0n, slots: 0n, roulette: 0n, poker: 0n, lottery: 0n, pachinko: 0n
        };

        if (typeof window.saveData === 'function') window.saveData();
        if (typeof window.updateUI === 'function') window.updateUI();

        refreshDevPanelData();
        alert('🔄 データを完全初期化しました。');
    }

    /**
     * お知らせ配信送信処理
     */
    async function submitNotice() {
        if (!isAuthenticated()) return;

        const titleEl = document.getElementById('dev-notice-title');
        const msgEl = document.getElementById('dev-notice-msg');
        const submitBtn = document.getElementById('dev-notice-submit-btn');

        const title = titleEl ? titleEl.value.trim() : "";
        const message = msgEl ? msgEl.value.trim() : "";

        if (!message) {
            alert('お知らせ内容を入力してください。');
            return;
        }

        const passHash = sessionStorage.getItem('fever_casino_admin_pass_hash') || ADMIN_PASS_HASH;

        submitBtn.disabled = true;
        submitBtn.textContent = '送信中...';

        try {
            if (typeof window.sendNoticeToSpreadsheet === 'function') {
                const res = await window.sendNoticeToSpreadsheet(title, message, passHash);
                if (res && res.status === 'success') {
                    alert('🎉 全ユーザー向けお知らせの配信が完了しました！');
                    if (titleEl) titleEl.value = '';
                    if (msgEl) msgEl.value = '';
                } else {
                    alert(`配信エラー: ${res ? res.message : '送信に失敗しました'}`);
                }
            } else {
                alert('spreadsheet.js が正しく読み込まれていません。');
            }
        } catch (err) {
            console.error(err);
            alert('送信処理中にエラーが発生しました。');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '📢 お知らせを全ユーザーへ配信';
        }
    }

    /**
     * イベントリスナーのセットアップ
     */
    function initDevToolsEvents() {
        setupTriggerListeners();

        // ログイン処理
        const loginBtn = document.getElementById('devtools-login-btn');
        const passInput = document.getElementById('devtools-pass-input');
        const closeLoginBtn = document.getElementById('devtools-login-close');

        if (loginBtn && passInput) {
            const doLogin = async () => {
                const pass = passInput.value;
                const success = await loginAdmin(pass);
                if (success) {
                    openDevPanel();
                } else {
                    alert('パスワードが違います。');
                }
            };
            loginBtn.addEventListener('click', doLogin);
            passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
        }

        if (closeLoginBtn) closeLoginBtn.addEventListener('click', closeLoginModal);

        // パネル操作ボタン
        const closePanelBtn = document.getElementById('devtools-panel-close');
        const applyBtn = document.getElementById('dev-apply-btn');
        const resetBtn = document.getElementById('dev-reset-btn');
        const sendNoticeBtn = document.getElementById('dev-notice-submit-btn');

        if (closePanelBtn) closePanelBtn.addEventListener('click', closeDevPanel);
        if (applyBtn) applyBtn.addEventListener('click', applyPlayerDataChanges);
        if (resetBtn) resetBtn.addEventListener('click', resetAllPlayerData);
        if (sendNoticeBtn) sendNoticeBtn.addEventListener('click', submitNotice);

        // デバッグフラグ
        const winChk = document.getElementById('dev-chk-force-win');
        const loseChk = document.getElementById('dev-chk-force-lose');

        if (winChk) {
            winChk.addEventListener('change', (e) => {
                window.debugFlags.forceWin = e.target.checked;
                if (e.target.checked && loseChk) {
                    loseChk.checked = false;
                    window.debugFlags.forceLose = false;
                }
            });
        }

        if (loseChk) {
            loseChk.addEventListener('change', (e) => {
                window.debugFlags.forceLose = e.target.checked;
                if (e.target.checked && winChk) {
                    winChk.checked = false;
                    window.debugFlags.forceWin = false;
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', initDevToolsEvents);

})();