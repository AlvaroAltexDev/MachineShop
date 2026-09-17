import React, { useState, useEffect, useContext, useRef } from 'react';
import api from '../../api/api';
import { AuthContext } from '../../context/AuthProvider';
import { showToast } from 'nextjs-toast-notify';
import { FiPlus, FiX, FiTrash2, FiCalendar, FiFlag, FiFileText, FiUser, FiPlusCircle } from 'react-icons/fi';
import Select from 'react-select';
import { Modal } from '../../components/Modal'; 
import { BlocksForm } from './BlocksForm'; 

export const TicketsForm = ({ ticket, isEditing = false, onSuccess, onCancel }) => {
    const { user } = useContext(AuthContext);
    const [blocks, setBlocks] = useState([]);
    const [prioridades, setPrioridades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingBlocks, setLoadingBlocks] = useState(true);
    const [loadingPrioridades, setLoadingPrioridades] = useState(true);
    const [checkingCritico, setCheckingCritico] = useState(false);
    
    // 👈 Estados para el modal de bloques
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [selectedBlockIndex, setSelectedBlockIndex] = useState(null);
    const [shouldRefreshBlocks, setShouldRefreshBlocks] = useState(false);

    // ✅ Estado del formulario
    const [formData, setFormData] = useState({
        SolicitanteId: user?.noEmp || '',
        FechaDeseada: '',
        PrioridadId: '',
        Descripcion: '',
        Detalles: [
            { BloqueId: '', Cantidad: 1 }
        ]
    });

    // 👈 Estado de completitud por bloque seleccionado (D/P/E compacto)
    const [blockStatusMap, setBlockStatusMap] = useState({});
    const fetchedStatusRef = useRef(new Set());
    const toBoolFlag = (v) => v === true || v === 1 || v === '1';

    useEffect(() => {
        formData.Detalles.forEach(d => {
            const id = d.BloqueId;
            if (!id || fetchedStatusRef.current.has(id)) return;
            fetchedStatusRef.current.add(id);
            api.get(`/bloquesGetStatus/${id}`)
                .then(r => setBlockStatusMap(prev => ({ ...prev, [id]: r.data })))
                .catch(() => { });
        });
    }, [formData.Detalles]);

    // Cargar bloques para el select
    const fetchBlocks = async () => {
        setLoadingBlocks(true);
        try {
            const response = await api.get('/bloquesSelect');
            setBlocks(response.data || []);
        } catch (error) {
            console.error('Error al cargar bloques:', error);
            showToast.error('Error al cargar los bloques', {
                duration: 3000,
                position: "top-right",
            });
        } finally {
            setLoadingBlocks(false);
        }
    };

    useEffect(() => {
        fetchBlocks();
    }, []);

    // ✅ Recargar bloques cuando se cierre el modal
    useEffect(() => {
        if (shouldRefreshBlocks) {
            fetchBlocks();
            setShouldRefreshBlocks(false);
        }
    }, [shouldRefreshBlocks]);

    // Cargar prioridades
    useEffect(() => {
        const fetchPrioridades = async () => {
            try {
                const response = await api.get('/prioridadesSelectAll');
                setPrioridades(response.data || []);
            } catch (error) {
                console.error('Error al cargar prioridades:', error);
                showToast.error('Error al cargar las prioridades', {
                    duration: 3000,
                    position: "top-right",
                });
            } finally {
                setLoadingPrioridades(false);
            }
        };
        fetchPrioridades();
    }, []);

    // Si es edición, cargar datos del ticket
    useEffect(() => {
        console.log('👤 Usuario:', user);
        if (isEditing && ticket) {
            setFormData({
                SolicitanteId: ticket.SolicitanteId || user?.noEmp || '',
                FechaDeseada: ticket.FechaDeseada || '',
                PrioridadId: ticket.PrioridadId || ticket.Prioridad || '',
                Descripcion: ticket.Descripcion || '',
                Detalles: ticket.Detalles?.length > 0
                    ? ticket.Detalles.map(d => ({
                        BloqueId: d.BloqueId || '',
                        Cantidad: d.Cantidad || 1
                    }))
                    : [{ BloqueId: '', Cantidad: 1 }]
            });
        }
    }, [isEditing, ticket, user]);

    // ✅ Función para verificar si ya existe un ticket crítico en el área
    const verificarTicketCritico = async (areaId) => {
        if (!areaId) return false;

        setCheckingCritico(true);
        try {
            const response = await api.get(`/ticketsCheckCritico/${areaId}`);
            return response.data.tieneCritico;
        } catch (error) {
            console.error('Error al verificar ticket crítico:', error);
            return false;
        } finally {
            setCheckingCritico(false);
        }
    };

    // Agregar una línea de detalle
    const addDetalle = () => {
        setFormData(prev => ({
            ...prev,
            Detalles: [...prev.Detalles, { BloqueId: '', Cantidad: 1 }]
        }));
    };

    // Eliminar una línea de detalle
    const removeDetalle = (index) => {
        if (formData.Detalles.length <= 1) {
            showToast.warning('Debe tener al menos un detalle', {
                duration: 3000,
                position: "top-right",
            });
            return;
        }
        setFormData(prev => ({
            ...prev,
            Detalles: prev.Detalles.filter((_, i) => i !== index)
        }));
    };

    // Actualizar un detalle
    const updateDetalle = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            Detalles: prev.Detalles.map((d, i) =>
                i === index ? { ...d, [field]: value } : d
            )
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleBlockSelect = (index, selectedOption) => {
        updateDetalle(index, 'BloqueId', selectedOption ? selectedOption.value : '');
    };

    // ✅ Abrir el modal para agregar un nuevo bloque
    const handleOpenBlockModal = (index) => {
        setSelectedBlockIndex(index);
        setIsBlockModalOpen(true);
    };

    // ✅ Cuando se crea un nuevo bloque exitosamente
    const handleBlockCreated = () => {
        setIsBlockModalOpen(false);
        setShouldRefreshBlocks(true);
        showToast.success('Bloque creado correctamente. Selecciónalo en el campo.', {
            duration: 3000,
            position: "top-right",
        });
    };

    const blockOptions = blocks.map(block => ({
        value: block.NoParte,
        label: `${block.NoParte}`
    }));

    const getSelectedOption = (bloqueId) => {
        return blockOptions.find(option => option.value === bloqueId) || null;
    };

    const prioridadOptions = prioridades.map(p => ({
        value: String(p.IdPrioridad),
        label: p.Prioridad
    }));

    // ✅ Obtener el ID de la prioridad "CRITICA"
    const getCriticaId = () => {
        const critica = prioridades.find(p => p.Prioridad?.toUpperCase() === 'CRITICA');
        return critica ? String(critica.IdPrioridad) : null;
    };

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            border: '2px solid #e9ecef',
            borderRadius: '8px',
            padding: '0px 4px',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(220, 53, 69, 0.08)' : 'none',
            borderColor: state.isFocused ? '#dc3545' : '#e9ecef',
            '&:hover': {
                borderColor: '#ced4da',
            },
            fontSize: '0.9rem',
            minHeight: '42px',
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected ? '#dc3545' : state.isFocused ? '#f8f9fa' : 'white',
            color: state.isSelected ? 'white' : '#2d3436',
            '&:hover': {
                backgroundColor: state.isSelected ? '#dc3545' : '#f1f3f5',
            },
            padding: '8px 14px',
            fontSize: '0.85rem',
            cursor: 'pointer',
        }),
        menu: (provided) => ({
            ...provided,
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e9ecef',
            zIndex: 100,
        }),
        menuPortal: (provided) => ({
            ...provided,
            zIndex: 9999,
        }),
        placeholder: (provided) => ({
            ...provided,
            color: '#adb5bd',
            fontSize: '0.85rem',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: '#2d3436',
            fontSize: '0.85rem',
        }),
        input: (provided) => ({
            ...provided,
            fontSize: '0.85rem',
        }),
        noOptionsMessage: (provided) => ({
            ...provided,
            color: '#6c757d',
            fontSize: '0.85rem',
            padding: '12px',
        }),
    };

    // ✅ VALIDACIÓN PRINCIPAL
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validaciones básicas
            if (!formData.FechaDeseada) {
                showToast.error('Por favor seleccione una fecha deseada', {
                    duration: 3000,
                    position: "top-right",
                });
                setLoading(false);
                return;
            }

            if (!formData.PrioridadId) {
                showToast.error('Por favor seleccione una prioridad', {
                    duration: 3000,
                    position: "top-right",
                });
                setLoading(false);
                return;
            }

            // ✅ VALIDACIÓN: Verificar si es CRÍTICO y si ya existe uno en el área
            const criticaId = getCriticaId();
            const isCritico = formData.PrioridadId === criticaId;

            if (isCritico && !isEditing) {
                // Solo verificar si es NUEVO ticket (no edición)
                const areaId = user?.areaId;

                if (!areaId) {
                    showToast.error('No se pudo determinar el área del usuario', {
                        duration: 3000,
                        position: "top-right",
                    });
                    setLoading(false);
                    return;
                }

                const tieneCritico = await verificarTicketCritico(areaId);

                if (tieneCritico) {
                    showToast.error(
                        '❌ Ya existe un ticket CRÍTICO activo en tu área. ' +
                        'No se pueden crear múltiples tickets críticos por área.',
                        {
                            duration: 6000,
                            position: "top-right",
                        }
                    );
                    setLoading(false);
                    return;
                }
            }

            // ✅ Validación para edición: Si se está editando y se cambia a CRÍTICO
            if (isCritico && isEditing) {
                const areaId = user?.areaId;

                if (areaId) {
                    const tieneCritico = await verificarTicketCritico(areaId);

                    // Si ya existe un crítico y NO es el mismo ticket que se está editando
                    if (tieneCritico) {
                        // Verificar si el ticket actual es el que tiene el crítico
                        const currentTicketCritico = ticket?.PrioridadId === criticaId;

                        if (!currentTicketCritico) {
                            showToast.error(
                                '❌ Ya existe un ticket CRÍTICO activo en tu área. ' +
                                'No se pueden crear múltiples tickets críticos por área.',
                                {
                                    duration: 6000,
                                    position: "top-right",
                                }
                            );
                            setLoading(false);
                            return;
                        }
                    }
                }
            }

            // Validar que todos los detalles tengan BloqueId y Cantidad > 0
            const detallesInvalidos = formData.Detalles.some(
                d => !d.BloqueId || d.Cantidad <= 0
            );

            if (detallesInvalidos) {
                showToast.error('Todos los detalles deben tener un bloque y cantidad válida', {
                    duration: 3000,
                    position: "top-right",
                });
                setLoading(false);
                return;
            }

            const dataToSend = {
                SolicitanteId: formData.SolicitanteId,
                FechaDeseada: formData.FechaDeseada,
                PrioridadId: formData.PrioridadId,
                Descripcion: formData.Descripcion || '',
                Detalles: formData.Detalles.map(d => ({
                    BloqueId: d.BloqueId,
                    Cantidad: parseInt(d.Cantidad)
                }))
            };

            console.log('📤 Enviando ticket:', dataToSend);

            let response;
            if (isEditing && ticket) {
                response = await api.put(`/ticketsUpdate/${ticket.IdTicket}`, dataToSend);
                showToast.success('Ticket actualizado correctamente', {
                    duration: 3000,
                    position: "top-right",
                });
            } else {
                response = await api.post('/ticketsInsert', dataToSend);
                showToast.success('Ticket creado correctamente', {
                    duration: 3000,
                    position: "top-right",
                });
            }

            if (onSuccess) {
                onSuccess(response.data);
            }

        } catch (error) {
            console.error('❌ Error al procesar ticket:', error);
            console.error('Detalles:', error.response?.data);

            const errorMessage = error.response?.data?.error || 'Error al procesar el ticket';
            showToast.error(errorMessage, {
                duration: 5000,
                position: "top-right",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <form className="form-container tickets-form" onSubmit={handleSubmit}>
                {/* Título de la sección */}
                <h3 className="form-section-title">
                    <FiFileText />
                    Información General
                </h3>

                <div className="tickets-form-row">
                    {/* Columna Izquierda */}
                    <div className="tickets-form-column">
                        <div className="form-group">
                            <label className="form-label">
                                <FiUser className="form-icon" />
                                Solicitante
                            </label>
                            <input
                                type="text"
                                value={user?.nombre || 'Usuario actual'}
                                className="form-input"
                                disabled
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                <FiCalendar className="form-icon" />
                                Fecha Deseada *
                            </label>
                            <input
                                type="date"
                                name="FechaDeseada"
                                value={formData.FechaDeseada}
                                onChange={handleChange}
                                className="form-input"
                                required
                                min={new Date().toISOString().split('T')[0]}
                            />
                            <small className="form-hint">
                                Fecha en la que deseas recibir los conectores
                            </small>
                        </div>
                    </div>

                    {/* Columna Derecha */}
                    <div className="tickets-form-column">
                        <div className="form-group">
                            <label className="form-label">
                                <FiFlag className="form-icon" />
                                Prioridad *
                            </label>
                            <select
                                name="PrioridadId"
                                value={formData.PrioridadId || ''}
                                onChange={handleChange}
                                className="form-input"
                                required
                            >
                                <option value="">Seleccione una prioridad</option>
                                {prioridadOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {formData.PrioridadId === getCriticaId() && !isEditing && (
                                <small className="form-hint" style={{ color: '#dc3545' }}>
                                    ⚠️ Al seleccionar CRÍTICO, se verificará si ya existe uno en tu área
                                </small>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                <FiFileText className="form-icon" />
                                Descripción
                            </label>
                            <textarea
                                name="Descripcion"
                                value={formData.Descripcion}
                                onChange={handleChange}
                                className="form-textarea"
                                rows="3"
                                placeholder="Describe brevemente el motivo del ticket..."
                            />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN: Bloques Solicitados */}
                <div className="tickets-form-section">
                    <div className="form-section-header">
                        <h3 className="form-section-title">
                            <FiPlus />
                            Bloques Solicitados
                        </h3>
                        <button
                            type="button"
                            className="button-add-small"
                            onClick={addDetalle}
                            disabled={loadingBlocks}
                        >
                            <FiPlus />
                            Agregar Bloque
                        </button>
                    </div>

                    {loadingBlocks ? (
                        <div className="loading-state">Cargando bloques...</div>
                    ) : (
                        <div className="detalles-list">
                            {formData.Detalles.map((detalle, index) => (
                                <div className="detalle-item" key={index}>
                                    <div className="detalle-row">
                                        <div className="detalle-number">{index + 1}</div>
                                        <div className="detalle-fields">
                                            <div className="form-group">
                                                <label>Bloque/Conector *</label>
                                                <div className="select-with-button">
                                                    <Select
                                                        options={blockOptions}
                                                        value={getSelectedOption(detalle.BloqueId)}
                                                        onChange={(option) => handleBlockSelect(index, option)}
                                                        placeholder="Buscar por número de parte..."
                                                        isClearable
                                                        styles={customSelectStyles}
                                                        className="react-select-container"
                                                        classNamePrefix="react-select"
                                                        isLoading={loadingBlocks}
                                                        menuPosition="fixed"
                                                        menuPlacement="auto"
                                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                        noOptionsMessage={() => 'No se encontraron bloques'}
                                                        loadingMessage={() => 'Cargando bloques...'}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="add-block-btn"
                                                        onClick={() => handleOpenBlockModal(index)}
                                                        title="Agregar nuevo bloque"
                                                    >
                                                        <FiPlusCircle size={20} />
                                                    </button>
                                                </div>
                                                {detalle.BloqueId && blockStatusMap[detalle.BloqueId] && (
                                                    <div className="block-mini-status">
                                                        <span
                                                            className={`mini-dot mini-drawings ${toBoolFlag(blockStatusMap[detalle.BloqueId]?.DibujosCompleto) ? 'on' : ''}`}
                                                            title="Dibujos completos"
                                                        />
                                                        <span className="mini-label">D</span>
                                                        <span
                                                            className={`mini-dot mini-programs ${toBoolFlag(blockStatusMap[detalle.BloqueId]?.ProgramasCompleto) ? 'on' : ''}`}
                                                            title="Programas completos"
                                                        />
                                                        <span className="mini-label">P</span>
                                                        <span
                                                            className={`mini-dot mini-ensamble ${toBoolFlag(blockStatusMap[detalle.BloqueId]?.EnsambleCompleto) ? 'on' : ''}`}
                                                            title="Ensamble completo"
                                                        />
                                                        <span className="mini-label">E</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="form-group">
                                                <label>Cantidad *</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={detalle.Cantidad}
                                                    onChange={(e) => updateDetalle(index, 'Cantidad', parseInt(e.target.value) || 1)}
                                                    className="form-input"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="remove-detalle-btn"
                                            onClick={() => removeDetalle(index)}
                                            title="Eliminar detalle"
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {formData.Detalles.length === 0 && (
                                <div className="empty-detalles">
                                    <p>No hay bloques agregados</p>
                                    <button
                                        type="button"
                                        className="button-add-small"
                                        onClick={addDetalle}
                                    >
                                        <FiPlus />
                                        Agregar Bloque
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ACCIONES */}
                <div className="tickets-form-actions">
                    <button
                        type="button"
                        className="button-cancel"
                        onClick={onCancel}
                        disabled={loading || checkingCritico}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="button-save"
                        disabled={loading || loadingBlocks || checkingCritico}
                    >
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                {isEditing ? 'ACTUALIZANDO...' : 'CREANDO TICKET...'}
                            </>
                        ) : checkingCritico ? (
                            <>
                                <span className="spinner"></span>
                                VERIFICANDO...
                            </>
                        ) : (
                            isEditing ? 'ACTUALIZAR TICKET' : 'CREAR TICKET'
                        )}
                    </button>
                </div>
            </form>

            {/* ✅ MODAL PARA AGREGAR NUEVO BLOQUE */}
            <Modal
                isOpen={isBlockModalOpen}
                onClose={() => setIsBlockModalOpen(false)}
                title="Agregar Nuevo Bloque/Conector"
                size="large"
            >
                <BlocksForm
                    onSuccess={handleBlockCreated}
                    onCancel={() => setIsBlockModalOpen(false)}
                />
            </Modal>
        </>
    );
};