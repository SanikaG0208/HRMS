import { dashboardGet } from './dashboardGet';
import API_ENDPOINTS from '../config/api';

const CACHE_TTL_MS = 10000;
let cachedToken = null;
let cachedRequest = null;
let cachedAt = 0;

export function getSharedTickets() {
  const token = localStorage.getItem('token');
  if (cachedToken !== token) {
    cachedToken = token;
    cachedRequest = null;
    cachedAt = 0;
  } else if (cachedRequest && cachedAt && Date.now() - cachedAt >= CACHE_TTL_MS) {
    cachedRequest = null;
    cachedAt = 0;
  }

  if (!cachedRequest) {
    const request = dashboardGet(API_ENDPOINTS.TICKETS).then(response => {
      if (cachedRequest === request) cachedAt = Date.now();
      return response.data?.tickets || [];
    });
    cachedRequest = request;
    request.catch(() => {
      if (cachedRequest === request) {
        cachedRequest = null;
        cachedAt = 0;
      }
    });
  }

  return cachedRequest.then(tickets => structuredClone(tickets));
}

export function invalidateSharedTickets() {
  cachedToken = localStorage.getItem('token');
  cachedRequest = null;
  cachedAt = 0;
  window.dispatchEvent(new Event('hrms:tickets-changed'));
}
