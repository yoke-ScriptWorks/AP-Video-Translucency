// ==UserScript==
// @name          AP Video Translucency
// @namespace     https://github.com/yoke-ScriptWorks/AP-Video-Translucency
// @version       1.1.261014
// @description   AP Video Translucency
// @author        yoke
// @match         https://*.amazon.co.jp/*
// @run-at        document-start
// @grant         none
// @updateURL     https://raw.githubusercontent.com/yoke-ScriptWorks/AP-Video-Translucency/main/ap-video-translucency.user.js
// @downloadURL   https://raw.githubusercontent.com/yoke-ScriptWorks/AP-Video-Translucency/main/ap-video-translucency.user.js
// ==/UserScript==

(function () {
    "use strict";

    const DEBUG_MODE = false;
    const CHECK_INTERVAL = 3000;
    const CUSTOM_STYLE_ID = "ap-customizer-style";
    const CSS_VARIABLE_NAMESPACE = "--ap-customizer";

    /**
     * 特定の記号に続く変数名を検出し、辞書の値に置換する
     * @param {string} sourceText - 置換対象の文字列
     * @param {string} prefixSymbol - 変数の前置記号
     * @param {Object} replacements - 変数名と置換後の値のマップ
     * @returns {string} 置換後の文字列
     */
    const replaceTokens = (sourceText, prefixSymbol, replacements) => {
        // バリデーション: 前置記号または置換表が未指定の場合はエラー
        if (
            !prefixSymbol ||
            !replacements ||
            typeof prefixSymbol !== "string" ||
            typeof replacements !== "object"
        ) {
            if (DEBUG_MODE) {
                console.error(`replace tokens: type error [arguments].`);
            }
            return sourceText;
        }

        // 正規表現用のエスケープ処理
        const escapeRegExp = (text) =>
            text.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");

        // 変数名を検出する正規表現（例: \$varName など）の生成
        const pattern = new RegExp(
            `${escapeRegExp(prefixSymbol)}([a-zA-Z]\\w*)`,
            "g",
        );

        // マッチした変数を辞書の値に置換
        return sourceText.replace(pattern, (matchedToken, variableName) => {
            // 辞書に変数が存在しない場合は警告を出し、置換しない
            if (!(variableName in replacements)) {
                if (DEBUG_MODE) {
                    console.warn(
                        `replace tokens: variable was not found [${variableName}].`,
                    );
                }
                return matchedToken;
            }
            return replacements[variableName];
        });
    };

    /**
     * 重ね合わせ後の目標不透明度から、追加する不透明度を計算する
     * @param {number} baseOpacity - 既存の不透明度
     * @param {number} targetOpacity - 目標とする合成後の不透明度
     * @returns {number} 追加する不透明度
     */
    const calcOpacity = (baseOpacity, targetOpacity) => {
        // 既存がすでに100%不透明、または目標が既存以下の場合は、追加する必要がない(0)
        if (baseOpacity >= 1 || targetOpacity <= baseOpacity) {
            return 0;
        }
        const additionalOpacity =
            (targetOpacity - baseOpacity) / (1 - baseOpacity);
        return Math.min(1, Math.round(additionalOpacity * 100000) / 100000);
    };

    /**
     * 対象セレクタ
     * 基本的に詳細度を (0, 0, 1) にして、後から指定したものが優先になるように調整
     * 細かく指定しなくても大丈夫かもしれないが、誤爆を防ぐため念を押して細かい指定にしている
     */
    const selectorSymbol = "$";
    const selector = {
        // 切り替わりのタイミングは良く分からないが二つある
        basePlayer: "#dv-web-player, #dv-web-player-2",
        mainPlayer: "&:is(#dv-web-player)",
        adsPlayer: "&:not(#dv-web-player)",

        // 初期化しておいた方が良さげな要素(現状必要がないようにも思える)
        initialize: ":where(div, span, input)",

        // z-index の調整用 (VSC用)
        playerContainer: ".atvwebplayersdk-player-container",

        /**
         * ボタンとボタンのマウスオーバーテキスト
         * 大体、下記のような構造になっている
         * <div> <!-- これ以下が1つのボタンの構成要素 -->
         *   <button>
         *     <img src="ボタンのイメージへのリンク">
         *   </button>
         *   <div>
         *     <div>ボタンにマウスオーバーしたときに表示される文字や要素
         *       <div>たまに深いテキストや要素もあるが、ここまで取得する必要はなさそう</div>
         *     </div>
         *   </div>
         * </div>
         */
        button: "button",
        buttonHover:
            "button:where(button:hover, button:has(+ div > div:hover))",
        buttonText: "div:where(button + div > div)",
        buttonTextHover:
            "div:where(button:hover + div > div, button + div > div:hover)",
        buttonImage: "img:where(button > img)",

        // フルスクリーンのボタンだけ少し目立たせたい
        fullscreenButton:
            "button:where(#atvwebplayersdk-fullscreen-toggle-button)",
        fullscreenButtonHover:
            "button:where(#atvwebplayersdk-fullscreen-toggle-button:hover, #atvwebplayersdk-fullscreen-toggle-button:has(+ div > div:hover))",
        fullscreenButtonText:
            "div:where(#atvwebplayersdk-fullscreen-toggle-button + div > div)",
        fullscreenButtonTextHover:
            "div:where(#atvwebplayersdk-fullscreen-toggle-button:hover + div > div, #atvwebplayersdk-fullscreen-toggle-button + div > div:hover)",

        /**
         * タイトルとサブタイトル
         * サブタイトルは少し深いところに入っているが、タイトルの兄弟の div要素 への変更で問題なさそう
         */
        titleParent: "div:has(> :where(.atvwebplayersdk-title-text))",
        title: "div:where(.atvwebplayersdk-title-text)",
        titleHover:
            "div:where(.atvwebplayersdk-title-text:hover, div.atvwebplayersdk-title-text:has(+ div:hover))",
        subTitle: "div:where(.atvwebplayersdk-title-text + div)",
        subTitleHover:
            "div:where(.atvwebplayersdk-title-text + div:hover, .atvwebplayersdk-title-text:hover + div)",

        pauseButtonParent:
            "div:where(div:has(> #atvwebplayersdk-play-pause-button))",

        // 一時停止と10秒スキップ
        backwardButton: "button:where(#atvwebplayersdk-skip-backward-button)",
        backwardButtonHover:
            "button:where(div:has(> div > #atvwebplayersdk-skip-backward-button:hover, > div > #atvwebplayersdk-play-pause-button:hover, > div > #atvwebplayersdk-skip-forward-button:hover) #atvwebplayersdk-skip-backward-button)",
        pauseButton: "button:where(#atvwebplayersdk-play-pause-button)",
        pauseButtonHover:
            "button:where(div:has(> div > #atvwebplayersdk-skip-backward-button:hover, > div > #atvwebplayersdk-play-pause-button:hover, > div > #atvwebplayersdk-skip-forward-button:hover) #atvwebplayersdk-play-pause-button)",
        forwardButton: "button:where(#atvwebplayersdk-skip-forward-button)",
        forwardButtonHover:
            "button:where(div:has(> div > #atvwebplayersdk-skip-backward-button:hover, > div > #atvwebplayersdk-play-pause-button:hover, > div > #atvwebplayersdk-skip-forward-button:hover) #atvwebplayersdk-skip-forward-button)",

        // 右上のボリュームボタン
        volumeButtonHover:
            "button:where(div:has(> div > #atvwebplayersdk-mute-toggle-button:hover, > div + div > div > div + #atvwebplayersdk-volume-slider:hover) #atvwebplayersdk-mute-toggle-button)",
        volumeSlider: "input:where(#atvwebplayersdk-volume-slider)",
        volumeSliderHover:
            "input:where(div:has(> div > #atvwebplayersdk-mute-toggle-button:hover, > div + div > div > div + #atvwebplayersdk-volume-slider:hover) #atvwebplayersdk-volume-slider)",

        // シークバー
        timeIndicator: "div:where(#atvwebplayersdk-time-indicator)",
        timeIndicatorHover:
            "div:where(div:has(> #atvwebplayersdk-time-indicator:hover, > #atvwebplayersdk-time-remaining-indicator:hover, > #atvwebplayersdk-time-indicator + div:hover) #atvwebplayersdk-time-indicator)",
        timeSlider:
            "input:where(#atvwebplayersdk-time-indicator + div input[aria-label='Seek'])",
        timeSliderHover:
            "input:where(div:has(> #atvwebplayersdk-time-indicator:hover, > #atvwebplayersdk-time-remaining-indicator:hover, > #atvwebplayersdk-time-indicator + div:hover) #atvwebplayersdk-time-indicator + div input[aria-label='Seek'])",
        timeRemaining: "div:where(#atvwebplayersdk-time-remaining-indicator)",
        timeRemainingHover:
            "div:where(div:has(> #atvwebplayersdk-time-indicator:hover, > #atvwebplayersdk-time-remaining-indicator:hover, > #atvwebplayersdk-time-indicator + div:hover) #atvwebplayersdk-time-remaining-indicator)",
        timeSliderIgnoreA: "div:where(.atvwebplayersdk-tick-mark-mask)",
        timeSliderIgnoreB:
            "div:where(:has(>div > div >input[aria-label='Seek']) > :where(div:not(div:has(input[aria-label='Seek']))))",

        // キーボードで音量を変えたときのボリューム
        volumeToastContainer: "div:where(.atvwebplayersdk-toast-container)",
        volumeToastIcon: "img:where(.atvwebplayersdk-toast-icon)",
        volumeToastIconHover:
            "img:where(.atvwebplayersdk-toast-container:hover .atvwebplayersdk-toast-icon)",
        volumeToastTrack: "div:where(.atvwebplayersdk-toast-slider-track)",
        volumeToastTrackHover:
            "div:where(.atvwebplayersdk-toast-container:hover .atvwebplayersdk-toast-slider-track)",
        volumeToastProgress: "div:where(.atvwebplayersdk-toast-slider-value)",
        volumeToastProgressHover:
            "div:where(.atvwebplayersdk-toast-container:hover .atvwebplayersdk-toast-slider-value)",
        volumeToastThumb: "div:where(.atvwebplayersdk-toast-slider-thumb)",
        volumeToastThumbHover:
            "div:where(.atvwebplayersdk-toast-container:hover .atvwebplayersdk-toast-slider-thumb)",

        // 左上に表示されるレーティングとか
        regulatoryOverlay:
            "div:where(.atvwebplayersdk-top-left-regulatory-overlay)",

        /**
         * 右下に表示される少し目立たせたいボタン
         */
        featuredTextButton:
            "button:where(.atvwebplayersdk-loading-overlay + div > div:nth-last-of-type(1) > div:nth-last-of-type(1) > div:nth-last-of-type(1) > div button)",
        featuredTextButtonHover:
            "button:where(.atvwebplayersdk-loading-overlay + div > div:nth-last-of-type(1) > div:nth-last-of-type(1) > div:nth-last-of-type(1) > div button:hover)",

        // 広告が終わるまでのカウントダウン
        adRemainingTime:
            "div:where(:has(> div > div > .atvwebplayersdk-ad-timer-remaining-time))",
        adRemainingTimeHover:
            "div:where(:has(> div > div > .atvwebplayersdk-ad-timer-remaining-time:hover))",

        /**
         * いらない子たち
         */
        // 次の話へ飛ばすボタンだった気がする
        nextUpCard: "div:where(.atvwebplayersdk-nextupcard-wrapper)",
        // あなたへのおすすめだった気がする
        preferences:
            "div:where(.atvwebplayersdk-loading-overlay + div > div:nth-of-type(1) > div:nth-last-of-type(2) > div > div > div > div:nth-of-type(1) > div:has(> div + div > div > button))",
        // あなたへのおすすめの画像の部分
        carousel: "div:where(:has(> div > div > .atvwebplayersdk-carousel))",
        // あなたへのおすすめのテキストの部分
        recommendA:
            "div:where(:has(+ div > div > div > .atvwebplayersdk-carousel))",
        // #dv-web-player-2 のときに表示されるあなたへのおすすめ (かなり適当)
        recommendB:
            "div:where(.atvwebplayersdk-loading-overlay + div > div:nth-of-type(2) > div:nth-last-of-type(1) > div:nth-of-type(1):has(> div button:not([id])))",
        // 広告フリーに登録
        registerAdFree:
            "div:where(.atvwebplayersdk-loading-overlay + div > div:nth-of-type(2) > div:nth-last-of-type(1) > div:nth-last-of-type(1):has(> div button:not([id])))",
        // シークバー上のCMの位置
        adMarkers:
            "div:where(div:has(> div > div > .atvwebplayersdk-progress-bar-handle) > div:nth-of-type(2) ~ div)",

        /**
         * 元々これでおすすめなどを表示を非表示にしていたが、お役御免かもしれない
         */
        videoAutoHideNextUpCard:
            "button:where(#atvwebplayersdk-settings-button)",
        videoAutoHideNextUpCardHover:
            "button:where(#atvwebplayersdk-settings-button:hover, #atvwebplayersdk-settings-button:has(+ div > div:hover))",
        videoAutoHideNextUpCardImage:
            "img:where(#atvwebplayersdk-settings-button > img)",
        videoAutoHideNextUpCardImageHover:
            ":where(#atvwebplayersdk-settings-button:hover, #atvwebplayersdk-settings-button:has(+ div > div:hover)) > img",
        // そのトップ画面
        topAutoHideNextUpCard:
            "img:where(#pv-nav-option-btn-container > div > button > span > img)",
        topAutoHideNextUpCardHover:
            "img:where(#pv-nav-option-btn-container > div > button:has(> span:hover, > span > img:hover) > span > img)",
        topAutoHideNextUpCardParent:
            "span:where(#pv-nav-option-btn-container > div > button > span)",
        topAutoHideNextUpCardParentHover:
            "span:where(#pv-nav-option-btn-container > div > button:has(> span:hover, > span > img:hover) > span)",

        /**
         * 画面に表示されるいらない子を aria-label で絞り込んだときに巻き込まれて消されたボタン
         * 要素の位置のベタ打ちに変更しが、ちょくちょく変更されると修正が面倒なので、そのときにまた巻き込まれる可能性がある
         * その度に表示されたり消されたりすると違和感があるので安定するまで非表示にしておく
         */
        topRegisterAdFree:
            "a:where(.dv-dp-node-playback + div > span > a.dv-signup-button)",
    };

    /**
     * 不透明度
     */
    const Opacities = {
        zero: 0,
        text: 0.2,
        textHover: 0.6,
        image: 0.2,
        imageHover: 0.6,
        fullscreenText: 0.4,
        fullscreenTextHover: 0.8,
        fullscreenImage: 0.4,
        fullscreenImageHover: 0.8,
        timeHover: 0.6,
        track: 0.1,
        trackHover: 0.3,
        progress: 0.2,
        progressHover: 0.6,
        thumb: 0.4,
        thumbHover: 0.8,
        featuredColor: 0.2,
        featuredBackground: 0.05,
        featuredBorder: 0.1,
        featuredColorHover: 0.8,
        featuredBackgroundHover: 0.15,
        featuredBorderHover: 0.2,
        topIcon: 0.65,
    };

    /**
     * 適用する値
     */
    const valuesSymbol = "?";
    const values = {
        namespace: CSS_VARIABLE_NAMESPACE,
        // 右上のボタン
        buttonOpacity: Opacities.image,
        buttonHoverOpacity: Opacities.imageHover,
        buttonTextOpacity: Opacities.text,
        buttonTextHoverOpacity: Opacities.textHover,
        fullscreenButtonOpacity: Opacities.fullscreenImage,
        fullscreenButtonHoverOpacity: Opacities.fullscreenImageHover,
        fullscreenButtonTextOpacity: Opacities.fullscreenText,
        fullscreenButtonTextHoverOpacity: Opacities.fullscreenTextHover,

        // タイトル
        titleOpacity: Opacities.text,
        titleHoverOpacity: Opacities.textHover,
        subtitleOpacity: Opacities.text,
        subtitleHoverOpacity: Opacities.textHover,

        // 再生関連
        backwardButtonOpacity: Opacities.image,
        backwardButtonHoverOpacity: Opacities.imageHover,
        pauseButtonOpacity: Opacities.image,
        pauseButtonHoverOpacity: Opacities.imageHover,
        forwardButtonOpacity: Opacities.image,
        forwardButtonHoverOpacity: Opacities.imageHover,

        // 右上のボリューム
        volumeSliderTrackOpacity: Opacities.track,
        volumeSliderTrackHoverOpacity: Opacities.trackHover,
        volumeSliderProgressOpacity: calcOpacity(
            Opacities.track,
            Opacities.progress,
        ),
        volumeSliderProgressHoverOpacity: calcOpacity(
            Opacities.trackHover,
            Opacities.progressHover,
        ),
        // マウスが外れているとき用
        volumeSliderThumbOpacity: Opacities.zero,
        volumeSliderThumbHoverOpacity: calcOpacity(
            Opacities.trackHover,
            Opacities.thumbHover,
        ),

        // シークバー／時間表示関連
        timeIndicatorOpacity: Opacities.text,
        timeIndicatorHoverOpacity: Opacities.timeHover,
        timeRemainingOpacity: Opacities.text,
        timeRemainingHoverOpacity: Opacities.timeHover,
        timeSliderTrackOpacity: Opacities.track,
        timeSliderTrackHoverOpacity: Opacities.trackHover,
        timeSliderProgressOpacity: calcOpacity(
            Opacities.track,
            Opacities.progress,
        ),
        timeSliderProgressHoverOpacity: calcOpacity(
            Opacities.trackHover,
            Opacities.progressHover,
        ),
        // マウスが外れているときは目立たなくても困らないので非表示
        timeSliderThumbOpacity: Opacities.zero,
        timeSliderThumbHoverOpacity: calcOpacity(
            Opacities.trackHover,
            Opacities.thumbHover,
        ),

        // キーボードで変更したときのボリューム
        volumeToastIconOpacity: Opacities.image,
        volumeToastIconHoverOpacity: Opacities.imageHover,
        volumeToastTrackOpacity: Opacities.track,
        volumeToastTrackHoverOpacity: Opacities.trackHover,
        volumeToastProgressOpacity: calcOpacity(
            Opacities.track,
            Opacities.progress,
        ),
        volumeToastProgressHoverOpacity: calcOpacity(
            Opacities.trackHover,
            Opacities.progressHover,
        ),
        // マウスが外れているとき用
        volumeToastThumbOpacity: calcOpacity(
            Opacities.progress,
            Opacities.thumb,
        ),
        volumeToastThumbHoverOpacity: calcOpacity(
            Opacities.trackHover,
            Opacities.thumbHover,
        ),

        // 右下の少しだけ目立たせたいボタン
        featuredTextButtonColorOpacity: Opacities.featuredColor,
        featuredTextButtonBackgroundOpacity: Opacities.featuredBackground,
        featuredTextButtonBorderOpacity: Opacities.featuredBorder,
        featuredTextButtonColorHoverOpacity: Opacities.featuredColorHover,
        featuredTextButtonBackgroundHoverOpacity:
            Opacities.featuredBackgroundHover,
        featuredTextButtonBorderHoverOpacity: Opacities.featuredBorderHover,

        // 広告が終わるまでのカウントダウン
        adRemainingTimeOpacity: Opacities.text,
        adRemainingTimeHoverOpacity: Opacities.textHover,

        // 要らないかも
        videoAutoHideNextUpCardOpacity: Opacities.image,
        videoAutoHideNextUpCardHoverOpacity: Opacities.imageHover,
        topAutoHideNextUpCardOpacity: Opacities.topIcon,
    };

    /**
     * テンプレート
     */
    const cssTemplate = `
        :root
        {
            /* z-index の調整 */
            ?namespace-z-index-max: ${2 ** 24 - 1};
            ?namespace-player-container-z-index: 1;
            /* スライダーの共通サイズ */
            ?namespace-thumb-size: 6pt;
            ?namespace-bar-size: 3pt;
            /* ボリュームの消える時間の指定 */
            ?namespace-transition-volume-opacity-duration: 1.5s;
            ?namespace-transition-volume-opacity-delay: 1.5s;
            ?namespace-transition-volume-visible-delay: 3.5s;
            /* その他の消える時間の指定 */
            ?namespace-transition-base-opacity-duration: 0.5s;
            ?namespace-transition-base-opacity-delay: 0s;
            /* 広告が終わるまでのカウントダウンが表示される位置 */
            ?namespace-ad-remaining-time-position: 60pt auto auto 30pt;
        }
        $basePlayer
        {
            /**
             * 不透明度以外のスタイル設定
             */

            /* 邪魔になりそうな要素を一括で変更 */
            $initialize
            {
                color: #ffffff !important;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                opacity: 1 !important;
                filter: none !important;

                appearance: none !important;
            }

            /* VSC と協調できるように z-index を調整 */
            $playerContainer
            {
                position: relative !important;
                z-index: var(?namespace-player-container-z-index) !important;

                margin-inline: auto !important;
            }

            /**
             * ボタンとボタンのマウスオーバーテキストの基本設定
             */
            $button
            {
                position: relative !important;
                z-index: var(?namespace-z-index-max) !important;

                margin-inline: auto !important;

                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                opacity: var(?namespace-opacity) !important;
                filter: none !important;

                appearance: none !important;
                transition: opacity var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                transform-origin: center !important;
                pointer-events: auto !important;
                cursor: pointer !important;
            }
            $buttonHover
            {
                transition: none !important;
            }
            $buttonText
            {
                position: relative !important;
                z-index: var(?namespace-z-index-max) !important;

                margin-inline: auto !important;

                color: rgba(255, 255, 255, var(?namespace-opacity)) !important;
                border: none !important;
                box-shadow: none !important;
                opacity: 1 !important;
                filter: none !important;

                appearance: none !important;
                transition: color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                transform-origin: center !important;
                pointer-events: auto !important;
                zoom: 80% !important;
            }
            $buttonTextHover
            {
                transition: none !important;
            }
            $buttonImage
            {
                background: transparent !important;
                background-position: center !important;
                border: none !important;
                box-shadow: none !important;
                opacity: 1 !important;
                filter: none !important;

                appearance: none !important;
                transform-origin: center !important;
                cursor: pointer !important;
            }


            /**
             * タイトル
             * z-index を変更しないとマウスオーバーが効かない
             * 他の要素は z-index 変更しくても良いかもしれない
             */
            $titleParent
            {
                display: inline-flex !important;

                gap: 0 !important;

                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                filter: none !important;

                appearance: none !important;
                pointer-events: auto !important;
            }
            $title
            {
                position: relative !important;
                z-index: var(?namespace-z-index-max) !important;

                margin: auto auto 0 0 !important;

                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                filter: none !important;
                opacity: var(?namespace-opacity) !important;

                appearance: none !important;
                transition: opacity var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                pointer-events: auto !important;
                zoom: 50% !important;
            }
            $titleHover
            {
                transition: none !important;
            }
            $subTitle
            {
                position: relative !important;
                z-index: var(?namespace-z-index-max) !important;

                margin: 0 auto auto 0 !important;

                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                filter: none !important;
                opacity: var(?namespace-opacity) !important;

                appearance: none !important;
                transition: opacity var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                pointer-events: auto !important;
                zoom: 65% !important;
            }
            $subTitleHover
            {
                transition: none !important;
            }


            /* 一時停止と10秒進むと戻る */
            $pauseButtonParent
            {
                margin: 0 -0.8vw !important;
                padding: 0 !important;

                border: none !important;

                transform-origin: center !important;
            }
            $backwardButton
            {
                margin: 0 !important;
                padding: 0 !important;

                border: none !important;

                transition: opacity var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                transform: scale(0.85) !important;
                transform-origin: center right !important;
            }
            $backwardButtonHover
            {
                transition: none !important;
            }
            $pauseButton
            {
                margin: 0 !important;
                padding: 0 !important;

                border: none !important;

                transition: opacity var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                transform: scale(0.65) !important;
                transform-origin: center !important;
            }
            $pauseButtonHover
            {
                transition: none !important;
            }
            $forwardButton
            {
                margin: 0 !important;
                padding: 0 !important;

                border: none !important;

                transition: opacity var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                transform: scale(0.85) !important;
                transform-origin: center left !important;
            }
            $forwardButtonHover
            {
                transition: none !important;
            }


            /**
             * 右上のボリューム
             * 幅(width)は chrome用 の進捗バーが、つまみ(サム)の状態(表示／非表示)でずれるのを防ぐために必要
             * overflow Chrome用の 進捗バーが input の要素から飛び出すのを防ぐため
             * margin は position を変えると左右の位置が少しずれるので進捗バーの大きさを基準としてずらす
             * 高さは他のボタンをマウスオーバーしたときに文字と被らないようにずらしていると思われるが好みの問題でボタンに寄せている
             * z-index は触らない方が素直だったかもしれない
             */
            $volumeSlider
            {
                ?namespace-current-thumb-size: 0pt;

                position: relative !important;
                z-index: var(?namespace-z-index-max) !important;
                visibility: hidden !important;

                width: var(?namespace-thumb-size) !important;
                overflow: hidden !important;
                /* margin: -2vh auto auto calc(var(?namespace-bar-size) * -0.208 - 0.05vh) !important; */
                margin: -2vh auto auto calc(var(?namespace-bar-size) * -0.1 - 0.25vw) !important;

                background: transparent !important;
                opacity: 0 !important;

                appearance: none !important;
                transition:
                    opacity var(?namespace-transition-volume-opacity-duration) ease var(?namespace-transition-volume-opacity-delay),
                    visibility 0s var(?namespace-transition-volume-visible-delay)
                    !important;
                pointer-events: auto !important;
                cursor: pointer !important;
            }
            $volumeSliderHover
            {
                ?namespace-current-thumb-size: var(?namespace-thumb-size);

                visibility: visible !important;

                opacity: 1 !important;

                transition: none !important;
            }
            /* Firefox用 の溝(トラック) */
            $volumeSlider::-moz-range-track
            {
                width: var(?namespace-bar-size) !important;

                background-color: rgba(255, 255, 255, var(?namespace-track-opacity)) !important;
                opacity: 1 !important;

                appearance: none !important;
                cursor: pointer !important;
            }
            /* Chrome用 の溝(トラック) */
            $volumeSlider::-webkit-slider-runnable-track
            {
                /* 要素の幅はつまみのサイズとする */
                width: var(?namespace-thumb-size) !important;

                /* 縦の直線で実際のトラックの幅を作る */
                background: linear-gradient(rgba(255, 255, 255, var(?namespace-track-opacity)) 0 0) center / var(?namespace-bar-size) 100% no-repeat !important;
                opacity: 1 !important;

                appearance: none !important;
                cursor: pointer !important;
            }
            /* Firefox用 の進捗バー */
            $volumeSlider::-moz-range-progress
            {
                width: var(?namespace-bar-size) !important;

                background-color: rgba(255, 255, 255, var(?namespace-progress-opacity)) !important;
                opacity: 1 !important;

                appearance: none !important;
                cursor: pointer !important;
            }
            /* Firefox用 のつまみ(サム) */
            $volumeSlider::-moz-range-thumb
            {
                width: var(?namespace-current-thumb-size) !important;
                height: var(?namespace-current-thumb-size) !important;

                background-color: rgba(255, 255, 255, var(?namespace-thumb-opacity)) !important;
                border: none !important;
                border-radius: 50% !important;
                opacity: 1 !important;

                appearance: none !important;
                cursor: pointer !important;
            }
            /**
             * Chrome用 のつまみ(サム)と進捗バー
             * 進捗バーは zbox-shadow をつまみ分ずらしてバカでかい影を表示
             * clip-path で必要な溝(進捗バー)の幅だけ残こと進捗バーとなる
             * ※ input から飛び出し分は input自体 の overflow で切っている
             */
            $volumeSlider::-webkit-slider-thumb
            {
                /* 進捗バーを作る背景の大きさ (overflow: hidden ではみ出した分はカットするので円の丸みがでないように大きなサイズで作る) */
                ?namespace-shadow-progress-size: calc(var(?namespace-thumb-size) * 200);
                /* つまみ */
                /* 左上が原点で右下はつまみのサイズ */
                ?namespace-track-top: 0pt;
                ?namespace-track-right: var(?namespace-current-thumb-size);
                ?namespace-track-bottom: var(?namespace-current-thumb-size);
                ?namespace-track-left: 0pt;
                /* 進捗バー */
                /* 上端は つまみのサイズ 下にオフセット */
                ?namespace-progress-top: var(?namespace-current-thumb-size);
                /* 右端は [つまみのサイズ-トラックの幅] の 1/2 右(左)にオフセット */
                ?namespace-progress-left: calc((var(?namespace-current-thumb-size) - var(?namespace-bar-size)) / 2);
                /* 左側は [つまみのサイズ+トラックの幅] の 1/2 右にオフセット */
                ?namespace-progress-right: calc((var(?namespace-current-thumb-size) + var(?namespace-bar-size)) / 2);
                /* 下端は 適当にはみ出す長さとする (はみ出した分は input の overflow: hidden で消去される) */
                ?namespace-progress-bottom: var(?namespace-shadow-progress-size);

                /* 幅と高さは現在のつまみのサイズ */
                width: var(?namespace-current-thumb-size) !important;
                height: var(?namespace-current-thumb-size) !important;
                /* つまみの状態(大きさ)によって左右に移動するのでオフセット */
                margin-left: calc((var(?namespace-thumb-size) - var(?namespace-current-thumb-size)) / 2) !important;

                /* つまみの色や形 */
                background-color: rgba(255, 255, 255, var(?namespace-thumb-opacity)) !important;
                border: none !important;
                border-radius: 50% !important;
                /* 進捗バーの土台 */
                /* [つまみのサイズ+背景のサイズ] 下にオフセット 背景はかなり大きな円となる */
                box-shadow: 0 calc(var(?namespace-shadow-progress-size) + var(?namespace-current-thumb-size)) 0 var(?namespace-shadow-progress-size) rgba(255, 255, 255, var(?namespace-progress-opacity)) !important;
                opacity: 1 !important;

                appearance: none !important;
                /* つまみと進捗バーを切り抜く */
                clip-path: polygon(
                    /* つまみの左下 */
                    var(?namespace-track-left) var(?namespace-track-bottom),
                    /* つまみの左上 */
                    var(?namespace-track-left) var(?namespace-track-top),
                    /* つまみの右上 */
                    var(?namespace-track-right) var(?namespace-track-top),
                    /* つまみの右下 */
                    var(?namespace-track-right) var(?namespace-track-bottom),
                    /* 進捗バーの右上 */
                    var(?namespace-progress-right) var(?namespace-progress-top),
                    /* 進捗バーの右下 */
                    var(?namespace-progress-right) var(?namespace-progress-bottom),
                    /* 進捗バーの左下 */
                    var(?namespace-progress-left) var(?namespace-progress-bottom),
                    /* 進捗バーの左上 */
                    var(?namespace-progress-left) var(?namespace-progress-top)
                ) !important;
                cursor: pointer !important;
            }


            /**
             * シークバーと時間表示
             * 大体右上のボリュームと同じ
             * chrome用 の進捗バーは、ボリュームで input のつまみから作り出す仕組みを作ったのでcmの点と一緒に非表示に変更
             */
            $timeIndicator
            {
                display: flex !important;
                position: relative !important;
                justify-content: center !important;
                z-index: var(?namespace-z-index-max) !important;
                margin: auto 0 auto auto !important;

                color: rgba(255, 255, 255, var(?namespace-opacity)) !important;
                background: transparent !important;
                opacity: 1 !important;

                transition: color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                transform: scale(0.85) !important;
            }
            $timeIndicatorHover
            {
                transition: none !important;
            }
            $timeRemaining
            {
                display: flex !important;
                position: relative !important;
                justify-content: center !important;
                z-index: var(?namespace-z-index-max) !important;

                margin: auto auto auto 0 !important;

                color: rgba(255, 255, 255, var(?namespace-opacity)) !important;
                background: transparent !important;
                opacity: 1 !important;

                transition: color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                transform: scale(0.85) !important;
            }
            $timeRemainingHover
            {
                transition: none !important;
            }
            $timeSlider
            {
                ?namespace-current-thumb-size: 0pt;

                position: relative !important;
                z-index: var(?namespace-z-index-max) !important;
                visibility: visible !important;

                height: var(?namespace-thumb-size) !important;
                overflow: hidden !important;
                margin: calc(var(?namespace-thumb-size) * -0.54  + 0.39vh) auto auto auto !important;
                background: transparent !important;
                opacity: 1 !important;

                appearance: none !important;
                pointer-events: auto !important;
                cursor: pointer !important;
            }
            $timeSliderHover
            {
                ?namespace-current-thumb-size: var(?namespace-thumb-size);
            }
            $timeSlider::-moz-range-track
            {
                height: var(?namespace-bar-size) !important;

                background-color: rgba(255, 255, 255, var(?namespace-track-opacity)) !important;
                opacity: 1 !important;

                appearance: none !important;
                transition: background-color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                cursor: pointer !important;
            }
            $timeSliderHover::-moz-range-track
            {
                transition: none !important;
            }
            $timeSlider::-webkit-slider-runnable-track
            {
                height: var(?namespace-thumb-size) !important;

                background: linear-gradient(rgba(255, 255, 255, var(?namespace-track-opacity)) 0 0) center / 100% var(?namespace-bar-size) no-repeat !important;
                opacity: 1 !important;

                appearance: none !important;
                transition: background-color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                cursor: pointer !important;
            }
            $timeSliderHover::-webkit-slider-runnable-track
            {
                transition: none !important;
            }
            $timeSlider::-moz-range-progress
            {
                height: var(?namespace-bar-size) !important;

                background-color: rgba(255, 255, 255, var(?namespace-progress-opacity)) !important;
                opacity: 1 !important;

                appearance: none !important;
                transition: background-color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                cursor: pointer !important;
            }
            $timeSliderHover::-moz-range-progress
            {
                transition: none !important;
            }
            $timeSlider::-moz-range-thumb
            {
                width: var(?namespace-current-thumb-size) !important;
                height: var(?namespace-current-thumb-size) !important;

                background-color: rgba(255, 255, 255, var(?namespace-thumb-opacity)) !important;
                border: none !important;
                border-radius: 50% !important;
                opacity: 1 !important;

                appearance: none !important;
                transition: background-color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                cursor: pointer !important;
            }
            $timeSliderHover::-moz-range-thumb
            {
                transition: none !important;
            }
            $timeSlider::-webkit-slider-thumb
            {
                ?namespace-shadow-progress-size: calc(var(?namespace-thumb-size) * 200);
                ?namespace-track-top: 0pt;
                ?namespace-track-right: var(?namespace-current-thumb-size);
                ?namespace-track-bottom: var(?namespace-current-thumb-size);
                ?namespace-track-left: 0pt;
                ?namespace-progress-top: calc(var(?namespace-current-thumb-size) / 2 - var(?namespace-bar-size) / 2);
                ?namespace-progress-left: calc(0pt - var(?namespace-shadow-progress-size));
                ?namespace-progress-right: 0pt;
                ?namespace-progress-bottom: calc(var(?namespace-current-thumb-size) / 2 + var(?namespace-bar-size) / 2);

                width: var(?namespace-current-thumb-size) !important;
                height: var(?namespace-current-thumb-size) !important;
                margin-top: calc(var(--ap-customizer-thumb-size) / 2 - var(--ap-customizer-current-thumb-size) / 2) !important;

                background-color: rgba(255, 255, 255, var(?namespace-thumb-opacity)) !important;
                border: none !important;
                border-radius: 50% !important;
                box-shadow: calc(0pt - var(?namespace-shadow-progress-size) - var(?namespace-current-thumb-size)) 0 0 var(?namespace-shadow-progress-size) rgba(255, 255, 255, var(?namespace-progress-opacity)) !important;
                opacity: 1 !important;

                appearance: none !important;

                transition:
                    background-color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay),
                    box-shadow var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay)
                    !important;
                clip-path: polygon(
                    var(?namespace-track-left) var(?namespace-track-top),
                    var(?namespace-track-right) var(?namespace-track-top),
                    var(?namespace-track-right) var(?namespace-track-bottom),
                    var(?namespace-track-left) var(?namespace-track-bottom),
                    var(?namespace-progress-right) var(?namespace-progress-bottom),
                    var(?namespace-progress-left) var(?namespace-progress-bottom),
                    var(?namespace-progress-left) var(?namespace-progress-top),
                    var(?namespace-progress-right) var(?namespace-progress-top)
                ) !important;
                cursor: pointer !important;
            }
            $timeSliderHover::-webkit-slider-thumb
            {
                transition: none !important;
            }
            $timeSliderIgnoreA
            {
                clip-path: none !important;
            }
            $timeSliderIgnoreB
            {
                display: none !important;

                opacity: 0 !important;

                transform: scale(0) !important;
            }


            /* キーボードから音量を変えたときに表示されるボリュームの疑似スライダー */
            $volumeToastContainer
            {
                position: relative !important;
                z-index: var(?namespace-z-index-max) !important;
                visibility: visible !important;

                margin-inline: auto !important;

                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                opacity: 1 !important;
                filter: none !important;

                appearance: none !important;
                transform-origin: center !important;
                pointer-events: auto !important;
                cursor: default !important;
            }
            $volumeToastIcon
            {
                background: transparent !important;
                border: none !important;
                border-radius: 50% !important;
                box-shadow: none !important;
                opacity: var(?namespace-opacity) !important;
                filter: none !important;

                appearance: none !important;
                transition: opacity var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                transform-origin: center !important;
                cursor: default !important;
            }
            $volumeToastIconHover
            {
                transition: none !important;
            }
            $volumeToastTrack
            {
                height: var(?namespace-bar-size) !important;

                background-color: rgba(255, 255, 255, var(?namespace-opacity)) !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                opacity: 1 !important;
                filter: none !important;

                appearance: none !important;
                transition: background-color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                cursor: default !important;
            }
            $volumeToastTrackHover
            {
                transition: none !important;
            }
            $volumeToastProgress
            {
                height: var(?namespace-bar-size) !important;

                background-color: rgba(255, 255, 255, var(?namespace-opacity)) !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                opacity: 1 !important;
                filter: none !important;

                appearance: none !important;
                transition: background-color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                cursor: default !important;
            }
            $volumeToastProgressHover
            {
                transition: none !important;
            }
            $volumeToastThumb
            {
                width: var(?namespace-thumb-size) !important;
                height: var(?namespace-thumb-size) !important;
                margin: 0 auto auto auto !important;
                padding: 0 !important;

                background-color: rgba(255, 255, 255, var(?namespace-opacity)) !important;
                border: none !important;
                opacity: 1 !important;

                appearance: none !important;
                transition: background-color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                cursor: default !important;
            }
            $volumeToastThumbHover
            {
                transition: none !important;
            }

            /* 右下の少し目立たせたいボタン */
            $mainPlayer $featuredTextButton
            {
                position: relative !important;
                z-index: var(?namespace-z-index-max) !important;
                visibility: visible !important;

                margin-inline: auto !important;

                color: rgba(255, 255, 255, var(?namespace-color-opacity)) !important;
                background: rgba(0, 0, 0, var(?namespace-background-opacity)) !important;
                border: thin solid rgba(0, 0, 0, var(?namespace-border-opacity)) !important;
                box-shadow: none !important;
                opacity: 1 !important;
                filter: none !important;

                appearance: none !important;
                pointer-events: auto !important;
                transition:
                    color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay),
                    background-color var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay),
                    border var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay)
                    !important;
                cursor: pointer !important;
                zoom: 65% !important;
            }
            $mainPlayer $featuredTextButtonHover
            {
                transition: none !important;
            }

            /* 広告が終わるまでのカウントダウン */
            $adRemainingTime
            {
                position: fixed !important;
                z-index: var(?namespace-z-index-max) !important;
                visibility: visible !important;

                margin: 0 !important;
                padding: 0 !important;
                inset: var(?namespace-ad-remaining-time-position) !important;
                width: fit-content !important;

                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                filter: none !important;
                opacity: var(?namespace-opacity) !important;

                appearance: none !important;
                transition: opacity var(?namespace-transition-base-opacity-duration) ease var(?namespace-transition-base-opacity-delay) !important;
                pointer-events: auto !important;
            }
            $adRemainingTimeHover
            {
                transition: none !important;
            }

            /* いらない子 */
            $nextUpCard,
            $preferences,
            $carousel,
            $recommendA,
            $recommendB,
            $registerAdFree,
            $adMarkers,
            $regulatoryOverlay,
            $adsPlayer $featuredTextButton
            {
                display: none !important;

                opacity: 0 !important;

                transform: scale(0) !important;
            }


            /**
             * 不透明度のスタイル設定
             * CSSカスタムプロパティに各状態での不透明度を指定
             */

            /* ボタン関連 */
            $button
            {
                ?namespace-opacity: ?buttonOpacity;
            }
            $buttonHover
            {
                ?namespace-opacity: ?buttonHoverOpacity;
            }
            $buttonText
            {
                ?namespace-opacity: ?buttonTextOpacity;
            }
            $buttonTextHover
            {
                ?namespace-opacity: ?buttonTextHoverOpacity;
            }
            /* フルスクリーンボタンだけ少し目立つように */
            $fullscreenButton
            {
                ?namespace-opacity: ?fullscreenButtonOpacity;
            }
            $fullscreenButtonHover
            {
                ?namespace-opacity: ?fullscreenButtonHoverOpacity;
            }
            $fullscreenButtonText
            {
                ?namespace-opacity: ?fullscreenButtonTextOpacity;
            }
            $fullscreenButtonTextHover
            {
                ?namespace-opacity: ?fullscreenButtonTextHoverOpacity;
            }


            /* タイトル関連 */
            $title
            {
                ?namespace-opacity: ?titleOpacity;
            }
            $titleHover
            {
                ?namespace-opacity: ?titleHoverOpacity;
            }
            $subTitle
            {
                ?namespace-opacity: ?subtitleOpacity;
            }
            $subTitleHover
            {
                ?namespace-opacity: ?subtitleHoverOpacity;
            }


            /* 一時停止など */
            $backwardButton
            {
                ?namespace-opacity: ?backwardButtonOpacity;
            }
            $backwardButtonHover
            {
                ?namespace-opacity: ?backwardButtonHoverOpacity;
            }
            $pauseButton
            {
                ?namespace-opacity: ?pauseButtonOpacity;
            }
            $pauseButtonHover
            {
                ?namespace-opacity: ?pauseButtonHoverOpacity;
            }
            $forwardButton
            {
                ?namespace-opacity: ?forwardButtonOpacity;
            }
            $forwardButtonHover
            {
                ?namespace-opacity: ?forwardButtonHoverOpacity;
            }

            /* 右上のボリューム */
            $volumeSlider
            {
                ?namespace-track-opacity: ?volumeSliderTrackOpacity;
                ?namespace-progress-opacity: ?volumeSliderProgressOpacity;
                ?namespace-thumb-opacity: ?volumeSliderThumbOpacity;
            }
            $volumeSliderHover
            {
                ?namespace-track-opacity: ?volumeSliderTrackHoverOpacity;
                ?namespace-progress-opacity: ?volumeSliderProgressHoverOpacity;
                ?namespace-thumb-opacity: ?volumeSliderThumbHoverOpacity;
            }


            /* シークバー関連 */
            $timeIndicator
            {
                ?namespace-opacity: ?timeIndicatorOpacity;
            }
            $timeRemaining
            {
                ?namespace-opacity: ?timeRemainingOpacity;
            }
            $timeIndicatorHover
            {
                ?namespace-opacity: ?timeIndicatorHoverOpacity;
            }
            $timeRemainingHover
            {
                ?namespace-opacity: ?timeRemainingHoverOpacity;
            }
            $timeSlider
            {
                ?namespace-track-opacity: ?timeSliderTrackOpacity;
                ?namespace-progress-opacity: ?timeSliderProgressOpacity;
                ?namespace-thumb-opacity: ?timeSliderThumbOpacity;
            }
            $timeSliderHover
            {
                ?namespace-track-opacity: ?timeSliderTrackHoverOpacity;
                ?namespace-progress-opacity: ?timeSliderProgressHoverOpacity;
                ?namespace-thumb-opacity: ?timeSliderThumbHoverOpacity;
            }


            /* キーボードから音量を変更したときに表示されるボリューム関連 */
            $volumeToastIcon
            {
                ?namespace-opacity: ?volumeToastIconOpacity;
            }
            $volumeToastTrack
            {
                ?namespace-opacity: ?volumeToastTrackOpacity;
            }
            $volumeToastProgress
            {
                ?namespace-opacity: ?volumeToastProgressOpacity;
            }
            $volumeToastThumb
            {
                ?namespace-opacity: ?volumeToastThumbOpacity;
            }
            $volumeToastIconHover
            {
                ?namespace-opacity: ?volumeToastIconHoverOpacity;
            }
            $volumeToastTrackHover
            {
                ?namespace-opacity: ?volumeToastTrackHoverOpacity;
            }
            $volumeToastProgressHover
            {
                ?namespace-opacity: ?volumeToastProgressHoverOpacity;
            }
            $volumeToastThumbHover
            {
                ?namespace-opacity: ?volumeToastThumbHoverOpacity;
            }


            /* あらすじをスキップなど少しだけ目立たせたいボタン */
            $mainPlayer $featuredTextButton
            {
                ?namespace-color-opacity: ?featuredTextButtonColorOpacity;
                ?namespace-background-opacity: ?featuredTextButtonBackgroundOpacity;
                ?namespace-border-opacity: ?featuredTextButtonBorderOpacity;
            }
            $mainPlayer $featuredTextButtonHover
            {
                ?namespace-color-opacity: ?featuredTextButtonColorHoverOpacity;
                ?namespace-background-opacity: ?featuredTextButtonBackgroundHoverOpacity;
                ?namespace-border-opacity: ?featuredTextButtonBorderHoverOpacity;
            }

            /* 広告が終わるまでのカウントダウン */
            $adRemainingTime
            {
                ?namespace-opacity: ?adRemainingTimeOpacity;
            }
            $adRemainingTimeHover
            {
                ?namespace-opacity: ?adRemainingTimeHoverOpacity;
            }

            /* 削除して良いかも */
            $videoAutoHideNextUpCardImage
            {
                background: transparent !important;
                filter: grayscale(100%) hue-rotate(120deg) !important;

                transform: scale(0.8) !important;
            }

        }


        /**
         * プレイヤーの外側の表示
         */

        /* そのうち削除するかも */
        $topAutoHideNextUpCard
        {
            background: transparent !important;
            opacity: ?topAutoHideNextUpCardOpacity !important;
            filter: grayscale(100%) hue-rotate(120deg) !important;

            transform: scale(0.8) !important;
        }
        $topAutoHideNextUpCardHover
        {
            filter: grayscale(100%) hue-rotate(120deg) invert(100%) !important;
        }
        $topAutoHideNextUpCardParent
        {
            background: transparent !important;
            opacity: 0.9 !important;
        }
        $topAutoHideNextUpCardParentHover
        {
            background-color: #ffffff !important;
        }

        /**
         * aria-label で絞り込みしてたときに巻き込まれて消えたボタン
         * aria-label でしか制御できなくなったときに巻き込まれて消えると、消えたり消えなかったり違和感が出るから残してるだけ
         * 大丈夫と判断できればボタンが残るように、この指定自体を削除するかも
         */
        $topRegisterAdFree
        {
            display: none !important;

            opacity: 0 !important;

            transform: scale(0) !important;
        }
    `;

    // スタイルを適用
    function applyCustomStyle() {
        // 適用済みなら何もしない
        if (document.getElementById(CUSTOM_STYLE_ID)) return;
        const style = document.createElement("style");
        // テンプレートを展開
        const resolvedCss = replaceTokens(
            replaceTokens(cssTemplate, selectorSymbol, selector),
            valuesSymbol,
            values,
        );
        // id を追加して保存
        style.id = CUSTOM_STYLE_ID;
        style.textContent = resolvedCss;
        document.documentElement.appendChild(style);
        // 保存した CSS 確認用ログ
        if (DEBUG_MODE) {
            console.log(resolvedCss);
        }
    }

    /**
     * 定期的に監視
     * 多分最初の一回だけで良い
     */
    setInterval(applyCustomStyle, CHECK_INTERVAL);
})();
