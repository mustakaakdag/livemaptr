/**
 * LiveMapTR — Conflict Intelligence Service
 * Tüm aktif çatışmaları, olay akışını ve risk seviyelerini yönetir.
 */
const cacheService = require('../cache/cacheService');
const logger = require('../utils/logger');

// ── Aktif Çatışma Veritabanı ──────────────────────────────────────────────────
const CONFLICTS = [
  {
    id: 'ukraine',
    name: 'Ukrayna Savaşı',
    nameEn: 'Russia-Ukraine War',
    region: 'Doğu Avrupa',
    flag: '🇺🇦',
    status: 'aktif', // aktif | donmus | izleme
    intensity: 'yuksek', // dusuk | orta | yuksek | kritik
    riskScore: 92,
    startDate: '2022-02-24',
    center: { lat: 48.5, lng: 31.5 },
    bounds: [[44.0, 22.0], [52.5, 40.5]],
    parties: [
      { name: 'Ukrayna', flag: '🇺🇦', side: 'A', color: '#3b82f6' },
      { name: 'Rusya', flag: '🇷🇺', side: 'B', color: '#ef4444' },
      { name: 'NATO (destek)', flag: '🌐', side: 'A', color: '#3b82f6' },
    ],
    casualties: { total: '~500,000+', daily: '~200-800', source: 'OHCHR/MediaRep' },
    displaced: '10,000,000+',
    summary: 'Rusya\'nın Şubat 2022\'de başlattığı tam ölçekli işgal sürüyor. Cephe hatları Donetsk, Zaporizhzhia, Kherson ve Kharkiv bölgelerinde aktif.',
    hotspots: [
      { lat: 47.8388, lng: 35.1396, name: 'Zaporizhzhia Cephesi', icon: '🔥', severity: 'kritik' },
      { lat: 48.0159, lng: 37.8028, name: 'Donetsk Cephesi', icon: '💥', severity: 'kritik' },
      { lat: 49.9935, lng: 36.2304, name: 'Kharkiv Bölgesi', icon: '🚀', severity: 'yuksek' },
      { lat: 50.4501, lng: 30.5234, name: 'Kyiv — Başkent', icon: '🏛️', severity: 'orta' },
      { lat: 46.9591, lng: 31.9974, name: 'Kherson Hattı', icon: '⚔️', severity: 'yuksek' },
    ],
    tags: ['Füze Saldırısı', 'Hava Saldırısı', 'Kara Harekâtı', 'Nükleer Tesis Riski'],
    sources: ['Institute for the Study of War', 'OHCHR', 'Ukrinform'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'gaza',
    name: 'Gazze Savaşı',
    nameEn: 'Gaza-Israel Conflict',
    region: 'Ortadoğu',
    flag: '🇵🇸',
    status: 'aktif',
    intensity: 'kritik',
    riskScore: 97,
    startDate: '2023-10-07',
    center: { lat: 31.4, lng: 34.35 },
    bounds: [[31.2, 34.2], [31.6, 34.6]],
    parties: [
      { name: 'İsrail Savunma Kuvvetleri', flag: '🇮🇱', side: 'A', color: '#3b82f6' },
      { name: 'Hamas / Filistin Grupları', flag: '🇵🇸', side: 'B', color: '#10b981' },
      { name: 'Hizbullah (Lübnan cephesi)', flag: '🇱🇧', side: 'B', color: '#f59e0b' },
    ],
    casualties: { total: '~50,000+', daily: '~50-200', source: 'UNRWA/Gaza Health Ministry' },
    displaced: '1,900,000+',
    summary: '7 Ekim 2023 Hamas saldırısının ardından başlayan İsrail kara harekâtı sürüyor. Kuzey Gazze\'de yoğun kentsel çatışma, Refah\'ta insani kriz.',
    hotspots: [
      { lat: 31.5017, lng: 34.4667, name: 'Kuzey Gazze', icon: '💥', severity: 'kritik' },
      { lat: 31.4175, lng: 34.3547, name: 'Gazze Şehri', icon: '🔥', severity: 'kritik' },
      { lat: 31.2968, lng: 34.2476, name: 'Han Yunus', icon: '⚔️', severity: 'kritik' },
      { lat: 31.1, lng: 34.2, name: 'Refah Sınır Kapısı', icon: '🚧', severity: 'yuksek' },
      { lat: 31.7683, lng: 35.2137, name: 'Kudüs Gerilimi', icon: '⚠️', severity: 'yuksek' },
    ],
    tags: ['İnsani Kriz', 'Kentsel Savaş', 'Abluka', 'Bölgesel Yayılma Riski'],
    sources: ['UNRWA', 'Reuters', 'Al Jazeera'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'sudan',
    name: 'Sudan İç Savaşı',
    nameEn: 'Sudan Civil War',
    region: 'Afrika',
    flag: '🇸🇩',
    status: 'aktif',
    intensity: 'kritik',
    riskScore: 89,
    startDate: '2023-04-15',
    center: { lat: 15.5, lng: 30.0 },
    bounds: [[8.0, 22.0], [23.0, 38.0]],
    parties: [
      { name: 'Sudanlı Silahlı Kuvvetler (SAF)', flag: '🇸🇩', side: 'A', color: '#3b82f6' },
      { name: 'Hızlı Destek Kuvvetleri (RSF)', flag: '⚔️', side: 'B', color: '#ef4444' },
    ],
    casualties: { total: '~150,000+', daily: '~50-300', source: 'ACLED/UN' },
    displaced: '10,800,000+',
    summary: 'SAF ve RSF arasındaki iç savaş tüm hızıyla sürüyor. Hartum\'da yıkıcı kentsel çatışma, Darfur\'da insanlığa karşı suç iddiaları.',
    hotspots: [
      { lat: 15.5007, lng: 32.5599, name: 'Hartum — Başkent Çatışması', icon: '💥', severity: 'kritik' },
      { lat: 13.5, lng: 25.3, name: 'Darfur — İnsani Felaket', icon: '🔥', severity: 'kritik' },
      { lat: 12.9, lng: 30.2, name: 'Kordofan Bölgesi', icon: '⚔️', severity: 'yuksek' },
    ],
    tags: ['İnsani Felaket', 'Etnik Temizlik İddiaları', 'Göç Krizi', 'BM Gündemde'],
    sources: ['ACLED', 'UN OCHA', 'Sudan Tribune'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'myanmar',
    name: 'Myanmar İç Savaşı',
    nameEn: 'Myanmar Civil War',
    region: 'Güneydoğu Asya',
    flag: '🇲🇲',
    status: 'aktif',
    intensity: 'yuksek',
    riskScore: 82,
    startDate: '2021-02-01',
    center: { lat: 19.0, lng: 96.5 },
    bounds: [[10.0, 92.0], [28.0, 101.0]],
    parties: [
      { name: 'Askeri Cunta (SAC/Tatmadaw)', flag: '🎖️', side: 'A', color: '#ef4444' },
      { name: 'Halk Savunma Kuvvetleri (PDF)', flag: '✊', side: 'B', color: '#10b981' },
      { name: 'Etnik Silahlı Örgütler (EAO)', flag: '🏔️', side: 'B', color: '#f59e0b' },
    ],
    casualties: { total: '~50,000+', daily: '~30-100', source: 'AAPP/ACLED' },
    displaced: '2,700,000+',
    summary: '2021 askeri darbesinin ardından başlayan direnişin büyümesiyle cunta toprak kaybediyor. Kuzey ve batı eyaletlerinde yoğun çatışmalar.',
    hotspots: [
      { lat: 16.8661, lng: 96.1951, name: 'Yangon — Kentsel Direniş', icon: '✊', severity: 'yuksek' },
      { lat: 21.9588, lng: 96.0891, name: 'Sagaing Bölgesi', icon: '🔥', severity: 'kritik' },
      { lat: 24.0, lng: 97.5, name: 'Kuzey Shan — Etnik Çatışma', icon: '⚔️', severity: 'yuksek' },
    ],
    tags: ['Askeri Darbe', 'Sivil Direniş', 'İnsan Hakları İhlali', 'Etnik Çatışma'],
    sources: ['ACLED', 'Assistance Association for Political Prisoners', 'The Irrawaddy'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'yemen',
    name: 'Yemen İç Savaşı',
    nameEn: 'Yemen Civil War',
    region: 'Ortadoğu',
    flag: '🇾🇪',
    status: 'aktif',
    intensity: 'yuksek',
    riskScore: 85,
    startDate: '2014-09-21',
    center: { lat: 16.0, lng: 48.0 },
    bounds: [[12.0, 42.0], [19.0, 54.0]],
    parties: [
      { name: 'Husi Hareketi (Ensar Allah)', flag: '🔴', side: 'A', color: '#ef4444' },
      { name: 'Uluslararası Tanınan Hükümet', flag: '🇾🇪', side: 'B', color: '#3b82f6' },
      { name: 'Suudi Koalisyonu', flag: '🇸🇦', side: 'B', color: '#f59e0b' },
    ],
    casualties: { total: '~377,000+', daily: 'Kısmi Ateşkes', source: 'UN OCHA' },
    displaced: '4,500,000+',
    summary: 'Husiler kuzey Yemen\'i kontrol ederken Kızıldeniz\'e füze/drone saldırıları sürüyor. Uluslararası ticaret tehdit altında.',
    hotspots: [
      { lat: 15.3694, lng: 44.1910, name: 'Sana — Husi Kontrolü', icon: '🔴', severity: 'yuksek' },
      { lat: 14.7978, lng: 42.9543, name: 'Hudeyde — Deniz Saldırıları', icon: '🚀', severity: 'yuksek' },
      { lat: 12.5847, lng: 43.3272, name: 'Bab el-Mandeb Boğazı', icon: '⚓', severity: 'kritik' },
      { lat: 14.5322, lng: 49.1291, name: 'Marib Cephesi', icon: '⚔️', severity: 'orta' },
    ],
    tags: ['Kızıldeniz Tehdidi', 'İnsani Kriz', 'İran Destekli', 'Deniz Güvenliği'],
    sources: ['UN OCHA', 'ACLED', 'Reuters'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'syria',
    name: 'Suriye Çatışması',
    nameEn: 'Syrian Conflict',
    region: 'Ortadoğu',
    flag: '🇸🇾',
    status: 'izleme',
    intensity: 'orta',
    riskScore: 68,
    startDate: '2011-03-15',
    center: { lat: 35.0, lng: 38.5 },
    bounds: [[32.0, 35.5], [37.5, 42.5]],
    parties: [
      { name: 'HTS / Yeni Yönetim', flag: '🟢', side: 'A', color: '#10b981' },
      { name: 'Kürt Güçleri (SDG/YPG)', flag: '🔵', side: 'B', color: '#3b82f6' },
      { name: 'Türk Askeri & SMO', flag: '🇹🇷', side: 'C', color: '#ef4444' },
    ],
    casualties: { total: '~600,000+', daily: 'Düşük Yoğunluk', source: 'SOHR' },
    displaced: '12,000,000+',
    summary: 'Esad rejiminin devrilmesinin ardından Suriye geçiş sürecinde. Kuzey Suriye\'de Türkiye destekli operasyonlar ve Kürt güçleriyle gerilim sürüyor.',
    hotspots: [
      { lat: 36.2021, lng: 37.1343, name: 'Halep — Geçiş Süreci', icon: '🕊️', severity: 'orta' },
      { lat: 33.5102, lng: 36.2913, name: 'Şam — Yeni Yönetim', icon: '🏛️', severity: 'dusuk' },
      { lat: 36.8, lng: 38.5, name: 'Kuzey Suriye — Türk Operasyonu', icon: '⚔️', severity: 'yuksek' },
      { lat: 35.9, lng: 39.0, name: 'SDG Kontrol Hattı', icon: '⚠️', severity: 'orta' },
    ],
    tags: ['Geçiş Süreci', 'Türk Askeri Varlığı', 'Kürt Meselesi', 'İran Etkisi'],
    sources: ['SOHR', 'Reuters', 'Anadolu Ajansı'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'sahel',
    name: 'Sahel Bölgesi Çatışmaları',
    nameEn: 'Sahel Conflicts',
    region: 'Afrika',
    flag: '🌍',
    status: 'aktif',
    intensity: 'yuksek',
    riskScore: 78,
    startDate: '2012-01-01',
    center: { lat: 14.0, lng: 2.0 },
    bounds: [[10.0, -18.0], [20.0, 24.0]],
    parties: [
      { name: 'JNIM (El Kaide bağlantılı)', flag: '⚫', side: 'A', color: '#ef4444' },
      { name: 'ISGS (IŞİD Sahra)', flag: '⚫', side: 'A', color: '#dc2626' },
      { name: 'Mali/Burkina/Niger Cuntaları', flag: '🎖️', side: 'B', color: '#f59e0b' },
      { name: 'Wagner/Afrika Kolordusu', flag: '🇷🇺', side: 'B', color: '#8b5cf6' },
    ],
    casualties: { total: '~40,000+ (2012-)', daily: '~20-100', source: 'ACLED' },
    displaced: '7,000,000+',
    summary: 'Mali, Burkina Faso, Nijer ve Nijerya\'yı kapsayan çok cepheli isyan. Fransız kuvvetleri çekildi, Rusya Wagner/Afrika Kolordusu bölgede.',
    hotspots: [
      { lat: 14.3167, lng: -1.6167, name: 'Gao — Mali Kuzey', icon: '⚔️', severity: 'kritik' },
      { lat: 12.3569, lng: -1.5352, name: 'Ouagadougou — Burkina Faso', icon: '🔥', severity: 'yuksek' },
      { lat: 13.5137, lng: 2.1098, name: 'Niamey — Nijer', icon: '⚠️', severity: 'yuksek' },
      { lat: 11.8, lng: 13.15, name: 'Kuzeydoğu Nijerya — Boko Haram', icon: '💥', severity: 'yuksek' },
    ],
    tags: ['IŞİD', 'El Kaide', 'Wagner Grubu', 'Kuzey Afrika İstikrarsızlığı'],
    sources: ['ACLED', 'ISS Africa', 'AFP'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'ethiopia',
    name: 'Etiyopya Çatışmaları',
    nameEn: 'Ethiopia Conflicts',
    region: 'Afrika',
    flag: '🇪🇹',
    status: 'izleme',
    intensity: 'orta',
    riskScore: 62,
    startDate: '2020-11-04',
    center: { lat: 10.0, lng: 40.0 },
    bounds: [[3.0, 33.0], [18.0, 48.0]],
    parties: [
      { name: 'Etiyopya Federal Hükümeti', flag: '🇪🇹', side: 'A', color: '#10b981' },
      { name: 'TPLF (Tigray)', flag: '🏔️', side: 'B', color: '#3b82f6' },
      { name: 'OLA (Oromo)', flag: '⚔️', side: 'B', color: '#f59e0b' },
    ],
    casualties: { total: '~600,000+', daily: 'Ateşkeste', source: 'ACLED/UN' },
    displaced: '3,000,000+',
    summary: 'Tigray ateşkesi tutsa da Amhara ve Oromo bölgelerinde çatışmalar sürüyor. Tigray\'daki insani durum kritik.',
    hotspots: [
      { lat: 14.0, lng: 38.45, name: 'Tigray Bölgesi', icon: '⚠️', severity: 'orta' },
      { lat: 9.0249, lng: 38.7469, name: 'Addis Ababa Çevresi', icon: '🏛️', severity: 'dusuk' },
      { lat: 7.5, lng: 36.5, name: 'Oromo Bölgesi', icon: '⚔️', severity: 'orta' },
    ],
    tags: ['Ateşkes Kırılgan', 'İnsani Kriz', 'Etnik Çatışma'],
    sources: ['ACLED', 'UN OCHA', 'Reuters'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'haiti',
    name: 'Haiti Çete Savaşı',
    nameEn: 'Haiti Gang War',
    region: 'Karayipler',
    flag: '🇭🇹',
    status: 'aktif',
    intensity: 'yuksek',
    riskScore: 75,
    startDate: '2021-07-07',
    center: { lat: 18.9712, lng: -72.2852 },
    bounds: [[18.0, -74.5], [20.1, -71.6]],
    parties: [
      { name: 'Viv Ansanm Çete Koalisyonu', flag: '🔫', side: 'A', color: '#ef4444' },
      { name: 'Haiti Polisi & Geçici Hükümet', flag: '🇭🇹', side: 'B', color: '#3b82f6' },
      { name: 'Kenya Liderliği Uluslararası Güç', flag: '🌐', side: 'B', color: '#10b981' },
    ],
    casualties: { total: '~5,000+ (2024)', daily: '~10-50', source: 'BINUH/UN' },
    displaced: '700,000+',
    summary: 'Çeteler Port-au-Prince\'in %80\'ini kontrol ediyor. Uluslararası güvenlik gücü yetersiz kalıyor. Devlet otoritesi fiilen çökmüş.',
    hotspots: [
      { lat: 18.5392, lng: -72.3288, name: 'Port-au-Prince — Çete Kontrolü', icon: '🔫', severity: 'kritik' },
      { lat: 18.8, lng: -72.3, name: 'Kuzey Bölgeler', icon: '⚔️', severity: 'yuksek' },
    ],
    tags: ['Devlet Çöküşü', 'Çete Hakimiyeti', 'İnsani Kriz', 'BM Müdahalesi'],
    sources: ['BINUH', 'Reuters', 'ACLED'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'drcongo',
    name: 'DR Kongo Çatışması',
    nameEn: 'DRC Conflict',
    region: 'Afrika',
    flag: '🇨🇩',
    status: 'aktif',
    intensity: 'kritik',
    riskScore: 88,
    startDate: '1996-01-01',
    center: { lat: -1.5, lng: 29.5 },
    bounds: [[-12.0, 12.0], [5.0, 31.5]],
    parties: [
      { name: 'M23 / Ruanda Kuvvetleri', flag: '🇷🇼', side: 'A', color: '#ef4444' },
      { name: 'Kongo Ordusu (FARDC)', flag: '🇨🇩', side: 'B', color: '#3b82f6' },
      { name: 'FDLR & Diğer Milisler', flag: '⚔️', side: 'C', color: '#f59e0b' },
    ],
    casualties: { total: '~6,000,000+ (toplam)', daily: '~30-100', source: 'ACLED/UN' },
    displaced: '7,200,000+',
    summary: 'M23 isyanı Goma\'yı ele geçirdi. Ruanda\'nın doğrudan müdahalesi uluslararası kriz yarattı. Doğu Kongo tamamen istikrarsız.',
    hotspots: [
      { lat: -1.6595, lng: 29.2211, name: 'Goma — M23 Kontrolü', icon: '💥', severity: 'kritik' },
      { lat: -0.5, lng: 29.4, name: 'Kuzey Kivu Çatışması', icon: '🔥', severity: 'kritik' },
      { lat: -2.5, lng: 28.8, name: 'Güney Kivu', icon: '⚔️', severity: 'yuksek' },
    ],
    tags: ['M23 İsyanı', 'Ruanda Müdahalesi', 'Maden Çatışması', 'İnsanlık Krizi'],
    sources: ['ACLED', 'UN OCHA', 'Reuters'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'iran_israel',
    name: 'İran-İsrail-ABD Bölgesel Savaşı',
    nameEn: 'Iran-Israel-US Regional War',
    region: 'Ortadoğu / Körfez',
    flag: '☢️',
    status: 'aktif',
    intensity: 'kritik',
    riskScore: 98,
    startDate: '2023-10-07',
    center: { lat: 32.4279, lng: 53.6880 },
    bounds: [[22.0, 29.0], [42.0, 63.0]],
    parties: [
      { name: 'ABD & CENTCOM (5. Filo)', flag: '🇺🇸', side: 'A', color: '#3b82f6' },
      { name: 'İsrail / IDF', flag: '🇮🇱', side: 'A', color: '#60a5fa' },
      { name: 'İran / IRGC', flag: '🇮🇷', side: 'B', color: '#ef4444' },
      { name: 'Direniş Ekseni (Hizbullah, Husiler, Haşdi Şabi)', flag: '🔴', side: 'B', color: '#dc2626' },
    ],
    casualties: { total: '150,000+ (vekil dahil)', daily: '50-300 (bölgesel)', source: 'ACLED/Reuters/IDF' },
    displaced: '2,500,000+ (bölgesel)',
    summary: 'ABD ve İsrail ile İran arasındaki doğrudan ve vekil çatışma tüm bölgeyi kapsıyor. İran nükleer programı kritik eşikte, ABD askeri seçenekleri masada. Körfez\'de 5. Filo konuşlu. Husi saldırıları Kızıldeniz ticaretini tehdit ediyor. Bölgesel tırmanma riski son 40 yılın en yüksek seviyesinde.',
    hotspots: [
      { lat: 35.6892, lng: 51.3890, name: 'Tahran — IRGC Merkezi / Nükleer Program', icon: '☢️', severity: 'kritik' },
      { lat: 32.4279, lng: 53.6880, name: 'İran — Balistik Füze Üsleri', icon: '🚀', severity: 'kritik' },
      { lat: 32.0853, lng: 34.7818, name: 'Tel Aviv / IDF Karargâhı', icon: '🎯', severity: 'kritik' },
      { lat: 33.8938, lng: 35.5018, name: 'Beyrut — Hizbullah Merkezi', icon: '💣', severity: 'kritik' },
      { lat: 26.5000, lng: 56.0000, name: 'Hürmüz Boğazı — Küresel Petrol Damarı', icon: '🛢️', severity: 'kritik' },
      { lat: 26.2361, lng: 50.5860, name: 'Bahreyn — ABD 5. Filo Ana Üssü', icon: '⚓', severity: 'yuksek' },
      { lat: 15.3547, lng: 42.6243, name: 'Yemen / Husi — Kızıldeniz Saldırıları', icon: '🚢', severity: 'yuksek' },
      { lat: 33.3152, lng: 44.3661, name: 'Bağdat — Haşdi Şabi / ABD Üsleri', icon: '🏴', severity: 'yuksek' },
      { lat: 31.7683, lng: 35.2137, name: 'Kudüs — Gerilim Merkezi', icon: '⚠️', severity: 'yuksek' },
    ],
    tags: ['Nükleer Risk', 'ABD Askeri Varlığı', 'Hürmüz Krizi Riski', 'Bölgesel Savaş', 'Kızıldeniz Tehdidi', 'Vekil Çatışma', '5. Filo', 'Körfez Gerilimi', 'Trump Baskısı'],
    sources: ['Reuters', 'AP', 'IDF Sözcüsü', 'CENTCOM', 'Al Jazeera', 'Iran International'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'gulf_nuclear',
    name: 'Körfez Gerilimi & İran Nükleer Krizi',
    nameEn: 'Gulf Tensions & Iran Nuclear Crisis',
    region: 'Körfez / İran',
    flag: '🛢️',
    status: 'aktif',
    intensity: 'kritik',
    riskScore: 95,
    startDate: '2018-05-08',
    center: { lat: 27.0, lng: 54.0 },
    bounds: [[22.0, 44.0], [35.0, 65.0]],
    parties: [
      { name: 'ABD / Trump Yönetimi', flag: '🇺🇸', side: 'A', color: '#3b82f6' },
      { name: 'Körfez İşbirliği Konseyi (KİK)', flag: '🇸🇦', side: 'A', color: '#f59e0b' },
      { name: 'İsrail', flag: '🇮🇱', side: 'A', color: '#60a5fa' },
      { name: 'İran / IAEA Engeli', flag: '🇮🇷', side: 'B', color: '#ef4444' },
    ],
    casualties: { total: 'Doğrudan Yok / Potansiyel Çok Yüksek', daily: 'Kriz Seviyesi', source: 'IAEA/Reuters' },
    displaced: 'Potansiyel: 5,000,000-15,000,000',
    summary: 'İran uranyum zenginleştirmesi %60+ seviyesinde, nükleer silah eşiğine yaklaşıyor. IAEA denetimleri büyük ölçüde engelleniyor. ABD ve İsrail askeri saldırı senaryolarını masada tutuyor. Trump yönetiminin "maksimum baskı" politikası yeniden devrede. Hürmüz Boğazı\'nın kapanması küresel petrol arzını %20 azaltır; dünya ekonomisi için varoluşsal tehdit.',
    hotspots: [
      { lat: 26.5000, lng: 56.0000, name: 'Hürmüz Boğazı — Stratejik Boğaz', icon: '🛢️', severity: 'kritik' },
      { lat: 33.7204, lng: 51.8574, name: 'Natanz — Uranyum Zenginleştirme', icon: '☢️', severity: 'kritik' },
      { lat: 34.8892, lng: 48.8428, name: 'Fordo — Yeraltı Nükleer Tesisi', icon: '☢️', severity: 'kritik' },
      { lat: 28.8202, lng: 50.8239, name: 'Busheyr — Nükleer Santral', icon: '⚡', severity: 'yuksek' },
      { lat: 26.2361, lng: 50.5860, name: 'Bahreyn — ABD 5. Filo', icon: '🚢', severity: 'yuksek' },
      { lat: 24.6877, lng: 46.7219, name: 'Riyad — Suudi Savunma', icon: '🛡️', severity: 'yuksek' },
      { lat: 25.2048, lng: 55.2708, name: 'Dubai/BAE — Ekonomik Risk', icon: '🏙️', severity: 'orta' },
    ],
    tags: ['Nükleer Kriz', 'IAEA', 'JCPOA Çöküşü', 'Hürmüz Riski', 'Petrol Güvenliği', 'Trump Maksimum Baskı', 'Nükleer Silahlanma Riski', 'Körfez Güvenliği'],
    sources: ['IAEA', 'Reuters', 'AP', 'CENTCOM', 'Iran International', 'Al Monitor'],
    lastUpdate: new Date().toISOString(),
  },
  {
    id: 'nagorno',
    name: 'Güney Kafkasya Gerilimi',
    nameEn: 'South Caucasus Tensions',
    region: 'Kafkasya',
    flag: '🏔️',
    status: 'donmus',
    intensity: 'dusuk',
    riskScore: 42,
    startDate: '2020-09-27',
    center: { lat: 40.5, lng: 47.0 },
    bounds: [[38.0, 44.0], [42.0, 50.0]],
    parties: [
      { name: 'Azerbaycan', flag: '🇦🇿', side: 'A', color: '#10b981' },
      { name: 'Ermenistan', flag: '🇦🇲', side: 'B', color: '#3b82f6' },
    ],
    casualties: { total: '~7,000+ (2020-2023)', daily: 'Ateşkeste', source: 'ICRC' },
    displaced: '100,000+',
    summary: 'Eylül 2023\'te Azerbaycan\'ın Dağlık Karabağ harekâtıyla Ermeni nüfus bölgeyi terk etti. Barış müzakereleri devam ediyor.',
    hotspots: [
      { lat: 39.8167, lng: 46.7500, name: 'Dağlık Karabağ — Azerbaycan Kontrolü', icon: '🏔️', severity: 'dusuk' },
      { lat: 40.1811, lng: 44.5136, name: 'Erivan — Barış Görüşmeleri', icon: '🕊️', severity: 'dusuk' },
    ],
    tags: ['Donmuş Çatışma', 'Toprak Meselesi', 'Nüfus Transferi', 'Barış Süreci'],
    sources: ['ICRC', 'Reuters', 'OSCE'],
    lastUpdate: new Date().toISOString(),
  },
];

// ── Olay Tiplerine Göre İkonlar ────────────────────────────────────────────────
const EVENT_ICONS = {
  airstrike: '✈️', missile: '🚀', artillery: '💥', ground: '⚔️',
  explosion: '💣', protest: '✊', political: '🏛️', humanitarian: '🏥',
  naval: '⚓', cyber: '💻', drone: '🤖',
};

// ── Dinamik Olay Akışı Üretici ─────────────────────────────────────────────────
function generateRecentEvents(conflicts) {
  // Sahte event üretimi kaldirildi - gercek veriler RSS/NewsAPI'den geliyor
  return [];
}

// ── Global İstatistikler ────────────────────────────────────────────────────────
function buildGlobalStats(conflicts) {
  const aktif    = conflicts.filter(c => c.status === 'aktif').length;
  const donmus   = conflicts.filter(c => c.status === 'donmus').length;
  const izleme   = conflicts.filter(c => c.status === 'izleme').length;
  const kritik   = conflicts.filter(c => c.intensity === 'kritik').length;
  const toplam_displaced = '65,000,000+';

  const highestRisk = [...conflicts].sort((a, b) => b.riskScore - a.riskScore)[0];

  return {
    aktifCatisma: aktif,
    donmusCatisma: donmus,
    izlemeCatisma: izleme,
    kritikYogunluk: kritik,
    toplamCatisma: conflicts.length,
    enYuksekRisk: highestRisk ? { id: highestRisk.id, name: highestRisk.name, score: highestRisk.riskScore } : null,
    toplamGocmen: toplam_displaced,
    guncelleme: new Date().toISOString(),
  };
}

// ── Risk Seviyesi Renk ──────────────────────────────────────────────────────────
function riskColor(score) {
  if (score >= 85) return '#ef4444';
  if (score >= 65) return '#f97316';
  if (score >= 45) return '#f59e0b';
  return '#10b981';
}

function intensityColor(intensity) {
  return { kritik: '#ef4444', yuksek: '#f97316', orta: '#f59e0b', dusuk: '#10b981' }[intensity] || '#6b7280';
}

// ── Service ────────────────────────────────────────────────────────────────────
class ConflictService {
  getAll() {
    const stOrder = { aktif: 0, izleme: 1, donmus: 2 };
    return [...CONFLICTS]
      .sort((a, b) => {
        const sd = (stOrder[a.status] ?? 9) - (stOrder[b.status] ?? 9);
        return sd !== 0 ? sd : b.riskScore - a.riskScore;
      })
      .map(c => ({
        ...c,
        riskColor: riskColor(c.riskScore),
        intensityColor: intensityColor(c.intensity),
      }));
  }

  getById(id) {
    const c = CONFLICTS.find(c => c.id === id);
    if (!c) return null;
    return { ...c, riskColor: riskColor(c.riskScore), intensityColor: intensityColor(c.intensity) };
  }

  getEvents() {
    const cached = cacheService.getSocial('conflict_events');
    if (cached) return cached;
    const events = generateRecentEvents(CONFLICTS);
    cacheService.setSocial('conflict_events', events);
    return events;
  }

  getStats() {
    return buildGlobalStats(CONFLICTS);
  }

  getAllHotspots() {
    const all = [];
    for (const c of CONFLICTS) {
      for (const h of (c.hotspots || [])) {
        all.push({ ...h, conflictId: c.id, conflictName: c.name, conflictFlag: c.flag, intensityColor: intensityColor(c.intensity) });
      }
    }
    return all;
  }
}

module.exports = new ConflictService();
