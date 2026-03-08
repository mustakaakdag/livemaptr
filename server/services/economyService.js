const axios = require('axios');
const cacheService = require('../cache/cacheService');
const logger = require('../utils/logger');

function fmt(v, d = 2) { return (v != null && !isNaN(v)) ? parseFloat(v).toFixed(d).replace('.', ',') : null; }
function dir(c) { if (c == null || isNaN(c)) return 'belirsiz'; return c > 0.05 ? 'yukari' : c < -0.05 ? 'asagi' : 'degismedi'; }

class EconomyService {
  async fetchAll() {
    const cached = cacheService.getEconomy('economy_all');
    if (cached) return cached;
    const d = await this._fetch();
    cacheService.setEconomy('economy_all', d);
    return d;
  }

  async _fetch() {
    const [doviz, kripto] = await Promise.allSettled([this._currencies(), this._crypto()]);
    return {
      doviz:      doviz.status === 'fulfilled'  ? doviz.value  : this._fbDoviz(),
      kripto:     kripto.status === 'fulfilled' ? kripto.value : this._fbKripto(),
      guncelleme: new Date().toISOString(),
    };
  }

  async _currencies() {
    const endpoints = [
      'https://api.exchangerate-api.com/v4/latest/USD',
      'https://open.er-api.com/v6/latest/USD',
    ];
    for (const url of endpoints) {
      try {
        const r = await axios.get(url, { timeout: 6000 });
        const rates = r.data.rates || r.data.conversion_rates;
        if (!rates?.TRY) continue;
        const t = rates.TRY;
        return [
          { kod: 'USD/TRY', isim: 'Amerikan Doları', sembol: '$', deger: fmt(t),              degisimYon: 'belirsiz', degerHam: t },
          { kod: 'EUR/TRY', isim: 'Euro',             sembol: '€', deger: fmt(t / rates.EUR),  degisimYon: 'belirsiz', degerHam: t / rates.EUR },
          { kod: 'GBP/TRY', isim: 'İngiliz Sterlini', sembol: '£', deger: fmt(t / rates.GBP),  degisimYon: 'belirsiz', degerHam: t / rates.GBP },
          { kod: 'CHF/TRY', isim: 'İsviçre Frangı',  sembol: '₣', deger: fmt(t / rates.CHF),  degisimYon: 'belirsiz', degerHam: t / rates.CHF },
        ];
      } catch (e) { logger.warn('[Döviz] ' + e.message); }
    }
    return this._fbDoviz();
  }

  async _crypto() {
    try {
      const r = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple,solana&vs_currencies=usd,try&include_24hr_change=true',
        { timeout: 8000 }
      );
      const d = r.data;
      const items = [];
      const map = [
        { id: 'bitcoin',  kod: 'BTC', isim: 'Bitcoin',  sembol: '₿' },
        { id: 'ethereum', kod: 'ETH', isim: 'Ethereum', sembol: 'Ξ' },
        { id: 'ripple',   kod: 'XRP', isim: 'XRP',      sembol: '✕' },
        { id: 'solana',   kod: 'SOL', isim: 'Solana',   sembol: '◎' },
      ];
      for (const m of map) {
        if (!d[m.id]) continue;
        const chg = d[m.id].usd_24h_change;
        items.push({
          kod: m.kod, isim: m.isim, sembol: m.sembol,
          deger:    d[m.id].try ? fmt(d[m.id].try, 0) : null,
          degerUSD: d[m.id].usd,
          degisim:  chg != null ? chg.toFixed(2) : null,
          degisimYon: dir(chg),
        });
      }
      return items;
    } catch (e) {
      logger.warn('[Kripto] ' + e.message);
      return this._fbKripto();
    }
  }

  _fbDoviz() {
    return [
      { kod: 'USD/TRY', isim: 'Amerikan Doları', sembol: '$', deger: null, degisimYon: 'belirsiz' },
      { kod: 'EUR/TRY', isim: 'Euro',             sembol: '€', deger: null, degisimYon: 'belirsiz' },
      { kod: 'GBP/TRY', isim: 'İngiliz Sterlini', sembol: '£', deger: null, degisimYon: 'belirsiz' },
    ];
  }
  _fbKripto() {
    return [
      { kod: 'BTC', isim: 'Bitcoin',  sembol: '₿', deger: null, degisimYon: 'belirsiz' },
      { kod: 'ETH', isim: 'Ethereum', sembol: 'Ξ', deger: null, degisimYon: 'belirsiz' },
    ];
  }
}

module.exports = new EconomyService();
