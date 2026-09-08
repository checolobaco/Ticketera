import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

// 1. Instancia PRIVADA (Para el Dashboard, requiere Token)
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000
})

api.defaults.headers.common['ngrok-skip-browser-warning'] = 'true'

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/api/auth/')) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return api(originalRequest);
          }).catch(err => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
          const newAccessToken = res.data.accessToken || res.data.token;
          if (newAccessToken) {
            localStorage.setItem('token', newAccessToken);
            if (res.data.refreshToken) {
              localStorage.setItem('refreshToken', res.data.refreshToken);
            }
            api.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;
            originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
            processQueue(null, newAccessToken);
            return api(originalRequest);
          }
        } catch (refreshErr) {
          processQueue(refreshErr, null);
        } finally {
          isRefreshing = false;
        }
      }
    }
    return Promise.reject(error);
  }
);

// 2. Instancia PÚBLICA (Para Landings, Eventos compartidos, QR/NFC públicos)
// Al no tener interceptor, Vercel puede cachear estas respuestas sin problemas
export const publicApi = axios.create({
  baseURL: API_URL,
  timeout: 30000
})
publicApi.defaults.headers.common['ngrok-skip-browser-warning'] = 'true'

// Función corregida usando la URL base y la instancia pública limpia
export async function getSharedEventBySlug(slug) {
  const { data } = await publicApi.get(`/api/events/share/${slug}`)
  return data
}

export default api


/*
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000
})

api.defaults.headers.common['ngrok-skip-browser-warning'] = 'true'

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export async function getSharedEventBySlug(slug) {
  const { data } = await axios.get(`${API_URL}/api/events/share/${slug}`);
  return data;
}

export default api
*/
