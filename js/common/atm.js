// js/common/atm.js

/**
 * CasinoAtm - あつ森風ATM画面と各種システムを仲介するモジュール
 * 
 * 依存関係:
 * - window.CasinoStorage : 資金情報の管理
 * - window.CasinoNumpad  : 金額入力用のキーパッド
 * - window.CasinoRanking  : 純資産スコアの送信
 */
(function () {
  'use strict';

  // 内部状態管理
  let activeModal = null;
  let onClose = null;
  let isProcessing = false; // 二重操作および取引中の入力を防ぐフラグ

  const CasinoAtm = {
    /**
     * 初期化処理
     * 必要に応じて将来的な拡張（リソースのプリロードなど）を行えるよう定義
     */
    init() {
      // 起動確認用のログ出力、または必要なリソースの検証
      if (typeof console !== 'undefined') {
        console.log('CasinoAtm system initialized.');
      }
    },

    /**
     * ATMモーダルを画面上に動的生成して表示する
     * @param {Function} onCloseCallback - 取引終了時に呼び出し元に伝えるコールバック
     */
    open(onCloseCallback) {
      // すでに開いている場合は多重起動を防ぐ
      if (activeModal) return;

      onClose = onCloseCallback;
      isProcessing = false;

      // モーダル全体（オーバーレイ）の生成
      const overlay = document.createElement('div');
      overlay.className = 'atm-overlay';

      // 構造のレンダリング
      overlay.innerHTML = `
        <div class="atm-modal">
          <header class="atm-header">
            <h1 class="atm-title">ATM PORTAL SYSTEM / ご利用メニュー</h1>
          </header>
          
          <div class="atm-status-card">
            <div class="status-item">
              <span class="status-label">
                手元資金 <small>CASH ON HAND</small>
              </span>
              <span class="status-value value-white" id="atm-cash-on-hand">--</span>
            </div>
            <div class="status-item">
              <span class="status-label">
                借金残高 <small>DEBT / LOAN</small>
              </span>
              <span class="status-value value-red" id="atm-debt-loan">--</span>
            </div>
            <div class="status-item">
              <span class="status-label">
                預金残高 <small>ATM SAVINGS</small>
              </span>
              <span class="status-value value-gold" id="atm-savings">--</span>
            </div>
          </div>
          
          <div class="atm-menu">
            <button class="atm-btn btn-deposit" data-action="deposit">預け入れ (DEPOSIT)</button>
            <button class="atm-btn btn-withdraw" data-action="withdraw">引き出し (WITHDRAW)</button>
            <button class="atm-btn btn-repay" data-action="repay">ローン返済 (REPAY DEBT)</button>
            <button class="atm-btn btn-borrow" data-action="borrow">新規融資 (BORROW CASH)</button>
            <button class="atm-btn btn-exit" data-action="exit">取引終了 (EXIT)</button>
          </div>
        </div>
      `;

      // DOMへ挿入し、参照を保持
      document.body.appendChild(overlay);
      activeModal = overlay;

      // 画面表示を最新の状態に更新（ボタンのdisabled状態もここで初期判定します）
      this.updateDisplay();

      // イベントリスナーの設定
      this.bindEvents();
    },

    /**
     * モーダル要素を安全にDOMから削除する
     */
    close() {
      if (!activeModal) return;

      // DOMから削除
      activeModal.remove();
      activeModal = null;
      isProcessing = false;

      // クローズ時コールバックの安全な実行
      if (typeof onClose === 'function') {
        const callback = onClose;
        onClose = null; // ガードのため一度クリア
        callback();
      }
    },

    /**
     * 最新の資金データを取得し、画面に反映する
     * あつ森準拠のボタン活性・非活性の制御も含みます
     */
    updateDisplay() {
      if (!activeModal) return;

      // CasinoStorageから安全にデータを取得（未定義時は0で代替）
      const bankroll = window.CasinoStorage ? window.CasinoStorage.getBankroll() : 0;
      const debt = window.CasinoStorage ? window.CasinoStorage.getDebt() : 0;
      const atm = window.CasinoStorage ? window.CasinoStorage.getAtm() : 0;

      const cashElem = activeModal.querySelector('#atm-cash-on-hand');
      const debtElem = activeModal.querySelector('#atm-debt-loan');
      const savingsElem = activeModal.querySelector('#atm-savings');

      if (cashElem) cashElem.textContent = `$${bankroll.toLocaleString()}`;
      if (debtElem) debtElem.textContent = `$${debt.toLocaleString()}`;
      if (savingsElem) savingsElem.textContent = `$${atm.toLocaleString()}`;

      // 各種メニューボタンの取得
      const btnDeposit = activeModal.querySelector('.btn-deposit');
      const btnWithdraw = activeModal.querySelector('.btn-withdraw');
      const btnRepay = activeModal.querySelector('.btn-repay');

      // 【預け入れ】手元資金が1,000ドル未満の場合は無効化
      if (btnDeposit) {
        if (bankroll < 1000) {
          btnDeposit.disabled = true;
          btnDeposit.classList.add('disabled');
        } else {
          btnDeposit.disabled = false;
          btnDeposit.classList.remove('disabled');
        }
      }

      // 【引き出し】ATM預金残高が1,000ドル未満の場合は無効化
      if (btnWithdraw) {
        if (atm < 1000) {
          btnWithdraw.disabled = true;
          btnWithdraw.classList.add('disabled');
        } else {
          btnWithdraw.disabled = false;
          btnWithdraw.classList.remove('disabled');
        }
      }

      // 【ローン返済】借金残高が0、または手元資金が0の場合は無効化
      if (btnRepay) {
        if (debt === 0 || bankroll === 0) {
          btnRepay.disabled = true;
          btnRepay.classList.add('disabled');
        } else {
          btnRepay.disabled = false;
          btnRepay.classList.remove('disabled');
        }
      }
    },

    /**
     * モーダル内のイベントリスナーの紐付け
     */
    bindEvents() {
      if (!activeModal) return;

      // モーダル外（オーバーレイの背景部分）をクリックしたときに閉じる
      activeModal.addEventListener('click', (e) => {
        if (isProcessing) return; // Numpad展開中や取引中は閉じられないようにガード
        if (e.target === activeModal) {
          this.close();
        }
      });

      // 各種アクションボタンの制御
      const buttons = activeModal.querySelectorAll('.atm-btn');
      buttons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // バブリング防止
          if (isProcessing) return; // 重複操作を防止
          
          // disabled状態のボタンは処理を実行しない
          if (button.disabled || button.classList.contains('disabled')) {
            return;
          }

          const action = button.getAttribute('data-action');
          if (action === 'exit') {
            this.close();
          } else {
            this.handleAction(action);
          }
        });
      });
    },

    /**
     * 各ATMボタンのアクションハンドリングとNumpadの展開
     * @param {string} action - アクションキー
     */
    handleAction(action) {
      if (!window.CasinoNumpad) {
        console.warn('CasinoNumpad is missing. Operation ignored.');
        return;
      }

      let mode = '';
      switch (action) {
        case 'deposit':  mode = 'atm_deposit';  break;
        case 'withdraw': mode = 'atm_withdraw'; break;
        case 'repay':    mode = 'repay';        break;
        case 'borrow':   mode = 'borrow';       break;
        default: return;
      }

      // 入力開始段階で操作をロックする
      isProcessing = true;

      // 既存のCasinoNumpadシステムを呼び出す（コールバック引数 val, returnedMode）
      window.CasinoNumpad.open(mode, (val, returnedMode) => {
        // 取引終了、またはNumpad画面が閉じられた（キャンセル含む）時点で必ずガードを解除
        isProcessing = false;

        // 取引が成功した場合（valが有効な数値である場合）に、表示更新とクラウド同期を実行
        if (val !== null && typeof val === 'number' && !isNaN(val) && val > 0) {
          this.updateDisplay();
          this.syncRanking();
        }
      });
    },

    /**
     * クラウドへの同期（純資産の再計算とランキング送信）
     */
    syncRanking() {
      if (!window.CasinoStorage || !window.CasinoRanking) return;

      try {
        const bankroll = window.CasinoStorage.getBankroll();
        const atm = window.CasinoStorage.getAtm();
        const debt = window.CasinoStorage.getDebt();
        const netWorth = bankroll + atm - debt;

        // ランキングシステムに最新の純資産スコアを送信
        window.CasinoRanking.submitScore('net_worth', netWorth);
      } catch (error) {
        console.error('Failed to sync casino ranking:', error);
      }
    }
  };

  // グローバル空間への登録
  window.CasinoAtm = CasinoAtm;

})();
