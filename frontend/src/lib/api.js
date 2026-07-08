import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

/** Read token from localStorage (persistent) OR sessionStorage (session-only, cleared on tab close). */
export const getStoredToken = () => localStorage.getItem("af_token") || sessionStorage.getItem("af_token");
export const clearStoredToken = () => {
  localStorage.removeItem("af_token");
  sessionStorage.removeItem("af_token");
};

api.interceptors.request.use((cfg) => {
  const token = getStoredToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      clearStoredToken();
      if (window.location.pathname !== "/auth" && window.location.pathname !== "/") {
        window.location.href = "/auth";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
