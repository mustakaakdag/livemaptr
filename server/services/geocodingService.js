const cacheService = require('../cache/cacheService');

const LOCATIONS = {
  // Türkiye büyük şehirler
  'istanbul':    { lat: 41.0082, lng: 28.9784, region: 'Marmara' },
  'ankara':      { lat: 39.9334, lng: 32.8597, region: 'İç Anadolu' },
  'izmir':       { lat: 38.4192, lng: 27.1287, region: 'Ege' },
  'bursa':       { lat: 40.1826, lng: 29.0665, region: 'Marmara' },
  'antalya':     { lat: 36.8969, lng: 30.7133, region: 'Akdeniz' },
  'gaziantep':   { lat: 37.0662, lng: 37.3833, region: 'Güneydoğu Anadolu' },
  'adana':       { lat: 37.0000, lng: 35.3213, region: 'Akdeniz' },
  'konya':       { lat: 37.8746, lng: 32.4932, region: 'İç Anadolu' },
  'trabzon':     { lat: 41.0015, lng: 39.7178, region: 'Karadeniz' },
  'diyarbakır':  { lat: 37.9144, lng: 40.2306, region: 'Güneydoğu Anadolu' },
  'kayseri':     { lat: 38.7312, lng: 35.4787, region: 'İç Anadolu' },
  'erzurum':     { lat: 39.9055, lng: 41.2658, region: 'Doğu Anadolu' },
  'samsun':      { lat: 41.2867, lng: 36.3300, region: 'Karadeniz' },
  'mersin':      { lat: 36.8000, lng: 34.6333, region: 'Akdeniz' },
  'eskişehir':   { lat: 39.7767, lng: 30.5206, region: 'İç Anadolu' },
  'denizli':     { lat: 37.7765, lng: 29.0864, region: 'Ege' },
  'malatya':     { lat: 38.3552, lng: 38.3095, region: 'Doğu Anadolu' },
  'urfa':        { lat: 37.1591, lng: 38.7969, region: 'Güneydoğu Anadolu' },
  'şanlıurfa':   { lat: 37.1591, lng: 38.7969, region: 'Güneydoğu Anadolu' },
  'van':         { lat: 38.4891, lng: 43.4089, region: 'Doğu Anadolu' },
  'hatay':       { lat: 36.4018, lng: 36.3498, region: 'Akdeniz' },
  'mardin':      { lat: 37.3212, lng: 40.7245, region: 'Güneydoğu Anadolu' },
  'batman':      { lat: 37.8812, lng: 41.1351, region: 'Güneydoğu Anadolu' },
  'hakkari':     { lat: 37.5744, lng: 43.7408, region: 'Doğu Anadolu' },
  'şırnak':      { lat: 37.5187, lng: 42.4618, region: 'Güneydoğu Anadolu' },
  'kilis':       { lat: 36.7184, lng: 37.1212, region: 'Güneydoğu Anadolu' },
  'kahramanmaraş': { lat: 37.5858, lng: 36.9371, region: 'Akdeniz' },
  'osmaniye':    { lat: 37.0742, lng: 36.2464, region: 'Akdeniz' },
  'muş':         { lat: 38.7432, lng: 41.4942, region: 'Doğu Anadolu' },
  'bitlis':      { lat: 38.4006, lng: 42.1095, region: 'Doğu Anadolu' },
  'siirt':       { lat: 37.9333, lng: 41.9500, region: 'Güneydoğu Anadolu' },
  'iğdır':       { lat: 39.9167, lng: 44.0333, region: 'Doğu Anadolu' },
  'ağrı':        { lat: 39.7191, lng: 43.0503, region: 'Doğu Anadolu' },
  'ardahan':     { lat: 41.1105, lng: 42.7022, region: 'Doğu Anadolu' },
  'kars':        { lat: 40.6013, lng: 43.0975, region: 'Doğu Anadolu' },
  'türkiye':     { lat: 39.0,    lng: 35.0,    region: 'Türkiye' },
  'türkiyede':   { lat: 39.0,    lng: 35.0,    region: 'Türkiye' },
  // Ortadoğu
  'gazze':       { lat: 31.3547, lng: 34.3088, region: 'Filistin' },
  'kudüs':       { lat: 31.7683, lng: 35.2137, region: 'İsrail/Filistin' },
  'tel aviv':    { lat: 32.0853, lng: 34.7818, region: 'İsrail' },
  'beyrut':      { lat: 33.8938, lng: 35.5018, region: 'Lübnan' },
  'şam':         { lat: 33.5102, lng: 36.2913, region: 'Suriye' },
  'halep':       { lat: 36.2021, lng: 37.1343, region: 'Suriye' },
  'suriye':      { lat: 34.8021, lng: 38.9968, region: 'Suriye' },
  'tahran':      { lat: 35.6892, lng: 51.3890, region: 'İran' },
  'irak':        { lat: 33.2232, lng: 43.6793, region: 'Irak' },
  'bağdat':      { lat: 33.3152, lng: 44.3661, region: 'Irak' },
  'erbil':       { lat: 36.1901, lng: 44.0091, region: 'Kuzey Irak' },
  'musul':       { lat: 36.3350, lng: 43.1189, region: 'Irak' },
  'sana':        { lat: 15.3694, lng: 44.1910, region: 'Yemen' },
  'hudeyde':     { lat: 14.7978, lng: 42.9543, region: 'Yemen' },
  'riyad':       { lat: 24.6877, lng: 46.7219, region: 'Suudi Arabistan' },
  'doha':        { lat: 25.2854, lng: 51.5310, region: 'Katar' },
  'abu dabi':    { lat: 24.4539, lng: 54.3773, region: 'BAE' },
  'dubai':       { lat: 25.2048, lng: 55.2708, region: 'BAE' },
  'kahire':      { lat: 30.0444, lng: 31.2357, region: 'Mısır' },
  'mısır':       { lat: 26.8206, lng: 30.8025, region: 'Mısır' },
  'libya':       { lat: 26.3351, lng: 17.2283, region: 'Libya' },
  'trablus':     { lat: 32.9011, lng: 13.1805, region: 'Libya' },
  'moskova':     { lat: 55.7558, lng: 37.6173, region: 'Rusya' },
  'rusya':       { lat: 61.5240, lng: 105.3188,region: 'Rusya' },
  'ukrayna':     { lat: 48.3794, lng: 31.1656, region: 'Ukrayna' },
  'kyiv':        { lat: 50.4501, lng: 30.5234, region: 'Ukrayna' },
  'washington':  { lat: 38.9072, lng: -77.0369,region: 'ABD' },
  'berlin':      { lat: 52.5200, lng: 13.4050, region: 'Almanya' },
  'londra':      { lat: 51.5074, lng: -0.1278, region: 'İngiltere' },
  'paris':       { lat: 48.8566, lng: 2.3522,  region: 'Fransa' },
  'pekin':       { lat: 39.9042, lng: 116.4074,region: 'Çin' },
};

