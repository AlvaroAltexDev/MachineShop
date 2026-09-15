import React from 'react';
import { 
    FiUser, 
    FiCalendar, 
    FiFlag, 
    FiFileText, 
    FiPackage, 
    FiClock,
    FiCheckCircle,
    FiAlertCircle,
    FiX,
    FiDownload,
    FiPrinter,
    FiCode,
    FiCpu,
    FiBox
} from 'react-icons/fi';
import { FaRegCalendarAlt, FaRegClock } from 'react-icons/fa';

export const TicketsDetails = ({ ticket, onClose }) => {
    if (!ticket) return null;

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

    const getStatusColor = (status) => {
        const statusMap = {
            'RECIBIDO': '#3498db',
            'DISEÑO': '#f39c12',
            'PROGRAMA': '#9b59b6',
            'ENSAMBLE': '#e67e22',
            'MATERIALES': '#1abc9c',
            'MAQUINADO': '#2ecc71',
            'ARMADO': '#27ae60',
            'COMPLETO': '#2ecc71',
            'ENTREGADO': '#2ecc71'
        };
        return statusMap[status] || '#95a5a6';
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'RECIBIDO': return <FiClock />;
            case 'DISEÑO': return <FiFileText />;
            case 'PROGRAMA': return <FiCode />;
            case 'ENSAMBLE': return <FiPackage />;
            case 'COMPLETO': return <FiCheckCircle />;
            default: return <FiClock />;
        }
    };

    const currentStatus = ticket.Estado || ticket.NombreEstado || 'RECIBIDO';

    const statusColor = getStatusColor(currentStatus);

    return (
        <div className="ticket-details-modern">
            {/* HEADER COMPACTO */}
            <div className="ticket-details-header-modern" style={{ borderBottom: `3px solid ${statusColor}` }}>
                <div className="header-content">
                    <div className="ticket-id-section">
                        <span className="ticket-id-label">Ticket</span>
                        <span className="ticket-id-number">#{String(ticket.IdTicket).padStart(4, '0')}</span>
                    </div>
                    <div className="header-status">
                        <div className="status-indicator" style={{ backgroundColor: statusColor }}>
                            {getStatusIcon(currentStatus)}
                        </div>
                        <span className="status-text" style={{ color: statusColor }}>
                            {currentStatus}
                        </span>
                    </div>
                    <div className="header-actions">
                        <button className="header-action-btn" title="Imprimir">
                            <FiPrinter />
                        </button>
                        <button className="header-action-btn" title="Descargar">
                            <FiDownload />
                        </button>
                        <button className="header-close-btn" onClick={onClose}>
                            <FiX />
                        </button>
                    </div>
                </div>
            </div>

            {/* BODY - DOS COLUMNAS */}
            <div className="ticket-details-body-modern">
                {/* COLUMNA IZQUIERDA - INFO GENERAL + PROGRESO */}
                <div className="details-column left-column">
                    <div className="details-card-modern">
                        <div className="card-header-modern">
                            <span className="card-icon"><FiUser /></span>
                            <h4>Información General</h4>
                        </div>
                        <div className="card-body-modern">
                            <div className="info-row">
                                <div className="info-label">
                                    <FiUser size={14} />
                                    <span>Solicitante</span>
                                </div>
                                <div className="info-value">{ticket.SolicitanteNombre || 'Desconocido'}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">
                                    <FaRegCalendarAlt size={14} />
                                    <span>Solicitado</span>
                                </div>
                                <div className="info-value">{ticket.FechaSolicitacionFormateada || 'N/A'}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">
                                    <FaRegClock size={14} />
                                    <span>Fecha Deseada</span>
                                </div>
                                <div className="info-value highlight">{ticket.FechaDeseadaFormateada || 'N/A'}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">
                                    <FiFlag size={14} />
                                    <span>Prioridad</span>
                                </div>
                                <div className="info-value">
                                    <span className={`priority-badge-modern ${getPriorityColor(ticket.PrioridadNombre)}`}>
                                        {getPriorityIcon(ticket.PrioridadNombre)} {ticket.PrioridadNombre || 'Media'}
                                    </span>
                                </div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">
                                    <FiPackage size={14} />
                                    <span>Área</span>
                                </div>
                                <div className="info-value">{ticket.NombreArea || ticket.Area || 'Sin área'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUMNA DERECHA - DESCRIPCIÓN + BLOQUES */}
                <div className="details-column right-column">
                    <div className="details-card-modern">
                        <div className="card-header-modern">
                            <span className="card-icon"><FiFileText /></span>
                            <h4>Descripción</h4>
                        </div>
                        <div className="card-body-modern description-card">
                            <div className="description-text">
                                {ticket.Descripcion || 'Sin descripción'}
                            </div>
                        </div>
                    </div>

                    {ticket.Detalles && ticket.Detalles.length > 0 && (
                        <div className="details-card-modern blocks-card">
                            <div className="card-header-modern">
                                <span className="card-icon"><FiPackage /></span>
                                <h4>Bloques Solicitados</h4>
                                <span className="blocks-progress">
                                    {ticket.Detalles.length} bloque{ticket.Detalles.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="card-body-modern blocks-grid-modern">
                                {ticket.Detalles.map((detalle, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`block-chip-modern ${detalle.esCompleto ? 'block-complete' : 'block-pending'}`}
                                    >
                                        <span className="block-code">{detalle.NoParte || detalle.BloqueId}</span>
                                        <span className="block-qty">×{detalle.Cantidad}</span>
                                        {detalle.esCompleto ? (
                                            <span className="block-status ok"><FiCheckCircle /></span>
                                        ) : (
                                            <span className="block-status wait"><FiClock /></span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* FOOTER */}
            <div className="ticket-details-footer-modern">
                <button className="footer-btn primary" onClick={onClose}>
                    <FiCheckCircle style={{marginRight: 6}} />
                    Cerrar
                </button>
            </div>
        </div>
    );
};