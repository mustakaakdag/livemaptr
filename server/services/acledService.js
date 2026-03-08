/**
 * ACLED OAuth2 Servisi — LiveMapTR v3.7
 * email + password -> Bearer token -> gercek catisma verisi
 */
const https  = require('https');
const logger = require('../utils/logger');

const ACLED_EMAIL    = process.env.ACLED_EMAIL    || '';
const ACLED_PASSWORD = process.env.ACLED_PASSWORD || '';

const WATCH_COUNTRIES = [
  'Israel','Palestinian Territories','Lebanon','Syria','Iran',
  'Ukraine','Russia','Sudan','Ethiopia',
  'Democratic Republic of Congo','Yemen','Somalia',
  'Myanmar','Mali','Burkina Faso','Niger','Haiti',
];

const EVENT_TYPE_TR = {
  'Battles':                    'Catisma',
  'Explosions/Remote violence': 'Patlama/Uzak Saldiri',
  'Violence against civilians': 'Sivil Saldirisi',
  'Protests':                   'Protesto',
  'Riots':                      'Isyan',
  'Strategic developments':     'Stratejik Gelisme',
};

const COUNTRY_CONFLICT = {
  'Israel':'iran_israel','Palestinian Territories':'gaza',
  'Lebanon':'iran_israel','Syria':'iran_israel','Iran':'gulf_nuclear',
  'Ukraine':'ukraine','Russia':'ukraine',
  'Sudan':'sudan','Democratic Republic of Congo':'drcongo',
  'Yemen':'yemen','Myanmar':'myanmar',
  'Mali':'sahel','Burkina Faso':'sahel','Niger':'sahel',
  'Haiti':'haiti','Ethiopia':'ethiopia','Somalia':'sahel',
};