class GeocodingService {
  extractLocation(text) {
    if (!text) return null;

    const key = `geo_${text.substring(0, 80)}`;
    const cached = cacheService.getGeo(key);
    if (cached !== undefined) return cached;

    const norm = text.toLowerCase()
      .replace(/[''`]/g, '')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u');

    let best = null;
    let bestScore = 0;

    for (const [city, coords] of Object.entries(LOCATIONS)) {
      const nc = city.toLowerCase().replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ö/g,'o').replace(/ü/g,'u');
      const rx = new RegExp(`\\b${nc}\\b`, 'i');
      if (rx.test(norm)) {
        const score = city.length + (['istanbul','ankara','izmir'].includes(city) ? 3 : 0);
        if (score > bestScore) { bestScore = score; best = { city, coords }; }
      }
    }

    const result = best ? {
      lat: best.coords.lat,
      lng: best.coords.lng,
      locationName: best.city.charAt(0).toUpperCase() + best.city.slice(1),
      region: best.coords.region || 'Türkiye',
    } : null;

    cacheService.setGeo(key, result);
    return result;
  }

  addJitter(lat, lng, range = 0.04) {
    return {
      lat: lat + (Math.random() - 0.5) * range,
      lng: lng + (Math.random() - 0.5) * range,
    };
  }
}

module.exports = new GeocodingService();
