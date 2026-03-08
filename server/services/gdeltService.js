/**
 * GDELT Project API — LiveMapTR v3.9
 * Ücretsiz, key gerektirmez, gerçek zamanlı global olay verisi
 * https://api.gdeltproject.org
 */
const https = require('https');
const logger = require('../utils/logger');

const CACHE_TTL = 10 * 60 * 1000; // 10 dakika

// Çatışma keyword → conflict ID eşleştirmesi
const CONFLICT_KEYWORDS = {
  iran_israel: ['israel','iran','hezbollah','lebanon','tel aviv','beirut','idf','irgc','hamas','netanyahu'],
  gaza: ['gaza','rafah','west bank','palestine','hamas','khan younis'],
  ukraine: ['ukraine','russia','kyiv','zelensky','putin','kharkiv','mariupol','donbas','zaporizhzhia'],
  gulf_nuclear: ['hormuz','persian gulf','saudi arabia','nuclear iran','iaea iran'],
  sudan: ['sudan','khartoum','darfur','rsf','rapid support'],
  drcongo: ['congo','goma','m23','kinshasa','kivu'],
  yemen: ['yemen','houthi','sanaa','aden','hodeidah'],
  myanmar: ['myanmar','burma','naypyidaw','junta','tatmadaw'],
  sahel: ['mali','burkina faso','niger','sahel','ouagadougou'],
  haiti: ['haiti','port-au-prince','gang'],
};

// Olay tipi kategorileri
const EVENT_CATS = {
  14: { label: 'Protesto', severity: 'low' },
  15: { label: 'Protesto', severity: 'low' },
  17: { label: 'Siddete Basvurma', severity: 'medium' },
  18: { label: 'Saldiri', severity: 'high' },
  19: { label: 'Catisma', severity: 'high' },
  20: { label: 'Toplu Siddet', severity: 'critical' },
};

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'LiveMapTR/3.9' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error('JSON parse error: ' + d.substring(0,100))); }
      });
    }).on('error', reject);
  });
}

function detectConflict(title) {
  if (!title) return null;
  const t = title.toLowerCase();
  for (const [id, keywords] of Object.entries(CONFLICT_KEYWORDS)) {
    if (keywords.some(kw => t.includes(kw))) return id;
  }
  return null;
}

class GdeltService {
  constructor() {
    this._events = [];
    this._lastFetch = 0;
    this._fetchPromise = null;
  }

  async fetchEvents() {
    if (Date.now() - this._lastFetch < CACHE_TTL && this._events.length) {
      return this._events;
    }
    if (this._fetchPromise) return this._fetchPromise;
    this._fetchPromise = this._doFetch().finally(() => { this._fetchPromise = null; });
    return this._fetchPromise;
  }

  async _doFetch() {
    try {
      logger.info('GDELT: Olaylar cekiliyor...');

      // GDELT Event DB API — koordinatlı olay verisi
      // Format: YYYYMMDD
      const now = new Date();
      const pad = n => String(n).padStart(2,'0');
      const dateStr = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}`;
      const url = `https://api.gdeltproject.org/api/v2/tv/tv?query=conflict%20war%20attack&mode=timelinevol&format=json&dateres=day&startdatetime=${dateStr}000000&enddatetime=${dateStr}235959&maxrecords=50`;

      // EventDB CSV'den koordinatlı veri cek - simge JSON endpoint
      const geoUrl = `http://data.gdeltproject.org/gdeltv2/${dateStr}000000.export.CSV.zip`;

      // Alternatif: GDELT GKG ile konum bazlı
      const eventUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=airstrike&mode=artlist&maxrecords=50&format=json&sort=DateDesc`;
      const data = await httpsGet(eventUrl);
      const articles = data.articles || [];
      logger.info(`GDELT: ${articles.length} makale alindi`);

      // Conflict bölgelerine gore manuel koordinat ata
      const conflictCoords = {
        iran_israel: { lat: 31.5, lng: 34.8 },
        gaza:        { lat: 31.35, lng: 34.3 },
        ukraine:     { lat: 48.5, lng: 31.2 },
        gulf_nuclear:{ lat: 25.3, lng: 55.4 },
        sudan:       { lat: 15.5, lng: 32.5 },
        drcongo:     { lat: -4.3, lng: 15.3 },
        yemen:       { lat: 15.3, lng: 44.2 },
        myanmar:     { lat: 19.7, lng: 96.1 },
        sahel:       { lat: 13.5, lng: -2.1 },
        haiti:       { lat: 18.9, lng: -72.3 },
        syria:       { lat: 34.8, lng: 38.9 },
        ethiopia:    { lat: 9.1, lng: 40.5 },
      };

      this._events = articles
        .filter(a => a.title && a.url)
        .map((a, i) => {
          const conflictId = detectConflict(a.title + ' ' + (a.sourcecountry || ''));
          const coords = conflictId ? conflictCoords[conflictId] : null;
          // Kucuk rastgele offset ekle - ayni noktaya yigilmasin
          const jitter = () => (Math.random() - 0.5) * 1.5;
          return {
            id: 'gdelt_' + i + '_' + Date.now(),
            title: a.title,
            url: a.url,
            source: a.domain || 'GDELT',
            publishedAt: a.seendate || new Date().toISOString(),
            lat: coords ? coords.lat + jitter() : null,
            lng: coords ? coords.lng + jitter() : null,
            country: a.sourcecountry || '',
            tone: parseFloat(a.tone) || 0,
            conflictId,
            severity: (a.tone || 0) < -5 ? 'critical' : (a.tone || 0) < -2 ? 'high' : 'medium',
            type: 'gdelt',
          };
        })
        .filter(e => e.lat && e.lng && e.conflictId);

      this._lastFetch = Date.now();
      logger.info(`GDELT: ${this._events.length} olay islendi`);
      return this._events;

    } catch(err) {
      logger.warn('GDELT fetch hatasi: ' + err.message);
      return this._events; // cache dön
    }
  }

  getMapMarkers() {
    return this._events
      .filter(e => e.lat && e.lng)
      .map(e => ({
        id: e.id,
        lat: e.lat,
        lng: e.lng,
        title: e.title,
        source: e.source,
        url: e.url,
        publishedAt: e.publishedAt,
        severity: e.severity,
        conflictId: e.conflictId,
        tone: e.tone,
        type: 'gdelt',
        isBreaking: e.tone < -5,
        credibilityScore: 70,
      }));
  }

  getByConflict(conflictId) {
    return this._events
      .filter(e => e.conflictId === conflictId)
      .slice(0, 15);
  }

  getLatest(limit = 30) {
    return this._events
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit);
  }

  getStats() {
    return {
      total: this._events.length,
      withLocation: this._events.filter(e => e.lat && e.lng).length,
      critical: this._events.filter(e => e.severity === 'critical').length,
      lastUpdate: this._lastFetch ? new Date(this._lastFetch).toISOString() : null,
      source: 'GDELT',
    };
  }
}

module.exports = new GdeltService();
