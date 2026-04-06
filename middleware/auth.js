const userRepository = require('../repositories/userRepository');

function sessionUserId(req) {
  return userRepository.normalizeUserId(req.session?.userId);
}

function requireAuth(req, res, next) {
  const uid = sessionUserId(req);
  if (req.session && uid) {
    userRepository.findById(uid)
      .then(user => {
        if (user && user.isActive) {
          req.user = user;
          next();
        } else {
          req.session.destroy();
          if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ error: 'Please log in to continue' });
          }
          res.redirect('/login');
        }
      })
      .catch(err => {
        console.error('Auth middleware error:', err);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(500).json({ error: 'Authentication error' });
        }
        res.redirect('/login');
      });
  } else {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Please log in to continue' });
    }
    res.redirect('/login');
  }
}

function apiAuth(req, res, next) {
  const uid = sessionUserId(req);
  if (req.session && uid) {
    userRepository.findById(uid)
      .then(user => {
        if (user && user.isActive) {
          req.user = user;
          next();
        } else {
          req.session.destroy();
          res.status(401).json({ error: 'Please log in to continue' });
        }
      })
      .catch(err => {
        console.error('API auth middleware error:', err);
        res.status(500).json({ error: 'Authentication error' });
      });
  } else {
    res.status(401).json({ error: 'Please log in to continue' });
  }
}

function optionalAuth(req, res, next) {
  const uid = sessionUserId(req);
  if (req.session && uid) {
    userRepository.findById(uid)
      .then(user => {
        if (user && user.isActive) {
          req.user = user;
        }
        next();
      })
      .catch(err => {
        console.error('Optional auth middleware error:', err);
        next();
      });
  } else {
    next();
  }
}

function guestOnly(req, res, next) {
  if (req.session && sessionUserId(req)) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ error: 'Already logged in' });
    }
    return res.redirect('/');
  }
  next();
}

module.exports = {
  requireAuth,
  apiAuth,
  optionalAuth,
  guestOnly
};
