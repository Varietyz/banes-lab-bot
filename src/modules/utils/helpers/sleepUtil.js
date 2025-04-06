async function sleep(ms) {
  if (typeof ms !== 'number' || ms < 0) {
    throw new TypeError(
      '🚨 **Invalid Parameter:** The `ms` parameter must be a non-negative number.'
    );
  }
  return new Promise(resolve => setTimeout(resolve, ms));
}
module.exports = {
  sleep
};
