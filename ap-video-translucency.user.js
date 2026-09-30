// ==UserScript==
// @name          AP Video Translucency
// @namespace     https://github.com/yoke-ScriptWorks/AP-Video-Translucency
// @version       1.0.260930
// @description   AP Video Translucency
// @author        yoke
// @match         https://*.amazon.co.jp/*
// @run-at        document-idle
// @grant         none
// @updateURL     https://raw.githubusercontent.com/yoke-ScriptWorks/AP-Video-Translucency/main/ap-video-translucency.user.js
// @downloadURL   https://raw.githubusercontent.com/yoke-ScriptWorks/AP-Video-Translucency/main/ap-video-translucency.user.js
// ==/UserScript==


(function() {
    'use strict';
    /*
     * 各要素のcssをimportantで指定
     */
    const style = document.createElement('style');
    style.innerHTML = `
        div:has(> div > .atvwebplayersdk-tick-mark-mask) > div:nth-of-type(2) ~ div
        {
            opacity: 0.175 !important;
            background-color: #ffffff !important;
        }
        div:has(> #atvwebplayersdk-volume-slider)
        {
            background: transparent !important;
        }
        .atvwebplayersdk-toast-container
        {
            background-color: transparent !important;
            border: none !important;
        }
        .atvwebplayersdk-toast-icon
        {
            opacity: 0.185 !important;
            border: none !important;
        }
        .atvwebplayersdk-toast-slider-thumb
        {
            opacity: 0.45 !important;
            background-color: #ffffff !important;
            border: none !important;
        }
        .atvwebplayersdk-toast-slider-track
        {
            opacity: 0.185 !important;
            background-color: #ffffff !important;
        }
        .atvwebplayersdk-toast-slider-value
        {
            opacity: 0.275 !important;
            background-color: #ffffff !important;
        }
        .atvwebplayersdk-progress-bar-handle,
        div:has(+ #atvwebplayersdk-volume-slider) > div:nth-of-type(3)
        {
            opacity: 0.225 !important;
            background-color: #ffffff !important;
        }
        input[aria-label="Seek"] ~ span
        {
            opacity: 0.175 !important;
            background-color: #ffffff !important;
        }
        input[aria-label="Seek"] ~ span
        {
            opacity: 0.175 !important;
            color: #ffffff !important;
        }
        div:has(+ #atvwebplayersdk-volume-slider) > div:nth-of-type(2)
        {
            opacity: 0.125 !important;
            background-color: #ffffff !important;
        }
        div:has(> div > div > div > #atvwebplayersdk-fullscreen-toggle-button) button
        {
            opacity: 0.225 !important;
            color: #ffffff !important;
        }
        div:has(> div > div > div > #atvwebplayersdk-fullscreen-toggle-button) button + div > div
        {
            opacity: 0.225 !important;
            transform: scale(0.65) !important;
            color: #ffffff !important;
        }
        #pv-nav-option-btn-container > div > button > span > img
        {
            opacity: 0.65 !important;
            transform: scale(0.8) !important;
            filter: grayscale(100%) hue-rotate(120deg) !important;
        }
        #atvwebplayersdk-settings-button > img
        {
            filter: grayscale(100%) hue-rotate(120deg) !important;
        }
        div:has(> div > #atvwebplayersdk-play-pause-button) > div:nth-of-type(1) > button
        {
            opacity: 0.225 !important;
            color: #ffffff !important;
            transform: scale(0.85) !important;
            transform-origin: center right !important;
        }
        div:has(> div > #atvwebplayersdk-play-pause-button) > div:nth-of-type(2) > button
        {
            opacity: 0.225 !important;
            color: #ffffff !important;
            transform: scale(0.65) !important;
            transform-origin: center center !important;
        }
        div:has(> div > #atvwebplayersdk-play-pause-button) > div:nth-of-type(3) > button
        {
            opacity: 0.225 !important;
            color: #ffffff !important;
            transform: scale(0.85) !important;
            transform-origin: center left !important;
        }
        .atvwebplayersdk-title-text,
        .atvwebplayersdk-episode-info
        {
            display: inline-block !important;
            position: relative !important;
            z-index: calc(infinity) !important;
            pointer-events: auto !important;
            opacity: 0.225 !important;
            transform: scale(0.65) !important;
            transform-origin: top left !important;
            color: #ffffff !important;
            background-color: transparent !important;
            border: none !important;
        }
        .atvwebplayersdk-title-text:hover,
        .atvwebplayersdk-episode-info:hover
        {
            opacity: 0.85 !important;
        }
        div:has(> #atvwebplayersdk-time-indicator) > div:nth-of-type(1)
        {
            opacity: 0.225 !important;
            color: #ffffff !important;
            transform: scale(0.85) !important;
            transform-origin: top left !important;
        }
        div:has(> #atvwebplayersdk-time-indicator) > div:nth-of-type(2)
        {
            opacity: 0.65 !important;
        }
        div:has(> #atvwebplayersdk-time-indicator) > div:nth-of-type(3)
        {
            opacity: 0.225 !important;
            color: #ffffff !important;
            transform: scale(0.85) !important;
            transform-origin: top left !important;
        }
        div:has(> div > div > div > #atvwebplayersdk-fullscreen-toggle-button) button#atvwebplayersdk-fullscreen-toggle-button
        {
            opacity: 0.65 !important;
            color: #ffffff !important;
        }
        div:has(> div > div > div > #atvwebplayersdk-fullscreen-toggle-button) button#atvwebplayersdk-fullscreen-toggle-button:hover
        {
            opacity: 1 !important;
        }
        .atvwebplayersdk-loading-overlay + div > div:nth-last-of-type(1) > div:nth-last-of-type(1) > div:nth-last-of-type(1) button
        {
            opacity: 0.225 !important;
            transform: scale(0.65) !important;
            transform-origin: bottom right !important;
            color: #ffffff !important;
            background-color: transparent !important;
            border: none !important;
        }
        .atvwebplayersdk-loading-overlay + div > div:nth-last-of-type(1) > div:nth-last-of-type(1) > div:nth-last-of-type(1) button:hover
        {
            opacity: 0.35 !important;
            background-color: #000000 !important;
            border: thin solid !important;
        }
        .atvwebplayersdk-top-left-regulatory-overlay,
        [aria-label*="広告を再生しています"],
        [aria-label*="広告フリーに登録"],
        .atvwebplayersdk-trickplay-container > div:nth-of-type(2),
        .atvwebplayersdk-player-container > div:nth-of-type(1) > div:nth-of-type(1) > div,
        div:has(> div > div > div > .atvwebplayersdk-carousel)
        {
            opacity: 0 !important;
            display: none !important;
            transform: scale(0) !important;
        }
        div:has(> div > div > div > div > div > #atvwebplayersdk-play-pause-button) > div:nth-of-type(1) > div
        {
            opacity: 0 !important;
            display: none !important;
            transform: scale(0) !important;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
})();
