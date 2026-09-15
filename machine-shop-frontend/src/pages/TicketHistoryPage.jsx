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
    creacion: { label: 'Creación', icon: <FiPlus />, cls: 'ev-creacion' },
    cambio_estado: { label: 'Cambio de estado', icon: <FiFlag />, cls: 'ev-estado' },
    edicion: { label: 'Edición', icon: <FiEdit2 />, cls: 'ev-edicion' },
    bloque: { label: 'Bloque', icon: <FiBox />, cls: 'ev-bloque' },
    papelera: { label: 'Papelera', icon: <FiTrash2 />, cls: 'ev-papelera' },
    restaurar: { label: 'Restaurado', icon: <FiRefreshCw />, cls: 'ev-restaurar' },
    cierre: { label: 'Cierre', icon: <FiCheckCircle />, cls: 'ev-cierre' },
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
            showToast.error('Error al cargar el historial', { duration: 3000, position: "top-right" });
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
                            title="Volver a tickets"
                            style={{ minWidth: 'auto', padding: '0 14px' }}
                        >
                            <FiArrowLeft />
                        </button>
                        <div className="header-icon-wrapper">
                            <FiClock className="header-icon" />
                        </div>
                        <div>
                            <h1 className="header-title">
                                Historial #{ticket ? String(ticket.IdTicket).padStart(4, '0') : id}
                            </h1>
                            <p className="header-subtitle">
                                {ticket?.SolicitanteNombre ? `Solicitado por ${ticket.SolicitanteNombre}` : 'Movimientos del ticket'}
                                {ticket?.NombreEstado ? ` · Estado actual: ${ticket.NombreEstado}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="header-stats">
                        <div className="stat-item">
                            <span className="stat-number">{historial.length}</span>
                            <span className="stat-label">Eventos</span>
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
                                    {t === 'todos' ? 'Todos los eventos' : (TIPO_META[t]?.label || t)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* TIMELINE */}
                <div className="details-card-modern">
                    <div className="card-header-modern">
                        <span className="card-icon"><FiClock /></span>
                        <h4>Línea de tiempo</h4>
                        <span className="blocks-progress">{eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="card-body-modern">
                        {loading ? (
                            <div className="loading-state">Cargando historial...</div>
                        ) : eventosFiltrados.length === 0 ? (
                            <div className="empty-state-tickets">
                                <FiClock size={48} />
                                <h3>Sin eventos</h3>
                                <p>No hay movimientos registrados para este ticket</p>
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
                                                    <span>{ev.UsuarioNombre || (ev.UsuarioId ? `#${ev.UsuarioId}` : 'Sistema')}</span>
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
