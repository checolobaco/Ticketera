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
