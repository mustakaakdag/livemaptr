require('dotenv').config();

const config = {
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT, 10) || 3000,
    env: process.env.NODE_ENV || 'development',
    isProd: process.env.NODE_ENV === 'production',
  },
  app: {
    name: process.env.APP_NAME || 'LiveMapTR',
    version: process.env.APP_VERSION || '3.0.0',
  },
  refresh: {
    news:    parseInt(process.env.NEWS_REFRESH_INTERVAL,    10) || 120000,
    economy: parseInt(process.env.ECONOMY_REFRESH_INTERVAL, 10) || 60000,
    social:  parseInt(process.env.SOCIAL_REFRESH_INTERVAL,  10) || 90000,
  },
  limits: {
    maxNews:          parseInt(process.env.MAX_NEWS_ITEMS,     10) || 80,
    newsMaxAgeHours:  parseInt(process.env.NEWS_MAX_AGE_HOURS, 10) || 24,
  },
  credibility: {
    minScore: parseInt(process.env.MIN_CREDIBILITY_SCORE, 10) || 30,
  },
  log: { level: process.env.LOG_LEVEL || 'info' },

  rssSources: [
    // Türk haber kaynakları
    { url: 'https://www.trthaber.com/sondakika.rss',                        name: 'TRT Haber',        credibility: 88 },
    { url: 'https://www.aa.com.tr/tr/rss/default?cat=guncel',               name: 'Anadolu Ajansı',   credibility: 87 },
    { url: 'https://www.ntv.com.tr/son-dakika.rss',                         name: 'NTV',              credibility: 85 },
    { url: 'https://www.haberturk.com/rss/kategori/dunya.xml',              name: 'Habertürk Dünya',  credibility: 82 },
    { url: 'https://www.haberturk.com/rss/kategori/gundem.xml',             name: 'Habertürk Gündem', credibility: 82 },
    { url: 'https://www.hurriyet.com.tr/rss/gundem',                        name: 'Hürriyet',         credibility: 80 },
    { url: 'https://www.cumhuriyet.com.tr/rss/son_dakika.xml',              name: 'Cumhuriyet',       credibility: 80 },
    { url: 'https://www.milliyet.com.tr/rss/rssNew/sondakikaRss.xml',       name: 'Milliyet',         credibility: 79 },
    { url: 'https://www.sabah.com.tr/rss/anasayfa.xml',                     name: 'Sabah',            credibility: 78 },
    { url: 'https://www.ensonhaber.com/rss/dunya.xml',                      name: 'Ensonhaber Dünya', credibility: 76 },
    { url: 'https://www.ensonhaber.com/rss/gundem.xml',                     name: 'Ensonhaber Gündem',credibility: 76 },
    // Uluslararası kaynaklar
    { url: 'https://feeds.bbci.co.uk/turkce/rss.xml',                       name: 'BBC Türkçe',       credibility: 90 },
    { url: 'https://tr.euronews.com/rss',                                    name: 'Euronews TR',      credibility: 83 },
    { url: 'https://www.bloomberght.com/rss',                                name: 'Bloomberg HT',     credibility: 88 },
  ],
};

module.exports = config;
