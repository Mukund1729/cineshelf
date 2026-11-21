import jwt from 'jsonwebtoken';
import { readCookie, SESSION_COOKIE_NAME } from '../services/authSession.js';

/** Attaches req.user when a valid session exists; never blocks anonymous access. */
const optionalAuth = (req, res, next) => {
  const cookieToken = readCookie(req, SESSION_COOKIE_NAME);
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.userId) req.user = { id: decoded.userId };
  } catch {
    // Ignore invalid tokens for public community browsing.
  }
  return next();
};

export default optionalAuth;
