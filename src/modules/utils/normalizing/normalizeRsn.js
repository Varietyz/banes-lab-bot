function normalizeRsn(rsn) {
  if (typeof rsn !== 'string') {
    return '';
  }
  return rsn.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
module.exports = { normalizeRsn };
