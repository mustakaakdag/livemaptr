const newsService    = require('../services/newsService');
const economyService = require('../services/economyService');
const socialService  = require('../services/socialService');
const cacheService   = require('../cache/cacheService');
const deduplicationService = require('../services/deduplicationService');
const config         = require('../config');
const logger         = require('../utils/logger');

async function getNews(req, res) {
  try {
    const news = await newsService.fetchAll();
    res.json({ basari: true, veri: news, sayac: news.length });
  } catch (e) { res.status(500).json({ basari: false, hata: e.message }); }
}

async function getEconomy(req, res) {
  try {
    const data = await economyService.fetchAll();
    res.json({ basari: true, veri: data });
  } catch (e) { res.status(500).json({ basari: false, hata: e.message }); }
}

async function getSocial(req, res) {
  try {
    const news = await newsService.fetchAll();
    const trends = await socialService.generateTrends(news);
    res.json({ basari: true, veri: trends, sayac: trends.length });
  } catch (e) { res.status(500).json({ basari: false, hata: e.message }); }
}

async function getMapMarkers(req, res) {
  try {
    const markers = await newsService.getMapMarkers();
    res.json({ basari: true, veri: markers, sayac: markers.length });
  } catch (e) { res.status(500).json({ basari: false, hata: e.message }); }
}

async function getAll(req, res) {
  try {
    const [news, economy] = await Promise.all([
      newsService.fetchAll(),
      economyService.fetchAll().catch(() => ({})),
    ]);
    const markers = await newsService.getMapMarkers().catch(() => []);
    let sosyal = [];
    try {
      const c = cacheService.getSocial('social_trends');
      if (c) sosyal = c;
      else socialService.generateTrends(news).catch(() => {});
    } catch (e) { /* ignore */ }

    res.json({ basari: true, veri: { haberler: news, ekonomi: economy, sosyal, markers } });
  } catch (e) {
    logger.error('Toplu API hatası: ' + e.message);
    res.status(500).json({ basari: false, hata: e.message });
  }
}

function getHealth(req, res) {
  res.json({
    durum: 'aktif',
    versiyon: config.app.version,
    zaman: new Date().toISOString(),
    cache: cacheService.getStats(),
    dedup: deduplicationService.getStats(),
  });
}

function clearCache(req, res) {
  cacheService.clearAll();
  res.json({ basari: true, mesaj: 'Cache temizlendi' });
}

module.exports = { getNews, getEconomy, getSocial, getMapMarkers, getAll, getHealth, clearCache };
