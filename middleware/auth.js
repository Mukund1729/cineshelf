import jwt from 'jsonwebtoken';
import {
  readCookie,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from '../services/authSession.js';

const auth = (req, res, next) => {
  const cookieToken = readCookie(req, SESSION_COOKIE_NAME);
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.userId) throw new Error('Invalid session payload');
    req.user = { id: decoded.userId };
    if (!cookieToken && bearerToken) setSessionCookie(req, res, bearerToken);
    next();
  } catch {
    return res.status(401).json({ error: 'Session is not valid' });
  }
};

export default auth;
