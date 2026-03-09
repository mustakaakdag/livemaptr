require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');
const { applyMiddlewares, applyErrorHandlers } = require('./middlewares');
const apiRoutes = require('./routes/api');
const newsService    = require('./services/newsService');
const economyService = require('./services/economyService');
const socialService  = require('./services/socialService');
const gdeltService   = require('./services/gdeltService');
const newsApiService = require('./services/newsApiService');

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

applyMiddlewares(app);
app.use('/api', apiRoutes);
app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'public', 'index.html')));
applyErrorHandlers(app);

// Socket.IO
io.on('connection', async (socket) => {
  logger.info(`İstemci bağlandı: ${socket.id}`);
  try {
    const [news, economy] = await Promise.all([newsService.fetchAll(), economyService.fetchAll()]);
    const [trends, markers] = await Promise.all([socialService.generateTrends(news), newsService.getMapMarkers()]);
    // NewsAPI — çatışma haberleri
    const conflictNews = await newsApiService.fetchConflictNews().catch(() => []);
    const naMarkers = newsApiService.getMapMarkers();
    socket.emit('initial_data', {
      haberler: news, ekonomi: economy, sosyal: trends,
      markers: [...markers, ...naMarkers],
      conflictNews: newsApiService.getLatest(30),
      zaman: new Date().toISOString(),
    });
  } catch (e) {
    logger.error('İlk veri hatası: ' + e.message);
    socket.emit('hata', { mesaj: 'Veriler yüklenirken hata oluştu' });
  }
  socket.on('disconnect', reason => logger.debug(`Ayrıldı: ${socket.id} (${reason})`));
});

// Periyodik güncelleme döngüleri
setInterval(async () => {
  try {
    const news = await newsService.fetchAll();
    const markers = await newsService.getMapMarkers();
    io.emit('haberler_guncellendi', { haberler: news, markers, zaman: new Date().toISOString() });
  } catch (e) { logger.error('Haber döngüsü: ' + e.message); }
}, config.refresh.news);

setInterval(async () => {
  try {
    const economy = await economyService.fetchAll();
    io.emit('ekonomi_guncellendi', { ekonomi: economy, zaman: new Date().toISOString() });
  } catch (e) { logger.error('Ekonomi döngüsü: ' + e.message); }
}, config.refresh.economy);

setInterval(async () => {
  try {
    const news = await newsService.fetchAll();
    const trends = await socialService.generateTrends(news);
    io.emit('sosyal_guncellendi', { sosyal: trends, zaman: new Date().toISOString() });
  } catch (e) { logger.error('Sosyal döngüsü: ' + e.message); }
}, config.refresh.social);


// ACLED — ilk fetch + periyodik guncelleme (her 15 dk)
// GDELT — her 10 dakikada güncelle
// GDELT 15sn gecikmeli baslat (rate limit onlemek icin)
gdeltService.fetchEvents(15000)
  .then(() => logger.info('GDELT: Ilk veri yuklendi, ' + gdeltService.getStats().total + ' olay'))
  .catch(e => logger.warn('GDELT ilk yukleme hatasi: ' + e.message));

setInterval(async () => {
  try {
    await gdeltService.fetchEvents();
    const markers = gdeltService.getMapMarkers();
    const stats   = gdeltService.getStats();
    io.emit('gdelt_updated', { markers, stats, zaman: new Date().toISOString() });
    logger.info('GDELT: Guncellendi, ' + markers.length + ' konum markeri');
  } catch(e) {
    logger.warn('GDELT interval hata: ' + e.message);
  }
}, 10 * 60 * 1000);

// NewsAPI periyodik döngüsü — her 5 dakikada rotasyonlu sorgu
const NEWSAPI_INTERVAL = parseInt(process.env.NEWSAPI_REFRESH_INTERVAL, 10) || 300000;
setInterval(async () => {
  try {
    await newsApiService.fetchConflictNews();
    const conflictNews = newsApiService.getLatest(30);
    const naMarkers    = newsApiService.getMapMarkers();
    io.emit('conflict_news_updated', { conflictNews, naMarkers, zaman: new Date().toISOString() });
    logger.info(`NewsAPI yayını: ${conflictNews.length} haber, ${naMarkers.length} marker`);
  } catch (e) { logger.error('NewsAPI döngüsü: ' + e.message); }
}, NEWSAPI_INTERVAL);


process.on('uncaughtException', e => { logger.error('UncaughtException: ' + e.message); setTimeout(() => process.exit(1), 1000); });
process.on('unhandledRejection', r => logger.error('UnhandledRejection: ' + r));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));

// Başlat — port meşgulse otomatik öldür (Windows + Unix)
const { host: HOST, port: PORT } = config.server;

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    logger.warn(`Port ${PORT} mesgul, temizleniyor...`);
    const { execSync } = require('child_process');
    try {
      if (process.platform === 'win32') {
        // Windows: portu tutan PID'i bul ve öldür
        const out = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: 'utf8', stdio: ['pipe','pipe','ignore'] });
        const pid = out.trim().split(/\s+/).pop();
        if (pid && !isNaN(pid)) {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          logger.info(`PID ${pid} olduruldu, yeniden baslatiliyor...`);
        }
      } else {
        execSync(`lsof -ti:${PORT} | xargs kill -9`, { stdio: 'ignore' });
      }
    } catch (_) {}
    setTimeout(() => server.listen(PORT, HOST, onListen), 1000);
  } else {
    logger.error('Server hatasi: ' + e.message);
    process.exit(1);
  }
});

function onListen() {
  logger.info('═══════════════════════════════════════════');
  logger.info(`  ${config.app.name} v${config.app.version} başlatıldı`);
  logger.info(`  Adres : http://localhost:${PORT}`);
  logger.info(`  Ortam : ${config.server.env}`);
  logger.info('═══════════════════════════════════════════');

  Promise.all([newsService.fetchAll(), economyService.fetchAll()])
    .then(([news]) => { socialService.generateTrends(news); logger.info('İlk veri çekimi tamamlandı'); })
    .catch(e => logger.warn('İlk veri çekimi hatası: ' + e.message));
}

server.listen(PORT, HOST, onListen);

module.exports = { app, server, io };
