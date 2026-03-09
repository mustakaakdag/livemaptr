/**
 * NewsAPI.org Entegrasyonu — LiveMapTR v3.6
 * Gerçek zamanlı global çatışma haberleri
 */
const https = require('https');
const cacheService = require('../cache/cacheService');
const geocodingService = require('./geocodingService');
const logger = require('../utils/logger');

const API_KEY  = process.env.NEWSAPI_KEY || '';
const BASE_URL = 'https://newsapi.org/v2/everything';
const CACHE_KEY = 'newsapi_conflict';
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

// Çatışma bölgesi sorgu grupları — API'yi boğmamak için rotasyonlu kullanılır
const QUERY_GROUPS = [
  { q: 'war OR airstrike OR missile attack OR drone strike', label: 'saldiri' },
  { q: 'Gaza war OR Israel Iran OR Lebanon Hezbollah', label: 'ortadogu' },
  { q: 'Ukraine war OR Russia attack OR Zelensky', label: 'ukrayna' },
  { q: 'Sudan civil war OR Congo M23 OR Yemen Houthi', label: 'afrika-yemen' },
  { q: 'nuclear Iran OR Gulf crisis OR Strait of Hormuz', label: 'korfez' },
  { q: 'Myanmar military OR Sahel coup OR Haiti gang', label: 'diger' },
];

// Bölge → çatışma ID eşleştirmesi
const REGION_CONFLICT_MAP = {
  'israel': 'iran_israel', 'iran': 'iran_israel', 'tel aviv': 'iran_israel',
  'beirut': 'iran_israel', 'hezbollah': 'iran_israel', 'lebanon': 'iran_israel',
  'gaza': 'gaza', 'rafah': 'gaza', 'hamas': 'gaza', 'west bank': 'gaza',
  'ukraine': 'ukraine', 'kyiv': 'ukraine', 'russia': 'ukraine', 'kharkiv': 'ukraine',
  'zaporizhzhia': 'ukraine', 'mariupol': 'ukraine', 'donetsk': 'ukraine',
  'hormuz': 'gulf_nuclear', 'persian gulf': 'gulf_nuclear', 'irgc': 'gulf_nuclear',
  'sudan': 'sudan', 'khartoum': 'sudan', 'darfur': 'sudan', 'rsf': 'sudan',
  'congo': 'drcongo', 'goma': 'drcongo', 'm23': 'drcongo', 'kinshasa': 'drcongo',
  'yemen': 'yemen', 'houthi': 'yemen', 'sanaa': 'yemen', 'aden': 'yemen',
  'myanmar': 'myanmar', 'rangoon': 'myanmar', 'naypyidaw': 'myanmar',
  'sahel': 'sahel', 'mali': 'sahel', 'burkina': 'sahel', 'niger': 'sahel',
  'haiti': 'haiti', 'port-au-prince': 'haiti',
};

// İngilizce başlığa kategori ve şiddet tahmini
function classifyArticle(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  let severity = 'low';
  let category = 'news';

  if (/missile|airstrike|bombing|explosion|blast|rocket|drone strike|attack/.test(text)) {
    category = 'strike'; severity = 'high';
  } else if (/killed|dead|casualties|wounded|civilian/.test(text)) {
    category = 'casualties'; severity = 'high';
  } else if (/ceasefire|truce|negotiation|peace talks|diplomatic/.test(text)) {
    category = 'diplomacy'; severity = 'medium';
  } else if (/nuclear|weapon|sanction|military/.test(text)) {
    category = 'military'; severity = 'medium';
  }

  // Acil kelimeler
  if (/breaking|urgent|alert|emergency/.test(text)) severity = 'critical';

  return { category, severity };
}

function detectConflict(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  for (const [keyword, conflictId] of Object.entries(REGION_CONFLICT_MAP)) {
    if (text.includes(keyword)) return conflictId;
  }
  return null;
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'LiveMapTR/3.6' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}


// Çatışma ID → merkez koordinat (marker için fallback)
const CONFLICT_COORDS = {
  iran_israel:  { lat: 32.5,  lng: 35.5,  name: 'İsrail/İran' },
  gaza:         { lat: 31.35, lng: 34.30, name: 'Gazze' },
  ukraine:      { lat: 49.0,  lng: 32.0,  name: 'Ukrayna' },
  gulf_nuclear: { lat: 26.0,  lng: 54.0,  name: 'Körfez' },
  sudan:        { lat: 15.5,  lng: 32.5,  name: 'Sudan' },
  drcongo:      { lat: -4.3,  lng: 15.3,  name: 'DR Kongo' },
  yemen:        { lat: 15.3,  lng: 44.2,  name: 'Yemen' },
  myanmar:      { lat: 19.7,  lng: 96.1,  name: 'Myanmar' },
  sahel:        { lat: 13.5,  lng: -2.1,  name: 'Sahel' },
  haiti:        { lat: 18.9,  lng: -72.3, name: 'Haiti' },
  syria:        { lat: 34.8,  lng: 38.9,  name: 'Suriye' },
  ethiopia:     { lat: 9.1,   lng: 40.5,  name: 'Etiyopya' },
};

