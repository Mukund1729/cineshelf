import jwt from 'jsonwebtoken';

export const SESSION_COOKIE_NAME = 'vc_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export function readCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || '/api'}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join('; ');
}

export function setSessionCookie(req, res, token) {
  const secure = process.env.NODE_ENV === 'production' || req.secure;
  res.append('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, token, {
    path: '/api',
    maxAge: SESSION_TTL_SECONDS,
    httpOnly: true,
    secure,
    sameSite: secure ? 'None' : 'Lax',
  }));
}

export function clearSessionCookie(req, res) {
  const secure = process.env.NODE_ENV === 'production' || req.secure;
  res.append('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, '', {
    path: '/api',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    secure,
    sameSite: secure ? 'None' : 'Lax',
  }));
}

export function issueSessionToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}
