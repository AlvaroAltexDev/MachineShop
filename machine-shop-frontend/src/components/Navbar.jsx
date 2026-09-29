import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthProvider";
import { useNotifications } from "../context/NotificationProvider";
import { FiMenu, FiChevronDown, FiLogOut, FiBell, FiX, FiExternalLink, FiClock, FiHome, FiSun, FiMoon } from "react-icons/fi";
import { useTheme } from "../context/ThemeContext";
import { LuChartNoAxesGantt } from "react-icons/lu";
import { FaChartSimple } from "react-icons/fa6";
import { GrProjects } from "react-icons/gr";
import { TbTimeline } from "react-icons/tb";
import { FiActivity } from "react-icons/fi";
import { FaTools } from "react-icons/fa";
import { LuTickets, LuBlocks } from "react-icons/lu";
import { FaPuzzlePiece } from "react-icons/fa6";

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [adminMenuOpen, setAdminMenuOpen] = useState(false);
    const [notifMenuOpen, setNotifMenuOpen] = useState(false);

    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { isLight, toggleTheme } = useTheme();
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotifications();

    const userMenuRef = useRef(null);
    const adminMenuRef = useRef(null);
    const notifMenuRef = useRef(null);

    const RELOAD_FLAG = "hasReloadedOnce";

    const toggleMenu = () => setIsOpen(!isOpen);
    const toggleAdminMenu = () => setAdminMenuOpen(!adminMenuOpen);
    const toggleNotifMenu = () => setNotifMenuOpen(!notifMenuOpen);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }

            if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
                setAdminMenuOpen(false);
            }

            if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
                setNotifMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const getUserInitials = () => {
        if (!user?.nombre) return "U";

        return user.nombre
            .split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const handleLogOut = () => {
        localStorage.removeItem("token");
        localStorage.removeItem(RELOAD_FLAG);
        navigate("/");
    };

    const isAdmin = Number(user?.rolId) === 1;

    const mainMenuItems = [
        { to: "/home", label: "Home", icon: <FiHome /> },
        ...(isAdmin ? [{ to: "/metrics", label: "Metrics", icon: <FaChartSimple /> }] : []),
        { to: "/tickets", label: "Tickets", icon: <LuTickets /> },
        { to: "/blocks", label: "Connectors", icon: <LuBlocks /> },
    ];

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
        return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'ticket_created': return <FiBell style={{ color: '#2ecc71' }} />;
            case 'ticket_updated': return <FiBell style={{ color: '#3498db' }} />;
            case 'ticket_trashed': return <FiBell style={{ color: '#f39c12' }} />;
            case 'ticket_deleted': return <FiBell style={{ color: '#e74c3c' }} />;
            case 'ticket_completed': return <FiBell style={{ color: '#27ae60' }} />;
            case 'block_created': return <FiBell style={{ color: '#9b59b6' }} />;
            case 'block_updated': return <FiBell style={{ color: '#8e44ad' }} />;
            case 'block_deleted': return <FiBell style={{ color: '#c0392b' }} />;
            case 'drawing_created': return <FiBell style={{ color: '#2ecc71' }} />;
            case 'program_created': return <FiBell style={{ color: '#2ecc71' }} />;
            case 'ensemble_created': return <FiBell style={{ color: '#2ecc71' }} />;
            default: return <FiBell />;
        }
    };

    const handleNotificationClick = (notif) => {
        if (notif.read) return;

        markAsRead(notif.id);

        const refTipo = notif.referenciaTipo || notif.ReferenciaTipo;
        const refId = notif.referenciaId || notif.ReferenciaId || notif.noParte || notif.ticketId || notif.dibujoId || notif.programaId || notif.ensembleId || notif.IdDibujo || notif.IdPrograma || notif.IdEnsamble;

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
                if (refId) {
                    sessionStorage.setItem("selectedBlockId", notif.BloqueId || notif.blockId);
                    navigate("/blocksdetails");
                }
                break;
            case 'programa':
                if (refId) {
                    sessionStorage.setItem("selectedBlockId", notif.BloqueId || notif.blockId);
                    navigate("/blocksdetails");
                }
                break;
            case 'ensamble':
                if (refId) {
                    sessionStorage.setItem("selectedBlockId", notif.BloqueId || notif.blockId);
                    navigate("/blocksdetails");
                }
                break;
            default:
                // Fallback para notificaciones antiguas sin referenciaTipo
                if (notif.ticketId) {
                    navigate(`/tickets?view=${notif.ticketId}`);
                } else if (notif.noParte) {
                    sessionStorage.setItem("selectedBlockId", notif.noParte);
                    navigate("/blocksdetails");
                }
        }
    };

    return (
        <nav className="navbar">
            {/* LEFT SIDE */}
            <div className="navbar-left">
                <FaTools className="navbar-logo" size={30} />
                <Link to="/" className="navbar-title">
                    Machine Shop - Altex
                </Link>
            </div>

            {/* CENTER MENU */}
            <div className={`menu-center ${isOpen ? "open" : ""}`}>
                {mainMenuItems.map((item) => (
                    <Link key={item.to} to={item.to} className="menu-item">
                        {item.icon && <span className="menu-icon">{item.icon}</span>}
                        {item.label}
                    </Link>
                ))}
            </div>

            {/* RIGHT SIDE - NOTIFICATIONS & USER */}
            <div className="navbar-right">
                <button
                    className="notif-button"
                    onClick={toggleTheme}
                    title={isLight ? "Switch to dark mode" : "Switch to light mode"}
                    aria-label="Toggle theme"
                >
                    {isLight ? <FiMoon size={20} /> : <FiSun size={20} />}
                </button>
                {/* NOTIFICATION BELL */}
                <div className="notif-menu-container" ref={notifMenuRef}>
                    <button
                        className={`notif-button ${unreadCount > 0 ? 'has-unread' : ''}`}
                        onClick={toggleNotifMenu}
                        aria-label="Notifications"
                    >
                        <FiBell size={20} />
                        {unreadCount > 0 && (
                            <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>

                    {notifMenuOpen && (
                        <div className="notif-dropdown">
                            <div className="notif-header">
                                <h4>Notifications</h4>
                                <div className="notif-header-actions">
                                    {unreadCount > 0 && (
                                        <button className="notif-btn-small" onClick={markAllAsRead}>
                                            Mark all as read
                                        </button>
                                    )}
                                    {notifications.length > 0 && (
                                        <button className="notif-btn-small danger" onClick={clearAll}>
                                            Clear all
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="notif-list">
                                {notifications.length === 0 ? (
                                    <div className="notif-empty">
                                        <FiBell size={32} />
                                        <p>No notifications</p>
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={`notif-item ${!notif.read ? 'unread' : ''} ${(notif.ticketId || notif.noParte) ? 'clickable' : ''}`}
                                            onClick={() => handleNotificationClick(notif)}
                                        >
                                            <div className="notif-icon">
                                                {getNotificationIcon(notif.type)}
                                            </div>
                                            <div className="notif-content">
                                                <div className="notif-title-row">
                                                    <span className="notif-title">{notif.title}</span>
                                                    <span className="notif-time">{formatTime(notif.timestamp)}</span>
                                                </div>
                                                <p className="notif-message">{notif.message}</p>
                                                {notif.ticketId && (
                                                    <span className="notif-ticket">Ticket #{notif.ticketId}</span>
                                                )}
                                                {notif.noParte && (
                                                    <span className="notif-block">Block: {notif.noParte}</span>
                                                )}
                                            </div>
                                            {(notif.ticketId || notif.noParte) && !notif.read && (
                                                <FiExternalLink className="notif-external-link" title="Go to item" />
                                            )}
                                            <button
                                                className="notif-close"
                                                onClick={(e) => { e.stopPropagation(); clearNotification(notif.id); }}
                                                aria-label="Delete notification"
                                            >
                                                <FiX size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="notif-footer">
                                <Link to="/notifications" className="notif-history-link" onClick={() => setNotifMenuOpen(false)}>
                                    <FiClock />
                                    Notifications History
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* USER MENU */}
                <div className="user-menu-container" ref={userMenuRef}>
                    <button
                        className="user-menu-button"
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                    >
                        {getUserInitials()}
                    </button>

                    {userMenuOpen && (
                        <div className="user-dropdown">
                            <div className="user-info">
                                <span className="user-name">
                                    {user?.nombre || "User"}
                                </span>
                                <span className="user-role">
                                    {user?.rolId === 1 ? "Admin" : "User"}
                                </span>
                            </div>
                            <div className="dropdown-divider"></div>
                            <button className="logout-button" onClick={handleLogOut}>
                                <FiLogOut />
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;