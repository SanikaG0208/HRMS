import axios from '../config/axios';
import API_ENDPOINTS from '../config/api';

const PROFILE_CACHE_TTL = 30_000;
const profileCache = new Map();

const cacheKey = (employeeId, token) => JSON.stringify([token, employeeId]);

const cloneProfile = (profile) => JSON.parse(JSON.stringify(profile));

export const getSharedEmployeeProfile = (employeeId) => {
  const token = localStorage.getItem('token');
  if (!token || !employeeId) {
    return axios.get(API_ENDPOINTS.EMPLOYEE_PROFILE(employeeId));
  }

  const key = cacheKey(employeeId, token);
  const cached = profileCache.get(key);
  if (cached?.data && cached.expiresAt > Date.now()) {
    return Promise.resolve({ data: cloneProfile(cached.data) });
  }
  if (cached?.request) return cached.request.then(data => ({ data: cloneProfile(data) }));

  for (const [entryKey, entry] of profileCache) {
    if (entry.expiresAt && entry.expiresAt <= Date.now()) profileCache.delete(entryKey);
  }

  const request = axios.get(API_ENDPOINTS.EMPLOYEE_PROFILE(employeeId))
    .then(({ data }) => {
      if (profileCache.get(key)?.request === request) {
        profileCache.set(key, { data: cloneProfile(data), expiresAt: Date.now() + PROFILE_CACHE_TTL });
      }
      return data;
    })
    .catch((error) => {
      if (profileCache.get(key)?.request === request) profileCache.delete(key);
      throw error;
    });

  profileCache.set(key, { request });
  return request.then(data => ({ data: cloneProfile(data) }));
};

export const invalidateSharedEmployeeProfile = (employeeId) => {
  if (employeeId == null) {
    profileCache.clear();
    return;
  }

  for (const key of profileCache.keys()) {
    if (JSON.parse(key)[1] === employeeId) profileCache.delete(key);
  }
};

export const clearSharedEmployeeProfiles = () => profileCache.clear();
