import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { Modal } from '../components/Modal';
import api from '../api/api';
import socket from '../api/socket';
import { AuthContext } from '../context/AuthProvider';
import {
    FiBox, FiTool, FiPackage, FiPlus, FiEdit2, FiTrash2,
    FiArrowUpCircle, FiArrowDownCircle, FiClock, FiSearch,
    FiAlertTriangle, FiChevronDown, FiCheckCircle, FiMinus,
    FiCheck, FiX
} from "react-icons/fi";
import { showToast } from 'nextjs-toast-notify';
import Swal from "sweetalert2";

const emptyMaterial = { Material: '', Descripcion: '', Largo: '', Ancho: '', Cant: 0, StockMinimo: 0, TipoMaterialId: '', SubtipoMaterialId: '' };
const emptyHerramienta = { Herramienta: '', TipoHerramientaId: '', Cant: 0, Size: '', MaterialHerramienta: '' };

export const InventarioPage = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const isAdmin = Number(user?.rolId) === 1;

    const [activeTab, setActiveTab] = useState('materiales');
    const [search, setSearch] = useState('');

    const [materiales, setMateriales] = useState([]);
    const [herramientas, setHerramientas] = useState([]);
    const [tiposMaterial, setTiposMaterial] = useState([]);
    const [tiposHerramienta, setTiposHerramienta] = useState([]);
    const [subtiposMaterial, setSubtiposMaterial] = useState([]);
    const [demanda, setDemanda] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tipoExpandido, setTipoExpandido] = useState(null);
    const [nuevoSubtipo, setNuevoSubtipo] = useState('');
    const [editandoTipo, setEditandoTipo] = useState(null);
    const [nombreEdit, setNombreEdit] = useState('');

    // Modales
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState(emptyMaterial);
    const [isTipoOpen, setIsTipoOpen] = useState(false);
    const [nuevoTipo, setNuevoTipo] = useState('');
    const [isMovOpen, setIsMovOpen] = useState(false);
    const [movTarget, setMovTarget] = useState(null);
    const [movData, setMovData] = useState({ TipoMov: 'entrada', Cantidad: 1, Comentario: '' });
    const [isKardexOpen, setIsKardexOpen] = useState(false);
    const [kardex, setKardex] = useState([]);
    const [kardexTarget, setKardexTarget] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [m, h, tm, th, sm, d] = await Promise.all([
                api.get('/materialesSelect'),
                api.get('/herramientasSelect'),
                api.get('/tiposMaterialSelect'),
                api.get('/tiposHerramientaSelect'),
                api.get('/subtiposMaterialSelect'),
                api.get('/inventarioDemandaBlocks'),
            ]);
            setMateriales(m.data || []);
            setHerramientas(h.data || []);
            setTiposMaterial(tm.data || []);
            setTiposHerramienta(th.data || []);
            setSubtiposMaterial(sm.data || []);
            setDemanda(d.data || []);
        } catch (error) {
            console.error('Error al cargar inventario:', error);
            showToast.error('Error al cargar el inventario', { duration: 3000, position: "top-right" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        const h = () => fetchAll();
        socket.on('inventarioActualizado', h);
        return () => socket.off('inventarioActualizado', h);
    }, [fetchAll]);

    if (!isAdmin) {
        return (
            <>
                <Navbar />
                <div className="page-container full-width">
                    <div className="empty-state-tickets">
                        <FiBox size={48} />
                        <h3>Sin acceso</h3>
                        <p>El inventario es solo para administradores</p>
                    </div>
                </div>
            </>
        );
    }

    const term = search.toLowerCase();
    const matFiltrados = materiales.filter(m =>
        !term || m.Material?.toLowerCase().includes(term) ||
        m.Descripcion?.toLowerCase().includes(term) ||
        m.TipoMaterial?.toLowerCase().includes(term) ||
        m.SubtipoMaterial?.toLowerCase().includes(term)
    );
    const subtiposDelTipo = (tipoId) =>
        subtiposMaterial.filter(s => String(s.TipoMaterialId) === String(tipoId));
    const herFiltradas = herramientas.filter(h =>
        !term || h.Herramienta?.toLowerCase().includes(term) ||
        h.TipoHerramienta?.toLowerCase().includes(term) ||
        h.MaterialHerramienta?.toLowerCase().includes(term)
    );
    const demFiltrada = demanda.filter(d =>
        !term || String(d.NoParte)?.toLowerCase().includes(term)
    );

    const bajoStock = (cant, min) => Number(cant) <= Number(min);

    // ---------- Formulario alta/edición ----------
    const openNew = () => {
        setEditing(null);
        setFormData(activeTab === 'materiales' ? { ...emptyMaterial } : { ...emptyHerramienta });
        setIsFormOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        if (activeTab === 'materiales') {
            setFormData({
                Material: row.Material || '', Descripcion: row.Descripcion || '',
                Largo: row.Largo || '', Ancho: row.Ancho || '',
                Cant: row.Cant ?? 0, StockMinimo: row.StockMinimo ?? 0,
                TipoMaterialId: row.TipoMaterialId ? String(row.TipoMaterialId) : '',
                SubtipoMaterialId: row.SubtipoMaterialId ? String(row.SubtipoMaterialId) : ''
            });
        } else {
            setFormData({
                Herramienta: row.Herramienta || '',
                TipoHerramientaId: row.TipoHerramientaId ? String(row.TipoHerramientaId) : '',
                Cant: row.Cant ?? 0, Size: row.Size || '', MaterialHerramienta: row.MaterialHerramienta || ''
            });
        }
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (activeTab === 'materiales') {
                const payload = { ...formData, UsuarioId: user?.noEmp };
                if (editing) {
                    await api.put(`/materialesUpdate/${editing.IdMateriales}`, payload);
                    showToast.success('Material actualizado', { duration: 3000, position: "top-right" });
                } else {
                    await api.post('/materialesInsert', payload);
                    showToast.success('Material creado', { duration: 3000, position: "top-right" });
                }
            } else {
                const payload = { ...formData, UsuarioId: user?.noEmp };
                if (editing) {
                    delete payload.Cant;
                    await api.put(`/herramientasUpdate/${editing.IdHerramienta}`, payload);
                    showToast.success('Herramienta actualizada', { duration: 3000, position: "top-right" });
                } else {
                    await api.post('/herramientasInsert', payload);
                    showToast.success('Herramienta creada', { duration: 3000, position: "top-right" });
                }
            }
            setIsFormOpen(false);
            fetchAll();
        } catch (error) {
            console.error(error);
            showToast.error(error.response?.data?.error || 'Error al guardar', { duration: 4000, position: "top-right" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row) => {
        const nombre = activeTab === 'materiales' ? row.Material : row.Herramienta;
        const result = await Swal.fire({
            title: '¿Eliminar?',
            html: `¿Eliminar <strong>${nombre}</strong> del inventario?<br>No debe tener movimientos registrados.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#D71928',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            background: '#3F3F42',
            color: '#fff',
            customClass: { popup: 'swal-dark-popup' }
        });
        if (!result.isConfirmed) return;
        try {
            if (activeTab === 'materiales') {
                await api.delete(`/materialesDelete/${row.IdMateriales}`, { data: { UsuarioId: user?.noEmp } });
            } else {
                await api.delete(`/herramientasDelete/${row.IdHerramienta}`, { data: { UsuarioId: user?.noEmp } });
            }
            showToast.success('Eliminado correctamente', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error al eliminar', { duration: 4000, position: "top-right" });
        }
    };

    // ---------- Tipos ----------
    const handleAddTipo = async (e) => {
        e.preventDefault();
        if (!nuevoTipo.trim()) return;
        try {
            if (activeTab === 'materiales') {
                await api.post('/tiposMaterialInsert', { TipoMaterial: nuevoTipo.trim(), UsuarioId: user?.noEmp });
            } else {
                await api.post('/tiposHerramientaInsert', { TipoHerramienta: nuevoTipo.trim(), UsuarioId: user?.noEmp });
            }
            setNuevoTipo('');
            showToast.success('Tipo agregado', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error al agregar tipo', { duration: 4000, position: "top-right" });
        }
    };

    const handleDeleteTipo = async (idTipo) => {
        try {
            if (activeTab === 'materiales') {
                await api.delete(`/tiposMaterialDelete/${idTipo}`, { data: { UsuarioId: user?.noEmp } });
            } else {
                await api.delete(`/tiposHerramientaDelete/${idTipo}`, { data: { UsuarioId: user?.noEmp } });
            }
            showToast.success('Tipo eliminado', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error al eliminar tipo', { duration: 4000, position: "top-right" });
        }
    };

    const handleAddSubtipo = async (e, tipoId) => {
        e.preventDefault();
        if (!nuevoSubtipo.trim()) return;
        try {
            await api.post('/subtiposMaterialInsert', {
                TipoMaterialId: tipoId,
                SubtipoMaterial: nuevoSubtipo.trim(),
                UsuarioId: user?.noEmp
            });
            setNuevoSubtipo('');
            showToast.success('Subtipo agregado', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error al agregar subtipo', { duration: 4000, position: "top-right" });
        }
    };

    const handleDeleteSubtipo = async (idSub) => {
        try {
            await api.delete(`/subtiposMaterialDelete/${idSub}`, { data: { UsuarioId: user?.noEmp } });
            showToast.success('Subtipo eliminado', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error al eliminar subtipo', { duration: 4000, position: "top-right" });
        }
    };

    const startEditTipo = (kind, idT, nombreActual) => {
        setEditandoTipo({ kind, id: idT });
        setNombreEdit(nombreActual || '');
    };

    const cancelEditTipo = () => {
        setEditandoTipo(null);
        setNombreEdit('');
    };

    const saveEditTipo = async (kind, idT) => {
        if (!nombreEdit.trim()) {
            showToast.warning('El nombre no puede estar vacío', { duration: 3000, position: "top-right" });
            return;
        }
        try {
            if (kind === 'sub') {
                await api.put(`/subtiposMaterialUpdate/${idT}`, { SubtipoMaterial: nombreEdit.trim(), UsuarioId: user?.noEmp });
                showToast.success('Subtipo actualizado', { duration: 3000, position: "top-right" });
            } else if (activeTab === 'materiales') {
                await api.put(`/tiposMaterialUpdate/${idT}`, { TipoMaterial: nombreEdit.trim(), UsuarioId: user?.noEmp });
                showToast.success('Tipo actualizado', { duration: 3000, position: "top-right" });
            } else {
                await api.put(`/tiposHerramientaUpdate/${idT}`, { TipoHerramienta: nombreEdit.trim(), UsuarioId: user?.noEmp });
                showToast.success('Tipo actualizado', { duration: 3000, position: "top-right" });
            }
            cancelEditTipo();
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error al actualizar', { duration: 4000, position: "top-right" });
        }
    };

    // ---------- Movimientos ----------
    const openMov = (row, tipo) => {
        setMovTarget({ row, tipo });
        setMovData({ TipoMov: 'entrada', Cantidad: 1, Comentario: '' });
        setIsMovOpen(true);
    };

    const handleMovSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const refId = movTarget.tipo === 'material' ? movTarget.row.IdMateriales : movTarget.row.IdHerramienta;
            const res = await api.post('/inventarioMovimiento', {
                TipoItem: movTarget.tipo,
                ReferenciaId: refId,
                TipoMov: movData.TipoMov,
                Cantidad: parseInt(movData.Cantidad, 10),
                UsuarioId: user?.noEmp,
                Comentario: movData.Comentario || ''
            });
            showToast.success(`Movimiento registrado. Existencia: ${res.data.nuevaExistencia}`, { duration: 3000, position: "top-right" });
            setIsMovOpen(false);
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error al registrar movimiento', { duration: 4000, position: "top-right" });
        } finally {
            setSaving(false);
        }
    };

    const openKardex = async (row, tipo) => {
        const refId = tipo === 'material' ? row.IdMateriales : row.IdHerramienta;
        setKardexTarget({ row, tipo });
        setIsKardexOpen(true);
        try {
            const res = await api.get(`/inventarioMovimientos?tipoItem=${tipo}&referenciaId=${refId}&limite=50`);
            setKardex(res.data || []);
        } catch (error) {
            showToast.error('Error al cargar movimientos', { duration: 3000, position: "top-right" });
            setKardex([]);
        }
    };

    const nombreMov = movTarget ? (movTarget.tipo === 'material' ? movTarget.row.Material : movTarget.row.Herramienta) : '';
    const existenciaMov = movTarget ? Number(movTarget.tipo === 'material' ? movTarget.row.Cant : (movTarget.row.Cant ?? 0)) : 0;

    return (
        <>
            <Navbar />
            <Sidebar />

            <div className="page-container inventario-page">
                {/* HEADER */}
                <div className="tickets-header-modern">
                    <div className="header-left">
                        <div className="header-icon-wrapper">
                            <FiBox className="header-icon" />
                        </div>
                        <div>
                            <h1 className="header-title">Inventario</h1>
                            <p className="header-subtitle">Materiales · Herramientas · Blocks requeridos</p>
                        </div>
                    </div>
                    <div className="header-stats">
                        <div className="stat-item">
                            <span className="stat-number">{materiales.filter(m => bajoStock(m.Cant, m.StockMinimo)).length}</span>
                            <span className="stat-label">Mat. bajo stock</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{demanda.reduce((a, d) => a + Number(d.Requerido || 0), 0)}</span>
                            <span className="stat-label">Blocks requeridos</span>
                        </div>
                    </div>
                    {activeTab !== 'blocks' && (
                        <button className="button-icon button-red" onClick={openNew}>
                            <FiPlus />
                            {activeTab === 'materiales' ? 'Nuevo material' : 'Nueva herramienta'}
                        </button>
                    )}
                </div>

                {/* BUSCADOR */}
                <div className="tickets-filters-discreta">
                    <div className="filters-main">
                        <div className="search-box">
                            <FiSearch />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* TABS */}
                <div className="filters-bar">
                    <button className={`tab-btn ${activeTab === 'materiales' ? 'active' : ''}`} onClick={() => setActiveTab('materiales')}>
                        <FiBox />
                        Materiales
                        <span className="tab-badge">{materiales.length}</span>
                    </button>
                    <button className={`tab-btn ${activeTab === 'herramientas' ? 'active' : ''}`} onClick={() => setActiveTab('herramientas')}>
                        <FiTool />
                        Herramientas
                        <span className="tab-badge">{herramientas.length}</span>
                    </button>
                    <button className={`tab-btn ${activeTab === 'blocks' ? 'active' : ''}`} onClick={() => setActiveTab('blocks')}>
                        <FiPackage />
                        Blocks
                        <span className="tab-badge">{demanda.length}</span>
                    </button>
                </div>

                {/* TABLA MATERIALES */}
                {activeTab === 'materiales' && (
                    <div className="Table">
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th>Tipo</th>
                                        <th>Subtipo</th>
                                        <th>Largo</th>
                                        <th>Ancho</th>
                                        <th>Existencia</th>
                                        <th>Mínimo</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={8}>Cargando...</td></tr>
                                    ) : matFiltrados.length === 0 ? (
                                        <tr><td colSpan={8}>
                                            <div className="inv-empty">
                                                <FiBox size={32} />
                                                <p>Sin materiales.<br />Agrega el primero con “Nuevo material”.</p>
                                            </div>
                                        </td></tr>
                                    ) : matFiltrados.map(m => (
                                        <tr key={m.IdMateriales} style={bajoStock(m.Cant, m.StockMinimo) ? { background: '#fff8e1' } : undefined}>
                                            <td>
                                                <strong>{m.Material}</strong>
                                                {m.Descripcion && <><br /><small>{m.Descripcion}</small></>}
                                                {bajoStock(m.Cant, m.StockMinimo) && (
                                                    <><br /><span className="inv-bajo-stock"><FiAlertTriangle /> Bajo stock</span></>
                                                )}
                                            </td>
                                            <td>{m.TipoMaterial || '—'}</td>
                                            <td>{m.SubtipoMaterial || '—'}</td>
                                            <td>{m.Largo || '—'}</td>
                                            <td>{m.Ancho || '—'}</td>
                                            <td><strong>{m.Cant}</strong></td>
                                            <td>{m.StockMinimo}</td>
                                            <td>
                                                <button className="icon-button" title="Entrada" onClick={() => { openMov(m, 'material'); setMovData({ TipoMov: 'entrada', Cantidad: 1, Comentario: '' }); }}>
                                                    <FiArrowUpCircle />
                                                </button>
                                                <button className="icon-button" title="Salida" onClick={() => { openMov(m, 'material'); setMovData({ TipoMov: 'salida', Cantidad: 1, Comentario: '' }); }}>
                                                    <FiArrowDownCircle />
                                                </button>
                                                <button className="icon-button" title="Ver movimientos" onClick={() => openKardex(m, 'material')}>
                                                    <FiClock />
                                                </button>
                                                <button className="icon-button" title="Editar" onClick={() => openEdit(m)}>
                                                    <FiEdit2 />
                                                </button>
                                                <button className="icon-button" title="Eliminar" onClick={() => handleDelete(m)}>
                                                    <FiTrash2 />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TABLA HERRAMIENTAS */}
                {activeTab === 'herramientas' && (
                    <div className="Table">
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Herramienta</th>
                                        <th>Tipo</th>
                                        <th>Tamaño</th>
                                        <th>Material</th>
                                        <th>Existencia</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={6}>Cargando...</td></tr>
                                    ) : herFiltradas.length === 0 ? (
                                        <tr><td colSpan={6}>
                                            <div className="inv-empty">
                                                <FiTool size={32} />
                                                <p>Sin herramientas.<br />Agrega la primera con “Nueva herramienta”.</p>
                                            </div>
                                        </td></tr>
                                    ) : herFiltradas.map(h => (
                                        <tr key={h.IdHerramienta}>
                                            <td><strong>{h.Herramienta}</strong></td>
                                            <td>{h.TipoHerramienta || '—'}</td>
                                            <td>{h.Size || '—'}</td>
                                            <td>{h.MaterialHerramienta || '—'}</td>
                                            <td><strong>{h.Cant ?? 0}</strong></td>
                                            <td>
                                                <button className="icon-button" title="Entrada" onClick={() => { openMov(h, 'herramienta'); setMovData({ TipoMov: 'entrada', Cantidad: 1, Comentario: '' }); }}>
                                                    <FiArrowUpCircle />
                                                </button>
                                                <button className="icon-button" title="Salida" onClick={() => { openMov(h, 'herramienta'); setMovData({ TipoMov: 'salida', Cantidad: 1, Comentario: '' }); }}>
                                                    <FiArrowDownCircle />
                                                </button>
                                                <button className="icon-button" title="Ver movimientos" onClick={() => openKardex(h, 'herramienta')}>
                                                    <FiClock />
                                                </button>
                                                <button className="icon-button" title="Editar" onClick={() => openEdit(h)}>
                                                    <FiEdit2 />
                                                </button>
                                                <button className="icon-button" title="Eliminar" onClick={() => handleDelete(h)}>
                                                    <FiTrash2 />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TABLA BLOCKS (solo lectura, demanda agregada) */}
                {activeTab === 'blocks' && (
                    <div className="Table">
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>No. Parte</th>
                                        <th>Requerido</th>
                                        <th>Tickets</th>
                                        <th>Dibujos</th>
                                        <th>Programas</th>
                                        <th>Ensamble</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={7}>Cargando...</td></tr>
                                    ) : demFiltrada.length === 0 ? (
                                        <tr><td colSpan={7}>
                                            <div className="inv-empty">
                                                <FiPackage size={32} />
                                                <p>Sin demanda en tickets activos.</p>
                                            </div>
                                        </td></tr>
                                    ) : demFiltrada.map(d => {
                                        const dib = Number(d.DibujosCompleto) === 1;
                                        const prog = Number(d.ProgramasCompleto) === 1;
                                        const ens = Number(d.EnsambleCompleto) === 1;
                                        const listo = dib && prog && ens;
                                        return (
                                            <tr key={d.NoParte}>
                                                <td>
                                                    <strong
                                                        style={{ cursor: 'pointer', color: '#1565c0' }}
                                                        onClick={() => {
                                                            sessionStorage.setItem("selectedBlockId", d.NoParte);
                                                            navigate("/blocksdetails");
                                                        }}
                                                        title="Ver detalles del bloque"
                                                    >
                                                        {d.NoParte}
                                                    </strong>
                                                </td>
                                                <td><strong>×{d.Requerido}</strong></td>
                                                <td>{d.Tickets}</td>
                                                <td>{dib ? <FiCheckCircle className="inv-check" /> : <FiMinus className="inv-dash" />}</td>
                                                <td>{prog ? <FiCheckCircle className="inv-check" /> : <FiMinus className="inv-dash" />}</td>
                                                <td>{ens ? <FiCheckCircle className="inv-check" /> : <FiMinus className="inv-dash" />}</td>
                                                <td>
                                                    {listo
                                                        ? <span className="status-active">Listo</span>
                                                        : <span className="status-inactive">En proceso</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL FORM */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editing ? (activeTab === 'materiales' ? 'Editar material' : 'Editar herramienta') : (activeTab === 'materiales' ? 'Nuevo material' : 'Nueva herramienta')}
                className="inv-wide"
            >
                <form className="form-container inv-form" onSubmit={handleSubmit}>
                    {activeTab === 'materiales' ? (
                        <>
                            <div className="inv-form-grid">
                                <div className="form-group">
                                    <label className="form-label">Material *</label>
                                    <input className="form-input" value={formData.Material} onChange={(e) => setFormData({ ...formData, Material: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipo *</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <select
                                            className="form-input"
                                            value={formData.TipoMaterialId}
                                            onChange={(e) => setFormData({ ...formData, TipoMaterialId: e.target.value, SubtipoMaterialId: '' })}
                                            required
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">Seleccione...</option>
                                            {tiposMaterial.map(t => (
                                                <option key={t.IdTipoMaterial} value={t.IdTipoMaterial}>{t.TipoMaterial}</option>
                                            ))}
                                        </select>
                                        <button type="button" className="button-icon button-gray" style={{ minWidth: 'auto', padding: '0 14px' }} onClick={() => setIsTipoOpen(true)} title="Gestionar tipos y subtipos">
                                            <FiPlus />
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Subtipo</label>
                                    <select
                                        className="form-input"
                                        value={formData.SubtipoMaterialId || ''}
                                        onChange={(e) => setFormData({ ...formData, SubtipoMaterialId: e.target.value })}
                                        disabled={!formData.TipoMaterialId || subtiposDelTipo(formData.TipoMaterialId).length === 0}
                                    >
                                        <option value="">
                                            {!formData.TipoMaterialId
                                                ? 'Primero elige un tipo...'
                                                : subtiposDelTipo(formData.TipoMaterialId).length === 0
                                                    ? 'Este tipo no tiene subtipos'
                                                    : 'Opcional...'}
                                        </option>
                                        {subtiposDelTipo(formData.TipoMaterialId).map(s => (
                                            <option key={s.IdSubtipoMaterial} value={s.IdSubtipoMaterial}>{s.SubtipoMaterial}</option>
                                        ))}
                                    </select>
                                    <small className="form-hint">Depende del tipo elegido (ej. Pin → Pin recto).</small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descripción</label>
                                    <input className="form-input" value={formData.Descripcion} onChange={(e) => setFormData({ ...formData, Descripcion: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Largo</label>
                                    <input className="form-input" value={formData.Largo} onChange={(e) => setFormData({ ...formData, Largo: e.target.value })} placeholder="ej. 12in" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ancho</label>
                                    <input className="form-input" value={formData.Ancho} onChange={(e) => setFormData({ ...formData, Ancho: e.target.value })} placeholder="ej. 1/2in" />
                                </div>
                                {!editing && (
                                    <div className="form-group">
                                        <label className="form-label">Existencia inicial *</label>
                                        <input type="number" min="0" className="form-input" value={formData.Cant} onChange={(e) => setFormData({ ...formData, Cant: e.target.value })} required />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Stock mínimo *</label>
                                    <input type="number" min="0" className="form-input" value={formData.StockMinimo} onChange={(e) => setFormData({ ...formData, StockMinimo: e.target.value })} required />
                                </div>
                            </div>
                            {editing && (
                                <small className="form-hint">La existencia solo cambia con entradas/salidas.</small>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="inv-form-grid">
                                <div className="form-group">
                                    <label className="form-label">Herramienta *</label>
                                    <input className="form-input" value={formData.Herramienta} onChange={(e) => setFormData({ ...formData, Herramienta: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipo *</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <select className="form-input" value={formData.TipoHerramientaId} onChange={(e) => setFormData({ ...formData, TipoHerramientaId: e.target.value })} required style={{ flex: 1 }}>
                                            <option value="">Seleccione...</option>
                                            {tiposHerramienta.map(t => (
                                                <option key={t.IdTipoHerramienta} value={t.IdTipoHerramienta}>{t.TipoHerramienta}</option>
                                            ))}
                                        </select>
                                        <button type="button" className="button-icon button-gray" style={{ minWidth: 'auto', padding: '0 14px' }} onClick={() => setIsTipoOpen(true)} title="Gestionar tipos">
                                            <FiPlus />
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tamaño</label>
                                    <input className="form-input" value={formData.Size} onChange={(e) => setFormData({ ...formData, Size: e.target.value })} placeholder="ej. 6mm" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Material</label>
                                    <input className="form-input" value={formData.MaterialHerramienta} onChange={(e) => setFormData({ ...formData, MaterialHerramienta: e.target.value })} placeholder="ej. HSS" />
                                </div>
                                {!editing && (
                                    <div className="form-group">
                                        <label className="form-label">Existencia inicial *</label>
                                        <input type="number" min="0" className="form-input" value={formData.Cant} onChange={(e) => setFormData({ ...formData, Cant: e.target.value })} required />
                                    </div>
                                )}
                            </div>
                            {editing && (
                                <small className="form-hint">La existencia solo cambia con entradas/salidas.</small>
                            )}
                        </>
                    )}
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : (editing ? 'Actualizar' : 'Crear')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL TIPOS */}
            <Modal
                isOpen={isTipoOpen}
                onClose={() => setIsTipoOpen(false)}
                title={activeTab === 'materiales' ? 'Tipos de material' : 'Tipos de herramienta'}
            >
                <form className="form-container" onSubmit={handleAddTipo}>
                    <div className="form-group">
                        <label className="form-label">Nuevo tipo</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="form-input" value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} placeholder="Nombre del tipo" style={{ flex: 1 }} />
                            <button type="submit" className="btn btn-primary">Agregar</button>
                        </div>
                    </div>
                </form>
                <div className="inv-tipos-list">
                    {(activeTab === 'materiales' ? tiposMaterial : tiposHerramienta).length === 0 && (
                        <div className="inv-empty">
                            <FiBox size={28} />
                            <p>Sin tipos registrados</p>
                        </div>
                    )}
                    {(activeTab === 'materiales' ? tiposMaterial : tiposHerramienta).map(t => {
                        const idT = activeTab === 'materiales' ? t.IdTipoMaterial : t.IdTipoHerramienta;
                        const nomT = activeTab === 'materiales' ? t.TipoMaterial : t.TipoHerramienta;
                        const subs = activeTab === 'materiales' ? subtiposDelTipo(idT) : [];
                        const abierto = tipoExpandido === idT;
                        return (
                            <div key={idT} className="inv-tipo-card">
                                <div
                                    className="inv-tipo-row"
                                    onClick={() => {
                                        if (activeTab !== 'materiales') return;
                                        if (editandoTipo?.id === idT) return;
                                        setTipoExpandido(abierto ? null : idT);
                                        setNuevoSubtipo('');
                                    }}
                                    title={activeTab === 'materiales' ? 'Clic para ver subtipos' : nomT}
                                    style={activeTab === 'materiales' ? { cursor: 'pointer' } : undefined}
                                >
                                    {editandoTipo?.kind === 'tipo' && editandoTipo?.id === idT ? (
                                        <>
                                            <input
                                                className="form-input"
                                                value={nombreEdit}
                                                onChange={(e) => setNombreEdit(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { e.preventDefault(); saveEditTipo('tipo', idT); }
                                                    if (e.key === 'Escape') cancelEditTipo();
                                                }}
                                                autoFocus
                                                style={{ flex: 1 }}
                                            />
                                            <button className="icon-button inv-save" title="Guardar" onClick={(e) => { e.stopPropagation(); saveEditTipo('tipo', idT); }}>
                                                <FiCheck />
                                            </button>
                                            <button className="icon-button" title="Cancelar" onClick={(e) => { e.stopPropagation(); cancelEditTipo(); }}>
                                                <FiX />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="inv-tipo-nombre">{nomT}</span>
                                            {activeTab === 'materiales' && (
                                                <span className="inv-tipo-count">{subs.length} subtipo{subs.length !== 1 ? 's' : ''}</span>
                                            )}
                                            {activeTab === 'materiales' && (
                                                <FiChevronDown className={`inv-chevron ${abierto ? 'abierto' : ''}`} />
                                            )}
                                            <button
                                                className="icon-button inv-edit"
                                                title="Editar nombre"
                                                onClick={(e) => { e.stopPropagation(); startEditTipo('tipo', idT, nomT); }}
                                            >
                                                <FiEdit2 />
                                            </button>
                                            <button
                                                className="icon-button inv-del"
                                                title="Eliminar tipo"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteTipo(idT); }}
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </>
                                    )}
                                </div>
                                {activeTab === 'materiales' && abierto && (
                                    <div className="inv-subs">
                                        {subs.length === 0 && (
                                            <small className="form-hint">Sin subtipos. Agrega el primero abajo.</small>
                                        )}
                                        {subs.map(s => (
                                            <div key={s.IdSubtipoMaterial} className="inv-sub-row">
                                                {editandoTipo?.kind === 'sub' && editandoTipo?.id === s.IdSubtipoMaterial ? (
                                                    <>
                                                        <input
                                                            className="form-input"
                                                            value={nombreEdit}
                                                            onChange={(e) => setNombreEdit(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') { e.preventDefault(); saveEditTipo('sub', s.IdSubtipoMaterial); }
                                                                if (e.key === 'Escape') cancelEditTipo();
                                                            }}
                                                            autoFocus
                                                            style={{ flex: 1 }}
                                                        />
                                                        <button className="icon-button inv-save" title="Guardar" onClick={() => saveEditTipo('sub', s.IdSubtipoMaterial)}>
                                                            <FiCheck />
                                                        </button>
                                                        <button className="icon-button" title="Cancelar" onClick={cancelEditTipo}>
                                                            <FiX />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>{s.SubtipoMaterial}</span>
                                                        <button
                                                            className="icon-button inv-edit"
                                                            title="Editar subtipo"
                                                            onClick={() => startEditTipo('sub', s.IdSubtipoMaterial, s.SubtipoMaterial)}
                                                        >
                                                            <FiEdit2 />
                                                        </button>
                                                        <button
                                                            className="icon-button inv-del"
                                                            title="Eliminar subtipo"
                                                            onClick={() => handleDeleteSubtipo(s.IdSubtipoMaterial)}
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                        <form className="inv-sub-form" onSubmit={(e) => handleAddSubtipo(e, idT)}>
                                            <input
                                                className="form-input"
                                                value={nuevoSubtipo}
                                                onChange={(e) => setNuevoSubtipo(e.target.value)}
                                                placeholder="Nuevo subtipo (ej. Pin recto)..."
                                            />
                                            <button type="submit" className="btn btn-primary">Agregar</button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Modal>

            {/* MODAL MOVIMIENTO */}
            <Modal
                isOpen={isMovOpen}
                onClose={() => setIsMovOpen(false)}
                title={`${movData.TipoMov === 'entrada' ? 'Entrada' : 'Salida'}: ${nombreMov}`}
            >
                <form className="form-container" onSubmit={handleMovSubmit}>
                    <div className="form-group">
                        <label className="form-label">Tipo de movimiento *</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                type="button"
                                className={`btn ${movData.TipoMov === 'entrada' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setMovData({ ...movData, TipoMov: 'entrada' })}
                                style={{ flex: 1 }}
                            >
                                <FiArrowUpCircle /> Entrada
                            </button>
                            <button
                                type="button"
                                className={`btn ${movData.TipoMov === 'salida' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setMovData({ ...movData, TipoMov: 'salida' })}
                                style={{ flex: 1 }}
                            >
                                <FiArrowDownCircle /> Salida
                            </button>
                        </div>
                        <small className="form-hint">Existencia actual: {existenciaMov}</small>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Cantidad *</label>
                        <input type="number" min="1" className="form-input" value={movData.Cantidad} onChange={(e) => setMovData({ ...movData, Cantidad: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Motivo / Comentario</label>
                        <input className="form-input" value={movData.Comentario} onChange={(e) => setMovData({ ...movData, Comentario: e.target.value })} placeholder="ej. Uso en barra, compra, ruptura..." />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsMovOpen(false)} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL KARDEX */}
            <Modal
                isOpen={isKardexOpen}
                onClose={() => setIsKardexOpen(false)}
                title={`Movimientos: ${kardexTarget ? (kardexTarget.tipo === 'material' ? kardexTarget.row.Material : kardexTarget.row.Herramienta) : ''}`}
            >
                {kardex.length === 0 ? (
                    <p>Sin movimientos registrados.</p>
                ) : (
                    <div className="Table">
                        <div className="table-scroll" style={{ maxHeight: 320 }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Movimiento</th>
                                        <th>Cant.</th>
                                        <th>Usuario</th>
                                        <th>Motivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kardex.map(k => (
                                        <tr key={k.IdMovimiento}>
                                            <td>{k.FechaFormateada || k.Fecha}</td>
                                            <td>
                                                <span className={k.TipoMov === 'entrada' ? 'status-active' : 'status-inactive'}>
                                                    {k.TipoMov}
                                                </span>
                                            </td>
                                            <td><strong>{k.Cantidad}</strong></td>
                                            <td>{k.UsuarioNombre || (k.UsuarioId ? `#${k.UsuarioId}` : '—')}</td>
                                            <td>{k.Comentario || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};
