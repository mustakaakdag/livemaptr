const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const express = require('express');
const path = require('path');
const logger = require('../utils/logger');

function applyMiddlewares(app) {
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false }));
  app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
  app.use(compression({ level: 6, threshold: 1024 }));
  app.use(morgan('combined', {
    stream: { write: msg => logger.info(msg.trim()) },
    skip: req => req.url === '/health' || req.url === '/api/health',
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));
  app.use(express.static(path.join(process.cwd(), 'public'), { maxAge: 0, etag: true }));

  // Leaflet npm serve
  try {
    const leafletDir = path.dirname(require.resolve('leaflet/dist/leaflet.js'));
    app.use('/lib/leaflet', express.static(leafletDir));
    logger.info('[Leaflet] npm serve: ' + leafletDir);
  } catch (e) { logger.warn('[Leaflet] npm bulunamadı, CDN kullanılacak'); }

  // MarkerCluster npm serve
  try {
    const mcDir = path.dirname(require.resolve('leaflet.markercluster/dist/leaflet.markercluster.js'));
    app.use('/lib/markercluster', express.static(mcDir));
    logger.info('[MarkerCluster] npm serve: ' + mcDir);
  } catch (e) { logger.warn('[MarkerCluster] npm bulunamadı, CDN kullanılacak'); }
}

function applyErrorHandlers(app) {
  app.use((req, res) => res.status(404).json({ hata: 'Bulunamadı', url: req.originalUrl }));
  app.use((err, req, res, next) => {
    logger.error('İşlenmemiş hata: ' + err.message);
    res.status(err.status || 500).json({ hata: err.message });
  });
}

module.exports = { applyMiddlewares, applyErrorHandlers };
