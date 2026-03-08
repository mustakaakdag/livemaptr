const Parser = require('rss-parser');
const config = require('../config');
const cacheService = require('../cache/cacheService');
const credibilityService = require('./credibilityService');
const deduplicationService = require('./deduplicationService');
const geocodingService = require('./geocodingService');
const logger = require('../utils/logger');

const parser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': 'LiveMapTR/3.0 News Aggregator', 'Accept': 'application/rss+xml, application/xml, text/xml' },
  customFields: { item: ['description', 'content:encoded', 'media:thumbnail'] },
});

const CAT_KW = {
  'son-dakika': ['son dakika', 'acil', 'flaş', 'kritik', 'uyarı'],
  'ekonomi':    ['dolar', 'euro', 'faiz', 'borsa', 'enflasyon', 'merkez bankası', 'piyasa', 'ekonomi', 'bütçe', 'kur', 'lira', 'bist', 'fed'],
  'siyaset':    ['meclis', 'hükümet', 'cumhurbaşkanı', 'bakan', 'muhalefet', 'seçim', 'parti', 'erdoğan', 'kılıçdaroğlu'],
  'guvenlik':   ['saldırı', 'operasyon', 'pkk', 'terör', 'polis', 'jandarma', 'güvenlik', 'bomba', 'çatışma', 'şehit'],
  'dis-politika':['nato', 'ab', 'abd', 'rusya', 'suriye', 'ukrayna', 'dışişleri', 'büyükelçi', 'putin', 'biden', 'trump'],
  'felaket':    ['deprem', 'sel', 'yangın', 'fırtına', 'kaza', 'ölü', 'yaralı', 'kayıp', 'afet'],
  'saglik':     ['sağlık', 'hastane', 'ilaç', 'salgın', 'covid', 'kanser', 'ameliyat'],
  'spor':       ['futbol', 'galatasaray', 'fenerbahçe', 'beşiktaş', 'trabzonspor', 'maç', 'gol', 'şampiyon', 'transfer'],
};

function detectCat(text, fallback) {
  if (!text) return fallback || 'genel';
  const l = text.toLowerCase();
  for (const [cat, kws] of Object.entries(CAT_KW)) {
    if (kws.some(kw => l.includes(kw))) return cat;
  }
  return fallback || 'genel';
}

function normalize(item, source) {
  const title = (item.title || '').trim().replace(/\s+/g, ' ');
  const content = (item.contentSnippet || item.description || item.content || '').trim().substring(0, 350);
  const url = item.link || item.guid || '';
  const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

  if ((Date.now() - publishedAt) / 3600000 > config.limits.newsMaxAgeHours) return null;
  if (!title || title.length < 10) return null;

  const combined = `${title} ${content}`;
  const category = detectCat(combined, source.category);
  const isBreaking = /son\s*dakika|flaş|acil/i.test(title);
  const location = geocodingService.extractLocation(combined);

  return {
    id: `n_${Buffer.from(url || title).toString('base64').substring(0, 14)}`,
    title, content, url,
    source: source.name,
    sourceCredibility: source.credibility,
    publishedAt: publishedAt.toISOString(),
    category, isBreaking,
    location: location || null,
    type: 'haber',
  };
}

class NewsService {
  constructor() { this._fetchPromise = null; }

  async fetchAll() {
    const cached = cacheService.getNews('news_all');
    if (cached) return cached;
    if (this._fetchPromise) return this._fetchPromise;
    this._fetchPromise = this._fetchFromSources().finally(() => { this._fetchPromise = null; });
    return this._fetchPromise;
  }

  async _fetchFromSources() {
    logger.info(`${config.rssSources.length} RSS kaynağından haber çekiliyor...`);
    const results = await Promise.allSettled(config.rssSources.map(s => this._fetchOne(s)));
    let all = [];
    let ok = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value?.length) { all.push(...r.value); ok++; }
    }
    logger.info(`${ok}/${config.rssSources.length} kaynaktan ${all.length} ham haber çekildi`);
    all = this._process(all);
    cacheService.setNews('news_all', all);
    return all;
  }

  async _fetchOne(source) {
    try {
      const feed = await parser.parseURL(source.url);
      return (feed.items || []).slice(0, 15).map(i => normalize(i, source)).filter(Boolean);
    } catch (e) {
      logger.warn(`RSS çekme hatası [${source.name}]: ${e.message}`);
      return [];
    }
  }

  _process(items) {
    const unique = deduplicationService.filterDuplicates(items);
    const scored = credibilityService.scoreAll(unique);
    const filtered = scored.filter(i => i.credibility.score >= config.credibility.minScore);
    filtered.sort((a, b) => {
      if (a.isBreaking !== b.isBreaking) return a.isBreaking ? -1 : 1;
      const sd = b.credibility.score - a.credibility.score;
      if (Math.abs(sd) > 10) return sd;
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });
    return filtered.slice(0, config.limits.maxNews);
  }

  async getMapMarkers() {
    const news = await this.fetchAll();
    // Lokasyon bazında grupla — ısı haritası için yoğunluk hesapla
    const locCount = {};
    for (const n of news) {
      if (!n.location) continue;
      const k = `${n.location.lat.toFixed(1)}_${n.location.lng.toFixed(1)}`;
      locCount[k] = (locCount[k] || 0) + 1;
    }
    return news
      .filter(n => n.location)
      .map(n => {
        const k = `${n.location.lat.toFixed(1)}_${n.location.lng.toFixed(1)}`;
        const jitter = geocodingService.addJitter(n.location.lat, n.location.lng, 0.04);
        return {
          id: n.id,
          lat: jitter.lat,
          lng: jitter.lng,
          locationName: n.location.locationName,
          region: n.location.region,
          title: n.title,
          source: n.source,
          url: n.url,
          publishedAt: n.publishedAt,
          category: n.category,
          isBreaking: n.isBreaking,
          credibilityScore: n.credibility?.score || 50,
          density: locCount[k] || 1, // Kaç haber aynı bölgeden
          type: 'haber',
        };
      });
  }
}

module.exports = new NewsService();
