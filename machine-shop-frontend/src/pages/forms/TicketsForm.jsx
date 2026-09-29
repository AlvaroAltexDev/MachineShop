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
    const detallesListRef = useRef(null);

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

    // Cargar bloques para el select (devuelve la lista para reutilizarla)
    const fetchBlocks = async () => {
        setLoadingBlocks(true);
        try {
            const response = await api.get('/bloquesSelect');
            const data = response.data || [];
            setBlocks(data);
            return data;
        } catch (error) {
            console.error('Error al cargar bloques:', error);
            showToast.error('Error al cargar los bloques', {
                duration: 3000,
                position: "top-right",
            });
            return [];
        } finally {
            setLoadingBlocks(false);
        }
    };

    useEffect(() => {
        fetchBlocks();
    }, []);

    // Al agregar una fila, bajar el scroll al último agregado
    const detallesCountRef = useRef(formData.Detalles.length);
    useEffect(() => {
        const prev = detallesCountRef.current;
        detallesCountRef.current = formData.Detalles.length;
        if (formData.Detalles.length > prev && detallesListRef.current) {
            detallesListRef.current.scrollTop = detallesListRef.current.scrollHeight;
        }
    }, [formData.Detalles.length]);

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
            showToast.warning('Must have at least one detail', {
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

    // ✅ Cuando se crea un nuevo bloque: se recarga la lista (sin tocar el
    // resto del formulario) y se auto-selecciona en la fila que abrió el modal
    const handleBlockCreated = async () => {
        setIsBlockModalOpen(false);
        const fresh = await fetchBlocks();
        const newest = fresh && fresh.length > 0 ? fresh[0].NoParte : null;
        if (newest && selectedBlockIndex !== null) {
            setFormData(prev => ({
                ...prev,
                Detalles: prev.Detalles.map((d, i) =>
                    i === selectedBlockIndex ? { ...d, BloqueId: newest } : d
                )
            }));
            showToast.success(`Block ${newest} created and selected`, {
                duration: 3000,
                position: "top-right",
            });
        } else if (newest) {
            showToast.success('Block created successfully. Select it in the field.', {
                duration: 3000,
                position: "top-right",
            });
        }
        setSelectedBlockIndex(null);
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
                showToast.error('Please select a desired date', {
                    duration: 3000,
                    position: "top-right",
                });
                setLoading(false);
                return;
            }

            if (!formData.PrioridadId) {
                showToast.error('Please select a priority', {
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
                    showToast.error('Could not determine user area', {
                        duration: 3000,
                        position: "top-right",
                    });
                    setLoading(false);
                    return;
                }

                const tieneCritico = await verificarTicketCritico(areaId);

                if (tieneCritico) {
                    showToast.error(
                        '❌ A CRITICAL ticket already exists in your area. ' +
                        'Multiple critical tickets per area are not allowed.',
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
                                '❌ A CRITICAL ticket already exists in your area. ' +
                                'Multiple critical tickets per area are not allowed.',
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
                showToast.error('All details must have a valid block and quantity', {
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
                showToast.success('Ticket updated successfully', {
                    duration: 3000,
                    position: "top-right",
                });
            } else {
                response = await api.post('/ticketsInsert', dataToSend);
                showToast.success(response.data?.message || 'Ticket created successfully', {
                    duration: 4000,
                    position: "top-right",
                });
            }

            if (onSuccess) {
                onSuccess(response.data);
            }

        } catch (error) {
            console.error('❌ Error al procesar ticket:', error);
            console.error('Detalles:', error.response?.data);

            const errorMessage = error.response?.data?.error || 'Error processing ticket';
            showToast.error(errorMessage, {
                duration: 5000,
                position: "top-right",
            });
        } finally {
            setLoading(false);
        }
    };

    // Borrador: resumen de bloques agregados (evitar repetidos y ver faltantes)
    const conteoBloques = {};
    formData.Detalles.forEach(d => {
        if (d.BloqueId) conteoBloques[d.BloqueId] = (conteoBloques[d.BloqueId] || 0) + 1;
    });
    const bloquesRepetidos = Object.keys(conteoBloques).filter(k => conteoBloques[k] > 1);
    const filasSinBloque = formData.Detalles.filter(d => !d.BloqueId).length;
    const totalPiezas = formData.Detalles.reduce((a, d) => a + (parseInt(d.Cantidad, 10) || 0), 0);

    return (
        <>
            <div className="tickets-layout">
            <form className="form-container tickets-form" onSubmit={handleSubmit}>
                {/* Título de la sección */}
                <h3 className="form-section-title">
                    <FiFileText />
                    General Information
                </h3>

                <div className="tickets-form-row">
                    {/* Columna Izquierda */}
                    <div className="tickets-form-column">
                        <div className="form-group">
                            <label className="form-label">
                                <FiUser className="form-icon" />
                                Requester
                            </label>
                            <input
                                type="text"
                                value={user?.nombre || 'Current user'}
                                className="form-input"
                                disabled
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                <FiCalendar className="form-icon" />
                                Desired Date *
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
                                Date you want to receive the connectors
                            </small>
                        </div>
                    </div>

                    {/* Columna Derecha */}
                    <div className="tickets-form-column">
                        <div className="form-group">
                            <label className="form-label">
                                <FiFlag className="form-icon" />
                                Priority *
                            </label>
                            <select
                                name="PrioridadId"
                                value={formData.PrioridadId || ''}
                                onChange={handleChange}
                                className="form-input"
                                required
                            >
                                <option value="">Select a priority</option>
                                {prioridadOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {formData.PrioridadId === getCriticaId() && !isEditing && (
                                <small className="form-hint" style={{ color: '#dc3545' }}>
                                    ⚠️ Selecting CRITICAL will check if one already exists in your area
                                </small>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                <FiFileText className="form-icon" />
                                Description
                            </label>
                            <textarea
                                name="Descripcion"
                                value={formData.Descripcion}
                                onChange={handleChange}
                                className="form-textarea"
                                rows="3"
                                placeholder="Briefly describe the reason for the ticket..."
                            />
                        </div>
                    </div>
                </div>

                {/* SECCIÓN: Bloques Solicitados */}
                <div className="tickets-form-section">
                    <div className="form-section-header">
                        <h3 className="form-section-title">
                            <FiPlus />
                            Requested Blocks
                        </h3>
                        <button
                            type="button"
                            className="button-add-small"
                            onClick={addDetalle}
                            disabled={loadingBlocks}
                        >
                            <FiPlus />
                            Add Block
                        </button>
                    </div>

                    {loadingBlocks ? (
                        <div className="loading-state">Loading blocks...</div>
                    ) : (
                        <div className="detalles-list" ref={detallesListRef}>
                            {formData.Detalles.map((detalle, index) => (
                                <div className="detalle-item" key={index}>
                                    <div className="detalle-row">
                                        <div className="detalle-number">{index + 1}</div>
                                        <div className="detalle-fields">
                                            <div className="form-group">
                                                <label>Block/Connector *</label>
                                                <div className="select-with-button">
                                                    <Select
                                                        options={blockOptions}
                                                        value={getSelectedOption(detalle.BloqueId)}
                                                        onChange={(option) => handleBlockSelect(index, option)}
                                                        placeholder="Search by part number..."
                                                        isClearable
                                                        styles={customSelectStyles}
                                                        className="react-select-container"
                                                        classNamePrefix="react-select"
                                                        isLoading={loadingBlocks}
                                                        menuPosition="fixed"
                                                        menuPlacement="auto"
                                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                        noOptionsMessage={() => 'No blocks found'}
                                                        loadingMessage={() => 'Loading blocks...'}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="add-block-btn"
                                                        onClick={() => handleOpenBlockModal(index)}
                                                        title="Add new block"
                                                    >
                                                        <FiPlusCircle size={20} />
                                                    </button>
                                                </div>
                                                {detalle.BloqueId && blockStatusMap[detalle.BloqueId] && (
                                                    <div className="block-mini-status">
                                                        <span
                                                            className={`mini-dot mini-drawings ${toBoolFlag(blockStatusMap[detalle.BloqueId]?.DibujosCompleto) ? 'on' : ''}`}
                                                            title="Drawings complete"
                                                        />
                                                        <span className="mini-label">D</span>
                                                        <span
                                                            className={`mini-dot mini-programs ${toBoolFlag(blockStatusMap[detalle.BloqueId]?.ProgramasCompleto) ? 'on' : ''}`}
                                                            title="Programs complete"
                                                        />
                                                        <span className="mini-label">P</span>
                                                        <span
                                                            className={`mini-dot mini-ensamble ${toBoolFlag(blockStatusMap[detalle.BloqueId]?.EnsambleCompleto) ? 'on' : ''}`}
                                                            title="Assembly complete"
                                                        />
                                                        <span className="mini-label">E</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="form-group">
                                                <label>Quantity *</label>
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
                                            title="Remove detail"
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {formData.Detalles.length === 0 && (
                                <div className="empty-detalles">
                                    <p>No blocks added</p>
                                    <button
                                        type="button"
                                        className="button-add-small"
                                        onClick={addDetalle}
                                    >
                                        <FiPlus />
                                        Add Block
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
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="button-save"
                        disabled={loading || loadingBlocks || checkingCritico}
                    >
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                {isEditing ? 'UPDATING...' : 'CREATING TICKET...'}
                            </>
                        ) : checkingCritico ? (
                            <>
                                <span className="spinner"></span>
                                VERIFYING...
                            </>
                        ) : (
                            isEditing ? 'UPDATE TICKET' : 'CREATE TICKET'
                        )}
                    </button>
                </div>
            </form>

                {/* BORRADOR lateral: lo que llevas agregado */}
                <aside className="tickets-draft">
                    <div className="draft-header">
                        <FiFileText />
                        <h4>Draft</h4>
                        <span className="draft-count">{formData.Detalles.filter(d => d.BloqueId).length}/{formData.Detalles.length}</span>
                    </div>
                    {totalPiezas > 0 && (
                        <div className="draft-total">Total pieces: <strong>×{totalPiezas}</strong></div>
                    )}
                    {formData.Detalles.length === 0 || formData.Detalles.every(d => !d.BloqueId) ? (
                        <p className="draft-empty">No blocks added yet.<br />Each block you choose appears here.</p>
                    ) : (
                        <div className="draft-list">
                            {formData.Detalles.map((d, i) => {
                                if (!d.BloqueId) return null;
                                const st = blockStatusMap[d.BloqueId];
                                const repetido = conteoBloques[d.BloqueId] > 1;
                                return (
                                    <div key={i} className={`draft-item ${repetido ? 'dup' : ''}`}>
                                        <span className="draft-num">{i + 1}</span>
                                        <span className="draft-name" title={d.BloqueId}>{d.BloqueId}</span>
                                        <span className="draft-qty">×{d.Cantidad}</span>
                                        {st && (
                                            <span className="draft-dots">
                                                <span className={`mini-dot mini-drawings ${toBoolFlag(st?.DibujosCompleto) ? 'on' : ''}`} title="Dibujos" />
                                                <span className={`mini-dot mini-programs ${toBoolFlag(st?.ProgramasCompleto) ? 'on' : ''}`} title="Programas" />
                                                <span className={`mini-dot mini-ensamble ${toBoolFlag(st?.EnsambleCompleto) ? 'on' : ''}`} title="Ensamble" />
                                            </span>
                                        )}
                                        {repetido && <span className="draft-dup" title="This block is duplicated">!</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {filasSinBloque > 0 && (
                        <p className="draft-warn">You still need to choose a block in {filasSinBloque} row{filasSinBloque !== 1 ? 's' : ''}.</p>
                    )}
                    {bloquesRepetidos.length > 0 && (
                        <p className="draft-warn dup">Duplicated: {bloquesRepetidos.join(', ')}</p>
                    )}
                </aside>
            </div>

            {/* ✅ MODAL PARA AGREGAR NUEVO BLOQUE */}
            <Modal
                isOpen={isBlockModalOpen}
                onClose={() => setIsBlockModalOpen(false)}
                title="Add New Block/Connector"
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