function calcSeverity(fat, evType) {
  if (fat >= 50 || evType === 'Explosions/Remote violence') return 'critical';
  if (fat >= 10) return 'high';
  if (fat >= 1)  return 'medium';
  return 'low';
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function httpsGet(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'LiveMapTR/3.7' },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

class AcledService {
  constructor() {
    this._token = null; this._tokenExp = 0;
    this._events = []; this._lastFetch = 0;
    this._fetchPromise = null;
    this._enabled = !!(ACLED_EMAIL && ACLED_PASSWORD);
  }

  get isEnabled() { return this._enabled; }

  async getToken() {
    if (this._token && Date.now() < this._tokenExp) return this._token;
    logger.info('ACLED: Token aliniyor...');
    const body = 'username=' + encodeURIComponent(ACLED_EMAIL) +
                 '&password=' + encodeURIComponent(ACLED_PASSWORD) +
                 '&grant_type=password&client_id=acled';
    const res = await httpsPost('https://acleddata.com/oauth/token', body);
    if (res.status !== 200 || !res.body.access_token) {
      throw new Error('Token alinamadi: ' + res.status + ' ' + JSON.stringify(res.body).substring(0,100));
    }
    this._token = res.body.access_token;
    this._tokenExp = Date.now() + 50 * 60 * 1000;
    logger.info('ACLED: Token alindi');
    return this._token;
  }

  async fetchEvents() {
    if (!this._enabled) return this._fallback();
    if (Date.now() - this._lastFetch < 10 * 60 * 1000 && this._events.length) return this._events;
    if (this._fetchPromise) return this._fetchPromise;
    this._fetchPromise = this._doFetch().finally(() => { this._fetchPromise = null; });
    return this._fetchPromise;
  }

  async _doFetch() {
    try {
      const token = await this.getToken();
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const fields = 'event_id_cnty|event_date|event_type|sub_event_type|country|admin1|location|latitude|longitude|fatalities|notes|source';
      const countryQ = WATCH_COUNTRIES.join(':OR:country=');
      const params = '_format=json&fields=' + fields +
        '&country=' + encodeURIComponent(countryQ) +
        '&event_date=' + since + '&event_date_where=BETWEEN&event_date2=' + today +
        '&limit=500';
      const url = 'https://acleddata.com/api/acled/read?' + params;
      logger.info('ACLED: Olaylar cekiliyor...');
      const res = await httpsGet(url, token);
      if (!res.body || res.body.status !== 200) {
        logger.warn('ACLED API hata: ' + JSON.stringify(res.body).substring(0,150));
        return this._fallback();
      }
      const raw = res.body.data || [];
      logger.info('ACLED: ' + raw.length + ' olay alindi');
      this._events = raw.map(e => ({
        id: e.event_id_cnty,
        date: e.event_date,
        type: EVENT_TYPE_TR[e.event_type] || e.event_type,
        subType: e.sub_event_type,
        country: e.country,
        region: e.admin1,
        location: e.location,
        lat: parseFloat(e.latitude),
        lng: parseFloat(e.longitude),
        fatalities: parseInt(e.fatalities, 10) || 0,
        notes: (e.notes || '').substring(0, 300),
        source: e.source,
        conflictId: COUNTRY_CONFLICT[e.country] || null,
        severity: calcSeverity(parseInt(e.fatalities, 10) || 0, e.event_type),
      })).filter(e => !isNaN(e.lat) && !isNaN(e.lng));
      this._lastFetch = Date.now();
      return this._events;
    } catch(err) {
      logger.error('ACLED fetch hatasi: ' + err.message);
      return this._fallback();
    }
  }

  _fallback() {
    return [
      { id:'FB001', date:new Date().toISOString().split('T')[0], type:'Patlama/Uzak Saldiri', country:'Ukraine',  location:'Kharkiv',  lat:49.99, lng:36.23, fatalities:12, severity:'critical', conflictId:'ukraine',     notes:'Rus topcu saldirisi, sivil bolge', source:'Fallback' },
      { id:'FB002', date:new Date().toISOString().split('T')[0], type:'Catisma',              country:'Sudan',    location:'Khartoum', lat:15.55, lng:32.53, fatalities:34, severity:'critical', conflictId:'sudan',       notes:'RSF ile SAF arasinda kentsel catisma', source:'Fallback' },
      { id:'FB003', date:new Date().toISOString().split('T')[0], type:'Patlama/Uzak Saldiri', country:'Israel',   location:'Tel Aviv', lat:32.08, lng:34.78, fatalities:0,  severity:'high',     conflictId:'iran_israel', notes:'Fuze alarm tetiklendi', source:'Fallback' },
      { id:'FB004', date:new Date().toISOString().split('T')[0], type:'Sivil Saldirisi',      country:'Democratic Republic of Congo', location:'Goma', lat:-1.67, lng:29.22, fatalities:8, severity:'high', conflictId:'drcongo', notes:'M23 sivilleri hedef aldi', source:'Fallback' },
      { id:'FB005', date:new Date().toISOString().split('T')[0], type:'Catisma',              country:'Myanmar',  location:'Sagaing',  lat:21.87, lng:95.98, fatalities:15, severity:'high',     conflictId:'myanmar',     notes:'PDF ile cunta catismasi', source:'Fallback' },
    ];
  }

  getMapMarkers() {
    return this._events.map(e => ({
      ...e, type: 'acled',
      icon: e.type.includes('Patlama') ? 'explosion' : e.type.includes('Sivil') ? 'warning' : 'battle',
    }));
  }

  getByConflict(conflictId) {
    return this._events.filter(e => e.conflictId === conflictId)
      .sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,20);
  }

  getStats() {
    return {
      total: this._events.length,
      fatalities: this._events.reduce((s,e) => s+e.fatalities, 0),
      critical: this._events.filter(e => e.severity==='critical').length,
      lastUpdate: this._lastFetch ? new Date(this._lastFetch).toISOString() : null,
      source: 'ACLED',
      enabled: this._enabled,
    };
  }
}

module.exports = new AcledService();
