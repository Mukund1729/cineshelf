import axios from 'axios';
import { hasAuthSession } from './session';

export function communityAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function requireCommunityAuth() {
  if (hasAuthSession()) return true;
  window.dispatchEvent(new CustomEvent('open-auth-modal'));
  return false;
}

export async function fetchCommunityHome() {
  const { data } = await axios.get('/api/community/home', {
    headers: communityAuthHeaders(),
    withCredentials: true,
  });
  return data;
}

export async function fetchCommunityFeed(filter = 'latest', page = 1) {
  const { data } = await axios.get('/api/community/feed', {
    params: { filter, page, limit: 20 },
    headers: communityAuthHeaders(),
    withCredentials: true,
  });
  return data;
}

export async function fetchCommunitySpotlight() {
  const { data } = await axios.get('/api/community/spotlight', {
    headers: communityAuthHeaders(),
    withCredentials: true,
  });
  return data;
}

export async function joinCommunity(slug) {
  if (!requireCommunityAuth()) return null;
  const { data } = await axios.post(`/api/community/${slug}/join`, {}, {
    headers: communityAuthHeaders(),
    withCredentials: true,
  });
  return data;
}

export async function leaveCommunity(slug) {
  if (!requireCommunityAuth()) return null;
  const { data } = await axios.post(`/api/community/${slug}/leave`, {}, {
    headers: communityAuthHeaders(),
    withCredentials: true,
  });
  return data;
}

export async function reactToPost(postId, reaction) {
  if (!requireCommunityAuth()) return null;
  const { data } = await axios.post(`/api/community/posts/${postId}/react`, { reaction }, {
    headers: communityAuthHeaders(),
    withCredentials: true,
  });
  return data;
}

export async function toggleBookmark(postId) {
  if (!requireCommunityAuth()) return null;
  const { data } = await axios.post(`/api/community/posts/${postId}/bookmark`, {}, {
    headers: communityAuthHeaders(),
    withCredentials: true,
  });
  return data;
}

export async function votePoll(postId, optionId) {
  if (!requireCommunityAuth()) return null;
  const { data } = await axios.post(`/api/community/posts/${postId}/vote`, { optionId }, {
    headers: communityAuthHeaders(),
    withCredentials: true,
  });
  return data;
}

/* ── Setup, settings and management ─────────────────────────────────── */

function requestConfig(extra = {}) {
  return { headers: communityAuthHeaders(), withCredentials: true, ...extra };
}

// Discovery: search plus category / topic filters. Private communities are
// excluded by the API.
export async function fetchCommunityList({ q = '', category = '', topic = '', page = 1, limit = 12 } = {}, signal) {
  const params = { page, limit };
  if (q) params.q = q;
  if (category) params.category = category;
  if (topic) params.topic = topic;
  const { data } = await axios.get('/api/community/list', requestConfig({ params, signal }));
  return data;
}

export async function fetchCommunityDetail(slug) {
  const { data } = await axios.get(`/api/community/${slug}`, requestConfig());
  return data;
}

export async function checkCommunityAvailability({ slug = '', name = '' }, signal) {
  const params = {};
  if (slug) params.slug = slug;
  if (name) params.name = name;
  const { data } = await axios.get('/api/community/check-slug', requestConfig({ params, signal }));
  return data;
}

export async function createCommunity(payload) {
  const { data } = await axios.post('/api/community', payload, requestConfig());
  return data;
}

export async function updateCommunity(slug, changes) {
  const { data } = await axios.patch(`/api/community/${slug}`, changes, requestConfig());
  return data;
}

export async function uploadCommunityImage(slug, kind, file) {
  const body = new FormData();
  body.append('image', file);
  const { data } = await axios.post(`/api/community/${slug}/image/${kind}`, body, requestConfig());
  return data;
}

export async function removeCommunityImage(slug, kind) {
  const { data } = await axios.delete(`/api/community/${slug}/image/${kind}`, requestConfig());
  return data;
}

export async function fetchCommunityMembers(slug, status = 'active') {
  const { data } = await axios.get(`/api/community/${slug}/members`, requestConfig({ params: { status, limit: 100 } }));
  return data;
}

export async function updateCommunityMember(slug, userId, action) {
  const { data } = await axios.patch(`/api/community/${slug}/members/${userId}`, { action }, requestConfig());
  return data;
}

export async function togglePinPost(postId) {
  const { data } = await axios.post(`/api/community/posts/${postId}/pin`, {}, requestConfig());
  return data;
}

export async function toggleLockPost(postId) {
  const { data } = await axios.post(`/api/community/posts/${postId}/lock`, {}, requestConfig());
  return data;
}

export async function deleteCommunityPost(postId) {
  const { data } = await axios.delete(`/api/community/posts/${postId}`, requestConfig());
  return data;
}
