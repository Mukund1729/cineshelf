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
