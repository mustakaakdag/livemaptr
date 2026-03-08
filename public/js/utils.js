/**
 * LiveMapTR - Yardımcı Fonksiyonlar
 * Zaman formatı, metin işleme, DOM yardımcıları.
 */

const LiveMapUtils = (() => {
  'use strict';

  // ── ZAMAN FORMATLAMA ────────────────────────────────────────────────

  /**
   * Tarihi "x dk önce" formatında Türkçe gösterir.
   * @param {string|Date} dateInput
   * @returns {string}
   */
  function timeAgo(dateInput) {
    if (!dateInput) return 'Bilinmiyor';

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Bilinmiyor';

    const diff = Date.now() - date.getTime();
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (secs < 30) return 'Az önce';
    if (secs < 60) return `${secs} sn önce`;
    if (mins < 60) return `${mins} dk önce`;
    if (hours < 24) return `${hours} sa önce`;
    if (days === 1) return 'Dün';
    return `${days} gün önce`;
  }

  /**
   * Tam Türkçe tarih ve saat formatı.
   * @param {string|Date} dateInput
   * @returns {string} Örn: "08.03.2026 14:35"
   */
  function formatDateTime(dateInput) {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';

    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  /**
   * Canlı saat göstergesi için HH:MM:SS formatı.
   */
  function formatClock(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // ── METİN İŞLEME ────────────────────────────────────────────────────

  /**
   * HTML özel karakterlerini encode eder (XSS önleme).
   */
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Metni belirtilen uzunlukta kırpar.
   */
  function truncate(str, maxLen = 100) {
    if (!str) return '';
    const clean = str.replace(/<[^>]*>/g, '').trim();
    return clean.length > maxLen ? `${clean.substring(0, maxLen)}…` : clean;
  }

  /**
   * Sayıyı Türkçe formatlı gösterir (1.234 gibi).
   */
  function formatNumber(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}B`;
    return String(Math.round(n));
  }

  // ── KATEGORİ YARDIMCILARI ────────────────────────────────────────────

  const CATEGORY_LABELS = {
    'son-dakika': 'Son Dakika',
    'ekonomi': 'Ekonomi',
    'siyaset': 'Siyaset',
    'güvenlik': 'Güvenlik',
    'dış-politika': 'Dış Politika',
    'felaket': 'Kriz/Felaket',
    'spor': 'Spor',
    'teknoloji': 'Teknoloji',
    'genel': 'Gündem',
    'haber': 'Haber',
    'sosyal': 'Sosyal',
  };

  function getCategoryLabel(cat) {
    return CATEGORY_LABELS[cat] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'Gündem');
  }

  // ── DOM YARDIMCILARI ─────────────────────────────────────────────────

  /**
   * Element seç.
   */
  const $ = (selector, ctx = document) => ctx.querySelector(selector);
  const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));

  /**
   * Element oluştur (şablondan).
   */
  function createElement(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstElementChild;
  }

  /**
   * DOM içeriğini güvenli ve animasyonlu günceller.
   * Mevcut içeriği silmeden önce fade-out, yeni içerikle fade-in.
   */
  function updateContent(container, newHTML, { animate = true } = {}) {
    if (!container) return;
    if (animate) {
      container.style.opacity = '0';
      setTimeout(() => {
        container.innerHTML = newHTML;
        container.style.opacity = '1';
        container.style.transition = 'opacity 0.2s ease';
      }, 100);
    } else {
      container.innerHTML = newHTML;
    }
  }

  /**
   * Toast bildirimi göster.
   * @param {string} message - Mesaj
   * @param {'info'|'success'|'warning'|'error'|'breaking'} type - Tip
   * @param {number} duration - ms cinsinden süre
   */
  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = createElement(`
      <div class="toast toast-${type}">
        <span>${escHtml(message)}</span>
      </div>
    `);

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Güvenilirlik skoru için CSS renk değerini döner.
   */
  function credibilityColor(score) {
    if (score >= 85) return '#10b981';
    if (score >= 60) return '#3b82f6';
    if (score >= 30) return '#f59e0b';
    return '#ef4444';
  }

  /**
   * Değişim yönü için ok simgesi.
   */
  function changeArrow(direction) {
    if (direction === 'yukari') return '▲';
    if (direction === 'asagi') return '▼';
    return '–';
  }

  /**
   * Periyodik olarak çalışan fonksiyon (güvenli).
   */
  function safeSetInterval(fn, interval, label = 'interval') {
    return setInterval(async () => {
      try {
        await fn();
      } catch (err) {
        console.warn(`[${label}] döngü hatası:`, err);
      }
    }, interval);
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────

  return {
    timeAgo,
    formatDateTime,
    formatClock,
    escHtml,
    truncate,
    formatNumber,
    getCategoryLabel,
    $,
    $$,
    createElement,
    updateContent,
    showToast,
    credibilityColor,
    changeArrow,
    safeSetInterval,
  };
})();

// Global erişim için
window.LiveMapUtils = LiveMapUtils;