class NewsApiService {
  constructor() {
    this._lastGroupIdx = 0;
    this._fetchPromise = null;
    this._allArticles = [];
    this._lastFetch = 0;
  }

  async fetchConflictNews() {
    // Cache kontrolü
    if (Date.now() - this._lastFetch < CACHE_TTL && this._allArticles.length) {
      return this._allArticles;
    }
    if (this._fetchPromise) return this._fetchPromise;
    this._fetchPromise = this._doFetch().finally(() => { this._fetchPromise = null; });
    return this._fetchPromise;
  }

  async _doFetch() {
    if (!API_KEY) {
      logger.warn('NEWSAPI_KEY eksik — NewsAPI devre dışı');
      return [];
    }

    // Rotasyonlu grup seç (her çağrıda farklı grup — API limitini korur)
    const group = QUERY_GROUPS[this._lastGroupIdx % QUERY_GROUPS.length];
    this._lastGroupIdx++;

    const params = new URLSearchParams({
      q: group.q,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: '30',
      apiKey: API_KEY,
    });

    const url = `${BASE_URL}?${params}`;

    try {
      logger.info(`NewsAPI çekiliyor [${group.label}]...`);
      const data = await fetchUrl(url);

      if (data.status !== 'ok') {
        logger.warn(`NewsAPI hata: ${data.message || data.status}`);
        return this._allArticles; // önceki veriyi dön
      }

      const articles = (data.articles || [])
        .filter(a => a.title && a.title !== '[Removed]')
        .map(a => {
          const { category, severity } = classifyArticle(a.title, a.description);
          const conflictId = detectConflict(a.title, a.description);
          const loc = geocodingService.extractLocation(a.title + ' ' + (a.description || ''));

          return {
            id: `na_${Buffer.from(a.url || a.title).toString('base64').substring(0, 14)}`,
            title: a.title,
            content: (a.description || '').substring(0, 300),
            url: a.url,
            source: a.source?.name || 'NewsAPI',
            sourceCountry: 'international',
            publishedAt: a.publishedAt,
            category,
            severity,
            conflictId,
            location: loc || null,
            imageUrl: a.urlToImage || null,
            isBreaking: /breaking|urgent|alert/i.test(a.title),
            type: 'newsapi',
            credibility: { score: 75, label: 'Uluslararası Kaynak' },
          };
        })
        .filter(a => a.conflictId || a.location); // Sadece konumlandırılabilenleri al

      // Mevcut listeye ekle, tekrarları temizle
      const existingIds = new Set(this._allArticles.map(a => a.id));
      const newArticles = articles.filter(a => !existingIds.has(a.id));
      this._allArticles = [...newArticles, ...this._allArticles].slice(0, 150);
      this._lastFetch = Date.now();

      logger.info(`NewsAPI: ${newArticles.length} yeni makale eklendi (toplam: ${this._allArticles.length})`);
      return this._allArticles;

    } catch (e) {
      logger.warn(`NewsAPI çekme hatası: ${e.message}`);
      return this._allArticles;
    }
  }

  // Belirli çatışmaya ait haberleri getir
  getByConflict(conflictId) {
    return this._allArticles.filter(a => a.conflictId === conflictId).slice(0, 10);
  }

  // Harita markerları için (lokasyonu olanlar + conflictId olanlar)
  getMapMarkers() {
    const jitter = () => (Math.random() - 0.5) * 1.5;
    return this._allArticles
      .filter(a => a.location || a.conflictId)
      .map(a => {
        let lat, lng, locationName;
        if (a.location) {
          lat = a.location.lat;
          lng = a.location.lng;
          locationName = a.location.locationName;
        } else {
          const coord = CONFLICT_COORDS[a.conflictId];
          if (!coord) return null;
          lat = coord.lat + jitter();
          lng = coord.lng + jitter();
          locationName = coord.name;
        }
        return {
          id: a.id,
          lat, lng, locationName,
          title: a.title,
          source: a.source,
          url: a.url,
          publishedAt: a.publishedAt,
          category: a.category,
          severity: a.severity,
          isBreaking: a.isBreaking,
          imageUrl: a.imageUrl,
          conflictId: a.conflictId,
          credibilityScore: 75,
          type: 'newsapi',
        };
      }).filter(Boolean);
  }

  // Son haberleri feed için getir
  getLatest(limit = 20) {
    return this._allArticles
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit);
  }
}

module.exports = new NewsApiService();
