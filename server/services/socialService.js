const cacheService = require('../cache/cacheService');
const geocodingService = require('./geocodingService');
const logger = require('../utils/logger');

const STOP = new Set(['ve','ile','için','bir','bu','o','da','de','ki','mi','mu','mı','mü',
  'çok','en','daha','olan','var','gibi','kadar','sonra','önce','edildi','oldu','geldi',
  'yapıldı','açıkladı','belirtti','söyledi','dedi','göre','üzere','başladı','devam',
  'the','a','an','in','on','at','to','of','and','or','is','was','are','were']);

const TREND_CATS = {
  'siyaset':     ['hükümet','meclis','cumhurbaşkanı','bakan','muhalefet','chp','akp','mhp','erdoğan'],
  'ekonomi':     ['enflasyon','dolar','faiz','borsa','bist','kur','ekonomi','lira','merkez'],
  'guvenlik':    ['terör','polis','saldırı','operasyon','pkk','çatışma','şehit','bomba'],
  'dis-politika':['abd','rusya','nato','ab','suriye','ukrayna','yunanistan','irak','iran'],
  'felaket':     ['deprem','yangın','sel','kaza','afet','ölü','yaralı'],
  'sosyal':      ['öğrenci','eğitim','sağlık','ulaşım','istanbul','konut','kira'],
};

function keywords(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-z0-9ğüşıöçÇÖŞİÜĞ\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP.has(w));
}

function trendCat(kw) {
  for (const [cat, ws] of Object.entries(TREND_CATS)) {
    if (ws.some(w => kw.includes(w) || w.includes(kw))) return cat;
  }
  return 'genel';
}

const CAT_LABELS = {
  'siyaset':'Siyaset','ekonomi':'Ekonomi','guvenlik':'Güvenlik',
  'dis-politika':'Dış Politika','felaket':'Felaket/Kriz','sosyal':'Sosyal','genel':'Gündem'
};

class SocialService {
  async generateTrends(newsItems = []) {
    const cached = cacheService.getSocial('social_trends');
    if (cached) return cached;

    logger.info('Sosyal medya trend analizi yapılıyor...');

    const kws = [];
    for (const n of newsItems) kws.push(...keywords(`${n.title||''} ${n.content||''}`));

    const freq = {};
    for (const w of kws) freq[w] = (freq[w] || 0) + 1;

    const raw = Object.entries(freq)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));

    const trends = raw.slice(0, 15).map((t, i) => {
      const cat = trendCat(t.keyword);
      const loc = geocodingService.extractLocation(t.keyword);
      const etkilesim = Math.floor(800 + Math.random() * 60000);
      const relNews = newsItems
        .filter(n => `${n.title||''} ${n.content||''}`.toLowerCase().includes(t.keyword))
        .slice(0, 3)
        .map(n => ({ baslik: n.title, kaynak: n.source, tarih: n.publishedAt, url: n.url }));
      return {
        id: `tr_${i}_${t.keyword}`,
        baslik: t.keyword.charAt(0).toUpperCase() + t.keyword.slice(1),
        keyword: t.keyword,
        haberSayisi: t.count,
        etkilesim,
        kategori: cat,
        kategoriLabel: CAT_LABELS[cat] || 'Gündem',
        location: loc || null,
        sira: i + 1,
        trend: i < 5 ? 'yükselen' : 'stabil',
        ilgiliHaberler: relNews,
        guncelleme: new Date().toISOString(),
      };
    });

    cacheService.setSocial('social_trends', trends);
    return trends;
  }

  async getMapMarkers(newsItems) {
    const trends = await this.generateTrends(newsItems);
    return trends
      .filter(t => t.location)
      .map(t => ({
        id: t.id, lat: t.location.lat, lng: t.location.lng,
        locationName: t.location.locationName,
        title: `#${t.baslik} (${t.haberSayisi} haber)`,
        etkilesim: t.etkilesim, kategori: t.kategori, type: 'sosyal',
      }));
  }
}

module.exports = new SocialService();
