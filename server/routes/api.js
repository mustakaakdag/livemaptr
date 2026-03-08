const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dataController');
const conflictCtrl = require('../controllers/conflictController');

router.get('/all',                ctrl.getAll);
router.get('/haberler',           ctrl.getNews);
router.get('/ekonomi',            ctrl.getEconomy);
router.get('/sosyal',             ctrl.getSocial);
router.get('/harita/markers',     ctrl.getMapMarkers);
router.get('/health',             ctrl.getHealth);
router.post('/admin/cache/temizle', ctrl.clearCache);

// Conflict Intelligence
router.get('/conflicts',          conflictCtrl.getAll);
router.get('/conflicts/stats',    conflictCtrl.getStats);
router.get('/conflicts/events',   conflictCtrl.getEvents);
router.get('/conflicts/hotspots', conflictCtrl.getHotspots);
router.get('/conflicts/:id',      conflictCtrl.getById);

// ACLED — Gerçek Çatışma Verisi
const acledCtrl = require('../controllers/acledController');
router.get('/acled/events',       acledCtrl.getEvents);
router.get('/acled/stats',        acledCtrl.getStats);
router.get('/acled/status',       acledCtrl.getStatus);

module.exports = router;

// NewsAPI — Gerçek Zamanlı Çatışma Haberleri
const newsApiService = require('../services/newsApiService');
router.get('/newsapi/latest',       async (req, res) => {
  try {
    const news = await newsApiService.fetchConflictNews();
    res.json({ ok: true, count: news.length, data: newsApiService.getLatest(50) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
router.get('/newsapi/conflict/:id', async (req, res) => {
  try {
    await newsApiService.fetchConflictNews();
    res.json({ ok: true, data: newsApiService.getByConflict(req.params.id) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
router.get('/newsapi/markers',      async (req, res) => {
  try {
    await newsApiService.fetchConflictNews();
    res.json({ ok: true, data: newsApiService.getMapMarkers() });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
