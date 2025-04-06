// middleware/webSanitizer.js
const validator = require("validator");

function sanitizeRecursive(data) {
  if (typeof data === "string") {
    return validator.escape(data);
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeRecursive);
  }
  if (typeof data === "object" && data !== null) {
    const sanitizedObj = {};
    for (const key in data) {
      if (Object.hasOwnProperty.call(data, key)) {
        sanitizedObj[key] = sanitizeRecursive(data[key]);
      }
    }
    return sanitizedObj;
  }
  return data;
}

function webSanitizer(req, res, next) {
  if (req.body) req.body = sanitizeRecursive(req.body);
  if (req.query) req.query = sanitizeRecursive(req.query);
  if (req.params) req.params = sanitizeRecursive(req.params);
  next();
}

module.exports = { webSanitizer };
