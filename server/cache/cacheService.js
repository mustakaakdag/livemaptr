const NodeCache = require('node-cache');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.newsCache    = new NodeCache({ stdTTL: 300,  checkperiod: 60  });
    this.economyCache = new NodeCache({ stdTTL: 60,   checkperiod: 30  });
    this.socialCache  = new NodeCache({ stdTTL: 120,  checkperiod: 60  });
    this.geoCache     = new NodeCache({ stdTTL: 3600, checkperiod: 300 });
  }

  setNews(k, v)     { return this.newsCache.set(k, v);    }
  getNews(k)        { return this.newsCache.get(k);        }
  setEconomy(k, v)  { return this.economyCache.set(k, v); }
  getEconomy(k)     { return this.economyCache.get(k);     }
  setSocial(k, v)   { return this.socialCache.set(k, v);  }
  getSocial(k)      { return this.socialCache.get(k);      }
  setGeo(k, v)      { return this.geoCache.set(k, v);     }
  getGeo(k)         { return this.geoCache.get(k);         }

  clearAll() {
    this.newsCache.flushAll();
    this.economyCache.flushAll();
    this.socialCache.flushAll();
    logger.info('Tüm cache temizlendi');
  }

  getStats() {
    return {
      haber:  this.newsCache.getStats(),
      ekonomi: this.economyCache.getStats(),
      sosyal:  this.socialCache.getStats(),
      geo:     this.geoCache.getStats(),
    };
  }
}

module.exports = new CacheService();
