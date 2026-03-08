/**
 * LiveMapTR - Canlı Yayın Video Servisi
 * Aktif canlı yayın kanallarını ve embed URL'lerini yönetir.
 */
const config = require('../config');

class VideoService {
  /**
   * Aktif canlı yayınları döner.
   */
  getActiveStreams() {
    return config.liveStreams
      .filter((s) => s.active)
      .map((stream) => ({
        id: stream.id,
        name: stream.name,
        logo: stream.logo,
        embedUrl: stream.embedUrl,
        aktif: true,
        tip: 'canli-yayin',
      }));
  }

  /**
   * Belirli bir yayını döner.
   */
  getStream(id) {
    return config.liveStreams.find((s) => s.id === id && s.active) || null;
  }
}

module.exports = new VideoService();
