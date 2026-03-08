/**
 * LiveMapTR - Video Panel Modülü
 * Canlı yayın kartlarını render eder.
 * Hover ile ses açma, tıklama ile aktifleştirme.
 */

const LiveMapVideo = (() => {
  'use strict';

  const { escHtml } = LiveMapUtils;

  let activeStream = null;

  /**
   * Yayın listesini render eder.
   * @param {Array} streams - videoService'den gelen yayın listesi
   */
  function render(streams = []) {
    const container = document.getElementById('videoList');
    if (!container) return;

    if (streams.length === 0) {
      container.innerHTML = `
        <div class="panel-loading">
          <div class="panel-error-icon" style="font-size:24px;opacity:0.4">📺</div>
          <span style="font-size:11px;color:var(--text-muted)">Yayın bulunamadı</span>
        </div>
      `;
      return;
    }

    container.innerHTML = streams.map((stream) => _videoCardHTML(stream)).join('');

    // Olay dinleyicileri ekle
    container.querySelectorAll('.video-card').forEach((card) => {
      const id = card.dataset.id;
      const activateBtn = card.querySelector('.video-activate-btn');

      // Tıklama ile aktifleştir
      if (activateBtn) {
        activateBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          _activateStream(card, id, streams);
        });
      }

      // Hover ile iframe pointer-events aç (ses için)
      card.addEventListener('mouseenter', () => {
        const iframe = card.querySelector('iframe');
        if (iframe && card.classList.contains('active')) {
          iframe.style.pointerEvents = 'all';
        }
      });

      card.addEventListener('mouseleave', () => {
        const iframe = card.querySelector('iframe');
        if (iframe && !card.classList.contains('expanded')) {
          iframe.style.pointerEvents = 'none';
        }
      });
    });
  }

  /**
   * Tek bir video kartı HTML'i oluşturur.
   */
  function _videoCardHTML(stream) {
    return `
      <div class="video-card" data-id="${escHtml(stream.id)}" data-embed="${escHtml(stream.embedUrl)}">
        <div class="video-card-header">
          <span class="video-channel-name">${escHtml(stream.logo || stream.name)}</span>
          <span class="video-live-tag">CANLI</span>
        </div>
        <div class="video-embed-area">
          <!-- iframe başlangıçta yüklü değil, tıklayınca yüklenir -->
          <div class="video-placeholder">
            <div class="video-placeholder-icon">📺</div>
            <div class="video-placeholder-text">${escHtml(stream.name)} Canlı Yayın</div>
          </div>
          <div class="video-activate-btn">
            <div class="video-play-icon">▶</div>
            <div class="video-activate-text">İzlemek için tıklayın</div>
          </div>
        </div>
        <div class="video-card-footer">
          <span class="video-hint">Tıklayarak aktifleştirin</span>
          <span class="video-mute-hint">🔇 Varsayılan sessiz</span>
        </div>
      </div>
    `;
  }

  /**
   * Bir yayını aktifleştirir (iframe yükler).
   */
  function _activateStream(card, id, streams) {
    const stream = streams.find((s) => s.id === id);
    if (!stream) return;

    // Önceki aktif kartı pasifleştir
    document.querySelectorAll('.video-card.active').forEach((c) => {
      if (c !== card) {
        _deactivateCard(c);
      }
    });

    // Mevcut duruma göre toggle
    if (card.classList.contains('active')) {
      _deactivateCard(card);
      return;
    }

    // Aktifleştir
    card.classList.add('active', 'expanded');

    const embedArea = card.querySelector('.video-embed-area');
    const placeholder = card.querySelector('.video-placeholder');
    const activateBtn = card.querySelector('.video-activate-btn');

    if (placeholder) placeholder.style.display = 'none';
    if (activateBtn) activateBtn.style.display = 'none';

    // iframe oluştur (lazy loading)
    const iframe = document.createElement('iframe');
    iframe.src = stream.embedUrl;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
    iframe.classList.add('loaded');

    embedArea.appendChild(iframe);

    // Footer güncelle
    const footer = card.querySelector('.video-card-footer');
    if (footer) {
      footer.innerHTML = `
        <span class="video-hint" style="color:var(--accent-green)">▶ Yayın aktif</span>
        <span class="video-mute-hint">Üstüne gelerek ses açın</span>
      `;
    }

    activeStream = id;
  }

  function _deactivateCard(card) {
    card.classList.remove('active', 'expanded');

    // iframe'i kaldır (kaynak tasarrufu)
    const iframe = card.querySelector('iframe');
    if (iframe) iframe.remove();

    // Placeholder geri getir
    const placeholder = card.querySelector('.video-placeholder');
    const activateBtn = card.querySelector('.video-activate-btn');
    if (placeholder) placeholder.style.display = '';
    if (activateBtn) activateBtn.style.display = '';

    // Footer sıfırla
    const footer = card.querySelector('.video-card-footer');
    if (footer) {
      footer.innerHTML = `
        <span class="video-hint">Tıklayarak aktifleştirin</span>
        <span class="video-mute-hint">🔇 Varsayılan sessiz</span>
      `;
    }

    if (activeStream === card.dataset.id) activeStream = null;
  }

  return {
    render,
  };
})();

window.LiveMapVideo = LiveMapVideo;
