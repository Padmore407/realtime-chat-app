import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Restore the session from a saved token on page load.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user: current }) => setUser(current))
      .catch(clearSession)
      .finally(() => setLoading(false));
  }, [clearSession]);

  const value = useMemo(() => {
    const authenticate = async (request) => {
      const { token, user: current } = await request;
      tokenStore.set(token);
      setUser(current);
    };
    return {
      user,
      loading,
      login: (credentials) => authenticate(api.login(credentials)),
      register: (details) => authenticate(api.register(details)),
      logout: () => {
        api.logout().catch(() => {});
        clearSession();
      },
      clearSession,
    };
  }, [user, loading, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
