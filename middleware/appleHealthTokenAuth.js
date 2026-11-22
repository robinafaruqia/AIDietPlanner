const {
  findUserByAppleHealthToken
} = require('../services/appleHealthService');

function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers['x-apple-health-token'];
  if (header && typeof header === 'string') {
    if (header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }
    return header.trim();
  }
  if (req.body?.syncToken) {
    return String(req.body.syncToken).trim();
  }
  return null;
}

async function appleHealthTokenAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing Apple Health sync token' });
    }

    const user = await findUserByAppleHealthToken(token);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired sync token' });
    }

    if (!user.biometricConnections?.appleHealth?.connected) {
      return res.status(403).json({ success: false, error: 'Apple Health is not connected for this account' });
    }

    req.user = user;
    req.appleHealthSyncToken = token;
    next();
  } catch (error) {
    console.error('Apple Health token auth error:', error);
    res.status(500).json({ success: false, error: 'Authentication error' });
  }
}

module.exports = { appleHealthTokenAuth, extractBearerToken };