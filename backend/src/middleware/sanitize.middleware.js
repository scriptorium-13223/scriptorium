const xss = require('xss');

// Recursively walk req.body and strip any HTML/script injection from string values.
// Protects the customer note field, name, address fields, etc. from stored XSS
// (relevant because order details get rendered in Telegram messages and, optionally, the admin panel).
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return xss(value.trim(), { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] });
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const cleaned = {};
    for (const key of Object.keys(value)) {
      cleaned[key] = sanitizeValue(value[key]);
    }
    return cleaned;
  }
  return value;
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}

module.exports = { sanitizeBody };
