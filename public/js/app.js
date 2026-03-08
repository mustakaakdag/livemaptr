/**
 * LiveMapTR - Ana Uygulama Koordinatörü
 * Socket.IO, panel ve harita modüllerini birleştiren merkezi kontrol.
 * Tüm veri akışını, filtreleri ve kullanıcı etkileşimlerini yönetir.
 */

const LiveMapApp = (() => {
  'use strict';

  const { timeAgo, formatClock, showToast, safeSetInterval } = LiveMapUtils;

  // ── DURUM ─────────────────────────────────────────────────────────────
  let socket = null;
  let isConnected = false;
  let lastNewsData = [];
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;

  // ── BAŞLAT ────────────────────────────────────────────────────────────

  function init() {
    console.log('[LiveMapTR] Uygulama başlatılıyor...');

    // Haritayı başlat
    LiveMapModule.init();
    LiveMapModule.bindFilterButtons();

    // Harita-panel senkronizasyonu: haritadan haber kartına git
    LiveMapModule.onMarkerClickCallback((itemId) => {
      _highlightNewsCard(itemId);
    });

    // Panel haber tıklaması: haritayı odakla + modal aç
    LiveMapPanels.setNewsClickCallback((item) => {
      if (item.location) {
        LiveMapModule.focusOn(item.id);
      }
      _openModal(item);
    });

    // Socket.IO bağlantısı
    _initSocket();

    // Üst filtre butonları
    _bindTopFilters();

    // Modal kapat butonu
    _bindModal();

    // Yenile butonu
    document.getElementById('refreshBtn')?.addEventListener('click', refresh);

    // Canlı saat
    _startClock();

    // Bağlantı olmadan REST ile ilk veriyi çek (fallback)
    _fetchInitialDataREST();

    console.log('[LiveMapTR] Başlatıldı');
  }

  // ── SOCKET.IO ─────────────────────────────────────────────────────────

  function _initSocket() {
    try {
      socket = io({
        transports: ['websocket', 'polling'],
        reconnectionAttempts: MAX_RECONNECT,
        reconnectionDelay: 2000,
        timeout: 10000,
      });

      socket.on('connect', _onConnect);
      socket.on('disconnect', _onDisconnect);
      socket.on('connect_error', _onConnectError);

      // Veri olayları
      socket.on('initial_data', _onInitialData);
      socket.on('haberler_guncellendi', _onNewsUpdate);
      socket.on('ekonomi_guncellendi', _onEconomyUpdate);
      socket.on('sosyal_guncellendi', _onSocialUpdate);
      socket.on('hata', (data) => {
        console.error('[Socket] Sunucu hatası:', data.mesaj);
        showToast(data.mesaj || 'Bağlantı hatası', 'error');
      });
    } catch (err) {
      console.warn('[Socket] Başlatılamadı:', err);
      // Graceful fallback - REST API ile çalışmaya devam et
    }
  }

  function _onConnect() {
    isConnected = true;
    reconnectAttempts = 0;
    _setConnectionStatus('connected', 'Canlı Bağlantı');
    console.log('[Socket] Bağlandı');
  }

  function _onDisconnect(reason) {
    isConnected = false;
    _setConnectionStatus('disconnected', 'Bağlantı kesildi');
    console.warn('[Socket] Bağlantı kesildi:', reason);

    if (reason === 'io server disconnect') {
      // Sunucu kesti, yeniden bağlan
      socket.connect();
    }
  }

  function _onConnectError(err) {
    reconnectAttempts++;
    console.warn(`[Socket] Bağlantı hatası (${reconnectAttempts}/${MAX_RECONNECT}):`, err.message);
    _setConnectionStatus('disconnected', `Bağlanılamıyor (${reconnectAttempts})`);

    if (reconnectAttempts >= MAX_RECONNECT) {
      showToast('Gerçek zamanlı bağlantı kurulamadı. REST modu aktif.', 'warning', 6000);
      // REST polling moduna geç
      _startRESTPolling();
    }
  }

  // ── VERİ ALMA OLAYLARI ────────────────────────────────────────────────

  function _onInitialData(data) {
    console.log('[Socket] İlk veri alındı');
    _processNewsData(data.haberler || []);
    _processEconomyData(data.ekonomi || {});
    _processSocialData(data.sosyal || []);
    _processMarkersData(data.markers || []);
    _setConnectionStatus('connected', 'Canlı Bağlantı');
  }

  function _onNewsUpdate(data) {
    console.log(`[Socket] Haberler güncellendi: ${(data.haberler || []).length} öğe`);
    _processNewsData(data.haberler || []);
    if (data.markers) _processMarkersData(data.markers);
    _notifyNewContent('haberler');
  }

  function _onEconomyUpdate(data) {
    _processEconomyData(data.ekonomi || {});
  }

  function _onSocialUpdate(data) {
    _processSocialData(data.sosyal || []);
  }

  // ── VERİ İŞLEME ──────────────────────────────────────────────────────

  function _processNewsData(news) {
    lastNewsData = news;
    LiveMapPanels.renderNews(news);

    // Son dakika bandı
    const breaking = news.filter((n) => n.isBreaking);
    LiveMapPanels.updateBreakingBand(breaking);
  }

  function _processEconomyData(economy) {
    LiveMapPanels.renderEconomy(economy);
  }

  function _processSocialData(trends) {
    LiveMapPanels.renderSocial(trends);
  }

  function _processMarkersData(markers) {
    LiveMapModule.updateMarkers(markers);
  }

  // ── REST API FALLBACK ─────────────────────────────────────────────────

  async function _fetchInitialDataREST() {
    // Socket bağlandıysa REST'e gerek yok
    if (isConnected) return;

    try {
      const response = await fetch('/api/all', {
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      if (!result.basari) throw new Error('API hatası');

      const { haberler, ekonomi, sosyal, yayinlar, markers } = result.veri;
      _processNewsData(haberler || []);
      _processEconomyData(ekonomi || {});
      _processSocialData(sosyal || []);
      _processMarkersData(markers || []);

      // Video paneli (socket'ten gelmiyor, REST ile çekiyoruz)
      if (yayinlar) LiveMapVideo.render(yayinlar);

      _setConnectionStatus('connected', 'Veri Yüklendi');
    } catch (err) {
      console.error('[REST] İlk veri çekimi hatası:', err);
      _showPanelErrors();
    }
  }

  // Yayın listesini REST'ten çek (sadece bir kez)
  async function _fetchStreams() {
    try {
      const res = await fetch('/api/yayinlar');
      const data = await res.json();
      if (data.basari) LiveMapVideo.render(data.veri || []);
    } catch (err) {
      console.warn('[REST] Yayın listesi çekilemedi:', err.message);
    }
  }

  let _restPollingStarted = false;
  function _startRESTPolling() {
    if (_restPollingStarted) return;
    _restPollingStarted = true;

    console.log('[REST] Polling modu başlatıldı');

    safeSetInterval(async () => {
      try {
        const [newsRes, econRes, socialRes] = await Promise.all([
          fetch('/api/haberler').then((r) => r.json()),
          fetch('/api/ekonomi').then((r) => r.json()),
          fetch('/api/sosyal').then((r) => r.json()),
        ]);

        if (newsRes.basari) _processNewsData(newsRes.veri);
        if (econRes.basari) _processEconomyData(econRes.veri);
        if (socialRes.basari) _processSocialData(socialRes.veri);
      } catch (err) {
        console.warn('[REST Polling] Hata:', err.message);
      }
    }, 90000, 'rest-polling'); // 90 saniye
  }

  // ── KULLANICI ARAYÜZÜ ─────────────────────────────────────────────────

  function _setConnectionStatus(state, label) {
    const dot = document.getElementById('connectionDot');
    const lbl = document.getElementById('connectionLabel');
    if (dot) {
      dot.className = `pulse-dot ${state}`;
    }
    if (lbl) lbl.textContent = label;
  }

  function _notifyNewContent(type) {
    const labels = { haberler: 'haberler güncellendi', ekonomi: 'ekonomi verileri güncellendi', sosyal: 'trendler güncellendi' };
    // Sessiz güncelleme - çok fazla toast gösterme
  }

  function _showPanelErrors() {
    LiveMapPanels.showError('newsContent', 'Haberler yüklenemedi. Bağlantınızı kontrol edin.');
    LiveMapPanels.showError('economyContent', 'Ekonomi verileri yüklenemedi.');
    LiveMapPanels.showError('socialContent', 'Sosyal medya verileri yüklenemedi.');
  }

  // ── ÜSTTE FİLTRE BUTONLARI ───────────────────────────────────────────

  function _bindTopFilters() {
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        LiveMapPanels.setFilter(filter);
      });
    });
  }

  // ── HABER MODAL ───────────────────────────────────────────────────────

  function _openModal(item) {
    const modal = document.getElementById('newsModal');
    if (!modal) return;

    document.getElementById('modalSource').textContent = item.source || '';
    document.getElementById('modalTitle').textContent = item.title || '';
    document.getElementById('modalSummary').textContent = item.content || 'İçerik özeti mevcut değil.';
    document.getElementById('modalTime').textContent = timeAgo(item.publishedAt);

    const link = document.getElementById('modalLink');
    if (link) {
      link.href = item.url || '#';
      link.style.display = item.url ? '' : 'none';
    }

    modal.style.display = 'flex';

    // Kapat
    modal.onclick = (e) => {
      if (e.target === modal) _closeModal();
    };
  }

  function _closeModal() {
    const modal = document.getElementById('newsModal');
    if (modal) modal.style.display = 'none';
  }

  function _bindModal() {
    document.getElementById('modalClose')?.addEventListener('click', _closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _closeModal();
    });
  }

  // ── HABER KARTINI VURGULA ─────────────────────────────────────────────

  function _highlightNewsCard(itemId) {
    // Önceki vurguyu kaldır
    document.querySelectorAll('.news-card.highlighted').forEach((c) => {
      c.classList.remove('highlighted');
    });

    // Yeni kartı vurgula
    const card = document.querySelector(`.news-card[data-id="${itemId}"]`);
    if (card) {
      card.classList.add('highlighted');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      setTimeout(() => card.classList.remove('highlighted'), 3000);
    }
  }

  // ── CANLI SAAT ────────────────────────────────────────────────────────

  function _startClock() {
    const el = document.getElementById('headerTime');
    if (!el) return;

    const update = () => {
      el.textContent = formatClock(new Date());
    };

    update();
    setInterval(update, 1000);
  }

  // ── MANUEL YENİLE ─────────────────────────────────────────────────────

  async function refresh() {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.classList.add('spinning');

    showToast('Veriler yenileniyor...', 'info', 2000);

    try {
      await _fetchInitialDataREST();
      showToast('Veriler güncellendi', 'success', 2000);
    } catch (err) {
      showToast('Yenileme başarısız', 'error', 2000);
    } finally {
      if (btn) {
        setTimeout(() => btn.classList.remove('spinning'), 500);
      }
    }
  }

  // ── BAŞLAT ────────────────────────────────────────────────────────────

  // DOM hazır olunca başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      // Yayın listesini de çek
      setTimeout(_fetchStreams, 2000);
    });
  } else {
    init();
    setTimeout(_fetchStreams, 2000);
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────

  return {
    refresh,
    getNewsData: () => lastNewsData,
  };
})();

window.LiveMapApp = LiveMapApp;
