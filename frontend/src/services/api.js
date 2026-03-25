import axios from 'axios';
import { useAuthStore } from '../store/authStore';

function resolveApiBase() {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '/api';
    }
  }
  return '/api';
}

const API_HOST = resolveApiBase();
const API_URL = API_HOST.endsWith('/api') ? API_HOST : `${API_HOST}/api`;

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const lang = localStorage.getItem('i18nextLng') || 'en';
  config.headers['X-Language'] = lang;
  return config;
}, err => Promise.reject(err));

let isRefreshing = false;
let failedQueue = [];
function processQueue(error, token = null) {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
}

api.interceptors.response.use(res => res, async err => {
  const orig = err.config || {};
  if (!err.response && err.code === 'ECONNABORTED') {
    window.alert('Backend timed out. Please verify your API server is running.');
    return Promise.reject(err);
  }
  if (!err.response) {
    window.alert('Cannot reach backend. Check server status at http://localhost:5000 (or configured API URL).');
    return Promise.reject(err);
  }
  if (err.response?.status === 401 && !orig._retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then(token => { orig.headers.Authorization = `Bearer ${token}`; return api(orig); });
    }
    orig._retry = true; isRefreshing = true;
    const { refreshToken, logout, updateTokens, user } = useAuthStore.getState();
    if (!refreshToken) { logout(); window.location.href = '/#/login'; return Promise.reject(err); }
    try {
      const res = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken, role: user?.role });
      const { accessToken: na, refreshToken: nr } = res.data.data;
      updateTokens(na, nr);
      processQueue(null, na);
      orig.headers.Authorization = `Bearer ${na}`;
      return api(orig);
    } catch (e) { processQueue(e); logout(); window.location.href = '/#/login'; return Promise.reject(e); }
    finally { isRefreshing = false; }
  }
  return Promise.reject(err);
});

export default api;
