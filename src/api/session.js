export function hasAuthSession() {
  if (localStorage.getItem('token')) return true;
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return Boolean(user && typeof user === 'object' && user._id);
  } catch {
    return false;
  }
}
