const acledService = require('../services/acledService');

exports.getEvents = async (req, res) => {
  try {
    const events = await acledService.fetchEvents();
    const { conflictId, severity, limit=100 } = req.query;
    let data = events;
    if (conflictId) data = data.filter(e => e.conflictId === conflictId);
    if (severity)   data = data.filter(e => e.severity === severity);
    res.json({ ok:true, count:data.length, data:data.slice(0, parseInt(limit)) });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};

exports.getStats  = async (req, res) => {
  try { await acledService.fetchEvents(); res.json({ ok:true, data:acledService.getStats() }); }
  catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};

exports.getStatus = (req, res) => {
  res.json({ ok:true, enabled:acledService.isEnabled, stats:acledService.getStats() });
};

exports.getByConflict = async (req, res) => {
  try {
    await acledService.fetchEvents();
    res.json({ ok:true, data:acledService.getByConflict(req.params.id) });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
};
