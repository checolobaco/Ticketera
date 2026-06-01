import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

// 1. Instancia PRIVADA (Para el Dashboard, requiere Token)
const api = axios.create({
  baseURL: API_URL,
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

// 2. Instancia PÚBLICA (Para Landings, Eventos compartidos, QR/NFC públicos)
// Al no tener interceptor, Vercel puede cachear estas respuestas sin problemas
export const publicApi = axios.create({
  baseURL: API_URL,
  timeout: 10000
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
