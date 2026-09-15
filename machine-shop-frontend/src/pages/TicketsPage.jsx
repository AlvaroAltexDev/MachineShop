import React, { useState, useContext, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { Modal } from '../components/Modal';
import { TicketsForm } from './forms/TicketsForm';
import { TicketsDetails } from './details/TicketsDetails';
import api from '../api/api';
import socket from '../api/socket';
import { AuthContext } from '../context/AuthProvider';
import {
    FiUser, FiCalendar, FiFlag, FiFileText, FiArrowRight, FiPlus,
    FiCheckCircle, FiClock, FiAlertCircle, FiPackage, FiBox,
    FiChevronLeft, FiChevronRight, FiTrash2, FiEdit2, FiEye,
    FiFilter, FiX, FiSearch, FiRefreshCw, FiDelete, FiArchive
} from "react-icons/fi";
import { showToast } from 'nextjs-toast-notify';
import Swal from "sweetalert2";

export const TicketsPage = () => {
    const { user } = useContext(AuthContext);
    const [searchParams, setSearchParams] = useSearchParams();
    const [tickets, setTickets] = useState([]);
    const [areas, setAreas] = useState([]);
    const [estados, setEstados] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [activeTab, setActiveTab] = useState('active');
    const [loading, setLoading] = useState(true);
    const [loadingEstados, setLoadingEstados] = useState(true);
    const navigate = useNavigate();
    const [highlightTicketId, setHighlightTicketId] = useState(null);

    const [filters, setFilters] = useState({
        search: '',
        prioridad: 'All',
        area: 'All',
        fecha: '',
        mostrarPropios: false
    });

    const [filteredTickets, setFilteredTickets] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(3);
    const isAdmin = Number(user?.rolId) === 1;

    // Estados de completitud de bloques (para colorear en tickets)
    const [blockStatuses, setBlockStatuses] = useState({});

    // ============ FUNCIONES DE UTILIDAD PARA ESTADOS ============

    // Map para obtener el nombre del estado por ID
    const getEstadoNombre = (estadoId) => {
        if (!estados.length) return 'Sin estado';
        const estado = estados.find(e => e.IdEstado === estadoId);
        return estado ? estado.NombreEstado : 'Sin estado';
    };

    // Map para obtener el estado completo por ID
    const getEstado = (estadoId) => {
        if (!estados.length) return null;
        return estados.find(e => e.IdEstado === estadoId);
    };

    // Verificar si un estado es "Completado"
    const isEstadoCompletado = (estadoId) => {
        const estado = getEstado(estadoId);
        return estado?.NombreEstado?.toUpperCase() === 'COMPLETO' ||
            estado?.NombreEstado?.toUpperCase() === 'ENTREGADO';
    };

    // ============ HANDLE VIEW PARAMETER FROM NOTIFICATION ============
    const handleViewTicket = useCallback((ticketId) => {
        if (!ticketId) return;

        const ticket = tickets.find(t => t.IdTicket === Number(ticketId));
        if (!ticket) return;

        // Determinar qué pestaña corresponde
        let targetTab = 'active';
        if (ticket.Activo === 0) {
            targetTab = 'papelera';
        } else if (isEstadoCompletado(ticket.EstadoId)) {
            targetTab = 'completados';
        } else {
            targetTab = 'active';
        }

        // Cambiar a la pestaña correcta
        setActiveTab(targetTab);

        // Calcular en qué página está el ticket dentro de esa pestaña
        // Necesitamos filtrar los tickets igual que en el useEffect de filtrado
        let filtered = [...tickets];
        if (targetTab === 'papelera') {
            filtered = filtered.filter(t => t.Activo === 0);
        } else if (targetTab === 'completados') {
            filtered = filtered.filter(t => t.Activo === 1 && isEstadoCompletado(t.EstadoId));
        } else {
            filtered = filtered.filter(t => t.Activo === 1 && !isEstadoCompletado(t.EstadoId));
        }

        const ticketIndex = filtered.findIndex(t => t.IdTicket === Number(ticketId));
        if (ticketIndex !== -1) {
            const targetPage = Math.floor(ticketIndex / itemsPerPage) + 1;
            setCurrentPage(targetPage);

            // Highlight el ticket por un momento y desplazarlo a la vista
            setHighlightTicketId(Number(ticketId));
            setTimeout(() => setHighlightTicketId(null), 3000);
            setTimeout(() => {
                document.getElementById(`ticket-card-${ticketId}`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }, 150);
        }
    }, [tickets, isEstadoCompletado, itemsPerPage]);

    // Escuchar cambios en el parámetro view de la URL
    useEffect(() => {
        const viewParam = searchParams.get('view');
        if (viewParam && tickets.length > 0) {
            handleViewTicket(viewParam);
            // Limpiar el parámetro de la URL después de usarlo
            setSearchParams({});
        }
    }, [searchParams, tickets, handleViewTicket]);

    // Obtener clase CSS para el estado
    const getStatusClass = (estadoId) => {
        const estado = getEstado(estadoId);
        if (!estado) return '';

        const nombre = estado.NombreEstado.toUpperCase();
        switch (nombre) {
            case 'RECIBIDO': return 'status-new';
            case 'DISEÑO': return 'status-assigned';
            case 'PROGRAMA': return 'status-in-process';
            case 'ENSAMBLE': return 'status-blocked';
            case 'MATERIALES': return 'status-in-repair';
            case 'MAQUINADO': return 'status-in-process';
            case 'ARMADO': return 'status-in-process';
            case 'COMPLETO': return 'status-completed';
            case 'ENTREGADO': return 'status-completed';
            default: return '';
        }
    };

    // Obtener icono para el estado
    const getStatusIcon = (estadoId) => {
        const estado = getEstado(estadoId);
        if (!estado) return <FiClock />;

        const nombre = estado.NombreEstado.toUpperCase();
        switch (nombre) {
            case 'RECIBIDO': return <FiClock />;
            case 'COMPLETO':
            case 'ENTREGADO': return <FiCheckCircle />;
            default: return <FiClock />;
        }
    };

    // ============ FUNCIONES DE UTILIDAD PARA PRIORIDAD ============

    // Obtener color de prioridad
    const getPriorityColor = (priority) => {
        const priorityUpper = priority?.toUpperCase() || 'MEDIA';
        switch (priorityUpper) {
            case 'CRITICA': return 'priority-critical';
            case 'ALTA': return 'priority-high';
            case 'MEDIA': return 'priority-medium';
            case 'BAJA': return 'priority-low';
            default: return 'priority-medium';
        }
    };

    // Obtener icono de prioridad
    const getPriorityIcon = (priority) => {
        const priorityUpper = priority?.toUpperCase() || 'MEDIA';
        switch (priorityUpper) {
            case 'CRITICA': return '🚨';
            case 'ALTA': return '🔴';
            case 'MEDIA': return '🟡';
            case 'BAJA': return '🟢';
            default: return '🟡';
        }
    };

    // ============ FUNCIONES DE PROGRESO ============

    // Mapa de estados automáticos (se construye desde BD)
    const estadosMap = useMemo(() => {
        const map = {};
        estados.forEach(e => {
            map[e.NombreEstado] = {
                EsAutomatico: e.EsAutomatico === 1 || e.EsAutomatico === true,
                Orden: e.Orden,
                IdEstado: e.IdEstado
            };
        });
        return map;
    }, [estados]);

    // Obtener pasos del progreso basados en los estados dinámicos
    const getProgressSteps = (estadoId) => {
        if (!estados.length) return [];

        // Obtener todos los estados ordenados por 'Orden'
        const sortedEstados = [...estados].sort((a, b) => a.Orden - b.Orden);

        // Encontrar el índice del estado actual
        const currentIndex = sortedEstados.findIndex(e => e.IdEstado === estadoId);

        return sortedEstados.map((estado, index) => ({
            label: estado.NombreEstado,
            // FIX: completed solo para índices ANTERIORES al actual (strict <)
            completed: index < currentIndex,
            active: index === currentIndex,
            id: estado.IdEstado,
            EsAutomatico: estado.EsAutomatico === 1 || estado.EsAutomatico === true
        }));
    };

    // ============ HELPER FUNCTIONS FOR BLOCK STATUS IN PROGRESS ============

    // Flags manuales del backend (acepta true/1/'1' porque MySQL devuelve tinyint).
    // Solo el flag cuenta: NO se usa dibujosCount/programasCount/ensamblesCount,
    // para que nada se marque solo al subir archivos.
    const toBoolFlag = (v) => v === true || v === 1 || v === '1';

    // Verificar si TODOS los bloques del ticket fueron marcados completos (dibujos).
    // 1 bloque marcado => true. 2+ bloques => true solo si TODOS están marcados.
    const hasAllDrawingsComplete = (ticket) => {
        if (!ticket.Detalles || ticket.Detalles.length === 0) return false;
        return ticket.Detalles.every(detalle => {
            const noParte = detalle.NoParte || detalle.BloqueId;
            const status = blockStatuses[noParte];
            return toBoolFlag(status?.DibujosCompleto);
        });
    };

    // Verificar si TODOS los bloques del ticket fueron marcados completos (programas).
    const hasAllProgramsComplete = (ticket) => {
        if (!ticket.Detalles || ticket.Detalles.length === 0) return false;
        return ticket.Detalles.every(detalle => {
            const noParte = detalle.NoParte || detalle.BloqueId;
            const status = blockStatuses[noParte];
            return toBoolFlag(status?.ProgramasCompleto);
        });
    };

    // Verificar si TODOS los bloques del ticket fueron marcados completos (ensamble).
    const hasAllEnsamblesComplete = (ticket) => {
        if (!ticket.Detalles || ticket.Detalles.length === 0) return false;
        return ticket.Detalles.every(detalle => {
            const noParte = detalle.NoParte || detalle.BloqueId;
            const status = blockStatuses[noParte];
            return toBoolFlag(status?.EnsambleCompleto);
        });
    };

    // Helper para normalizar nombres de estados (quitar acentos, mayúsculas)
    const normalizeStateName = (name) => {
        if (!name) return '';
        return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    };

    // Obtener status de completitud de bloques para un ticket
    const fetchBlockStatusesForTicket = async (detalles) => {
        if (!detalles || detalles.length === 0) return;

        try {
            const statusPromises = detalles.map(async (detalle) => {
                const noParte = detalle.NoParte || detalle.BloqueId;
                if (!noParte) return null;

                try {
                    const res = await api.get(`/bloquesGetStatus/${noParte}`);
                    return { noParte, status: res.data };
                } catch (err) {
                    console.error(`Error fetching status for ${noParte}:`, err);
                    return null;
                }
            });

            const results = await Promise.all(statusPromises);
            // FIX: Usar functional update para evitar race condition
            setBlockStatuses(prev => {
                const newStatuses = { ...prev };
                results.forEach(r => {
                    if (r) newStatuses[r.noParte] = r.status;
                });
                return newStatuses;
            });
        } catch (error) {
            console.error('Error fetching block statuses:', error);
        }
    };

    // ============ EFECTOS ============

    // Cargar áreas
    useEffect(() => {
        const fetchAreas = async () => {
            try {
                const response = await api.get('/areasSelectAll');
                setAreas(response.data || []);
            } catch (error) {
                console.error('Error al cargar áreas:', error);
            }
        };
        fetchAreas();
    }, []);

    // Cargar estados
    useEffect(() => {
        const fetchEstados = async () => {
            setLoadingEstados(true);
            try {
                const response = await api.get('/estadosSelectAll');
                console.log('📋 Estados cargados:', response.data);
                setEstados(response.data || []);
            } catch (error) {
                console.error('Error al cargar estados:', error);
            } finally {
                setLoadingEstados(false);
            }
        };
        fetchEstados();
    }, []);

    // Cargar tickets - SIEMPRE carga TODOS los tickets
    const fetchTickets = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();

            // ✅ Usamos el endpoint existente con un parámetro especial
            params.append('todos', 'true'); // 👈 Este parámetro indica que queremos TODOS los tickets

            if (filters.search) params.append('search', filters.search);
            if (filters.prioridad !== 'All') params.append('prioridad', filters.prioridad);
            if (filters.area !== 'All') params.append('area', filters.area);
            if (filters.fecha) params.append('fecha', filters.fecha);

            if (!isAdmin || filters.mostrarPropios) {
                params.append('usuarioId', user?.noEmp);
            }

            // ✅ Usar el endpoint existente
            const response = await api.get(`/ticketsSelect?${params.toString()}`);
            const data = Array.isArray(response.data) ? response.data : [];

            console.log('📊 Todos los tickets cargados:', {
                total: data.length,
                primerTicket: data[0],
                estadosCargados: estados.length
            });

            setTickets(data);
            // Obtener status de bloques para todos los tickets
            data.forEach(ticket => {
                if (ticket.Detalles && ticket.Detalles.length > 0) {
                    fetchBlockStatusesForTicket(ticket.Detalles);
                }
            });
        } catch (error) {
            console.error('Error al cargar tickets:', error);
            showToast.error("Error al cargar los tickets", {
                position: "top-right",
                duration: 3000,
            });
            setTickets([]);
            setFilteredTickets([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (estados.length > 0) {
            fetchTickets();
        }
    }, [estados]);

    // Real-time tickets updates via socket
    useEffect(() => {
        const handleTicketsUpdate = () => {
            console.log('🔄 Socket: ticketsActualizados recibido, recargando...');
            fetchTickets();
        };
        socket.on('ticketsActualizados', handleTicketsUpdate);
        return () => socket.off('ticketsActualizados', handleTicketsUpdate);
    }, []);

    // Refrescar SOLO el bloque marcado/desmarcado (sin recargar todos los tickets).
    // El backend emite { noParte, campo, valor } al hacer toggle en detalles.
    useEffect(() => {
        const handleBlockStatus = async (payload) => {
            const noParte = payload?.noParte;
            if (!noParte || typeof noParte !== 'string') return;
            try {
                const res = await api.get(`/bloquesGetStatus/${noParte}`);
                setBlockStatuses(prev => ({ ...prev, [noParte]: res.data }));
            } catch (err) {
                console.error(`Error refrescando status de ${noParte}:`, err);
            }
        };
        socket.on('bloqueStatusActualizado', handleBlockStatus);
        return () => socket.off('bloqueStatusActualizado', handleBlockStatus);
    }, []);


    useEffect(() => {
        // ✅ Si no hay estados cargados, no filtrar
        if (estados.length === 0) {
            setFilteredTickets([]);
            return;
        }

        let result = [...tickets];

        // ✅ Filtrar por pestaña activa
        if (activeTab === 'papelera') {
            result = result.filter(t => t.Activo === 0);
        } else if (activeTab === 'completados') {
            result = result.filter(t => t.Activo === 1 && isEstadoCompletado(t.EstadoId));
        } else { // active
            result = result.filter(t => t.Activo === 1 && !isEstadoCompletado(t.EstadoId));
        }

        // Aplicar filtros de búsqueda
        if (filters.search) {
            const term = filters.search.toLowerCase();
            result = result.filter(ticket =>
                ticket.Descripcion?.toLowerCase().includes(term) ||
                ticket.SolicitanteNombre?.toLowerCase().includes(term) ||
                String(ticket.IdTicket).includes(term)
            );
        }

        if (filters.prioridad !== 'All') {
            result = result.filter(ticket => ticket.PrioridadNombre === filters.prioridad);
        }

        if (filters.area !== 'All') {
            result = result.filter(ticket => ticket.AreaId === parseInt(filters.area));
        }

        if (filters.fecha) {
            const filterDate = new Date(filters.fecha).toDateString();
            result = result.filter(ticket => {
                const ticketDate = new Date(ticket.FechaSolicitacion).toDateString();
                return ticketDate === filterDate;
            });
        }

        setFilteredTickets(result);
        setCurrentPage(1);
    }, [filters, tickets, activeTab, estados]); // ✅ Agregar 'estados' como dependencia

    // ============ PAGINACIÓN ============

    const indexLast = currentPage * itemsPerPage;
    const indexFirst = indexLast - itemsPerPage;
    const currentTickets = filteredTickets.slice(indexFirst, indexLast);
    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // ============ ACCIONES DE TICKETS ============

    const handleViewDetails = (ticket) => {
        setSelectedTicket(ticket);
        setIsDetailsModalOpen(true);
    };

    const handleEditTicket = (ticket) => {
        if (ticket.PrioridadNombre === 'CRITICA' && !isEstadoCompletado(ticket.EstadoId)) {
            showToast.warning('No se puede editar un ticket crítico en curso', {
                duration: 3000,
                position: "top-right",
            });
            return;
        }
        setSelectedTicket(ticket);
        setIsEditModalOpen(true);
    };

    const handleCerrarTicket = async (ticket) => {
        try {
            if (!isAdmin) {
                showToast.error('Solo los administradores pueden cerrar tickets', {
                    duration: 3000,
                    position: "top-right",
                });
                return;
            }

            const { value: comentario } = await Swal.fire({
                title: '¿Cerrar ticket?',
                html: `¿Deseas cerrar el ticket <strong>#${ticket.IdTicket}</strong>?`,
                icon: 'question',
                input: 'textarea',
                inputPlaceholder: 'Comentario de cierre (opcional)',
                showCancelButton: true,
                confirmButtonColor: '#28a745',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Sí, cerrar',
                cancelButtonText: 'Cancelar',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup',
                    input: 'swal-dark-input'
                }
            });

            if (comentario === undefined) return;

            const response = await api.put(`/ticketsCerrar/${ticket.IdTicket}`, {
                CerradoPor: user?.noEmp,
                ComentarioCierre: comentario || ''
            });

            if (response.data.success) {
                showToast.success(response.data.message, {
                    duration: 3000,
                    position: "top-right",
                });
                fetchTickets();
            }
        } catch (error) {
            console.error(error);
            showToast.error(error.response?.data?.error || 'Error al cerrar ticket', {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    const handleDeleteTicket = async (ticket) => {
        try {
            const result = await Swal.fire({
                title: '¿Mover a papelera?',
                html: `¿Deseas mover el ticket <strong>#${ticket.IdTicket}</strong> a la papelera?<br>Podrás recuperarlo después.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#D71928',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Sí, mover a papelera',
                cancelButtonText: 'Cancelar',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });

            if (!result.isConfirmed) return;

            const response = await api.put(`/ticketsDeleteSoft/${ticket.IdTicket}`, { UsuarioId: user?.noEmp });

            if (response.data.success) {
                showToast.success(response.data.message, {
                    duration: 3000,
                    position: "top-right",
                });
                fetchTickets();
            }
        } catch (error) {
            console.error(error);
            showToast.error('Error al mover ticket a papelera', {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    const handleRestaurarTicket = async (ticket) => {
        try {
            const result = await Swal.fire({
                title: '¿Restaurar ticket?',
                html: `¿Deseas restaurar el ticket <strong>#${ticket.IdTicket}</strong>?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#28a745',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Sí, restaurar',
                cancelButtonText: 'Cancelar',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });

            if (!result.isConfirmed) return;

            const response = await api.put(`/ticketsRestaurar/${ticket.IdTicket}`, { UsuarioId: user?.noEmp });

            if (response.data.success) {
                showToast.success(response.data.message, {
                    duration: 3000,
                    position: "top-right",
                });
                fetchTickets();
            }
        } catch (error) {
            console.error(error);
            showToast.error('Error al restaurar ticket', {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    const handleDeletePermanente = async (ticket) => {
        try {
            const result = await Swal.fire({
                title: '¿Eliminar permanentemente?',
                html: `¿Estás seguro de eliminar el ticket <strong>#${ticket.IdTicket}</strong>?<br>Esta acción no se puede deshacer.`,
                icon: 'error',
                showCancelButton: true,
                confirmButtonColor: '#D71928',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });

            if (!result.isConfirmed) return;

            const response = await api.delete(`/ticketsDeletePermanente/${ticket.IdTicket}`);

            if (response.data.success) {
                showToast.success(response.data.message, {
                    duration: 3000,
                    position: "top-right",
                });
                fetchTickets();
            }
        } catch (error) {
            console.error(error);
            showToast.error('Error al eliminar ticket', {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    // ============ FUNCIÓN PARA CAMBIAR ESTADO DESDE BARRA DE PROGRESO ============
    const handleStepClick = async (ticketId, estadoId, estadoNombre) => {
        const { value: comentario } = await Swal.fire({
            title: `Marcar como "${estadoNombre}"`,
            input: 'textarea',
            inputPlaceholder: 'Comentario (opcional)',
            showCancelButton: true,
            confirmButtonText: 'Confirmar',
            cancelButtonText: 'Cancelar',
            background: '#3F3F42',
            color: '#fff',
            customClass: { popup: 'swal-dark-popup', input: 'swal-dark-input' }
        });

        if (comentario === undefined) return;

        try {
            await api.put(`/ticketActualizarEstado/${ticketId}`, {
                EstadoId: estadoId,
                UsuarioId: user.noEmp,
                Comentario: comentario || ''
            });
            showToast.success(`Estado cambiado a ${estadoNombre}`, { duration: 3000, position: "top-right" });
            fetchTickets();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error al cambiar estado', { duration: 4000, position: "top-right" });
        }
    };

    // ============ ESTADÍSTICAS ============

    const totalTickets = tickets.length;
    const getEstadoIdByName = (nombre) => {
        const estado = estados.find(e => e.NombreEstado.toUpperCase() === nombre.toUpperCase());
        return estado ? estado.IdEstado : null;
    };

    const completadoId = getEstadoIdByName('COMPLETO');
    const entregadoId = getEstadoIdByName('ENTREGADO');
    const estadoCompletadoIds = [completadoId, entregadoId].filter(id => id !== null);

    const inProcessCount = tickets.filter(t =>
        t.Activo === 1 && !estadoCompletadoIds.includes(t.EstadoId)
    ).length;
    const completedCount = tickets.filter(t =>
        estadoCompletadoIds.includes(t.EstadoId)
    ).length;

    return (
        <>
            <Navbar />
            {isAdmin && <Sidebar />}

            <div className={`page-container ${!isAdmin ? 'full-width' : ''}`}>
                {/* HEADER */}
                <div className="tickets-header-modern">
                    <div className="header-left">
                        <div className="header-icon-wrapper">
                            <FiFileText className="header-icon" />
                        </div>
                        <div>
                            <h1 className="header-title">Support Tickets</h1>
                            <p className="header-subtitle">Machining Support Requests</p>
                        </div>
                    </div>
                    <div className="header-stats">
                        <div className="stat-item">
                            <span className="stat-number">{totalTickets}</span>
                            <span className="stat-label">Total</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{inProcessCount}</span>
                            <span className="stat-label">En Proceso</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{completedCount}</span>
                            <span className="stat-label">Completados</span>
                        </div>
                    </div>
                    {activeTab === 'active' && (
                        <button className="button-icon button-red" onClick={() => setIsModalOpen(true)}>
                            <FiPlus />
                            New Ticket
                        </button>
                    )}
                </div>

                {/* FILTROS */}
                <div className="tickets-filters-discreta">
                    <div className="filters-main">
                        <div className="search-box">
                            <FiSearch />
                            <input
                                type="text"
                                placeholder={activeTab === 'papelera' ? "Buscar en papelera..." : "Buscar tickets..."}
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            />
                        </div>
                        <button
                            className="filter-toggle-btn"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <FiFilter />
                            {showFilters ? 'Ocultar filtros' : 'Filtros'}
                        </button>
                    </div>

                    {showFilters && (
                        <div className="filters-expanded">
                            <div className="filter-group">
                                <label>Prioridad</label>
                                <select
                                    value={filters.prioridad}
                                    onChange={(e) => setFilters({ ...filters, prioridad: e.target.value })}
                                >
                                    <option value="All">Todas</option>
                                    <option value="CRITICA">Crítica</option>
                                    <option value="ALTA">Alta</option>
                                    <option value="MEDIA">Media</option>
                                    <option value="BAJA">Baja</option>
                                </select>
                            </div>
                            <div className="filter-group">
                                <label>Área</label>
                                <select
                                    value={filters.area}
                                    onChange={(e) => setFilters({ ...filters, area: e.target.value })}
                                >
                                    <option value="All">Todas</option>
                                    {areas.map(area => (
                                        <option key={area.IdArea} value={area.IdArea}>
                                            {area.NombreArea}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <label>Fecha</label>
                                <input
                                    type="date"
                                    value={filters.fecha}
                                    onChange={(e) => setFilters({ ...filters, fecha: e.target.value })}
                                />
                            </div>
                            {(filters.search || filters.prioridad !== 'All' || filters.area !== 'All' || filters.fecha) && (
                                <button
                                    className="clear-filters-btn"
                                    onClick={() => setFilters({
                                        search: '',
                                        prioridad: 'All',
                                        area: 'All',
                                        fecha: '',
                                        mostrarPropios: false
                                    })}
                                >
                                    <FiX />
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* TABS */}
                <div className="filters-bar">
                    <button
                        className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                        onClick={() => setActiveTab('active')}
                    >
                        <FiFileText />
                        Tickets Activos
                        <span className="tab-badge">
                            {tickets.filter(t => t.Activo === 1 && !estadoCompletadoIds.includes(t.EstadoId)).length}
                        </span>
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'completados' ? 'active' : ''}`}
                        onClick={() => setActiveTab('completados')}
                    >
                        <FiCheckCircle />
                        Completados
                        <span className="tab-badge">
                            {tickets.filter(t => estadoCompletadoIds.includes(t.EstadoId)).length}
                        </span>
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'papelera' ? 'active' : ''}`}
                        onClick={() => setActiveTab('papelera')}
                    >
                        <FiArchive />
                        Papelera
                        <span className="tab-badge">{tickets.filter(t => t.Activo === 0).length}</span>
                    </button>
                </div>

                {/* TICKETS GRID */}
                <div className="tickets-grid">
                    {loading ? (
                        <div className="loading-state">Cargando tickets...</div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="empty-state-tickets">
                            {activeTab === 'papelera' ? (
                                <>
                                    <FiArchive size={48} />
                                    <h3>Papelera vacía</h3>
                                    <p>No hay tickets en la papelera</p>
                                </>
                            ) : (
                                <>
                                    <FiFileText size={48} />
                                    <h3>No tickets found</h3>
                                    <p>Try adjusting your filters or create a new ticket</p>
                                </>
                            )}
                        </div>
                    ) : (
                        currentTickets.map(ticket => {
                            const estadoNombre = getEstadoNombre(ticket.EstadoId);
                            const steps = getProgressSteps(ticket.EstadoId);
                            const fechaDeseada = ticket.FechaDeseadaFormateada || ticket.FechaDeseada || 'N/A';

                            return (
                                <div id={`ticket-card-${ticket.IdTicket}`} className={`ticket-card-modern ${highlightTicketId === ticket.IdTicket ? 'ticket-highlight' : ''}`} key={ticket.IdTicket}>
                                    <div className="ticket-notches">
                                        <div className="notch"></div>
                                        <div className="notch"></div>
                                        <div className="notch"></div>
                                        <div className="notch"></div>
                                        <div className="notch"></div>
                                        <div className="notch"></div>
                                    </div>

                                    <div className="ticket-red-bar"></div>

                                    <div className="ticket-content">
                                        {/* TOP */}
                                        <div className="ticket-top-modern">
                                            <div className="ticket-brand">
                                                <h2>OMNITEC</h2>
                                                <span>Machinery</span>
                                            </div>
                                            <div className="ticket-id-status">
                                                <span className="ticket-number">#{ticket.IdTicket}</span>
                                                <span className={`ticket-status-badge ${getStatusClass(ticket.EstadoId)}`}>
                                                    {getStatusIcon(ticket.EstadoId)}
                                                    {estadoNombre}
                                                </span>
                                            </div>
                                        </div>

                                        {/* INFO */}
                                        <div className="ticket-info-modern">
                                            <div className="info-item">
                                                <FiUser className="info-icon" />
                                                <div>
                                                    <small>Solicitante</small>
                                                    <strong>{ticket.SolicitanteNombre || 'Desconocido'}</strong>
                                                </div>
                                            </div>
                                            <div className="info-item">
                                                <FiCalendar className="info-icon" />
                                                <div>
                                                    <small>Fecha Deseada</small>
                                                    <strong>{fechaDeseada}</strong>
                                                </div>
                                            </div>
                                            <div className="info-item">
                                                <FiFlag className="info-icon" />
                                                <div>
                                                    <small>Prioridad</small>
                                                    <strong className={getPriorityColor(ticket.PrioridadNombre)}>
                                                        {getPriorityIcon(ticket.PrioridadNombre)} {ticket.PrioridadNombre || 'Media'}
                                                    </strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* BLOQUES SOLICITADOS */}
                                        {ticket.Detalles && ticket.Detalles.length > 0 && (
                                            <div className="ticket-blocks">
                                                <div className="blocks-header">
                                                    <FiPackage className="blocks-icon" />
                                                    <small>Bloques Solicitados</small>
                                                </div>
                                                <div className="blocks-list">
                                                    {ticket.Detalles.map((detalle, idx) => {
                                                        const noParte = detalle.NoParte || detalle.BloqueId;
                                                        const status = blockStatuses[noParte];
                                                        // Solo el flag manual pinta el puntito: al desmarcar, el punto se quita.
                                                        const hasDrawings = toBoolFlag(status?.DibujosCompleto);
                                                        const hasPrograms = toBoolFlag(status?.ProgramasCompleto);
                                                        const hasEnsamble = toBoolFlag(status?.EnsambleCompleto);
                                                        const isComplete = hasDrawings && hasPrograms && hasEnsamble;

                                                        let blockClass = 'block-item';
                                                        if (isComplete) blockClass += ' block-complete';
                                                        else if (hasDrawings && hasPrograms && hasEnsamble) blockClass += ' block-ready';
                                                        else if (hasDrawings && hasPrograms) blockClass += ' block-partial';
                                                        else if (hasDrawings) blockClass += ' block-drawings-only';

                                                        return (
                                                            <div key={idx} className={blockClass} title={
                                                                isComplete ? 'Completo: Dibujos + Programas + Ensamble' :
                                                                    hasDrawings && hasPrograms && hasEnsamble ? 'Listo para marcar completo' :
                                                                        hasDrawings && hasPrograms ? 'Tiene dibujos y programas' :
                                                                            hasDrawings ? 'Solo tiene dibujos' : 'Sin datos'
                                                            }>
                                                                {isAdmin ? (
                                                                    <span
                                                                        className="block-name clickable-block"
                                                                        onClick={() => {
                                                                            sessionStorage.setItem("selectedBlockId", noParte);
                                                                            navigate("/blocksdetails");
                                                                        }}
                                                                        title={`Click para ver detalles de ${noParte}`}
                                                                    >
                                                                        {noParte}
                                                                    </span>
                                                                ) : (
                                                                    <span className="block-name" title={noParte}>
                                                                        {noParte}
                                                                    </span>
                                                                )}
                                                                <span className="block-quantity">×{detalle.Cantidad}</span>
                                                                {(hasDrawings || hasPrograms || hasEnsamble) && (
                                                                    <div className="block-status-indicators">
                                                                        {hasDrawings && <span className="status-dot drawings" title="Dibujos" />}
                                                                        {hasPrograms && <span className="status-dot programs" title="Programas" />}
                                                                        {hasEnsamble && <span className="status-dot ensamble" title="Ensamble" />}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* PROGRESS */}
                                        {steps.length > 0 && (
                                            <div className="ticket-progress">
                                                <div className="progress-header">
                                                    <small>Progreso</small>
                                                    <span className="progress-percentage">
                                                        {steps.filter(s => {
                                                            if (s.completed) return true;
                                                            const n = normalizeStateName(s.label);
                                                            return (n === 'diseno' && hasAllDrawingsComplete(ticket)) ||
                                                                (n === 'programa' && hasAllProgramsComplete(ticket)) ||
                                                                (n === 'ensamble' && hasAllEnsamblesComplete(ticket));
                                                        }).length}/{steps.length}
                                                    </span>
                                                </div>
                                                <div className="progress-steps">
                                                    {steps.map((step, index) => {
                                                        const estadoInfo = estadosMap[step.label];
                                                        const isAuto = estadoInfo?.EsAutomatico;
                                                        const isManual = !isAuto;

                                                        // Auto-avance SOLO VISUAL (no toca EstadoId en BD):
                                                        // DISEÑO/PROGRAMA/ENSAMBLE se ven completos cuando TODOS
                                                        // los bloques del ticket tienen su flag en true.
                                                        // Al desmarcar un flag, el paso deja de verse completo.
                                                        const stepLabelNorm = normalizeStateName(step.label);
                                                        const autoCompleted =
                                                            (stepLabelNorm === 'diseno' && hasAllDrawingsComplete(ticket)) ||
                                                            (stepLabelNorm === 'programa' && hasAllProgramsComplete(ticket)) ||
                                                            (stepLabelNorm === 'ensamble' && hasAllEnsamblesComplete(ticket));
                                                        const effectiveCompleted = step.completed || autoCompleted;
                                                        const canClick = isAdmin && isManual && !effectiveCompleted && step.id !== ticket.EstadoId;

                                                        return (
                                                            <div key={index} className={`step ${effectiveCompleted ? 'completed' : ''} ${step.active ? 'active' : ''} ${canClick ? 'clickable' : ''} ${isAuto ? 'auto' : ''}`}>
                                                                {canClick ? (
                                                                    <button
                                                                        className="step-btn"
                                                                        onClick={() => handleStepClick(ticket.IdTicket, step.id, step.label)}
                                                                        title={`Cambiar estado a ${step.label}`}
                                                                    >
                                                                        <div className="step-circle">
                                                                            {effectiveCompleted ? '✓' : index + 1}
                                                                        </div>
                                                                        <span className="step-label">{step.label}</span>
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        <div className="step-circle">
                                                                            {effectiveCompleted ? '✓' : index + 1}
                                                                        </div>
                                                                        <span className="step-label">{step.label}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* FOOTER - Acciones */}
                                        <div className="ticket-footer-modern">
                                            <span className="ticket-category-modern">
                                                {ticket.NombreArea || 'Sin área'}
                                            </span>
                                            <div className="ticket-actions">
                                                {activeTab === 'papelera' ? (
                                                    <>
                                                        <button
                                                            className="action-btn restore-btn"
                                                            onClick={() => handleRestaurarTicket(ticket)}
                                                            title="Restaurar ticket"
                                                        >
                                                            <FiRefreshCw />
                                                        </button>
                                                        <button
                                                            className="action-btn history-btn"
                                                            onClick={() => navigate(`/tickets/${ticket.IdTicket}/historial`)}
                                                            title="Ver historial"
                                                        >
                                                            <FiClock />
                                                        </button>
                                                        <button
                                                            className="action-btn delete-permanent-btn"
                                                            onClick={() => handleDeletePermanente(ticket)}
                                                            title="Eliminar permanentemente"
                                                        >
                                                            <FiDelete />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            className="action-btn view-btn"
                                                            onClick={() => handleViewDetails(ticket)}
                                                            title="Ver detalles"
                                                        >
                                                            <FiEye />
                                                        </button>
                                                        <button
                                                            className="action-btn history-btn"
                                                            onClick={() => navigate(`/tickets/${ticket.IdTicket}/historial`)}
                                                            title="Ver historial"
                                                        >
                                                            <FiClock />
                                                        </button>
                                                        {!isEstadoCompletado(ticket.EstadoId) && (
                                                            <>
                                                                <button
                                                                    className="action-btn edit-btn"
                                                                    onClick={() => handleEditTicket(ticket)}
                                                                    title="Editar ticket"
                                                                >
                                                                    <FiEdit2 />
                                                                </button>
                                                                {isAdmin && (
                                                                    <button
                                                                        className="action-btn complete-btn"
                                                                        onClick={() => handleCerrarTicket(ticket)}
                                                                        title="Cerrar ticket"
                                                                    >
                                                                        <FiCheckCircle />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        <button
                                                            className="action-btn delete-btn"
                                                            onClick={() => handleDeleteTicket(ticket)}
                                                            title="Mover a papelera"
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* PAGINACIÓN */}
                {!loading && filteredTickets.length > 0 && (
                    <div className="blocks-pagination">
                        <div className="pagination-info">
                            Mostrando {indexFirst + 1} - {Math.min(indexLast, filteredTickets.length)} de {filteredTickets.length} tickets
                        </div>
                        <div className="pagination-controls">
                            <button
                                onClick={() => goToPage(currentPage - 1)}
                                className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                                disabled={currentPage === 1}
                            >
                                <FiChevronLeft />
                            </button>
                            <div className="pagination-pages">
                                {Array.from({ length: totalPages }, (_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => goToPage(i + 1)}
                                        className={`pagination-page ${currentPage === i + 1 ? 'active' : ''}`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => goToPage(currentPage + 1)}
                                className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                                disabled={currentPage === totalPages}
                            >
                                <FiChevronRight />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALES */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="New Ticket"
            >
                <TicketsForm
                    onSuccess={() => {
                        setIsModalOpen(false);
                        fetchTickets();
                    }}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Ticket"
            >
                <TicketsForm
                    ticket={selectedTicket}
                    isEditing={true}
                    onSuccess={() => {
                        setIsEditModalOpen(false);
                        fetchTickets();
                    }}
                    onCancel={() => setIsEditModalOpen(false)}
                />
            </Modal>

            <Modal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                title="Ticket Details"
                size="large"
            >
                <TicketsDetails
                    ticket={selectedTicket}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            </Modal>
        </>
    );
};