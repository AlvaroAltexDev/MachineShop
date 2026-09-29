import React, { useState, useEffect, useContext } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthProvider';
import { useNotifications } from '../context/NotificationProvider';
import api from '../api/api';
import { showToast } from 'nextjs-toast-notify';
import { useNavigate } from 'react-router-dom';
import {
    FiBell, FiX, FiCheck, FiFilter, FiTrash2, FiClock, FiUser,
    FiMail, FiCheckCircle, FiAlertCircle, FiPackage, FiBox,
    FiChevronLeft, FiChevronRight, FiDownload, FiEye, FiLink, FiFile
} from "react-icons/fi";

export const NotificationsHistoryPage = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotifications();

    const [filteredNotifications, setFilteredNotifications] = useState([]);
    const [filter, setFilter] = useState('all'); // all, unread, read
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 20;

    // Cargar notificaciones al montar y cuando cambien filtros o llegue el usuario.
    // (user en deps: si se entra directo/refresh, el primer render aún no tiene user
    // y sin esto la lista quedaba vacía para siempre hasta cambiar filtro/página)
    const userEmp = user?.noEmp;
    useEffect(() => {
        loadNotifications();
        loadUnreadCount();
    }, [filter, currentPage, userEmp]);

    const loadNotifications = async () => {
        if (!user?.noEmp) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                usuarioId: user.noEmp,
                limite: itemsPerPage,
                offset: (currentPage - 1) * itemsPerPage
            });
            if (filter !== 'all') {
                params.append('leida', filter === 'unread' ? 'false' : 'true');
            }

            const response = await api.get(`/notificaciones/historial?${params.toString()}`);
            setFilteredNotifications(response.data || []);
            
            // Para total count, hacer otra llamada sin límite
            // Nota: el backend no devuelve count total, así que estimamos
            setTotalCount(response.data?.length || 0);
            setTotalPages(Math.ceil((response.data?.length || 0) / itemsPerPage));
        } catch (error) {
            console.error('Error cargando notificaciones:', error);
            showToast.error('Error loading notifications', { duration: 3000, position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    const loadUnreadCount = async () => {
        if (!user?.noEmp) return;
        try {
            const response = await api.get(`/notificaciones/no-leidas?usuarioId=${user.noEmp}`);
            // El context ya maneja esto via socket, pero podemos sincronizar
        } catch (error) {
            console.error('Error cargando count:', error);
        }
    };

    const handleMarkAsRead = async (id) => {
        if (!user?.noEmp) return;
        try {
            await api.put(`/notificaciones/marcar-leida/${id}`, { usuarioId: user.noEmp });
            markAsRead(id);
        } catch (error) {
            console.error('Error marcando como leída:', error);
            showToast.error('Error marking as read', { duration: 3000, position: "top-right" });
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!user?.noEmp) return;
        try {
            await api.put('/notificaciones/marcar-todas-leidas', { usuarioId: user.noEmp });
            markAllAsRead();
            showToast.success('All marked as read', { duration: 3000, position: "top-right" });
            loadNotifications();
        } catch (error) {
            console.error('Error marcando todas:', error);
            showToast.error('Error marking all', { duration: 3000, position: "top-right" });
        }
    };

    const handleClearAll = async () => {
        if (!user?.noEmp) return;
        const confirmed = window.confirm('Delete all read notifications?');
        if (!confirmed) return;
        try {
            await api.delete(`/notificaciones/limpiar-leidas?usuarioId=${user.noEmp}&diasAntiguedad=0`);
            clearAll();
            showToast.success('Read notifications deleted', { duration: 3000, position: "top-right" });
            loadNotifications();
        } catch (error) {
            console.error('Error limpiando:', error);
            showToast.error('Error clearing', { duration: 3000, position: "top-right" });
        }
    };

    const handleNotificationClick = (notif) => {
        // Marcar como leída si no lo está
        if (!notif.Leida) {
            handleMarkAsRead(notif.IdNotificacion);
        }
        
        // Navegar a la entidad relacionada
        const refTipo = notif.ReferenciaTipo;
        const refId = notif.ReferenciaId;

        switch (refTipo) {
            case 'ticket':
                if (refId) {
                    navigate(`/tickets?view=${refId}`);
                }
                break;
            case 'bloque':
                if (refId) {
                    sessionStorage.setItem("selectedBlockId", refId);
                    navigate("/blocksdetails");
                }
                break;
            case 'dibujo':
            case 'programa':
            case 'ensamble':
                if (refId) {
                    sessionStorage.setItem("selectedBlockId", notif.BloqueId || refId);
                    navigate("/blocksdetails");
                }
                break;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'ticket_created': return <FiMail style={{ color: '#2ecc71' }} />;
            case 'ticket_updated': return <FiMail style={{ color: '#3498db' }} />;
            case 'ticket_completed': return <FiCheckCircle style={{ color: '#27ae60' }} />;
            case 'ticket_trashed': return <FiAlertCircle style={{ color: '#f39c12' }} />;
            case 'ticket_deleted': return <FiAlertCircle style={{ color: '#e74c3c' }} />;
            case 'block_created': return <FiPackage style={{ color: '#9b59b6' }} />;
            case 'block_updated': return <FiPackage style={{ color: '#8e44ad' }} />;
            case 'block_deleted': return <FiPackage style={{ color: '#c0392b' }} />;
            case 'drawing_deleted': return <FiFile style={{ color: '#e67e22' }} />;
            case 'program_deleted': return <FiFile style={{ color: '#e67e22' }} />;
            case 'ensemble_deleted': return <FiBox style={{ color: '#e67e22' }} />;
            case 'drawing_created': return <FiFile style={{ color: '#2ecc71' }} />;
            case 'program_created': return <FiFile style={{ color: '#2ecc71' }} />;
            case 'ensemble_created': return <FiBox style={{ color: '#2ecc71' }} />;
            default: return <FiBell />;
        }
    };

    const getTypeLabel = (type) => {
        const labels = {
            'ticket_created': 'Ticket Created',
            'ticket_updated': 'Ticket Updated',
            'ticket_completed': 'Ticket Completed',
            'ticket_trashed': 'Ticket Trashed',
            'ticket_deleted': 'Ticket Deleted',
            'block_created': 'Block Created',
            'block_updated': 'Block Updated',
            'block_deleted': 'Block Deleted',
            'drawing_deleted': 'Drawing Deleted',
            'program_deleted': 'Program Deleted',
            'ensemble_deleted': 'Ensemble Deleted',
            'drawing_created': 'Drawing Added',
            'program_created': 'Program Added',
            'ensemble_created': 'Ensemble Added',
        };
        return labels[type] || type;
    };

    const getTypeColor = (type) => {
        if (type.includes('created')) return '#2ecc71';
        if (type.includes('updated')) return '#3498db';
        if (type.includes('completed')) return '#27ae60';
        if (type.includes('trashed')) return '#f39c12';
        if (type.includes('deleted')) return '#e74c3c';
        return '#95a5a6';
    };

    const isAdmin = Number(user?.rolId) === 1;

    if (loading && filteredNotifications.length === 0) {
        return (
            <>
                <Navbar />
                {isAdmin && <Sidebar />}
                <div className={`page-container ${!isAdmin ? 'full-width' : ''}`}>
                    <div className="loading-dashboard">Loading history...</div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            {isAdmin && <Sidebar />}
            <div className={`page-container ${!isAdmin ? 'full-width' : ''}`}>
                {/* HEADER MEJORADO */}
                <div className="notifications-header-modern">
                    <div className="header-main">
                        <div className="header-icon-wrapper">
                            <FiBell className="header-icon" />
                        </div>
                        <div className="header-text">
                            <h1 className="header-title">Notification History</h1>
                            <p className="header-subtitle">Manage and review all system activity</p>
                        </div>
                    </div>
                    
                    <div className="header-stats">
                        <div className="stat-card total">
                            <span className="stat-number">{totalCount}</span>
                            <span className="stat-label">Total</span>
                        </div>
                        <div className="stat-card unread">
                            <span className="stat-number">{unreadCount}</span>
                            <span className="stat-label">Unread</span>
                        </div>
                        <div className="stat-card read">
                            <span className="stat-number">{totalCount - unreadCount}</span>
                            <span className="stat-label">Read</span>
                        </div>
                    </div>

                    <div className="header-actions">
                        <button 
                            className={`btn-mark-all ${unreadCount === 0 ? 'disabled' : ''}`}
                            onClick={handleMarkAllAsRead}
                            disabled={unreadCount === 0}
                            title={unreadCount === 0 ? 'No unread notifications' : `Mark ${unreadCount} as read`}
                        >
                            <FiCheckCircle />
                            <span>Mark all as read</span>
                            {unreadCount > 0 && (
                                <span className="btn-badge">{unreadCount}</span>
                            )}
                        </button>
                        <button className="btn-clear" onClick={handleClearAll} title="Delete read notifications">
                            <FiTrash2 />
                            <span>Clear read</span>
                        </button>
                    </div>
                </div>

                {/* FILTERS */}
                <div className="filters-bar">
                    <div className="filter-tabs">
                        <button 
                            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => { setFilter('all'); setCurrentPage(1); }}
                        >
                            <FiBell /> All
                            <span className="tab-count">{totalCount}</span>
                        </button>
                        <button 
                            className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
                            onClick={() => { setFilter('unread'); setCurrentPage(1); }}
                        >
                            <FiMail /> Unread
                            <span className="tab-count">{unreadCount}</span>
                        </button>
                        <button 
                            className={`filter-tab ${filter === 'read' ? 'active' : ''}`}
                            onClick={() => { setFilter('read'); setCurrentPage(1); }}
                        >
                            <FiCheckCircle /> Read
                        </button>
                    </div>
                </div>

                {/* NOTIFICATIONS LIST */}
                <div className="notifications-container">
                    {loading && filteredNotifications.length === 0 ? (
                        <div className="loading-dashboard">Loading notifications...</div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="empty-state">
                            <FiBell size={48} />
                            <h3>No notifications</h3>
                            <p>{filter === 'unread' ? 'All read! 🎉' : 'No notifications in this filter'}</p>
                        </div>
                    ) : (
                        <>
                            <div className="notifications-list">
                                {filteredNotifications.map((notif) => (
                                    <div 
                                        key={notif.IdNotificacion}
                                        className={`notification-item ${!notif.Leida ? 'unread' : ''}`}
                                        onClick={() => handleNotificationClick(notif)}
                                    >
                                        <div className="notification-icon" style={{ backgroundColor: `${getTypeColor(notif.Tipo)}20`, color: getTypeColor(notif.Tipo) }}>
                                            {getNotificationIcon(notif.Tipo)}
                                        </div>
                                        <div className="notification-content">
                                            <div className="notification-header">
                                                <span className="notification-title">{notif.Titulo}</span>
                                                <span className="notification-time">{formatDate(notif.FechaCreacion)}</span>
                                            </div>
                                            <p className="notification-message">{notif.Mensaje}</p>
                                            <div className="notification-meta">
                                                <span className="notification-type" style={{ backgroundColor: `${getTypeColor(notif.Tipo)}20`, color: getTypeColor(notif.Tipo) }}>
                                                    {getTypeLabel(notif.Tipo)}
                                                </span>
                                                {notif.UsuarioEmisorId && (
                                                    <span className="notification-sender">
                                                        <FiUser /> {notif.EmisorNombre || `User ${notif.UsuarioEmisorId}`}
                                                    </span>
                                                )}
                                                {notif.ReferenciaTipo && notif.ReferenciaId && (
                                                    <span className="notification-ref">
                                                        <FiLink /> {notif.ReferenciaTipo}: {notif.ReferenciaId}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="notification-actions">
                                            {!notif.Leida && (
                                                <button 
                                                    className="btn-mark-read"
                                                    onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notif.IdNotificacion); }}
                                                    title="Mark as read"
                                                >
                                                    <FiCheck />
                                                </button>
                                            )}
                                            <button 
                                                className="btn-delete"
                                                onClick={(e) => { e.stopPropagation(); clearNotification(notif.IdNotificacion); }}
                                                title="Delete"
                                            >
                                                <FiX />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* PAGINATION */}
                            {totalPages > 1 && (
                                <div className="pagination">
                                    <button 
                                        className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        <FiChevronLeft />
                                    </button>
                                    <span className="pagination-info">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button 
                                        className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                    >
                                        <FiChevronRight />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default NotificationsHistoryPage;