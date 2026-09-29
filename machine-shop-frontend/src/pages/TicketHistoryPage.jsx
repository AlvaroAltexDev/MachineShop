import React, { useState, useEffect, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import api from '../api/api';
import socket from '../api/socket';
import { AuthContext } from '../context/AuthProvider';
import {
    FiClock, FiArrowLeft, FiUser, FiPlus, FiEdit2, FiBox,
    FiTrash2, FiRefreshCw, FiCheckCircle, FiFlag, FiFilter
} from "react-icons/fi";
import { showToast } from 'nextjs-toast-notify';

const TIPO_META = {
    creacion: { label: 'Creation', icon: <FiPlus />, cls: 'ev-creacion' },
    cambio_estado: { label: 'Status change', icon: <FiFlag />, cls: 'ev-estado' },
    edicion: { label: 'Edit', icon: <FiEdit2 />, cls: 'ev-edicion' },
    bloque: { label: 'Block', icon: <FiBox />, cls: 'ev-bloque' },
    papelera: { label: 'Trash', icon: <FiTrash2 />, cls: 'ev-papelera' },
    restaurar: { label: 'Restored', icon: <FiRefreshCw />, cls: 'ev-restaurar' },
    cierre: { label: 'Close', icon: <FiCheckCircle />, cls: 'ev-cierre' },
};

const metaFor = (ev) => TIPO_META[ev?.TipoEvento] || TIPO_META.cambio_estado;

export const TicketHistoryPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const isAdmin = Number(user?.rolId) === 1;

    const [ticket, setTicket] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [filtro, setFiltro] = useState('todos');
    const [loading, setLoading] = useState(true);

    const fetchHistorial = useCallback(async () => {
        try {
            const res = await api.get(`/ticketEstados/${id}`);
            setHistorial(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error al cargar historial:', error);
            showToast.error('Error loading history', { duration: 3000, position: "top-right" });
        }
    }, [id]);

    const fetchTicket = useCallback(async () => {
        try {
            const res = await api.get(`/ticketsSelect/${id}`);
            setTicket(res.data || null);
        } catch (error) {
            console.error('Error al cargar ticket:', error);
        }
    }, [id]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchTicket(), fetchHistorial()]);
            setLoading(false);
        };
        load();
    }, [fetchTicket, fetchHistorial]);

    // Tiempo real: refrescar cuando este ticket cambie
    useEffect(() => {
        const handleUpdate = (payload) => {
            if (String(payload?.ticketId) === String(id)) {
                fetchHistorial();
            }
        };
        socket.on('ticketEstadoActualizado', handleUpdate);
        return () => socket.off('ticketEstadoActualizado', handleUpdate);
    }, [id, fetchHistorial]);

    const eventosFiltrados = filtro === 'todos'
        ? historial
        : historial.filter(ev => (ev.TipoEvento || 'cambio_estado') === filtro);

    const tiposDisponibles = ['todos', ...new Set(historial.map(ev => ev.TipoEvento || 'cambio_estado'))];

    return (
        <>
            <Navbar />
            {isAdmin && <Sidebar />}

            <div className={`page-container ${!isAdmin ? 'full-width' : ''}`}>
                {/* HEADER */}
                <div className="tickets-header-modern">
                    <div className="header-left">
                        <button
                            className="button-icon button-gray"
                            onClick={() => navigate('/tickets')}
                            title="Back to tickets"
                            style={{ minWidth: 'auto', padding: '0 14px' }}
                        >
                            <FiArrowLeft />
                        </button>
                        <div className="header-icon-wrapper">
                            <FiClock className="header-icon" />
                        </div>
                        <div>
                            <h1 className="header-title">
                                History #{ticket ? String(ticket.IdTicket).padStart(4, '0') : id}
                            </h1>
                            <p className="header-subtitle">
                                {ticket?.SolicitanteNombre ? `Requested by ${ticket.SolicitanteNombre}` : 'Ticket activity'}
                                {ticket?.NombreEstado ? ` · Current status: ${ticket.NombreEstado}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="header-stats">
                        <div className="stat-item">
                            <span className="stat-number">{historial.length}</span>
                            <span className="stat-label">Events</span>
                        </div>
                    </div>
                </div>

                {/* FILTRO */}
                <div className="tickets-filters-discreta">
                    <div className="filters-main">
                        <FiFilter />
                        <select
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                            style={{ height: '36px', borderRadius: '8px', border: '1px solid #e9ecef', padding: '0 10px' }}
                        >
                            {tiposDisponibles.map(t => (
                                <option key={t} value={t}>
                                    {t === 'todos' ? 'All events' : (TIPO_META[t]?.label || t)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* TIMELINE */}
                <div className="details-card-modern">
                    <div className="card-header-modern">
                        <span className="card-icon"><FiClock /></span>
                        <h4>Timeline</h4>
                        <span className="blocks-progress">{eventosFiltrados.length} event{eventosFiltrados.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="card-body-modern">
                        {loading ? (
                            <div className="loading-state">Loading history...</div>
                        ) : eventosFiltrados.length === 0 ? (
                            <div className="empty-state-tickets">
                                <FiClock size={48} />
                                <h3>No events</h3>
                                <p>No activity recorded for this ticket</p>
                            </div>
                        ) : (
                            <div className="progress-track ticket-history-track">
                                {eventosFiltrados.map((ev) => {
                                    const meta = metaFor(ev);
                                    return (
                                        <div key={ev.IdHistorial} className="progress-step">
                                            <div className={`step-circle hist-dot ${meta.cls}`}>
                                                {meta.icon}
                                            </div>
                                            <div className="hist-body">
                                                <div className="hist-top">
                                                    <span className={`hist-badge ${meta.cls}`}>{meta.label}</span>
                                                    {ev.NombreEstado && (
                                                        <strong className="hist-estado">{ev.NombreEstado}</strong>
                                                    )}
                                                    <span className="hist-fecha">
                                                        {ev.FechaCambioFormateada || ev.FechaCambio || ''}
                                                    </span>
                                                </div>
                                                {ev.Comentario && (
                                                    <div className="hist-comentario">{ev.Comentario}</div>
                                                )}
                                                <div className="hist-usuario">
                                                    <FiUser size={12} />
                                                    <span>{ev.UsuarioNombre || (ev.UsuarioId ? `#${ev.UsuarioId}` : 'System')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
