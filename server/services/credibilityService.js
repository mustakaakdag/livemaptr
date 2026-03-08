const SOURCE_SCORES = {
  'BBC Türkçe': 92, 'TRT Haber': 88, 'Anadolu Ajansı': 87, 'Bloomberg HT': 88,
  'NTV': 85, 'Habertürk': 82, 'Euronews TR': 83, 'Hürriyet': 80,
  'Cumhuriyet': 80, 'Sabah': 78, 'CNN Türk': 80, 'Para Analiz': 75,
  'Milliyet': 79, 'Reuters': 92, 'AP': 91,
};

const SPAM = [/tıkla\s*kazan/i, /ücretsiz\s*iphone/i, /reklam/i, /sponsored/i];

class CredibilityService {
  calculate(item) {
    let score = 50;
    const srcScore = SOURCE_SCORES[item.source] || item.sourceCredibility || 50;
    score = Math.round(score * 0.3 + srcScore * 0.7);

    const text = `${item.title || ''} ${item.content || ''}`;
    if (/son\s*dakika|flaş|acil/i.test(text)) score += 5;
    if ((item.content || '').length > 100) score += 3;
    if (SPAM.some(p => p.test(text))) score = Math.min(score, 20);

    const age = (Date.now() - new Date(item.publishedAt || 0)) / 3600000;
    if (age < 1) score += 5;
    else if (age > 12) score -= 8;
    else if (age > 6) score -= 3;

    const tlen = (item.title || '').length;
    if (tlen < 10) score -= 15;

    score = Math.max(0, Math.min(100, score));
    return {
      score,
      level: score >= 85 ? 'yuksek' : score >= 60 ? 'orta' : score >= 30 ? 'dusuk' : 'cok_dusuk',
      label: score >= 85 ? 'Doğrulandı' : score >= 60 ? 'Güvenilir' : score >= 30 ? 'Dikkatli' : 'Şüpheli',
      color: score >= 85 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 30 ? '#f59e0b' : '#ef4444',
    };
  }

  scoreAll(items) { return items.map(i => ({ ...i, credibility: this.calculate(i) })); }
}

module.exports = new CredibilityService();
