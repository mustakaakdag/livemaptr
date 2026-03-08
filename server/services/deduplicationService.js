const logger = require('../utils/logger');

class DeduplicationService {
  constructor() {
    this.seenHashes = new Set();
    this.seenUrls = new Set();
    setInterval(() => {
      const n = this.seenHashes.size;
      this.seenHashes.clear();
      this.seenUrls.clear();
      logger.info(`Dedup cache temizlendi: ${n} hash`);
    }, 24 * 60 * 60 * 1000);
  }

  _norm(t) {
    return (t || '').toLowerCase().replace(/[^a-z0-9ğüşıöçÇÖŞİÜĞ\s]/gi, '').replace(/\s+/g, ' ').trim().substring(0, 150);
  }

  _hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) + h) + s.charCodeAt(i); h |= 0; }
    return h.toString(36);
  }

  _sim(a, b) {
    if (!a || !b) return 0;
    const sa = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const sb = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (!sa.size || !sb.size) return 0;
    const inter = [...sa].filter(w => sb.has(w)).length;
    return inter / (sa.size + sb.size - inter);
  }

  filterDuplicates(items, threshold = 0.72) {
    const unique = [];
    const seenTitles = [];
    for (const item of items) {
      const title = item.title || '';
      if (item.url && this.seenUrls.has(item.url)) continue;
      const nh = this._hash(this._norm(title));
      if (this.seenHashes.has(nh)) continue;
      if (seenTitles.some(s => this._sim(title, s) >= threshold)) continue;
      unique.push(item);
      seenTitles.push(title);
      if (item.url) this.seenUrls.add(item.url);
      if (nh) this.seenHashes.add(nh);
    }
    const removed = items.length - unique.length;
    if (removed > 0) logger.debug(`Dedup: ${removed} tekrar filtrelendi (${items.length} → ${unique.length})`);
    return unique;
  }

  getStats() { return { seenHashes: this.seenHashes.size, seenUrls: this.seenUrls.size }; }
}

module.exports = new DeduplicationService();
