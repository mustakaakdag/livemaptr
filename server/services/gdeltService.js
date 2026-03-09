/**
 * ReliefWeb API — LiveMapTR
 * BM resmi insani kriz verisi, ucretsiz, key yok
 * https://api.reliefweb.int/v1
 */
const https = require('https');
const logger = require('../utils/logger');

const CACHE_TTL = 20 * 60 * 1000;

const CONFLICT_COORDS = {
  iran_israel:  { lat: 31.5,  lng: 34.8  },
  gaza:         { lat: 31.35, lng: 34.3  },
  ukraine:      { lat: 48.5,  lng: 31.2  },
  gulf_nuclear: { lat: 25.3,  lng: 55.4  },
  sudan:        { lat: 15.5,  lng: 32.5  },
  drcongo:      { lat: -4.3,  lng: 15.3  },
  yemen:        { lat: 15.3,  lng: 44.2  },
  myanmar:      { lat: 19.7,  lng: 96.1  },
  sahel:        { lat: 13.5,  lng: -2.1  },
  haiti:        { lat: 18.9,  lng: -72.3 },
  syria:        { lat: 34.8,  lng: 38.9  },
  ethiopia:     { lat: 9.1,   lng: 40.5  },
};

const COUNTRY_MAP = {
  'Israel':                            'iran_israel',
  'Palestinian Territory':             'gaza',
  'Palestine':                         'gaza',
  'Lebanon':                           'iran_israel',
  'Iran':                              'iran_israel',
  'Iraq':                              'iran_israel',
  'Ukraine':                           'ukraine',
  'Sudan':                             'sudan',
  'South Sudan':                       'sudan',
  'Democratic Republic of the Congo':  'drcongo',
  'Congo':                             'drcongo',
  'Yemen':                             'yemen',
  'Myanmar':                           'myanmar',
  'Burma':                             'myanmar',
  'Mali':                              'sahel',
  'Burkina Faso':                      'sahel',
  'Niger':                             'sahel',
  'Haiti':                             'haiti',
  'Syria':                             'syria',
  'Syrian Arab Republic':              'syria',
  'Ethiopia':                          'ethiopia',
  'Saudi Arabia':                      'gulf_nuclear',
};

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'api.reliefweb.int',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LiveMapTR/3.9 (contact@livemaptr.com)',
        'Content-Length': Buffer.byteLength(data),
      }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error('Parse error: ' + d.substring(0,100))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

class ReliefWebService {
  constructor() {
    this._events = [];
    this._lastFetch = 0;
    this._fetchPromise = null;
  }

  async fetchEvents(delay = 0) {
    if (Date.now() - this._lastFetch < CACHE_TTL && this._events.length) {
      return this._events;
    }
    if (this._fetchPromise) return this._fetchPromise;
    if (delay) await new Promise(r => setTimeout(r, delay));
    this._fetchPromise = this._doFetch().finally(() => { this._fetchPromise = null; });
    return this._fetchPromise;
  }

  async _doFetch() {
    try {
      logger.info('ReliefWeb: Haberler cekiliyor...');

      const body = {
        limit: 100,
        sort: ['date:desc'],
        fields: {
          include: ['title', 'date', 'source', 'country', 'url_alias', 'status']
        },
        filter: {
          field: 'country',
          value: [
            'Ukraine', 'Sudan', 'Yemen', 'Myanmar', 'Syria',
            'Palestinian Territory', 'Haiti', 'Ethiopia',
            'Democratic Republic of the Congo', 'Mali', 'Lebanon', 'Iraq'
          ],
          operator: 'OR'
        }
      };

      const data = await post('/v1/reports?appname=livemaptr', body);
      const items = (data.data || []);
      logger.info(`ReliefWeb: ${items.length} rapor alindi`);

      const jitter = () => (Math.random() - 0.5) * 1.2;

      this._events = items.map((item, i) => {
        const f = item.fields || {};
        const countryName = (f.country && f.country[0]) ? f.country[0].name : '';
        const conflictId = COUNTRY_MAP[countryName] || null;
        const coords = conflictId ? CONFLICT_COORDS[conflictId] : null;
        return {
          id: 'rw_' + item.id,
          title: f.title || 'Rapor',
          url: f.url_alias || ('https://reliefweb.int/node/' + item.id),
          source: (f.source && f.source[0]) ? f.source[0].name : 'ReliefWeb',
          publishedAt: (f.date && f.date.created) ? f.date.created : new Date().toISOString(),
          lat: coords ? coords.lat + jitter() : null,
          lng: coords ? coords.lng + jitter() : null,
          country: countryName,
          conflictId,
          severity: 'high',
          type: 'reliefweb',
          isBreaking: false,
          credibilityScore: 95,
        };
      }).filter(e => e.lat && e.lng && e.conflictId);

      this._lastFetch = Date.now();
      logger.info(`ReliefWeb: ${this._events.length} olay islendi`);
      return this._events;

    } catch(err) {
      logger.warn('ReliefWeb fetch hatasi: ' + err.message);
      return this._events;
    }
  }

  getMapMarkers() {
    return this._events.map(e => ({
      id: e.id,
      lat: e.lat,
      lng: e.lng,
      title: e.title,
      source: e.source,
      url: e.url,
      publishedAt: e.publishedAt,
      severity: e.severity,
      conflictId: e.conflictId,
      type: e.type,
      credibilityScore: e.credibilityScore,
    }));
  }

  getByConflict(conflictId) {
    return this._events.filter(e => e.conflictId === conflictId).slice(0, 15);
  }

  getLatest(limit = 30) {
    return [...this._events]
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit);
  }

  getStats() {
    return {
      total: this._events.length,
      withLocation: this._events.filter(e => e.lat && e.lng).length,
      lastUpdate: this._lastFetch ? new Date(this._lastFetch).toISOString() : null,
      source: 'ReliefWeb (UN)',
    };
  }
}

module.exports = new ReliefWebService();
