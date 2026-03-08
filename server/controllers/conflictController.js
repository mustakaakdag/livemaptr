const conflictService = require('../services/conflictService');
const logger = require('../utils/logger');

function getAll(req, res) {
  try {
    res.json({ basari: true, veri: conflictService.getAll() });
  } catch (e) { res.status(500).json({ basari: false, hata: e.message }); }
}

function getById(req, res) {
  try {
    const c = conflictService.getById(req.params.id);
    if (!c) return res.status(404).json({ basari: false, hata: 'Bulunamadı' });
    res.json({ basari: true, veri: c });
  } catch (e) { res.status(500).json({ basari: false, hata: e.message }); }
}

function getStats(req, res) {
  try {
    res.json({ basari: true, veri: conflictService.getStats() });
  } catch (e) { res.status(500).json({ basari: false, hata: e.message }); }
}

function getEvents(req, res) {
  try {
    res.json({ basari: true, veri: conflictService.getEvents() });
  } catch (e) { res.status(500).json({ basari: false, hata: e.message }); }
}

function getHotspots(req, res) {
  try {
    res.json({ basari: true, veri: conflictService.getAllHotspots() });
  } catch (e) { res.status(500).json({ basari: false, hata: e.message }); }
}

module.exports = { getAll, getById, getStats, getEvents, getHotspots };
