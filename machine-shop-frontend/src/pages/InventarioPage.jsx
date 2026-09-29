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
    FiAlertTriangle, FiChevronDown, FiCornerUpLeft,
    FiCheck, FiX
} from "react-icons/fi";
import { showToast } from 'nextjs-toast-notify';
import Swal from "sweetalert2";

const emptyMaterial = { Material: '', Descripcion: '', Largo: '', Ancho: '', Alto: '', Cant: 0, StockMinimo: 0, TipoMaterialId: '', SubtipoMaterialId: '' };
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
    const [bloqueExpandido, setBloqueExpandido] = useState(null);
    const [distribucion, setDistribucion] = useState({});
    const [isDevolverOpen, setIsDevolverOpen] = useState(false);
    const [devolverTarget, setDevolverTarget] = useState(null);
    const [devolverData, setDevolverData] = useState({ Cantidad: 1, Comentario: '' });

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
            console.error('Error loading inventory:', error);
            showToast.error('Error loading inventory', { duration: 3000, position: "top-right" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        const h = () => fetchAll();
        socket.on('inventarioActualizado', h);
        socket.on('bloqueInventarioActualizado', h);
        return () => {
            socket.off('inventarioActualizado', h);
            socket.off('bloqueInventarioActualizado', h);
        };
    }, [fetchAll]);

    const handleApartarPendientes = async () => {
        try {
            const res = await api.post('/bloquesApartar', { UsuarioId: user?.noEmp });
            showToast.success(res.data.message || 'Reservation updated', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error reserving', { duration: 4000, position: "top-right" });
        }
    };

    const toggleBloqueDist = async (noParte) => {
        if (bloqueExpandido === noParte) {
            setBloqueExpandido(null);
            return;
        }
        setBloqueExpandido(noParte);
        try {
            const res = await api.get(`/bloqueApartados?noParte=${encodeURIComponent(noParte)}`);
            setDistribucion(prev => ({ ...prev, [noParte]: res.data || [] }));
        } catch (error) {
            showToast.error('Error loading distribution', { duration: 3000, position: "top-right" });
            setDistribucion(prev => ({ ...prev, [noParte]: [] }));
        }
    };

    const openDevolver = (noParte, linea) => {
        setDevolverTarget({ noParte, ticketId: linea.TicketId, max: Number(linea.Apartado) });
        setDevolverData({ Cantidad: Number(linea.Apartado), Comentario: '' });
        setIsDevolverOpen(true);
    };

    const handleDevolverSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.post('/bloquesDevolver', {
                TicketId: devolverTarget.ticketId,
                BloqueNoParte: devolverTarget.noParte,
                Cantidad: parseInt(devolverData.Cantidad, 10),
                UsuarioId: user?.noEmp,
                Comentario: devolverData.Comentario || ''
            });
            showToast.success(res.data.message || 'Return recorded', { duration: 3000, position: "top-right" });
            setIsDevolverOpen(false);
            const res2 = await api.get(`/bloqueApartados?noParte=${encodeURIComponent(devolverTarget.noParte)}`);
            setDistribucion(prev => ({ ...prev, [devolverTarget.noParte]: res2.data || [] }));
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error processing return', { duration: 4000, position: "top-right" });
        } finally {
            setSaving(false);
        }
    };

    if (!isAdmin) {
        return (
            <>
                <Navbar />
                <div className="page-container full-width">
                    <div className="empty-state-tickets">
                        <FiBox size={48} />
                        <h3>No access</h3>
                        <p>Inventory is for administrators only</p>
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
                Largo: row.Largo || '', Ancho: row.Ancho || '', Alto: row.Alto || '',
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
                    showToast.success('Material updated', { duration: 3000, position: "top-right" });
                } else {
                    await api.post('/materialesInsert', payload);
                    showToast.success('Material created', { duration: 3000, position: "top-right" });
                }
            } else {
                const payload = { ...formData, UsuarioId: user?.noEmp };
                if (editing) {
                    delete payload.Cant;
                    await api.put(`/herramientasUpdate/${editing.IdHerramienta}`, payload);
                    showToast.success('Tool updated', { duration: 3000, position: "top-right" });
                } else {
                    await api.post('/herramientasInsert', payload);
                    showToast.success('Tool created', { duration: 3000, position: "top-right" });
                }
            }
            setIsFormOpen(false);
            fetchAll();
        } catch (error) {
            console.error(error);
            showToast.error(error.response?.data?.error || 'Error saving', { duration: 4000, position: "top-right" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row) => {
        const nombre = activeTab === 'materiales' ? row.Material : row.Herramienta;
        const result = await Swal.fire({
            title: 'Delete?',
            html: `Delete <strong>${nombre}</strong> from inventory?<br>It must have no recorded movements.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#D71928',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete',
            cancelButtonText: 'Cancel',
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
            showToast.success('Deleted successfully', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error deleting', { duration: 4000, position: "top-right" });
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
            showToast.success('Type added', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error adding type', { duration: 4000, position: "top-right" });
        }
    };

    const handleDeleteTipo = async (idTipo) => {
        try {
            if (activeTab === 'materiales') {
                await api.delete(`/tiposMaterialDelete/${idTipo}`, { data: { UsuarioId: user?.noEmp } });
            } else {
                await api.delete(`/tiposHerramientaDelete/${idTipo}`, { data: { UsuarioId: user?.noEmp } });
            }
            showToast.success('Type deleted', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error deleting type', { duration: 4000, position: "top-right" });
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
            showToast.success('Subtype added', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error adding subtype', { duration: 4000, position: "top-right" });
        }
    };

    const handleDeleteSubtipo = async (idSub) => {
        try {
            await api.delete(`/subtiposMaterialDelete/${idSub}`, { data: { UsuarioId: user?.noEmp } });
            showToast.success('Subtype deleted', { duration: 3000, position: "top-right" });
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error deleting subtype', { duration: 4000, position: "top-right" });
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
            showToast.warning('Name cannot be empty', { duration: 3000, position: "top-right" });
            return;
        }
        try {
            if (kind === 'sub') {
                await api.put(`/subtiposMaterialUpdate/${idT}`, { SubtipoMaterial: nombreEdit.trim(), UsuarioId: user?.noEmp });
                showToast.success('Subtype updated', { duration: 3000, position: "top-right" });
            } else if (activeTab === 'materiales') {
                await api.put(`/tiposMaterialUpdate/${idT}`, { TipoMaterial: nombreEdit.trim(), UsuarioId: user?.noEmp });
                showToast.success('Type updated', { duration: 3000, position: "top-right" });
            } else {
                await api.put(`/tiposHerramientaUpdate/${idT}`, { TipoHerramienta: nombreEdit.trim(), UsuarioId: user?.noEmp });
                showToast.success('Type updated', { duration: 3000, position: "top-right" });
            }
            cancelEditTipo();
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error updating', { duration: 4000, position: "top-right" });
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
        if (movTarget.tipo === 'bloque' && movData.TipoMov === 'entrada' && !movData.Origen) {
            showToast.warning('Choose whether they were made with 3D or CNC', { duration: 3000, position: "top-right" });
            return;
        }
        setSaving(true);
        try {
            if (movTarget.tipo === 'bloque') {
                const url = movData.TipoMov === 'entrada' ? '/bloquesEntrada' : '/bloquesSalida';
                const comentario = movData.TipoMov === 'entrada'
                    ? `[${movData.Origen}] ${(movData.Comentario || '').trim() || 'Manual stock entry'}`
                    : (movData.Comentario || '');
                const resBloque = await api.post(url, {
                    BloqueNoParte: movTarget.row.NoParte,
                    Cantidad: parseInt(movData.Cantidad, 10),
                    UsuarioId: user?.noEmp,
                    Comentario: comentario
                });
                showToast.success(resBloque.data?.message || 'Movement recorded', { duration: 4000, position: "top-right" });
                if (resBloque.data?.warning) {
                    showToast.warning(resBloque.data.warning, { duration: 6000, position: "top-right" });
                }
            } else {
                const refId = movTarget.tipo === 'material' ? movTarget.row.IdMateriales : movTarget.row.IdHerramienta;
                const res = await api.post('/inventarioMovimiento', {
                    TipoItem: movTarget.tipo,
                    ReferenciaId: refId,
                    TipoMov: movData.TipoMov,
                    Cantidad: parseInt(movData.Cantidad, 10),
                    UsuarioId: user?.noEmp,
                    Comentario: movData.Comentario || ''
                });
                showToast.success(`Movement recorded. Stock: ${res.data.nuevaExistencia}`, { duration: 3000, position: "top-right" });
            }
            setIsMovOpen(false);
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error recording movement', { duration: 4000, position: "top-right" });
        } finally {
            setSaving(false);
        }
    };

    const openKardex = async (row, tipo) => {
        setKardexTarget({ row, tipo });
        setIsKardexOpen(true);
        fetchKardex(row, tipo);
    };

    const fetchKardex = async (row, tipo) => {
        try {
            let res;
            if (tipo === 'bloque') {
                res = await api.get(`/bloqueMovimientos?noParte=${encodeURIComponent(row.NoParte)}&limite=50`);
            } else {
                const refId = tipo === 'material' ? row.IdMateriales : row.IdHerramienta;
                res = await api.get(`/inventarioMovimientos?tipoItem=${tipo}&referenciaId=${refId}&limite=50`);
            }
            setKardex(res.data || []);
        } catch (error) {
            showToast.error('Error loading movements', { duration: 3000, position: "top-right" });
            setKardex([]);
        }
    };

    const handleDeleteMov = async (idMov) => {
        const result = await Swal.fire({
            title: 'Delete movement?',
            html: 'Its effect on stock will be reverted.<br>If it would leave negative stock, it will be rejected.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#D71928',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete',
            cancelButtonText: 'Cancel',
            background: '#3F3F42',
            color: '#fff',
            customClass: { popup: 'swal-dark-popup' }
        });
        if (!result.isConfirmed) return;
        try {
            const res = await api.delete(`/inventarioMovimiento/${idMov}`, { data: { UsuarioId: user?.noEmp } });
            showToast.success(res.data?.message || 'Movement deleted', { duration: 3000, position: "top-right" });
            fetchKardex(kardexTarget.row, kardexTarget.tipo);
            fetchAll();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error deleting movement', { duration: 4000, position: "top-right" });
        }
    };

    const nombreMov = !movTarget ? '' : movTarget.tipo === 'material'
        ? movTarget.row.Material
        : movTarget.tipo === 'herramienta' ? movTarget.row.Herramienta : movTarget.row.NoParte;
    const existenciaMov = !movTarget ? '—' : movTarget.tipo === 'bloque'
        ? `Stock ${Number(movTarget.row.Existencia || 0)} · Available ${Number(movTarget.row.Disponible || 0)}`
        : movTarget.row.EsBarra && movTarget.row.LargoDisponible !== null
            ? `${Number(movTarget.row.Cant || 0)} bars (${Number(movTarget.row.LargoDisponible)}")`
            : Number(movTarget.tipo === 'material' ? movTarget.row.Cant : (movTarget.row.Cant ?? 0));

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
                            <h1 className="header-title">Inventory</h1>
                            <p className="header-subtitle">Materials · Tools · Required blocks</p>
                        </div>
                    </div>
                    <div className="header-stats">
                        <div className="stat-item">
                            <span className="stat-number">{materiales.filter(m => bajoStock(m.Cant, m.StockMinimo)).length}</span>
                            <span className="stat-label">Low-stock mat.</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{demanda.reduce((a, d) => a + Number(d.Requerido || 0), 0)}</span>
                            <span className="stat-label">Required blocks</span>
                        </div>
                    </div>
                    {activeTab !== 'blocks' && (
                        <button className="button-icon button-red" onClick={openNew}>
                            <FiPlus />
                            {activeTab === 'materiales' ? 'New material' : 'New tool'}
                        </button>
                    )}
                    {activeTab === 'blocks' && (
                        <button className="button-icon button-red" onClick={handleApartarPendientes} disabled={saving}>
                            <FiPackage />
                            Reserve pending
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
                                placeholder="Search..."
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
                        Materials
                        <span className="tab-badge">{materiales.length}</span>
                    </button>
                    <button className={`tab-btn ${activeTab === 'herramientas' ? 'active' : ''}`} onClick={() => setActiveTab('herramientas')}>
                        <FiTool />
                        Tools
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
                                        <th>Type</th>
                                        <th>Subtype</th>
                                        <th>Length</th>
                                        <th>Width</th>
                                        <th>Height</th>
                                        <th>Stock</th>
                                        <th>Minimum</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={9}>Loading...</td></tr>
                                    ) : matFiltrados.length === 0 ? (
                                        <tr><td colSpan={9}>
                                            <div className="inv-empty">
                                                <FiBox size={32} />
                                                <p>No materials.<br />Add the first one with “New material”.</p>
                                            </div>
                                        </td></tr>
                                    ) : matFiltrados.map(m => (
                                        <tr key={m.IdMateriales} style={bajoStock(m.Cant, m.StockMinimo) ? { background: '#fff8e1' } : undefined}>
                                            <td>
                                                <strong>{m.Material}</strong>
                                                {m.Descripcion && <><br /><small>{m.Descripcion}</small></>}
                                                {bajoStock(m.Cant, m.StockMinimo) && (
                                                    <><br /><span className="inv-bajo-stock"><FiAlertTriangle /> Low stock</span></>
                                                )}
                                            </td>
                                            <td>{m.TipoMaterial || '—'}</td>
                                            <td>{m.SubtipoMaterial || '—'}</td>
                                            <td>
                                                {m.EsBarra && m.LargoDisponible !== null && m.LargoDisponible !== undefined ? (
                                                    <><strong className="inv-pulgadas">{Number(m.LargoDisponible)}&quot;</strong><br /><small>bar of {m.Largo || '48"'}</small></>
                                                ) : (m.Largo || '—')}
                                            </td>
                                            <td>{m.Ancho || '—'}</td>
                                            <td>{m.Alto || '—'}</td>
                                            <td>
                                                <strong>{m.Cant}</strong>
                                                {m.EsBarra && m.LargoDisponible !== null && m.LargoDisponible !== undefined && (
                                                    <><br /><small className="inv-pulgadas">{Number(m.LargoDisponible)}&quot; total</small></>
                                                )}
                                            </td>
                                            <td>{m.StockMinimo}</td>
                                            <td>
                                                <button className="icon-button" title="Stock in" onClick={() => { openMov(m, 'material'); setMovData({ TipoMov: 'entrada', Cantidad: 1, Comentario: '' }); }}>
                                                    <FiArrowUpCircle />
                                                </button>
                                                <button className="icon-button" title="Stock out" onClick={() => { openMov(m, 'material'); setMovData({ TipoMov: 'salida', Cantidad: 1, Comentario: '' }); }}>
                                                    <FiArrowDownCircle />
                                                </button>
                                                <button className="icon-button" title="View movements" onClick={() => openKardex(m, 'material')}>
                                                    <FiClock />
                                                </button>
                                                <button className="icon-button" title="Edit" onClick={() => openEdit(m)}>
                                                    <FiEdit2 />
                                                </button>
                                                <button className="icon-button" title="Delete" onClick={() => handleDelete(m)}>
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
                                        <th>Tool</th>
                                        <th>Type</th>
                                        <th>Size</th>
                                        <th>Material</th>
                                        <th>Stock</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={6}>Loading...</td></tr>
                                    ) : herFiltradas.length === 0 ? (
                                        <tr><td colSpan={6}>
                                            <div className="inv-empty">
                                                <FiTool size={32} />
                                                <p>No tools.<br />Add the first one with “New tool”.</p>
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
                                                <button className="icon-button" title="Stock in" onClick={() => { openMov(h, 'herramienta'); setMovData({ TipoMov: 'entrada', Cantidad: 1, Comentario: '' }); }}>
                                                    <FiArrowUpCircle />
                                                </button>
                                                <button className="icon-button" title="Stock out" onClick={() => { openMov(h, 'herramienta'); setMovData({ TipoMov: 'salida', Cantidad: 1, Comentario: '' }); }}>
                                                    <FiArrowDownCircle />
                                                </button>
                                                <button className="icon-button" title="View movements" onClick={() => openKardex(h, 'herramienta')}>
                                                    <FiClock />
                                                </button>
                                                <button className="icon-button" title="Edit" onClick={() => openEdit(h)}>
                                                    <FiEdit2 />
                                                </button>
                                                <button className="icon-button" title="Delete" onClick={() => handleDelete(h)}>
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
                                        <th>Part No.</th>
                                        <th>Required</th>
                                        <th>Reserved</th>
                                        <th>Available</th>
                                        <th>Stock</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={7}>Loading...</td></tr>
                                    ) : demFiltrada.length === 0 ? (
                                        <tr><td colSpan={7}>
                                            <div className="inv-empty">
                                                <FiPackage size={32} />
                                                <p>No demand in active tickets.</p>
                                            </div>
                                        </td></tr>
                                    ) : demFiltrada.map(d => {
                                        const dib = Number(d.DibujosCompleto) === 1;
                                        const prog = Number(d.ProgramasCompleto) === 1;
                                        const ens = Number(d.EnsambleCompleto) === 1;
                                        const listo = dib && prog && ens;
                                        const apartado = Number(d.Apartado || 0);
                                        const requerido = Number(d.Requerido || 0);
                                        const cubierto = requerido > 0 && apartado >= requerido;
                                        const expandido = bloqueExpandido === d.NoParte;
                                        const lineas = distribucion[d.NoParte] || [];
                                        return (
                                            <React.Fragment key={d.NoParte}>
                                            <tr>
                                                <td>
                                                    <strong
                                                        style={{ cursor: 'pointer', color: '#1565c0' }}
                                                        onClick={() => {
                                                            sessionStorage.setItem("selectedBlockId", d.NoParte);
                                                            navigate("/blocksdetails");
                                                        }}
                                                        title="View block details"
                                                    >
                                                        {d.NoParte}
                                                    </strong>
                                                </td>
                                                <td><strong>×{requerido}</strong></td>
                                                <td>
                                                    <span className={`block-apartado ${cubierto ? 'full' : ''}`}>
                                                        {apartado}/{requerido}
                                                    </span>
                                                </td>
                                                <td><strong>{Number(d.Disponible || 0)}</strong></td>
                                                <td>{Number(d.Existencia || 0)}</td>
                                                <td>
                                                    {listo
                                                        ? <span className="status-active">Ready</span>
                                                        : <span className="status-inactive">In progress</span>}
                                                </td>
                                                <td>
                                                    <button className="icon-button" title="Stock in" onClick={() => { openMov(d, 'bloque'); setMovData({ TipoMov: 'entrada', Cantidad: 1, Comentario: '', Origen: '' }); }}>
                                                        <FiArrowUpCircle />
                                                    </button>
                                                    <button className="icon-button" title="Stock out" onClick={() => { openMov(d, 'bloque'); setMovData({ TipoMov: 'salida', Cantidad: 1, Comentario: '', Origen: '' }); }}>
                                                        <FiArrowDownCircle />
                                                    </button>
                                                    <button className="icon-button" title="View movements" onClick={() => openKardex(d, 'bloque')}>
                                                        <FiClock />
                                                    </button>
                                                    <button className="icon-button" title="View distribution by ticket" onClick={() => toggleBloqueDist(d.NoParte)}>
                                                        <FiChevronDown className={`inv-chevron ${expandido ? 'abierto' : ''}`} />
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandido && (
                                                <tr className="inv-dist-tr">
                                                    <td colSpan={7}>
                                                        <div className="inv-dist-list">
                                                            <div className="inv-dist-title">Reserved by ticket (priority)</div>
                                                            {lineas.length === 0 ? (
                                                                <small className="form-hint">No reservations: all stock is available.</small>
                                                            ) : lineas.map(l => (
                                                                <div key={l.TicketId} className="inv-dist-row">
                                                                    <span className="inv-dist-ticket">Ticket #{l.TicketId}</span>
                                                                    <span className="inv-dist-meta">
                                                                        {l.PrioridadNombre || ''} · {l.SolicitanteNombre || `#${l.SolicitanteId}`}{l.NombreEstado ? ` · ${l.NombreEstado}` : ''}
                                                                    </span>
                                                                    <span className="block-apartado">{Number(l.Apartado)}/{Number(l.Requerido ?? l.Apartado)}</span>
                                                                    <button
                                                                        className="icon-button"
                                                                        title="Return to inventory"
                                                                        onClick={() => openDevolver(d.NoParte, l)}
                                                                    >
                                                                        <FiCornerUpLeft />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            </React.Fragment>
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
                title={editing ? (activeTab === 'materiales' ? 'Edit material' : 'Edit tool') : (activeTab === 'materiales' ? 'New material' : 'New tool')}
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
                                    <label className="form-label">Type *</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <select
                                            className="form-input"
                                            value={formData.TipoMaterialId}
                                            onChange={(e) => setFormData({ ...formData, TipoMaterialId: e.target.value, SubtipoMaterialId: '' })}
                                            required
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">Select...</option>
                                            {tiposMaterial.map(t => (
                                                <option key={t.IdTipoMaterial} value={t.IdTipoMaterial}>{t.TipoMaterial}</option>
                                            ))}
                                        </select>
                                        <button type="button" className="button-icon button-gray" style={{ minWidth: 'auto', padding: '0 14px' }} onClick={() => setIsTipoOpen(true)} title="Manage types and subtypes">
                                            <FiPlus />
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Subtype</label>
                                    <select
                                        className="form-input"
                                        value={formData.SubtipoMaterialId || ''}
                                        onChange={(e) => setFormData({ ...formData, SubtipoMaterialId: e.target.value })}
                                        disabled={!formData.TipoMaterialId || subtiposDelTipo(formData.TipoMaterialId).length === 0}
                                    >
                                        <option value="">
                                            {!formData.TipoMaterialId
                                                ? 'Choose a type first...'
                                                : subtiposDelTipo(formData.TipoMaterialId).length === 0
                                                    ? 'This type has no subtypes'
                                                    : 'Optional...'}
                                        </option>
                                        {subtiposDelTipo(formData.TipoMaterialId).map(s => (
                                            <option key={s.IdSubtipoMaterial} value={s.IdSubtipoMaterial}>{s.SubtipoMaterial}</option>
                                        ))}
                                    </select>
                                    <small className="form-hint">Depends on the chosen type (e.g. Pin → Straight pin).</small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <input className="form-input" value={formData.Descripcion} onChange={(e) => setFormData({ ...formData, Descripcion: e.target.value })} />
                                </div>
                                <div className="inv-medidas">
                                    <div className="form-group">
                                        <label className="form-label">Length</label>
                                        <input className="form-input" value={formData.Largo} onChange={(e) => setFormData({ ...formData, Largo: e.target.value })} placeholder="e.g. 12in" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Width</label>
                                        <input className="form-input" value={formData.Ancho} onChange={(e) => setFormData({ ...formData, Ancho: e.target.value })} placeholder="e.g. 1/2in" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Height</label>
                                        <input className="form-input" value={formData.Alto} onChange={(e) => setFormData({ ...formData, Alto: e.target.value })} placeholder="e.g. 2in" />
                                    </div>
                                </div>
                                {!editing && (
                                    <div className="form-group">
                                        <label className="form-label">Initial stock *</label>
                                        <input type="number" min="0" className="form-input" value={formData.Cant} onChange={(e) => setFormData({ ...formData, Cant: e.target.value })} required />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Minimum stock *</label>
                                    <input type="number" min="0" className="form-input" value={formData.StockMinimo} onChange={(e) => setFormData({ ...formData, StockMinimo: e.target.value })} required />
                                </div>
                            </div>
                            {editing && (
                                <small className="form-hint">Stock only changes with stock ins/outs.</small>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="inv-form-grid">
                                <div className="form-group">
                                    <label className="form-label">Tool *</label>
                                    <input className="form-input" value={formData.Herramienta} onChange={(e) => setFormData({ ...formData, Herramienta: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Type *</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <select className="form-input" value={formData.TipoHerramientaId} onChange={(e) => setFormData({ ...formData, TipoHerramientaId: e.target.value })} required style={{ flex: 1 }}>
                                            <option value="">Select...</option>
                                            {tiposHerramienta.map(t => (
                                                <option key={t.IdTipoHerramienta} value={t.IdTipoHerramienta}>{t.TipoHerramienta}</option>
                                            ))}
                                        </select>
                                        <button type="button" className="button-icon button-gray" style={{ minWidth: 'auto', padding: '0 14px' }} onClick={() => setIsTipoOpen(true)} title="Manage types">
                                            <FiPlus />
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Size</label>
                                    <input className="form-input" value={formData.Size} onChange={(e) => setFormData({ ...formData, Size: e.target.value })} placeholder="e.g. 6mm" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Material</label>
                                    <input className="form-input" value={formData.MaterialHerramienta} onChange={(e) => setFormData({ ...formData, MaterialHerramienta: e.target.value })} placeholder="e.g. HSS" />
                                </div>
                                {!editing && (
                                    <div className="form-group">
                                        <label className="form-label">Initial stock *</label>
                                        <input type="number" min="0" className="form-input" value={formData.Cant} onChange={(e) => setFormData({ ...formData, Cant: e.target.value })} required />
                                    </div>
                                )}
                            </div>
                            {editing && (
                                <small className="form-hint">Stock only changes with stock ins/outs.</small>
                            )}
                        </>
                    )}
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)} disabled={saving}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : (editing ? 'Update' : 'Create')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL TIPOS */}
            <Modal
                isOpen={isTipoOpen}
                onClose={() => setIsTipoOpen(false)}
                title={activeTab === 'materiales' ? 'Material types' : 'Tool types'}
            >
                <form className="form-container" onSubmit={handleAddTipo}>
                    <div className="form-group">
                        <label className="form-label">New type</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="form-input" value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} placeholder="Type name" style={{ flex: 1 }} />
                            <button type="submit" className="btn btn-primary">Add</button>
                        </div>
                    </div>
                </form>
                <div className="inv-tipos-list">
                    {(activeTab === 'materiales' ? tiposMaterial : tiposHerramienta).length === 0 && (
                        <div className="inv-empty">
                            <FiBox size={28} />
                            <p>No registered types</p>
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
                                    title={activeTab === 'materiales' ? 'Click to view subtypes' : nomT}
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
                                            <button className="icon-button inv-save" title="Save" onClick={(e) => { e.stopPropagation(); saveEditTipo('tipo', idT); }}>
                                                <FiCheck />
                                            </button>
                                            <button className="icon-button" title="Cancel" onClick={(e) => { e.stopPropagation(); cancelEditTipo(); }}>
                                                <FiX />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="inv-tipo-nombre">{nomT}</span>
                                            {activeTab === 'materiales' && (
                                                <span className="inv-tipo-count">{subs.length} subtype{subs.length !== 1 ? 's' : ''}</span>
                                            )}
                                            {activeTab === 'materiales' && (
                                                <FiChevronDown className={`inv-chevron ${abierto ? 'abierto' : ''}`} />
                                            )}
                                            <button
                                                className="icon-button inv-edit"
                                                title="Edit name"
                                                onClick={(e) => { e.stopPropagation(); startEditTipo('tipo', idT, nomT); }}
                                            >
                                                <FiEdit2 />
                                            </button>
                                            <button
                                                className="icon-button inv-del"
                                                title="Delete type"
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
                                            <small className="form-hint">No subtypes. Add the first one below.</small>
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
                                                        <button className="icon-button inv-save" title="Save" onClick={() => saveEditTipo('sub', s.IdSubtipoMaterial)}>
                                                            <FiCheck />
                                                        </button>
                                                        <button className="icon-button" title="Cancel" onClick={cancelEditTipo}>
                                                            <FiX />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>{s.SubtipoMaterial}</span>
                                                        <button
                                                            className="icon-button inv-edit"
                                                            title="Edit subtype"
                                                            onClick={() => startEditTipo('sub', s.IdSubtipoMaterial, s.SubtipoMaterial)}
                                                        >
                                                            <FiEdit2 />
                                                        </button>
                                                        <button
                                                            className="icon-button inv-del"
                                                            title="Delete subtype"
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
                                                placeholder="New subtype (e.g. Straight pin)..."
                                            />
                                            <button type="submit" className="btn btn-primary">Add</button>
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
                title={`${movData.TipoMov === 'entrada' ? 'Stock in' : 'Stock out'}: ${nombreMov}`}
            >
                <form className="form-container" onSubmit={handleMovSubmit}>
                    <div className="form-group">
                        <label className="form-label">Movement type *</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                type="button"
                                className={`btn ${movData.TipoMov === 'entrada' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setMovData({ ...movData, TipoMov: 'entrada' })}
                                style={{ flex: 1 }}
                            >
                                <FiArrowUpCircle /> Stock in
                            </button>
                            <button
                                type="button"
                                className={`btn ${movData.TipoMov === 'salida' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setMovData({ ...movData, TipoMov: 'salida' })}
                                style={{ flex: 1 }}
                            >
                                <FiArrowDownCircle /> Stock out
                            </button>
                        </div>
                        <small className="form-hint">Current stock: {existenciaMov}</small>
                    </div>
                    {movTarget?.tipo === 'bloque' && movData.TipoMov === 'entrada' && (
                        <div className="form-group">
                            <label className="form-label">How were they made? *</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    type="button"
                                    className={`btn ${movData.Origen === '3D' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setMovData({ ...movData, Origen: '3D' })}
                                    style={{ flex: 1 }}
                                >
                                    3D printing
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${movData.Origen === 'CNC' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setMovData({ ...movData, Origen: 'CNC' })}
                                    style={{ flex: 1 }}
                                >
                                    CNC
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Quantity *</label>
                        <input type="number" min="1" className="form-input" value={movData.Cantidad} onChange={(e) => setMovData({ ...movData, Cantidad: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Reason / Comment</label>
                        <input className="form-input" value={movData.Comentario} onChange={(e) => setMovData({ ...movData, Comentario: e.target.value })} placeholder="e.g. Bar usage, purchase, breakage..." />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsMovOpen(false)} disabled={saving}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Record'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL KARDEX */}
            <Modal
                isOpen={isKardexOpen}
                onClose={() => setIsKardexOpen(false)}
                title={`Movements: ${kardexTarget ? (kardexTarget.tipo === 'material' ? kardexTarget.row.Material : kardexTarget.tipo === 'herramienta' ? kardexTarget.row.Herramienta : kardexTarget.row.NoParte) : ''}`}
                className="inv-wide"
            >
                {kardex.length === 0 ? (
                    <div className="inv-empty">
                        <FiClock size={32} />
                        <p>No recorded movements.<br />Stock ins, stock outs and reservations will appear here.</p>
                    </div>
                ) : (
                    <div className="Table kardex-table">
                        <div className="table-scroll" style={{ maxHeight: 320 }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Movement</th>
                                        <th>Qty.</th>
                                        <th>Ticket</th>
                                        <th>User</th>
                                        <th>Reason</th>
                                        {kardexTarget?.tipo !== 'bloque' && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {kardex.map(k => (
                                        <tr key={k.IdMovimiento}>
                                            <td className="kardex-fecha">{k.FechaFormateada || k.Fecha}</td>
                                            <td>
                                                <span className={`mov-pill mov-${k.TipoMov}`}>
                                                    {k.TipoMov}
                                                </span>
                                            </td>
                                            <td className="kardex-cant">{k.TipoMov === 'consumo' && Number(k.Cantidad) === 0 && k.Largo ? `L:${k.Largo}` : `${k.TipoMov === 'entrada' ? '+' : k.TipoMov === 'salida' || k.TipoMov === 'consumo' ? '−' : ''}${k.Cantidad}`}</td>
                                            <td className="kardex-ticket">{k.TicketId ? (
                                                <span
                                                    className="kardex-ticket-link"
                                                     title="View ticket history"
                                                    onClick={() => navigate(`/tickets/${k.TicketId}/historial`)}
                                                >
                                                    #{k.TicketId}
                                                </span>
                                            ) : '—'}</td>
                                            <td className="kardex-usuario">{k.UsuarioNombre || (k.UsuarioId ? `#${k.UsuarioId}` : '—')}</td>
                                            <td className="kardex-motivo">{k.Comentario || '—'}{(k.Largo || k.Ancho || k.Alto) && (<><br /><small className="kardex-dims">L:{k.Largo ?? '—'} A:{k.Ancho ?? '—'} H:{k.Alto ?? '—'}</small></>)}
                                            </td>
                                            <td>
                                                {kardexTarget?.tipo !== 'bloque' && (
                                                     <button className="icon-button" title="Delete movement (reverts stock)" onClick={() => handleDeleteMov(k.IdMovimiento)}>
                                                        <FiTrash2 />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL DEVOLVER */}
            <Modal
                isOpen={isDevolverOpen}
                onClose={() => setIsDevolverOpen(false)}
                title={devolverTarget ? `Return: ${devolverTarget.noParte} (ticket #${devolverTarget.ticketId})` : 'Return'}
            >
                <form className="form-container" onSubmit={handleDevolverSubmit}>
                    <div className="form-group">
                        <label className="form-label">Quantity to return *</label>
                        <input
                            type="number" min="1" max={devolverTarget?.max || 1}
                            className="form-input"
                            value={devolverData.Cantidad}
                            onChange={(e) => setDevolverData({ ...devolverData, Cantidad: e.target.value })}
                            required
                        />
                        <small className="form-hint">Currently reserved: {devolverTarget?.max || 0}. Returns to available.</small>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Reason</label>
                        <input
                            className="form-input"
                            value={devolverData.Comentario}
                            onChange={(e) => setDevolverData({ ...devolverData, Comentario: e.target.value })}
                            placeholder="e.g. Partially canceled ticket..."
                        />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsDevolverOpen(false)} disabled={saving}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Return'}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
};
