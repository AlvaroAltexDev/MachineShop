import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUserFromToken = () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const userData = {
          noEmp: decoded.NoEmpleado,
          nombre: decoded.Nombre,
          correo: decoded.Correo,
          areaId: decoded.AreaId,
          rolId: decoded.RolId
        };
        setUser(userData);
        return userData;
      } catch (error) {
        console.error('Invalid token:', error);
        localStorage.removeItem('token');
        setUser(null);
        return null;
      }
    } else {
      setUser(null);
      return null;
    }
  };
  // CARGA INICIAL
  useEffect(() => {
    loadUserFromToken();
    setLoading(false);
  }, []);

  // LOGIN
  const login = (token) => {
    localStorage.setItem("token", token);
    return loadUserFromToken();
  };

  // LOGOUT
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, login, logout, loading, loadUserFromToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};