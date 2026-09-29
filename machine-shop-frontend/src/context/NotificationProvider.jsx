import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from './AuthProvider';
import socket from '../api/socket';

const NotificationContext = createContext();
const MAX_NOTIFICATIONS = 100;

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useContext(AuthContext);
  const [hydrated, setHydrated] = useState(false);

  // Cargar notificaciones del localStorage al montar
  useEffect(() => {
    if (!user) return;
    try {
      const stored = localStorage.getItem(`notifications_${user.noEmp}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed.notifications || []);
        setUnreadCount(parsed.unreadCount || 0);
      }
    } catch (e) {
      console.warn('Error cargando notificaciones:', e);
    } finally {
      setHydrated(true);
    }
  }, [user]);

  // Guardar en localStorage cuando cambien
  useEffect(() => {
    if (!user || !hydrated) return;
    try {
      localStorage.setItem(`notifications_${user.noEmp}`, JSON.stringify({
        notifications,
        unreadCount
      }));
    } catch (e) {
      console.warn('Error guardando notificaciones:', e);
    }
  }, [notifications, unreadCount, user, hydrated]);

  // Escuchar notificaciones del socket
  useEffect(() => {
    if (!user || !hydrated) return;

    const handleNotification = (data) => {
      console.log('🔔 Notificación recibida:', data);

      // Admins: reciben TODAS las notificaciones (propias y ajenas)
      const isAdmin = Number(user?.rolId) === 1;
      if (!isAdmin) {
        const me = String(user.noEmp);
        // Dirigida explícitamente a otro usuario: ignorar
        if (data.targetUserId && String(data.targetUserId) !== me) {
          return;
        }
        // Solo mostrar eventos de SUS tickets: solicitante o lista de dueños
        const sol = data.solicitanteId;
        const lista = Array.isArray(data.userIds) ? data.userIds.map(String) : [];
        const esMio = (sol !== null && sol !== undefined && String(sol) === me) || lista.includes(me);
        const tieneRef = data.ticketId || data.noParte || data.bloqueId || data.blockId
          || data.dibujoId || data.programaId || data.ensembleId
          || data.IdDibujo || data.IdPrograma || data.IdEnsamble
          || sol !== null && sol !== undefined || lista.length > 0;
        if (tieneRef && !esMio) return; // Evento de tickets ajenos: ignorar
        if (!tieneRef && String(data.targetUserId) !== me) return; // Sin referencia y no dirigido a mí: ignorar
      }

      const notification = {
        id: Date.now() + Math.random(),
        ...data,
        read: false,
        timestamp: data.timestamp || new Date().toISOString()
      };

      setNotifications(prev => [notification, ...prev].slice(0, MAX_NOTIFICATIONS));
      setUnreadCount(prev => prev + 1);
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [user, hydrated]);

  const markAsRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearNotification = useCallback((id) => {
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id);
      if (notif && !notif.read) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotification,
      clearAll
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};