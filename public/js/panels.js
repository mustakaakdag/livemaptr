/**
 * LiveMapTR - Panel Render Modülü
 * Haber, ekonomi ve sosyal medya panel içeriklerini render eder.
 */

const LiveMapPanels = (() => {
  'use strict';

  const { timeAgo, escHtml, truncate, getCategoryLabel, credibilityColor, formatNumber, changeArrow, showToast } = LiveMapUtils;

  // Aktif filtre
  let currentFilter = 'tumu';
  let allNews = [];

  // Haber kartına tıklandığında tetiklenecek callback
  let onNewsClick = null;

  // ── HABER PANELİ ─────────────────────────────────────────────────────

  function renderNews(items = []) {
    allNews = items;
    _applyNewsFilter(currentFilter);
    _updateNewsCount(items.length);
    _updateTimestamp('newsUpdate');
  }

  function _applyNewsFilter(filter) {
    const container = document.getElementById('newsContent');
    if (!container) return;

    let filtered = allNews;

    switch (filter) {
      case 'son-dakika':
        filtered = allNews.filter((i) => i.isBreaking);
        break;
      case 'ekonomi':
        filtered = allNews.filter((i) => i.category === 'ekonomi');
        break;
      case 'yuksek-guven':
        filtered = allNews.filter((i) => i.credibility?.score >= 80);
        break;
      case 'son-1-saat':
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        filtered = allNews.filter((i) => new Date(i.publishedAt) >= oneHourAgo);
        break;
      default:
        filtered = allNews;
    }

    if (filtered.length === 0) {
      container.innerHTML = _emptyState('Bu filtrede içerik bulunamadı');
      return;
    }

    // Render (animasyon ile)
    const html = filtered.map((item, idx) => _newsCardHTML(item, idx)).join('');
    container.innerHTML = html;

    // Kart tıklama olayları
    container.querySelectorAll('.news-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const item = allNews.find((n) => n.id === id);
        if (item && typeof onNewsClick === 'function') {
          onNewsClick(item);
        }
      });
    });
  }

  function _newsCardHTML(item, idx) {
    const credColor = credibilityColor(item.credibility?.score || 50);
    const credScore = item.credibility?.score || '—';
    const credLabel = item.credibility?.label || '';
    const isBreaking = item.isBreaking;
    const catLabel = getCategoryLabel(item.category);
    const hasLocation = !!item.location;

    return `
      <div class="news-card ${isBreaking ? 'breaking' : ''} fade-in"
           data-id="${escHtml(item.id)}"
           style="animation-delay:${idx * 25}ms"
           title="${escHtml(item.title)}">
        <div class="card-top">
          <div class="card-badges">
            ${isBreaking ? '<span class="badge badge-breaking">⚡ Son Dakika</span>' : ''}
            <span class="badge badge-category">${escHtml(catLabel)}</span>
            ${hasLocation ? `<span class="badge badge-location">📍 ${escHtml(item.location.locationName)}</span>` : ''}
          </div>
          <span class="card-time">${timeAgo(item.publishedAt)}</span>
        </div>
        <div class="card-title">${escHtml(item.title)}</div>
        ${item.content ? `<div class="card-summary">${escHtml(truncate(item.content, 120))}</div>` : ''}
        <div class="card-bottom">
          <span class="card-source">${escHtml(item.source)}</span>
          <span class="credibility-badge" style="background:${credColor}18;border:1px solid ${credColor}30;color:${credColor}">
            <span class="cred-dot" style="background:${credColor}"></span>
            ${credScore} · ${escHtml(credLabel)}
          </span>
        </div>
      </div>
    `;
  }

  function _updateNewsCount(count) {
    const el = document.getElementById('newsCount');
    if (el) el.textContent = `${count} haber`;
  }

  // ── EKONOMİ PANELİ ───────────────────────────────────────────────────

  function renderEconomy(data = {}) {
    const container = document.getElementById('economyContent');
    if (!container) return;

    const { doviz = [], altin = [], kripto = [], petrol = [], borsa = [] } = data;

    let html = '';

    // Döviz bölümü
    if (doviz.length > 0) {
      html += '<div class="section-label">💱 Döviz</div>';
      html += '<div class="economy-grid">';
      html += doviz.map((item) => _economyCardHTML(item, 'TL')).join('');
      html += '</div>';
    }

    // Kripto bölümü
    if (kripto.length > 0) {
      html += '<div class="section-label" style="margin-top:8px">₿ Kripto</div>';
      html += '<div class="economy-grid">';
      html += kripto.map((item) => _economyCardHTML(item, 'USD')).join('');
      html += '</div>';
    }

    // Altın ve petrol küçük satır
    const commodities = [...altin, ...petrol].filter((i) => i.deger);
    if (commodities.length > 0) {
      html += '<div class="section-label" style="margin-top:8px">🏆 Emtia</div>';
      html += '<div class="economy-grid">';
      html += commodities.map((item) => _economyCardHTML(item, '')).join('');
      html += '</div>';
    }

    if (!html) {
      html = _emptyState('Ekonomi verisi yükleniyor...');
    }

    container.innerHTML = html;
    _updateTimestamp('economyUpdate');
  }

  function _economyCardHTML(item, currency) {
    const dir = item.degisimYon || 'belirsiz';
    const dirClass = dir === 'yukari' ? 'yukari' : dir === 'asagi' ? 'asagi' : 'belirsiz';
    const hasValue = item.deger !== null && item.deger !== undefined;

    return `
      <div class="economy-card">
        <div class="econ-symbol">${escHtml(item.sembol || item.kod || '')}</div>
        <div class="econ-name">${escHtml(item.isim)}</div>
        <div class="econ-value ${hasValue ? '' : 'na'}">
          ${hasValue ? escHtml(String(item.deger)) : 'Güncelleniyor'}
          ${hasValue && currency ? ` <small style="font-size:9px;opacity:0.5">${currency}</small>` : ''}
        </div>
        ${item.degisim !== null && item.degisim !== undefined ? `
          <div class="econ-change ${dirClass}">
            <span class="econ-arrow">${changeArrow(dir)}</span>
            <span>%${Math.abs(parseFloat(item.degisim) || 0).toFixed(2)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── SOSYAL MEDYA PANELİ ───────────────────────────────────────────────

  function renderSocial(trends = []) {
    const container = document.getElementById('socialContent');
    if (!container) return;

    if (trends.length === 0) {
      container.innerHTML = _emptyState('Trend verisi hesaplanıyor...');
      return;
    }

    const html = trends.slice(0, 15).map((trend, idx) => _socialCardHTML(trend, idx)).join('');
    container.innerHTML = html;

    // Sosyal kart tıklama - haritaya odakla
    container.querySelectorAll('.social-card[data-lat]').forEach((card) => {
      card.addEventListener('click', () => {
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          LiveMapModule.flyTo(lat, lng, 9);
          showToast(`"${card.dataset.keyword}" için haritaya gidiliyor`, 'info', 2500);
        }
      });
    });

    document.getElementById('socialCount').textContent = `${trends.length} trend`;
    _updateTimestamp('socialUpdate');
  }

  function _socialCardHTML(trend, idx) {
    const isTop = idx < 3;
    const trendDir = trend.trend === 'yükselen' ? 'yukseliyor' : 'stabil';
    const hasLocation = trend.location;
    const latAttr = hasLocation ? `data-lat="${trend.location.lat}" data-lng="${trend.location.lng}"` : '';
    const relatedText = trend.ilgiliHaberler?.[0]?.baslik
      ? truncate(trend.ilgiliHaberler[0].baslik, 80)
      : '';

    return `
      <div class="social-card fade-in" 
           data-keyword="${escHtml(trend.keyword)}"
           ${latAttr}
           style="animation-delay:${idx * 30}ms"
           ${hasLocation ? 'style="cursor:pointer"' : ''}>
        <div class="social-rank ${isTop ? 'top' : ''}">${trend.sira}</div>
        <div class="social-body">
          <div class="social-keyword">#${escHtml(trend.baslik)}</div>
          <div class="social-stats">
            <span class="social-stat">
              <span class="social-stat-icon">💬</span>
              ${formatNumber(trend.paylasim)}
            </span>
            <span class="social-stat">
              <span class="social-stat-icon">❤️</span>
              ${formatNumber(trend.etkilesim)}
            </span>
            <span class="social-news-count">${trend.haberSayisi} haber</span>
          </div>
          ${relatedText ? `<div class="social-related">${escHtml(relatedText)}</div>` : ''}
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
            <span class="social-category-badge">${escHtml(trend.kategoriLabel || 'Gündem')}</span>
            ${hasLocation ? `<span class="badge badge-location" style="font-size:8px">📍 ${escHtml(trend.location.locationName)}</span>` : ''}
          </div>
        </div>
        <div class="trend-arrow ${trendDir}">
          ${trendDir === 'yukseliyor' ? '↑' : '→'}
        </div>
      </div>
    `;
  }

  // ── YÜKLEME / HATA DURUMU ─────────────────────────────────────────────

  function showLoading(panelId) {
    const el = document.getElementById(panelId);
    if (!el) return;
    el.innerHTML = `<div class="panel-loading"><div class="spinner"></div><span>Yükleniyor...</span></div>`;
  }

  function showError(panelId, message = 'Veri yüklenemedi') {
    const el = document.getElementById(panelId);
    if (!el) return;
    el.innerHTML = `
      <div class="panel-error">
        <div class="panel-error-icon">⚠️</div>
        <span>${escHtml(message)}</span>
        <span class="panel-error-retry" onclick="LiveMapApp.refresh()">Yeniden dene</span>
      </div>
    `;
  }

  function _emptyState(message) {
    return `
      <div class="no-data">
        <div class="no-data-icon">📭</div>
        <span>${escHtml(message)}</span>
      </div>
    `;
  }

  // ── SON DAKİKA BANDI ──────────────────────────────────────────────────

  function updateBreakingBand(breakingNews = []) {
    const band = document.getElementById('breakingBand');
    const ticker = document.getElementById('breakingTicker');
    if (!band || !ticker) return;

    if (breakingNews.length === 0) {
      band.style.display = 'none';
      document.querySelector('.app-main')?.classList.remove('has-breaking');
      return;
    }

    // Ticker metni
    const text = breakingNews
      .slice(0, 5)
      .map((n) => `⚡ ${n.title}  ·  ${n.source}`)
      .join('     ——     ');

    ticker.textContent = text;
    band.style.display = 'flex';
    document.querySelector('.app-main')?.classList.add('has-breaking');
  }

  // ── FİLTRE DEĞİŞİKLİĞİ ───────────────────────────────────────────────

  function setFilter(filter) {
    currentFilter = filter;
    _applyNewsFilter(filter);
  }

  // ── CALLBACK AYARLA ──────────────────────────────────────────────────

  function setNewsClickCallback(fn) {
    onNewsClick = fn;
  }

  // ── ZAMAN DAMGASI ─────────────────────────────────────────────────────

  function _updateTimestamp(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())} güncellendi`;
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────

  return {
    renderNews,
    renderEconomy,
    renderSocial,
    showLoading,
    showError,
    updateBreakingBand,
    setFilter,
    setNewsClickCallback,
  };
})();

window.LiveMapPanels = LiveMapPanels;
