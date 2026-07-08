import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";

const AuthCtx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("af_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch {
      localStorage.removeItem("af_token");
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Heartbeat: ping every 60s while logged in
  useEffect(() => {
    if (!user) return;
    const ping = () => { api.post("/auth/heartbeat").catch(() => {}); };
    ping();
    const id = setInterval(ping, 60000);
    return () => clearInterval(id);
  }, [user]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("af_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    // If backend requires email verification, do NOT auto-login. Return the pending state.
    if (data?.email_verification_required) {
      return { pendingVerification: true, email: data.email, message: data.message };
    }
    if (data?.token) {
      localStorage.setItem("af_token", data.token);
      setUser(data.user);
      return data.user;
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem("af_token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
