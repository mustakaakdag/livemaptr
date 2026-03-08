/**
 * LiveMapTR - Harita Modülü
 * Leaflet + MarkerCluster ile profesyonel Türkiye haritası.
 * Performanslı marker yönetimi, popup'lar ve filtreler.
 */

const LiveMapModule = (() => {
  'use strict';

  const { timeAgo, escHtml, getCategoryLabel, showToast } = LiveMapUtils;

  // ── DURUM ─────────────────────────────────────────────────────────────

  let map = null;
  let clusterGroup = null;
  const markers = new Map(); // id → marker
  let currentFilter = 'tumu';
  let onMarkerClick = null; // Dışarıdan ayarlanabilir callback

  // ── HARİTAYI BAŞLAT ──────────────────────────────────────────────────

  function init() {
    if (map) return; // Çift init engelle

    map = L.map('map', {
      center: [39.0, 35.0], // Türkiye merkezi
      zoom: 6,
      minZoom: 3,
      maxZoom: 16,
      zoomControl: true,
      preferCanvas: true, // Performans
      attributionControl: true,
    });

    // Koyu OpenStreetMap katmanı
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      keepBuffer: 2,
    }).addTo(map);

    // MarkerCluster grubu
    clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 12,
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 50,
      animate: true,
      animateAddingMarkers: false, // Performans
    });

    map.addLayer(clusterGroup);

    // Harita tıklama (popup kapat)
    map.on('click', () => {
      map.closePopup();
    });

    console.log('[Harita] Başlatıldı');
    return map;
  }

  // ── MARKER İKONU OLUŞTUR ──────────────────────────────────────────────

  function createIcon(type, isBreaking = false) {
    const typeMap = {
      haber:   { cls: 'marker-news', icon: '📰', size: 28 },
      sosyal:  { cls: 'marker-social', icon: '📡', size: 26 },
      ekonomi: { cls: 'marker-economy', icon: '📊', size: 26 },
    };

    if (isBreaking) {
      return L.divIcon({
        className: '',
        html: `<div class="custom-marker marker-breaking" style="width:32px;height:32px;">
                 <span class="marker-icon">⚡</span>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });
    }

    const cfg = typeMap[type] || typeMap.haber;
    return L.divIcon({
      className: '',
      html: `<div class="custom-marker ${cfg.cls}" style="width:${cfg.size}px;height:${cfg.size}px;">
               <span class="marker-icon">${cfg.icon}</span>
             </div>`,
      iconSize: [cfg.size, cfg.size],
      iconAnchor: [cfg.size / 2, cfg.size / 2],
      popupAnchor: [0, -cfg.size / 2],
    });
  }

  // ── POPUP HTML OLUŞTUR ────────────────────────────────────────────────

  function createPopupHTML(item) {
    const typeLabel = item.isBreaking ? 'Son Dakika' : getCategoryLabel(item.type || item.category);
    const typeClass = item.isBreaking ? 'breaking' : (item.type || 'haber');

    return `
      <div class="map-popup">
        <div class="popup-header">
          <span class="popup-type ${typeClass}">${escHtml(typeLabel)}</span>
          <span class="popup-location">📍 ${escHtml(item.locationName || '')}</span>
        </div>
        <div class="popup-body">
          <div class="popup-title">${escHtml(item.title)}</div>
        </div>
        <div class="popup-footer">
          <span class="popup-source">${escHtml(item.source || '')}</span>
          <span class="popup-time">${timeAgo(item.publishedAt)}</span>
          ${item.id ? `<span class="popup-go-btn" data-id="${escHtml(item.id)}">Habere git →</span>` : ''}
        </div>
      </div>
    `;
  }

  // ── MARKER EKLE ───────────────────────────────────────────────────────

  function addMarker(item) {
    if (!map || !item.lat || !item.lng) return;
    if (markers.has(item.id)) return; // Duplicate engelle

    const marker = L.marker([item.lat, item.lng], {
      icon: createIcon(item.type || 'haber', item.isBreaking),
      title: item.title,
      riseOnHover: true,
    });

    // Popup
    marker.bindPopup(createPopupHTML(item), {
      maxWidth: 280,
      minWidth: 220,
      className: '',
      closeButton: true,
      autoClose: true,
    });

    // Popup açıldığında "habere git" butonunu dinle
    marker.on('popupopen', (e) => {
      const popup = e.popup.getElement();
      if (!popup) return;
      const btn = popup.querySelector('.popup-go-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          if (typeof onMarkerClick === 'function') {
            onMarkerClick(item.id);
          }
        });
      }
    });

    // Veri meta data
    marker._itemId = item.id;
    marker._itemType = item.type;

    clusterGroup.addLayer(marker);
    markers.set(item.id, { marker, item });
  }

  // ── MARKER GÜNCELLE (TOPLU) ───────────────────────────────────────────

  function updateMarkers(newItems = []) {
    if (!map || !clusterGroup) return;

    const newIds = new Set(newItems.map((i) => i.id));

    // Eski ve artık olmayan marker'ları kaldır
    for (const [id, { marker }] of markers) {
      if (!newIds.has(id)) {
        clusterGroup.removeLayer(marker);
        markers.delete(id);
      }
    }

    // Yeni marker'ları ekle (aşamalı)
    const toAdd = newItems.filter((item) => !markers.has(item.id));

    // Chunk olarak ekle (UI kilitlemesini önle)
    _addMarkersChunked(toAdd, 0, 20);

    // Sayacı güncelle
    _updateMarkerCount();
  }

  function _addMarkersChunked(items, offset, chunkSize) {
    const chunk = items.slice(offset, offset + chunkSize);
    if (chunk.length === 0) return;

    chunk.forEach((item) => addMarker(item));

    if (offset + chunkSize < items.length) {
      requestAnimationFrame(() => {
        _addMarkersChunked(items, offset + chunkSize, chunkSize);
      });
    }

    _updateMarkerCount();
  }

  function _updateMarkerCount() {
    const el = document.getElementById('markerCount');
    if (el) el.textContent = markers.size;
  }

  // ── FİLTRELEME ────────────────────────────────────────────────────────

  function setFilter(type) {
    currentFilter = type;

    for (const [id, { marker, item }] of markers) {
      const visible = type === 'tumu' || item.type === type;
      if (visible) {
        if (!clusterGroup.hasLayer(marker)) {
          clusterGroup.addLayer(marker);
        }
      } else {
        if (clusterGroup.hasLayer(marker)) {
          clusterGroup.removeLayer(marker);
        }
      }
    }

    _updateMarkerCount();
  }

  // ── HARİTADA KONUMA ODA ─────────────────────────────────────────────

  /**
   * Belirtilen marker'a veya koordinata haritayı odaklar ve popup açar.
   */
  function focusOn(itemId) {
    const entry = markers.get(itemId);
    if (!entry) return;

    const { marker, item } = entry;
    map.setView([item.lat, item.lng], 10, { animate: true, duration: 0.8 });
    marker.openPopup();
  }

  /**
   * Belirtilen koordinata fly animasyonuyla gider.
   */
  function flyTo(lat, lng, zoom = 9) {
    if (!map) return;
    map.flyTo([lat, lng], zoom, { animate: true, duration: 1.2 });
  }

  // ── MARKER VURGULA ────────────────────────────────────────────────────

  function highlightMarker(itemId) {
    const entry = markers.get(itemId);
    if (!entry) return;
    entry.marker.openPopup();
  }

  // ── HARİTA OLAYLARINI BAĞLA ───────────────────────────────────────────

  function onMarkerClickCallback(fn) {
    onMarkerClick = fn;
  }

  // ── HARITA FİLTRE BUTONLARINI BAĞLA ──────────────────────────────────

  function bindFilterButtons() {
    document.querySelectorAll('.map-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.map-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        setFilter(btn.dataset.type);
      });
    });
  }

  // ── GENEL TEMIZLE ─────────────────────────────────────────────────────

  function clearAll() {
    clusterGroup.clearLayers();
    markers.clear();
    _updateMarkerCount();
  }

  function getMap() { return map; }
  function getMarkerCount() { return markers.size; }

  // ── PUBLIC API ─────────────────────────────────────────────────────────

  return {
    init,
    addMarker,
    updateMarkers,
    setFilter,
    focusOn,
    flyTo,
    highlightMarker,
    onMarkerClickCallback,
    bindFilterButtons,
    clearAll,
    getMap,
    getMarkerCount,
  };
})();

window.LiveMapModule = LiveMapModule;
