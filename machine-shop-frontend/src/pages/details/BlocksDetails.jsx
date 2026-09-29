import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import { Modal } from '../../components/Modal';
import { DrawingForm } from "../forms/DrawingForm";
import api from '../../api/api';
import socket from "../../api/socket";
import { AuthContext } from '../../context/AuthProvider';
import { FiArrowLeft, FiChevronDown, FiChevronRight, FiFileText, FiCpu, FiDownload, FiImage, FiPlus, FiTrash2, FiEdit2, FiFolder, FiCode, FiBox, FiUpload, FiX, FiFile, FiAlertCircle, FiCalendar, FiUser, FiPackage, FiCheckCircle, FiClock, FiEye, FiCheck } from "react-icons/fi";
import { showToast } from 'nextjs-toast-notify';
import Swal from "sweetalert2";

export const BlocksDetails = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const blockId = sessionStorage.getItem("selectedBlockId");

    const [openDrawings, setOpenDrawings] = useState(new Set());
    const [openEnsambles, setOpenEnsambles] = useState(new Set());
    const [showAddProgram, setShowAddProgram] = useState(null);
    const [showAddEnsemble, setShowAddEnsemble] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedDrawing, setSelectedDrawing] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingBlock, setLoadingBlock] = useState(true);
    const [loadingProgram, setLoadingProgram] = useState(false);
    const [loadingEnsemble, setLoadingEnsemble] = useState(false);

    const [drawings, setDrawings] = useState([]);
    const [ensambles, setEnsambles] = useState([]);
    const [blockInfo, setBlockInfo] = useState(null);

    // ✅ Materiales por programa (receta informativa, no descuenta)
    const [progMats, setProgMats] = useState({});
    const [progMatsOk, setProgMatsOk] = useState({});
    const [isMatModalOpen, setIsMatModalOpen] = useState(false);
    const [matTarget, setMatTarget] = useState(null);
    const [matSel, setMatSel] = useState({});
    const [materialesInv, setMaterialesInv] = useState([]);

    const toggleMatCheck = (idMat) => {
        setMatSel(prev => {
            const actual = prev[idMat] || { check: false, Cantidad: '', Largo: '', Ancho: '', Alto: '' };
            return { ...prev, [idMat]: { ...actual, check: !actual.check } };
        });
    };

    const updateMatSel = (idMat, field, value) => {
        setMatSel(prev => ({
            ...prev,
            [idMat]: { ...(prev[idMat] || { check: true }), [field]: value }
        }));
    };

    // ✅ Pin/funda por pin del bloque (informativo, no descuenta)
    const [pinFunda, setPinFunda] = useState([]);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    // Combos: [{ PinMaterialId, FundaMaterialId, Cuantos }] — se reparten en orden a los pines 1..N
    const [pinCombos, setPinCombos] = useState([]);
    const [pinComboForm, setPinComboForm] = useState({ PinMaterialId: '', FundaMaterialId: '', Cuantos: 1 });

    const esPin = (m) => (m?.TipoMaterial || '').toLowerCase().includes('pin');
    const esFunda = (m) => (m?.TipoMaterial || '').toLowerCase().includes('funda');
    const pinesInv = materialesInv.filter(esPin);
    const fundasInv = materialesInv.filter(esFunda);
    const nombreMat = (id) => {
        const m = materialesInv.find(x => String(x.IdMateriales) === String(id));
        return m ? m.Material : (id ? `#${id}` : '—');
    };

    // ✅ Historial de materiales para la sección de ensamble
    const [histMats, setHistMats] = useState({ movimientos: [], planeado: [] });

    // ✅ Estados para los checkboxes de completitud (fuente de verdad: backend /bloquesGetStatus)
    const [drawingsComplete, setDrawingsComplete] = useState(false);
    const [programsComplete, setProgramsComplete] = useState(false);
    const [ensamblesComplete, setEnsamblesComplete] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [hasDrawings, setHasDrawings] = useState(false);
    const [hasPrograms, setHasPrograms] = useState(false);

    const [newProgram, setNewProgram] = useState({
        DibujoId: '',
        NumeroOperacion: '',
        RutaPrograma: null,
        NombreOriginal: ''
    });

    const [newEnsemble, setNewEnsemble] = useState({
        BloqueId: blockId || '',
        NombreEnsamble: '',
        RutaEnsamble: null
    });

    const [programFile, setProgramFile] = useState(null);
    const [programFileInfo, setProgramFileInfo] = useState(null);
    const [ensembleFile, setEnsembleFile] = useState(null);
    const [ensembleFileInfo, setEnsembleFileInfo] = useState(null);

    const fileInputRef = useRef(null);
    const ensembleFileInputRef = useRef(null);

    const IMAGE_BASE_URL = `${api.defaults.baseURL}/uploads/bloques/`;
    const DRAWING_BASE_URL = `${api.defaults.baseURL}/uploads/dibujos/`;
    const PROGRAM_BASE_URL = `${api.defaults.baseURL}/uploads/programas/`;
    const ENSEMBLE_BASE_URL = `${api.defaults.baseURL}/uploads/ensambles/`;

    // =============================================
    // FORMAT FUNCTIONS
    // =============================================

    const formatDateOnly = (value) => {
        if (!value) return 'N/A';

        const rawValue = String(value).trim();
        const datePart = rawValue.includes('T') ? rawValue.split('T')[0] : rawValue.split(' ')[0];

        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            const [year, month, day] = datePart.split('-').map(Number);
            return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        }

        const parsedDate = new Date(rawValue);
        if (Number.isNaN(parsedDate.getTime())) {
            return 'N/A';
        }

        return parsedDate.toLocaleDateString('es-MX', {
            timeZone: 'America/Hermosillo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // =============================================
    // FETCH FUNCTIONS
    // =============================================

    const fetchDrawings = async () => {
        if (!blockId || blockId === 'undefined' || blockId === 'null') {
            console.warn('⚠️ No hay blockId válido para cargar dibujos');
            return;
        }

        setLoading(true);
        try {
            console.log('📥 Cargando dibujos para el bloque:', blockId);
            const response = await api.get(`/dibujosByBloque/${blockId}`);

            const drawingsWithPrograms = await Promise.all(
                response.data.map(async (d) => {
                    try {
                        const programasRes = await api.get(`/programasByDibujo/${d.IdDibujo || d.id}`);
                        return {
                            ...d,
                            programas: programasRes.data || []
                        };
                    } catch (error) {
                        console.error(`❌ Error al cargar programas para dibujo ${d.IdDibujo}:`, error);
                        return {
                            ...d,
                            programas: []
                        };
                    }
                })
            );

            const drawingsData = drawingsWithPrograms.map((d, index) => ({
                IdDibujo: d.IdDibujo || d.id || `drawing-${index}`,
                BloqueId: d.BloqueId,
                TipoDibujoId: d.TipoDibujoId,
                RutaDibujo: d.RutaDibujo,
                FechaSubida: d.FechaSubida,
                NombreDibujo: d.NombreDibujo || 'Unnamed',
                nombre: d.NombreDibujo || 'Unnamed',
                fecha: formatDateOnly(d.FechaSubida),
                image: d.RutaDibujo ? `${DRAWING_BASE_URL}${d.RutaDibujo}` : null,
                rutaArchivo: d.RutaDibujo,
                tipoDibujoNombre: d.TipoDibujoNombre || 'No type',
                subidoPor: d.SubidoPorNombre || 'Unknown',
                programas: d.programas || []
            }));

            console.log('✅ Dibujos cargados:', drawingsData);
            setDrawings(drawingsData);

            // Solo registra si HAY dibujos (para habilitar/deshabilitar botones).
            // NO toca drawingsComplete: ese flag solo lo pone el botón + backend.
            setHasDrawings(drawingsData.length > 0);

            // Receta informativa por programa (no bloquea el render de dibujos)
            fetchProgMats(drawingsData);

        } catch (error) {
            console.error('❌ Error al cargar dibujos:', error);
            showToast.error("Error loading drawings", {
                duration: 3000,
                position: "top-right",
            });
            setDrawings([]);
            setDrawingsComplete(false);
        } finally {
            setLoading(false);
        }
    };

    const fetchEnsambles = async () => {
        if (!blockId || blockId === 'undefined' || blockId === 'null') {
            console.warn('⚠️ No hay blockId válido para cargar ensambles');
            return;
        }

        setLoadingEnsemble(true);
        try {
            console.log('📥 Cargando ensambles para el bloque:', blockId);
            const response = await api.get(`/ensamblesByBloque/${blockId}`);

            const ensamblesData = response.data.map((e) => ({
                IdEnsamble: e.IdEnsamble,
                BloqueId: e.BloqueId,
                NombreEnsamble: e.NombreEnsamble || 'Unnamed',
                RutaEnsamble: e.RutaEnsamble,
                FechaSubida: e.FechaSubida,
                fecha: formatDateOnly(e.FechaSubida),
                rutaArchivo: e.RutaEnsamble,
                image: e.RutaEnsamble ? `${ENSEMBLE_BASE_URL}${e.RutaEnsamble}` : null,
                subidoPor: e.SubidoPorNombre || 'Unknown'
            }));

            console.log('✅ Ensambles cargados:', ensamblesData);
            setEnsambles(ensamblesData);
        } catch (error) {
            console.error('❌ Error al cargar ensambles:', error);
            showToast.error("Error loading assemblies", {
                duration: 3000,
                position: "top-right",
            });
            setEnsambles([]);
        } finally {
            setLoadingEnsemble(false);
        }
    };

    const fetchBlockInfo = async () => {
        if (!blockId || blockId === 'undefined' || blockId === 'null') {
            setLoadingBlock(false);
            return;
        }

        setLoadingBlock(true);
        try {
            console.log('📥 Cargando información del bloque:', blockId);
            const response = await api.get(`/bloquesSelectAll/${blockId}`);
            console.log('✅ Información del bloque:', response.data);
            setBlockInfo(response.data);
        } catch (error) {
            console.error('❌ Error al cargar información del bloque:', error);
            showToast.error("Error loading block information", {
                duration: 3000,
                position: "top-right",
            });
            setBlockInfo(null);
        } finally {
            setLoadingBlock(false);
        }
    };

    // ✅ Materiales asignados a cada programa (receta informativa)
    // + flag explícito "materiales completos" por programa
    const fetchProgMats = async (listaDibujos) => {
        const base = Array.isArray(listaDibujos) ? listaDibujos : drawings;
        const mapa = {};
        const flags = {};
        await Promise.all(
            base.flatMap(d => (d.programas || []).map(async (p) => {
                const pid = p.IdPrograma || p.id;
                if (!pid) return;
                try {
                    const res = await api.get(`/programaMateriales?programaId=${pid}`);
                    const data = res.data;
                    mapa[pid] = Array.isArray(data) ? data : (data?.materiales || []);
                    flags[pid] = Array.isArray(data) ? false : data?.materialesCompletos === true;
                } catch (error) {
                    console.error(`❌ Error al cargar materiales del programa ${pid}:`, error);
                }
            }))
        );
        setProgMats(mapa);
        setProgMatsOk(flags);
    };

    // ¿El programa tiene todo para declararse completo? (≥1 material + stock suficiente)
    const programaListoParaMarcar = (pid) => {
        const mats = progMats[pid] || [];
        if (mats.length === 0) return { ok: false, motivo: 'Assign at least one material first' };
        const sinStock = mats.filter(m => {
            if (Number(m.EsBarra) === 1) {
                return (Number(m.LargoDisponible) || 0) < (Number(m.Largo) || 0);
            }
            return (Number(m.Existencia) || 0) < Number(m.Cantidad);
        });
        if (sinStock.length > 0) {
            return { ok: false, motivo: `Insufficient stock: ${sinStock.map(m => m.Material || 'material').join(', ')}` };
        }
        return { ok: true, motivo: '' };
    };

    const toggleProgramaMats = async (pid) => {
        try {
            const res = await api.put(`/programasMarcarMateriales/${pid}`, { UsuarioId: user?.noEmp });
            showToast.success(res.data?.message || 'Status updated', { duration: 3000, position: "top-right" });
            fetchDrawings();
            fetchHistMats();
        } catch (error) {
            console.error('❌ Error al marcar materiales del programa:', error);
            showToast.error(error.response?.data?.error || 'Error updating', { duration: 4000, position: "top-right" });
        }
    };

    const fetchMaterialesInv = async () => {
        try {
            const res = await api.get('/materialesSelect');
            setMaterialesInv(res.data || []);
        } catch (error) {
            console.error('❌ Error al cargar materiales:', error);
        }
    };

    // ✅ Configuración pin/funda del bloque
    const fetchPinFunda = async () => {
        if (!blockId || blockId === 'undefined' || blockId === 'null') return;
        try {
            const res = await api.get(`/bloquePinFunda?bloqueId=${encodeURIComponent(blockId)}`);
            setPinFunda(res.data || []);
        } catch (error) {
            console.error('❌ Error al cargar pin/funda:', error);
        }
    };

    const handleDeleteHistMov = async (idMov) => {
        const r = await Swal.fire({
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
        if (!r.isConfirmed) return;
        try {
            const res = await api.delete(`/inventarioMovimiento/${idMov}`, { data: { UsuarioId: user?.noEmp } });
            showToast.success(res.data?.message || 'Movement deleted', { duration: 3000, position: "top-right" });
            fetchHistMats();
            fetchDrawings();
        } catch (error) {
            showToast.error(error.response?.data?.error || 'Error deleting movement', { duration: 4000, position: "top-right" });
        }
    };

    // ✅ Historial de materiales para la sección de ensamble
    const fetchHistMats = async () => {
        if (!blockId || blockId === 'undefined' || blockId === 'null') return;
        try {
            const res = await api.get(`/ensambleHistorialMateriales?bloqueId=${encodeURIComponent(blockId)}`);
            setHistMats(res.data || { movimientos: [], planeado: [] });
        } catch (error) {
            console.error('❌ Error al cargar historial de materiales:', error);
        }
    };

    // Fuente de verdad de los flags manuales: backend /bloquesGetStatus.
    // Se llama al montar y después de cada toggle exitoso.
    const fetchBlockStatus = async () => {
        if (!blockId || blockId === 'undefined' || blockId === 'null') return;
        try {
            const res = await api.get(`/bloquesGetStatus/${blockId}`);
            const s = res.data || {};
            const toBool = (v) => v === true || v === 1 || v === '1';
            setDrawingsComplete(toBool(s.DibujosCompleto));
            setProgramsComplete(toBool(s.ProgramasCompleto));
            setEnsamblesComplete(toBool(s.EnsambleCompleto));
        } catch (error) {
            console.error('❌ Error al cargar estado del bloque:', error);
        }
    };

    // ✅ Marcar dibujos completos/incompletos (solo admin, guarda en backend)
    // Verde = "Marcar COMPLETOS" (cuando drawingsComplete=false) / Naranja = "Marcar INCOMPLETOS" (cuando true)
    // Cancel NO cambia nada.
    const toggleDrawingsComplete = async () => {
        // No permitir si no hay dibujos
        if (!hasDrawings) {
            showToast.error("No drawings uploaded for this block", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        setIsUpdatingStatus(true);
        try {
            const result = await Swal.fire({
                title: drawingsComplete ? 'Mark drawings as INCOMPLETE?' : 'Mark drawings as COMPLETE?',
                text: drawingsComplete
                    ? 'The button will turn green to mark them as complete again.'
                    : 'The button will turn orange to mark them as incomplete.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#D71928',
                cancelButtonColor: '#64748b',
                confirmButtonText: drawingsComplete ? 'Yes, mark incomplete' : 'Yes, mark complete',
                cancelButtonText: 'Cancel',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });

            // Cancel NO cambia nada
            if (!result.isConfirmed) return;

            // El backend hace toggle y devuelve el valor real guardado
            const response = await api.put(`/bloquesUpdateDibujosStatus/${blockId}`, {
                UsuarioId: user?.noEmp
            });

            const toBool = (v) => v === true || v === 1 || v === '1';
            const nuevoValor = toBool(response.data?.DibujosCompleto);
            setDrawingsComplete(nuevoValor);
            // Re-hidratar por si acaso (fuente de verdad: backend)
            fetchBlockStatus();

            showToast.success(
                nuevoValor
                    ? '✅ Drawings marked as COMPLETE'
                    : '🔓 Drawings marked as INCOMPLETE',
                {
                    duration: 3000,
                    position: "top-right",
                }
            );
        } catch (error) {
            console.error('Error updating estado de dibujos:', error);
            showToast.error(error.response?.data?.error || 'Error updating status', {
                duration: 3000,
                position: "top-right",
            });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    // ✅ Marcar programas completos/incompletos (solo admin, guarda en backend)
    // Verde = "Marcar COMPLETOS" (cuando programsComplete=false) / Naranja = "Marcar INCOMPLETOS" (cuando true)
    // Cancel NO cambia nada. Si no hay programas, el botón está deshabilitado y ni siquiera entra aquí.
    const toggleProgramsComplete = async () => {
        if (!hasPrograms) {
            showToast.error("No programs uploaded for this block", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        setIsUpdatingStatus(true);
        try {
            const result = await Swal.fire({
                title: programsComplete ? 'Mark programs as INCOMPLETE?' : 'Mark programs as COMPLETE?',
                text: programsComplete
                    ? 'The button will turn green to mark them as complete again.'
                    : 'The button will turn orange to mark them as incomplete.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#D71928',
                cancelButtonColor: '#64748b',
                confirmButtonText: programsComplete ? 'Yes, mark incomplete' : 'Yes, mark complete',
                cancelButtonText: 'Cancel',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });

            // Cancel NO cambia nada
            if (!result.isConfirmed) return;

            // El backend hace toggle y devuelve el valor real guardado
            const response = await api.put(`/bloquesUpdateProgramasStatus/${blockId}`, {
                UsuarioId: user?.noEmp
            });

            const toBool = (v) => v === true || v === 1 || v === '1';
            const nuevoValor = toBool(response.data?.ProgramasCompleto);
            setProgramsComplete(nuevoValor);
            // Re-hidratar por si acaso (fuente de verdad: backend)
            fetchBlockStatus();

            showToast.success(
                nuevoValor
                    ? '✅ Programs marked as COMPLETE'
                    : '🔓 Programs marked as INCOMPLETE',
                {
                    duration: 3000,
                    position: "top-right",
                }
            );
        } catch (error) {
            console.error('Error updating estado de programas:', error);
            showToast.error(error.response?.data?.error || 'Error updating status', {
                duration: 3000,
                position: "top-right",
            });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    // =============================================
    // TOGGLE FUNCTIONS
    // =============================================

    const toggleDrawing = (id) => {
        setOpenDrawings(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const toggleEnsemble = (id) => {
        setOpenEnsambles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // =============================================
    // EFFECTS
    // =============================================

useEffect(() => {
        if (!blockId || blockId === 'undefined' || blockId === 'null') {
            showToast.error("Selected block not found", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        fetchBlockInfo();
        fetchDrawings();
        fetchEnsambles();
        fetchBlockStatus();
        fetchMaterialesInv();
        fetchPinFunda();
        fetchHistMats();

        socket.on("dibujosActualizados", () => {
            console.log('🔄 Dibujos actualizados, recargando...');
            fetchDrawings();
        });

        socket.on("bloquesActualizados", () => {
            console.log('🔄 Bloques actualizados, recargando...');
            fetchBlockInfo();
            fetchEnsambles();
        });

        socket.on("ensamblesActualizados", () => {
            console.log('🔄 Ensambles actualizados, recargando...');
            fetchEnsambles();
            fetchHistMats();
        });

        socket.on("programaMaterialesActualizados", () => {
            console.log('🔄 Materiales de programa actualizados, recargando...');
            fetchDrawings();
            fetchHistMats();
        });

        socket.on("bloquePinFundaActualizado", () => {
            console.log('🔄 Pin/funda actualizados, recargando...');
            fetchPinFunda();
        });

        socket.on("inventarioActualizado", () => {
            fetchHistMats();
        });

        return () => {
            socket.off("dibujosActualizados");
            socket.off("bloquesActualizados");
            socket.off("ensamblesActualizados");
            socket.off("programaMaterialesActualizados");
            socket.off("bloquePinFundaActualizado");
            socket.off("inventarioActualizado");
        };
    }, [blockId]);


    // Solo registra si HAY programas (para habilitar/deshabilitar el botón).
    // NO toca programsComplete: ese flag solo lo pone el botón + backend.
    useEffect(() => {
        let totalPrograms = 0;
        drawings.forEach(d => {
            totalPrograms += d.programas?.length || 0;
        });
        setHasPrograms(totalPrograms > 0);
    }, [drawings]);

    // =============================================
    // STATISTICS
    // =============================================

    const totalDrawings = drawings.length;
    const totalPrograms = drawings.reduce((acc, d) => acc + (d.programas?.length || 0), 0);
    const totalAssemblies = ensambles.length;

    // =============================================
    // DRAWINGS HANDLERS
    // =============================================

    const handleOpenModal = () => {
        setSelectedDrawing(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (drawing) => {
        console.log('📝 Abriendo edición para dibujo:', drawing);
        const drawingToEdit = {
            IdDibujo: drawing.IdDibujo || drawing.id,
            BloqueId: drawing.BloqueId,
            TipoDibujoId: drawing.TipoDibujoId,
            RutaDibujo: drawing.RutaDibujo || drawing.rutaArchivo,
            FechaSubida: drawing.FechaSubida,
            NombreDibujo: drawing.NombreDibujo || drawing.nombre,
            ...drawing
        };
        setSelectedDrawing(drawingToEdit);
        setIsEditModalOpen(true);
    };

    const handleAddDrawing = (newDrawingData) => {
        fetchDrawings();
        setIsModalOpen(false);
        showToast.success("Drawing added successfully", {
            duration: 3000,
            position: "top-right",
        });
    };

    const handleDeleteDibujo = async (IdDibujo, NombreDibujo) => {
        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                html: `Do you want to delete the drawing <strong>${NombreDibujo || ''}</strong>?<br>This action cannot be undone.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#D71928',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, delete',
                cancelButtonText: 'Cancel',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });

            if (!result.isConfirmed) return;

            const response = await api.delete(`/dibujosDelete/${IdDibujo}`);

            if (response.data.success) {
                showToast.success(response.data.message, {
                    duration: 3000,
                    position: "top-right",
                });
                fetchDrawings();
            }

        } catch (error) {
            console.error(error);
            const errorMessage = error.response?.data?.error || 'Error deleting drawing';
            showToast.error(errorMessage, {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    // =============================================
    // PROGRAMS HANDLERS
    // =============================================

    const handleProgramFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (validateProgramFile(file)) {
            handleProgramFileUpload(file);
        }
    };

    const validateProgramFile = (file) => {
        if (file.size > 50 * 1024 * 1024) {
            showToast.error("File exceeds the 50MB limit", {
                duration: 4000,
                position: "top-right",
            });
            return false;
        }

        const allowedExtensions = ['.nc', '.cnc', '.txt', '.prt', '.sldprt', '.sldasm', '.pdf', '.dwg', '.mcam'];
        const fileName = file.name;
        const ext = '.' + fileName.split('.').pop().toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            showToast.error(`Format not allowed. Allowed: ${allowedExtensions.join(', ')}`, {
                duration: 4000,
                position: "top-right",
            });
            return false;
        }

        return true;
    };

    const handleProgramFileUpload = (file) => {
        const fileName = file.name;
        const operacion = fileName.replace(/\.[^/.]+$/, "");

        setProgramFile(file);
        setProgramFileInfo({
            nombre: fileName,
            tamanio: (file.size / 1024 / 1024).toFixed(2),
            extension: fileName.split('.').pop().toLowerCase()
        });

        setNewProgram(prev => ({
            ...prev,
            NumeroOperacion: operacion,
            RutaPrograma: file,
            NombreOriginal: fileName
        }));
    };

    const handleSubmitProgram = async (drawingId) => {
        if (!programFile) {
            showToast.error("Please select a file", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        if (!newProgram.NumeroOperacion.trim()) {
            showToast.error("Please enter an operation number", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        if (!drawingId || !user?.noEmp) {
            showToast.error("Could not identify the drawing or user", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        setLoadingProgram(true);

        try {
            const dataToSend = new FormData();
            dataToSend.append('DibujoId', String(drawingId));
            dataToSend.append('NumeroOperacion', newProgram.NumeroOperacion);
            dataToSend.append('UsuarioId', String(user.noEmp));

            if (programFile) {
                dataToSend.append('RutaPrograma', programFile);
            }

            const response = await api.post(`/programasInsert`, dataToSend, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            showToast.success("Program added successfully", {
                duration: 3000,
                position: "top-right",
            });

            fetchDrawings();

            setNewProgram({
                DibujoId: '',
                NumeroOperacion: '',
                RutaPrograma: null,
                NombreOriginal: ''
            });
            setProgramFile(null);
            setProgramFileInfo(null);
            setShowAddProgram(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

        } catch (error) {
            console.error('❌ Error al agregar programa:', error);
            showToast.error(error.response?.data?.error || "Error adding program", {
                duration: 5000,
                position: "top-right",
            });
        } finally {
            setLoadingProgram(false);
        }
    };

    const handleDeleteProgram = async (programId, programName) => {
        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                html: `Do you want to delete the program <strong>${programName || ''}</strong>?<br>This action cannot be undone.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#D71928',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, delete',
                cancelButtonText: 'Cancel',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });

            if (!result.isConfirmed) return;

            const response = await api.delete(`/programasDelete/${programId}`);

            if (response.data.success) {
                showToast.success(response.data.message, {
                    duration: 3000,
                    position: "top-right",
                });
                fetchDrawings();
            }

        } catch (error) {
            console.error(error);
            showToast.error(error.response?.data?.error || 'Error deleting program', {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    // =============================================
    // MATERIALES POR PROGRAMA (receta informativa, no descuenta)
    // =============================================

    const openMatModal = (programa) => {
        setMatTarget(programa);
        setMatSel({});
        setIsMatModalOpen(true);
    };

    const handleMatSubmit = async (e) => {
        e.preventDefault();
        if (!matTarget) return;
        const pid = matTarget.IdPrograma || matTarget.id;
        const items = Object.entries(matSel)
            .filter(([, v]) => v?.check)
            .map(([idMat, v]) => ({
                MaterialId: Number(idMat),
                Cantidad: v.Cantidad,
                Largo: v.Largo || null,
                Ancho: v.Ancho || null,
                Alto: v.Alto || null
            }));
        if (items.length === 0) {
            showToast.warning('Check at least one material with ✓', { duration: 3000, position: "top-right" });
            return;
        }
        try {
            const res = await api.post('/programaMaterialesBatch', {
                ProgramaId: pid,
                items,
                UsuarioId: user?.noEmp
            });
            showToast.success(res.data?.message || 'Materials assigned', { duration: 3000, position: "top-right" });
            if (res.data?.warning) {
                showToast.warning(res.data.warning, { duration: 6000, position: "top-right" });
            }
            setIsMatModalOpen(false);
            setMatSel({});
            fetchDrawings();
            fetchHistMats();
        } catch (error) {
            console.error('❌ Error al asignar materiales:', error);
            showToast.error(error.response?.data?.error || 'Error assigning materials', { duration: 4000, position: "top-right" });
        }
    };

    const handleMatDelete = async (idProgMat) => {
        try {
            await api.delete(`/programaMateriales/${idProgMat}`, { data: { UsuarioId: user?.noEmp } });
            showToast.success('Assignment deleted (no stock returned: it never deducted)', { duration: 4000, position: "top-right" });
            fetchDrawings();
            fetchHistMats();
        } catch (error) {
            console.error('❌ Error al eliminar asignación:', error);
            showToast.error(error.response?.data?.error || 'Error deleting assignment', { duration: 4000, position: "top-right" });
        }
    };

    // =============================================
    // PIN/FUNDA POR PIN (informativo, no descuenta)
    // =============================================

    const openPinModal = () => {
        // Agrupar lo guardado en combos (pin+funda iguales y consecutivos)
        const ordenados = [...pinFunda].sort((a, b) => Number(a.NumPin) - Number(b.NumPin));
        const combos = [];
        ordenados.forEach(pf => {
            const pin = pf.PinMaterialId ? String(pf.PinMaterialId) : '';
            const funda = pf.FundaMaterialId ? String(pf.FundaMaterialId) : '';
            if (!pin && !funda) return;
            const last = combos[combos.length - 1];
            if (last && last.PinMaterialId === pin && last.FundaMaterialId === funda
                && last.hasta === Number(pf.NumPin) - 1) {
                last.hasta = Number(pf.NumPin);
                last.Cuantos += 1;
            } else {
                combos.push({ PinMaterialId: pin, FundaMaterialId: funda, Cuantos: 1, hasta: Number(pf.NumPin) });
            }
        });
        setPinCombos(combos.map(({ hasta, ...c }) => c));
        setPinComboForm({ PinMaterialId: '', FundaMaterialId: '', Cuantos: 1 });
        setIsPinModalOpen(true);
    };

    const handlePinComboAdd = () => {
        if (!pinComboForm.PinMaterialId && !pinComboForm.FundaMaterialId) {
            showToast.warning('Choose at least pin or sleeve', { duration: 3000, position: "top-right" });
            return;
        }
        const cuantos = Math.max(1, parseInt(pinComboForm.Cuantos, 10) || 1);
        setPinCombos(prev => [...prev, {
            PinMaterialId: pinComboForm.PinMaterialId || '',
            FundaMaterialId: pinComboForm.FundaMaterialId || '',
            Cuantos: cuantos
        }]);
        setPinComboForm({ PinMaterialId: '', FundaMaterialId: '', Cuantos: 1 });
    };

    const handlePinComboRemove = (idx) => {
        setPinCombos(prev => prev.filter((_, i) => i !== idx));
    };

    const handlePinSaveAll = async () => {
        const total = Number(blockInfo?.CantidadPines) || 0;
        const asignados = pinCombos.reduce((a, c) => a + (Number(c.Cuantos) || 0), 0);
        if (asignados > total) {
            showToast.error(`${asignados} in combos but the block only has ${total} pins`, { duration: 4000, position: "top-right" });
            return;
        }
        try {
            // Expandir combos en orden a los pines 1..N; el resto queda sin configurar
            let pin = 1;
            const planes = [];
            pinCombos.forEach(c => {
                for (let k = 0; k < Number(c.Cuantos); k++) {
                    planes.push({ num: pin++, pin: c.PinMaterialId || null, funda: c.FundaMaterialId || null });
                }
            });
            for (const pl of planes) {
                await api.put('/bloquePinFunda', {
                    BloqueId: blockId,
                    NumPin: pl.num,
                    PinMaterialId: pl.pin,
                    FundaMaterialId: pl.funda,
                    UsuarioId: user?.noEmp
                });
            }
            // Limpiar pines que quedaron fuera de los combos
            for (let n = pin; n <= total; n++) {
                await api.put('/bloquePinFunda', {
                    BloqueId: blockId,
                    NumPin: n,
                    PinMaterialId: null,
                    FundaMaterialId: null,
                    UsuarioId: user?.noEmp
                });
            }
            showToast.success(`Pins configured (${planes.length}/${total})`, { duration: 3000, position: "top-right" });
            setIsPinModalOpen(false);
            fetchPinFunda();
        } catch (error) {
            console.error('❌ Error al guardar pin/funda:', error);
            showToast.error(error.response?.data?.error || 'Error saving', { duration: 4000, position: "top-right" });
        }
    };

    const handleDownloadProgram = async (program) => {
        try {
            const programId = program.IdPrograma || program.id;

            if (!programId) {
                showToast.error("Invalid program ID", {
                    duration: 3000,
                    position: "top-right",
                });
                return;
            }

            const response = await api.get(`/programasDownload/${programId}`, {
                responseType: 'blob',
            });

            let nombreArchivo = 'program';
            const contentDisposition = response.headers['content-disposition'];

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    nombreArchivo = filenameMatch[1].replace(/['"]/g, '');
                    try {
                        nombreArchivo = decodeURIComponent(nombreArchivo);
                    } catch (e) { }
                }
            }

            if (nombreArchivo === 'program' || !nombreArchivo) {
                const nombreBase = program.NombrePrograma || program.NumeroOperacion || program.operacion || 'program';
                const tieneExtension = nombreBase.includes('.');
                if (tieneExtension) {
                    nombreArchivo = nombreBase;
                } else {
                    const ruta = program.RutaPrograma || '';
                    const extension = ruta.includes('.') ? ruta.substring(ruta.lastIndexOf('.')) : '';
                    nombreArchivo = extension ? `${nombreBase}${extension}` : nombreBase;
                }
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', nombreArchivo);

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            showToast.success("Program downloaded successfully", {
                duration: 3000,
                position: "top-right",
            });

        } catch (error) {
            console.error('❌ Error al descargar programa:', error);
            showToast.error("Error downloading program", {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    // =============================================
    // ENSEMBLES HANDLERS
    // =============================================

    const handleEnsembleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (validateEnsembleFile(file)) {
            handleEnsembleFileUpload(file);
        }
    };

    const validateEnsembleFile = (file) => {
        if (file.size > 50 * 1024 * 1024) {
            showToast.error("File exceeds the 50MB limit", {
                duration: 4000,
                position: "top-right",
            });
            return false;
        }

        const allowedExtensions = ['.pdf', '.dwg', '.step', '.stp', '.igs', '.iges', '.sldasm', '.sldprt'];
        const fileName = file.name;
        const ext = '.' + fileName.split('.').pop().toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            showToast.error(`Format not allowed. Allowed: ${allowedExtensions.join(', ')}`, {
                duration: 4000,
                position: "top-right",
            });
            return false;
        }

        return true;
    };

    const handleEnsembleFileUpload = (file) => {
        const fileName = file.name;
        const nombreBase = fileName.replace(/\.[^/.]+$/, "");

        setEnsembleFile(file);
        setEnsembleFileInfo({
            nombre: fileName,
            tamanio: (file.size / 1024 / 1024).toFixed(2),
            extension: fileName.split('.').pop().toLowerCase()
        });

        setNewEnsemble(prev => ({
            ...prev,
            NombreEnsamble: nombreBase,
            RutaEnsamble: file
        }));
    };

    const handleSubmitEnsemble = async () => {
        if (!ensembleFile) {
            showToast.error("Please select a file", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        if (!newEnsemble.NombreEnsamble.trim()) {
            showToast.error("Could not get the file name", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        if (!blockId || !user?.noEmp) {
            showToast.error("Could not identify the block or user", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        setLoadingEnsemble(true);

        try {
            const dataToSend = new FormData();
            dataToSend.append('BloqueId', String(blockId));
            dataToSend.append('NombreEnsamble', newEnsemble.NombreEnsamble);
            dataToSend.append('UsuarioId', String(user.noEmp));

            if (ensembleFile) {
                dataToSend.append('RutaEnsamble', ensembleFile);
            }

            const response = await api.post(`/ensamblesInsert`, dataToSend, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            showToast.success("Assembly added successfully", {
                duration: 3000,
                position: "top-right",
            });

            fetchEnsambles();
            fetchBlockInfo();

            setNewEnsemble({
                BloqueId: blockId || '',
                NombreEnsamble: '',
                RutaEnsamble: null
            });
            setEnsembleFile(null);
            setEnsembleFileInfo(null);
            setShowAddEnsemble(null);
            if (ensembleFileInputRef.current) {
                ensembleFileInputRef.current.value = '';
            }

        } catch (error) {
            console.error('❌ Error al agregar ensemble:', error);
            showToast.error(error.response?.data?.error || "Error adding assembly", {
                duration: 5000,
                position: "top-right",
            });
        } finally {
            setLoadingEnsemble(false);
        }
    };

    const handleDeleteEnsemble = async (IdEnsemble, NombreEnsamble) => {
        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                html: `Do you want to delete the assembly <strong>${NombreEnsamble || ''}</strong>?<br>This action cannot be undone.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#D71928',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, delete',
                cancelButtonText: 'Cancel',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });

            if (!result.isConfirmed) return;

            const response = await api.delete(`/ensamblesDelete/${IdEnsemble}`);

            if (response.data.success) {
                showToast.success(response.data.message, {
                    duration: 3000,
                    position: "top-right",
                });
                fetchEnsambles();
                fetchBlockInfo();
            }

        } catch (error) {
            console.error(error);
            showToast.error(error.response?.data?.error || 'Error deleting assembly', {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    const handleDownloadEnsemble = async (ensemble) => {
        try {
            const ensembleId = ensemble.IdEnsamble;

            if (!ensembleId) {
                showToast.error("Invalid assembly ID", {
                    duration: 3000,
                    position: "top-right",
                });
                return;
            }

            const response = await api.get(`/ensamblesDownload/${ensembleId}`, {
                responseType: 'blob',
            });

            let nombreArchivo = 'assembly';
            const contentDisposition = response.headers['content-disposition'];

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    nombreArchivo = filenameMatch[1].replace(/['"]/g, '');
                    try {
                        nombreArchivo = decodeURIComponent(nombreArchivo);
                    } catch (e) { }
                }
            }

            if (nombreArchivo === 'assembly' || !nombreArchivo) {
                const nombreBase = ensemble.NombreEnsamble || 'assembly';
                const ruta = ensemble.RutaEnsamble || '';
                const extension = ruta.includes('.') ? ruta.substring(ruta.lastIndexOf('.')) : '';
                nombreArchivo = extension ? `${nombreBase}${extension}` : nombreBase;
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', nombreArchivo);

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            showToast.success("Assembly downloaded successfully", {
                duration: 3000,
                position: "top-right",
            });

        } catch (error) {
            console.error('❌ Error al descargar ensemble:', error);
            showToast.error("Error downloading assembly", {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    // =============================================
    // DRAG & DROP HANDLERS
    // =============================================

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropZone = e.currentTarget;
        dropZone.classList.add('drag-over');
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropZone = e.currentTarget;
        dropZone.classList.remove('drag-over');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropZone = e.currentTarget;
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (validateProgramFile(file)) {
                handleProgramFileUpload(file);
            }
        }
    };

    // =============================================
    // ABRIR ARCHIVOS EN EL NAVEGADOR
    // Imágenes y PDF abren directo; código/texto vía /archivosVer como
    // texto plano; CAD (SolidWorks/DWG) no se puede previsualizar y se descarga.
    // =============================================

    const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const EXT_TEXTO = ['txt', 'nc', 'cnc', 'mcam', 'tap', 'mpf'];

    const abrirArchivo = (tipo, rutaArchivo) => {
        if (!rutaArchivo) {
            showToast.error('No file to open', { duration: 3000, position: "top-right" });
            return;
        }

        // URLs externas (ej. dibujo por link) abren directo
        if (/^https?:\/\//i.test(rutaArchivo)) {
            window.open(rutaArchivo, '_blank', 'noopener');
            return;
        }

        const nombre = String(rutaArchivo).split('/').pop();
        const ext = (nombre.split('.').pop() || '').toLowerCase();
        const base = api.defaults.baseURL;
        const carpeta = { dibujo: 'dibujos', programa: 'programas', ensamble: 'ensambles' }[tipo] || tipo;

        if (EXT_IMAGEN.includes(ext) || ext === 'pdf') {
            window.open(`${base}/uploads/${carpeta}/${nombre}`, '_blank', 'noopener');
        } else if (EXT_TEXTO.includes(ext)) {
            window.open(`${base}/archivosVer/${carpeta}/${encodeURIComponent(nombre)}`, '_blank', 'noopener');
        } else {
            showToast.warning('This format cannot be previewed, it will be downloaded', { duration: 3500, position: "top-right" });
            const link = document.createElement('a');
            link.href = `${base}/uploads/${carpeta}/${nombre}`;
            link.download = nombre;
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    };

    // =============================================
    // RENDER FUNCTIONS
    // =============================================

    const renderDrawingImage = (drawing) => {
        if (drawing.image) {
            return (
                <img
                    src={drawing.image}
                    alt={drawing.nombre}
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                        const parent = e.target.parentNode;
                        const placeholder = document.createElement('div');
                        placeholder.className = 'drawing-image-placeholder';
                        parent.appendChild(placeholder);
                    }}
                />
            );
        } else {
            return (
                <div className="drawing-image-placeholder">
                    <FiFile size={48} />
                    <span>{drawing.rutaArchivo?.split('.').pop().toUpperCase() || 'No image'}</span>
                </div>
            );
        }
    };

    // =============================================
    // LOADING STATE
    // =============================================

    if (loadingBlock) {
        return (
            <>
                <Navbar />
                <Sidebar />
                <div className="page-container">
                    <div className="loading-state">Loading block information...</div>
                </div>
            </>
        );
    }

    // =============================================
    // RENDER
    // =============================================

    return (
        <>
            <Navbar />
            <Sidebar />

            <div className="page-container">
                {/* ============================================= */}
                {/* HEADER Y CARD UNIFICADOS */}
                {/* ============================================= */}
                <div className="block-detail-container">
                    <div className="block-detail-image">
                        <img
                            src={blockInfo?.Imagen ? `${IMAGE_BASE_URL}${blockInfo.Imagen}` : "https://placehold.co/260x260/1a1a2e/fff?text=NO+IMAGE"}
                            alt={blockInfo?.NoParte || 'Block'}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://placehold.co/260x260/1a1a2e/fff?text=NO+IMAGE";
                            }}
                        />
                        <div className="image-overlay">
                            <span className="image-badge">{blockInfo?.NoParte || 'Block'}</span>
                        </div>
                    </div>

                    <div className="block-detail-card">
                        <div className="block-detail-header">
                            <div className="header-left">
                                <div>
                                    <h1>{blockInfo?.NoParte || 'No part number'}</h1>
                                    <span className="subtitle">{blockInfo?.TipoConector || 'No connector type'}</span>
                                </div>
                                <span className="status-badge active">Active</span>
                            </div>

                            <div className="header-right">
                                <button
                                    className="back-button"
                                    onClick={() => navigate("/blocks")}
                                >
                                    <FiArrowLeft />
                                    Back
                                </button>
                                <span className="meta-info">
                                    <FiFileText />
                                    {blockInfo?.FechaFormateada || new Date().toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        <div className="block-detail-info">
                            <div className="detail-tags">
                                <span>{blockInfo?.CantidadPines || 0} Pins · {blockInfo?.TipoTerminal || 'No terminal'}</span>
                                {Number(blockInfo?.CantidadPines) > 0 && (
                                    <button
                                        type="button"
                                        className="pin-config-btn"
                                        onClick={openPinModal}
                                        title="Choose pin and sleeve for each pin"
                                    >
                                        <FiEdit2 size={12} /> Pins {pinFunda.length}/{Number(blockInfo?.CantidadPines)}
                                    </button>
                                )}
                                {blockInfo?.CantPinPresencia >= 1 ? (
                                    <span className="has-lock">
                                        🔒 Lock ({blockInfo.CantPinPresencia} pins)
                                    </span>
                                ) : (
                                    <span className="no-lock">🔓 No Lock</span>
                                )}
                                {blockInfo?.ConectorFisico === 1 ? (
                                    <span className="conector-fisico-tag has-conector">
                                        ✅ Physical Connector
                                    </span>
                                ) : (
                                    <span className="conector-fisico-tag no-conector">
                                        ❌ No Physical Connector
                                    </span>
                                )}
                            </div>
                            <div className="detail-stats">
                                <div className="detail-stat-item">
                                    <div className="stat-icon">
                                        <FiImage />
                                    </div>
                                    <div className="stat-content">
                                        <h3>{totalDrawings}</h3>
                                        <span>Drawings</span>
                                    </div>
                                </div>

                                <div className="detail-stat-item">
                                    <div className="stat-icon">
                                        <FiCode />
                                    </div>
                                    <div className="stat-content">
                                        <h3>{totalPrograms}</h3>
                                        <span>Programs</span>
                                    </div>
                                </div>

                                <div className="detail-stat-item">
                                    <div className="stat-icon">
                                        <FiBox />
                                    </div>
                                    <div className="stat-content">
                                        <h3>{totalAssemblies}</h3>
                                        <span>Assemblies</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ============================================= */}
                {/* SECCIÓN DE DRAWINGS & ENSAMBLES */}
                {/* ============================================= */}
                <div className="drawings-section">
                    <div className="drawings-header">
                        <h2>
                            <FiImage />
                            Drawings & Assemblies
                            <span className="drawing-count">{totalDrawings + totalAssemblies}</span>
                        </h2>
                        <div className="drawings-header-actions">
                            <button
                                className="button-add"
                                onClick={handleOpenModal}
                            >
                                <FiPlus />
                                Add Drawing
                            </button>
                            {/* ✅ Marcar dibujos: VERDE = "Marcar COMPLETOS" / NARANJA = "Marcar INCOMPLETOS" */}
                            <button
                                className={drawingsComplete ? 'status-toggle-btn-orange' : 'status-toggle-btn-green'}
                                onClick={toggleDrawingsComplete}
                                disabled={!hasDrawings || isUpdatingStatus}
                                title={!hasDrawings ? 'Upload at least one drawing to mark' : (drawingsComplete ? 'Mark drawings as INCOMPLETE' : 'Mark drawings as COMPLETE')}
                            >
                                {drawingsComplete ? (
                                    <>
                                        <FiClock /> Mark INCOMPLETE
                                    </>
                                ) : (
                                    <>
                                        <FiCheckCircle /> Mark COMPLETE
                                    </>
                                )}
                            </button>
                            {/* ✅ Marcar programas: VERDE = "Marcar COMPLETOS" / NARANJA = "Marcar INCOMPLETOS" */}
                            <button
                                className={programsComplete ? 'status-toggle-btn-orange' : 'status-toggle-btn-green'}
                                onClick={toggleProgramsComplete}
                                disabled={!hasPrograms || isUpdatingStatus}
                                title={!hasPrograms ? 'Upload at least one program to mark' : (programsComplete ? 'Mark programs as INCOMPLETE' : 'Mark programs as COMPLETE')}
                            >
                                {programsComplete ? (
                                    <>
                                        <FiClock /> Mark INCOMPLETE
                                    </>
                                ) : (
                                    <>
                                        <FiCheckCircle /> Mark COMPLETE
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* ============================================= */}
                    {/* ✅ SECCIÓN DE ENSAMBLES - DENTRO DE DRAWINGS */}
                    {/* ============================================= */}
                    <div className="ensambles-subsection">
                        <div className="ensambles-subheader">
                            <h3>
                                <FiPackage />
                                Assemblies
                                <span className="ensemble-count">{ensambles.length}</span>
                            </h3>
                            <button
                                className="button-add-small"
                                onClick={() => setShowAddEnsemble(showAddEnsemble === 'ensemble' ? null : 'ensemble')}
                            >
                                <FiPlus />
                                Add Assembly
                            </button>
                        </div>

                        {showAddEnsemble === 'ensemble' && (
                            <div className="add-ensemble-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Assembly File *</label>
                                        <div
                                            className="ensemble-file-drop"
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const dropZone = e.currentTarget;
                                                dropZone.classList.remove('drag-over');
                                                const files = e.dataTransfer.files;
                                                if (files.length > 0) {
                                                    const file = files[0];
                                                    if (validateEnsembleFile(file)) {
                                                        handleEnsembleFileUpload(file);
                                                    }
                                                }
                                            }}
                                        >
                                            <input
                                                ref={ensembleFileInputRef}
                                                type="file"
                                                id="ensembleFile"
                                                accept=".pdf,.dwg,.step,.stp,.igs,.iges,.sldasm,.sldprt"
                                                onChange={handleEnsembleFileChange}
                                                disabled={loadingEnsemble}
                                                hidden
                                            />
                                            <label
                                                htmlFor="ensembleFile"
                                                className="ensemble-file-label"
                                            >
                                                {ensembleFileInfo ? (
                                                    <div className="ensemble-file-info">
                                                        <FiFile size={24} />
                                                        <span>{ensembleFileInfo.nombre}</span>
                                                        <small>({ensembleFileInfo.tamanio} MB)</small>
                                                        <button
                                                            type="button"
                                                            className="remove-file"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setEnsembleFile(null);
                                                                setEnsembleFileInfo(null);
                                                                setNewEnsemble({
                                                                    BloqueId: blockId || '',
                                                                    NombreEnsamble: '',
                                                                    RutaEnsamble: null
                                                                });
                                                                if (ensembleFileInputRef.current) {
                                                                    ensembleFileInputRef.current.value = '';
                                                                }
                                                            }}
                                                        >
                                                            <FiX />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <FiUpload size={32} />
                                                        <span>Drag a file here or click to select</span>
                                                        <small>Formats: .pdf, .dwg, .step, .stp, .igs, .iges, .sldasm, .sldprt</small>
                                                        <small className="file-size-limit">Max: 50MB</small>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                        {ensembleFile && (
                                            <small className="ensemble-name-preview">
                                                <FiFile size={12} />
                                                Assembly name: <strong>{newEnsemble.NombreEnsamble}</strong>
                                            </small>
                                        )}
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="button-cancel"
                                        onClick={() => {
                                            setShowAddEnsemble(null);
                                            setNewEnsemble({
                                                BloqueId: blockId || '',
                                                NombreEnsamble: '',
                                                RutaEnsamble: null
                                            });
                                            setEnsembleFile(null);
                                            setEnsembleFileInfo(null);
                                            if (ensembleFileInputRef.current) {
                                                ensembleFileInputRef.current.value = '';
                                            }
                                        }}
                                        disabled={loadingEnsemble}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="button-save"
                                        onClick={handleSubmitEnsemble}
                                        disabled={loadingEnsemble || !ensembleFile}
                                    >
                                        {loadingEnsemble ? (
                                            <>
                                                <span className="spinner"></span>
                                                SAVING...
                                            </>
                                        ) : (
                                            'Add Assembly'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {loadingEnsemble ? (
                            <div className="loading-state">Loading assemblies...</div>
                        ) : ensambles.length === 0 ? (
                            <div className="empty-state-ensambles">
                                <FiPackage size={48} />
                                <h4>No assemblies yet</h4>
                                <p>Click "Add Assembly" to upload an assembly file for this block</p>
                            </div>
                        ) : (
                            ensambles.map(e => {
                                const isOpen = openEnsambles.has(e.IdEnsamble);

                                return (
                                    <div className="ensemble-card" key={e.IdEnsamble}>
                                        <div
                                            className="ensemble-header"
                                            onClick={() => toggleEnsemble(e.IdEnsamble)}
                                        >
                                            <div>
                                                <FiPackage />
                                                <strong>{e.NombreEnsamble}</strong>
                                                <span className="ensemble-date">
                                                    {e.fecha}
                                                </span>
                                                <span className="ensemble-uploader">
                                                    <FiUser size={12} />
                                                    Uploaded by: {e.subidoPor}
                                                </span>
                                            </div>
                                            <div className="ensemble-actions">
                                                <button
                                                    className="icon-btn"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        abrirArchivo('ensamble', e.rutaArchivo || e.RutaEnsamble);
                                                    }}
                                                    title="Open assembly"
                                                >
                                                    <FiEye />
                                                </button>
                                                <button
                                                    className="icon-btn"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDownloadEnsemble(e);
                                                    }}
                                                    title="Download assembly"
                                                >
                                                    <FiDownload />
                                                </button>
                                                <button
                                                    className="icon-btn delete"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDeleteEnsemble(e.IdEnsamble, e.NombreEnsamble);
                                                    }}
                                                >
                                                    <FiTrash2 />
                                                </button>
                                                {isOpen ? <FiChevronDown /> : <FiChevronRight />}
                                            </div>
                                        </div>

                                        {isOpen && (
                                            <div className="ensemble-body">
                                                <div className="ensemble-preview">
                                                    {e.image ? (
                                                        <img
                                                            src={e.image}
                                                            alt={e.NombreEnsamble}
                                                            onError={(el) => {
                                                                el.target.onerror = null;
                                                                el.target.style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="ensemble-placeholder">
                                                            <FiPackage size={48} />
                                                            <span>{e.RutaEnsamble?.split('.').pop().toUpperCase() || 'No preview'}</span>
                                                        </div>
                                                    )}
                                                    <div className="ensemble-info">
                                                        <span>Uploaded: <strong>{e.fecha}</strong></span>
                                                        <span className="ensemble-info-uploader">
                                                            <FiUser size={12} />
                                                            Uploaded by: {e.subidoPor}
                                                        </span>
                                                        <span className="file-name">
                                                            📄 {e.RutaEnsamble || 'N/A'}
                                                        </span>
                                                        <button
                                                            className="button-icon button-red"
                                                            onClick={() => handleDownloadEnsemble(e)}
                                                        >
                                                            <FiDownload />
                                                            Download
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* ============================================= */}
                    {/* HISTORIAL DE MATERIALES DEL ENSAMBLE */}
                    {/* ============================================= */}
                    <div className="ensambles-subsection">
                        <div className="ensambles-subheader">
                            <h3>
                                <FiBox />
                                Material history
                                <span className="ensemble-count">{histMats.movimientos.length}</span>
                            </h3>
                        </div>
                        {histMats.planeado.length > 0 && (
                            <div className="hist-planeado">
                                <small className="form-hint">Planned in programs (informational, does not deduct stock)</small>
                                {histMats.planeado.map(pl => (
                                    <div key={pl.IdProgMat} className="hist-plan-row">
                                        <span className="hist-plan-op">Op. {pl.NumeroOperacion || pl.NombrePrograma || pl.ProgramaId}</span>
                                        <span><strong>{pl.Material || `#${pl.MaterialId}`}</strong> {pl.Largo ? `L:${pl.Largo}` : `×${pl.Cantidad}`}</span>
                                        {Number(pl.Cantidad) > Number(pl.Existencia ?? 0) && (
                                            <span className="inv-bajo-stock"><FiAlertTriangle /> No stock</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {histMats.movimientos.length === 0 && histMats.planeado.length === 0 ? (
                            <small className="form-hint">No material movements for this block.</small>
                        ) : histMats.movimientos.length > 0 && (
                            <div className="hist-movs">
                                {histMats.movimientos.map(mv => (
                                    <div key={mv.IdMovimiento} className="hist-mov-row">
                                        <span className={`mov-pill mov-${mv.TipoMov}`}>{mv.TipoMov}</span>
                                        <span className="hist-mov-cant">×{mv.Cantidad}</span>
                                        <span className="hist-mov-fecha">{mv.FechaFormateada || mv.Fecha}</span>
                                        <span className="hist-mov-user">{mv.UsuarioNombre || (mv.UsuarioId ? `#${mv.UsuarioId}` : '—')}</span>
                                        <span className="hist-mov-com">{mv.Comentario || '—'}</span>
                                        <button
                                            type="button"
                                            className="icon-btn delete hist-mov-del"
                                            title="Delete movement (reverts stock)"
                                            onClick={() => handleDeleteHistMov(mv.IdMovimiento)}
                                        >
                                            <FiTrash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ============================================= */}
                    {/* DRAWINGS - Lista de dibujos */}
                    {/* ============================================= */}
                    {loading ? (
                        <div className="loading-state">Loading drawings...</div>
                    ) : drawings.length === 0 && ensambles.length === 0 ? (
                        <div className="empty-state-drawings">
                            <FiImage size={48} />
                            <h3>No drawings or assemblies yet</h3>
                            <p>Click "Add Drawing" or "Add Assembly" to upload files for this block</p>
                        </div>
                    ) : (
                        drawings.map(d => {
                            const isOpen = openDrawings.has(d.IdDibujo);
                            const drawingId = d.IdDibujo;
                            return (
                                <div className="drawing-card" key={d.IdDibujo}>
                                    <div
                                        className="drawing-header"
                                        onClick={() => toggleDrawing(d.IdDibujo)}
                                    >
                                        <div>
                                            <FiFileText />
                                            <strong>{d.nombre}</strong>
                                            <span className="drawing-type">{d.tipoDibujoNombre}</span>
                                            <span className="program-count">
                                                {d.programas?.length || 0} programs
                                            </span>
                                            <span className="drawing-uploader">
                                                <FiUser size={12} />
                                                Uploaded by: {d.subidoPor}
                                            </span>
                                        </div>
                                        <div className="drawing-actions">
                                            <button
                                                className="icon-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    abrirArchivo('dibujo', d.rutaArchivo || d.RutaDibujo);
                                                }}
                                                title="Open drawing"
                                            >
                                                <FiEye />
                                            </button>
                                            <button
                                                className="icon-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEditModal(d);
                                                }}
                                            >
                                                <FiEdit2 />
                                            </button>
                                            <button
                                                className="icon-btn delete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteDibujo(d.IdDibujo, d.NombreDibujo);
                                                }}
                                            >
                                                <FiTrash2 />
                                            </button>
                                            {isOpen ? <FiChevronDown /> : <FiChevronRight />}
                                        </div>
                                    </div>

                                    {isOpen && (
                                        <div className="drawing-body">
                                            <div className="drawing-preview">
                                                {renderDrawingImage(d)}
                                                <div className="preview-info">
                                                    <span>Uploaded: <strong>{d.fecha}</strong></span>
                                                    <span className="preview-uploader">
                                                        <FiUser size={12} />
                                                        Uploaded by: {d.subidoPor}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="programs-header">
                                                <h4>Programs</h4>
                                                <button
                                                    className="button-add-small"
                                                    onClick={() => setShowAddProgram(
                                                        showAddProgram === drawingId ? null : drawingId
                                                    )}
                                                >
                                                    <FiPlus />
                                                    Add Program
                                                </button>
                                            </div>

                                            {showAddProgram === drawingId && (
                                                <div className="add-program-form">
                                                    <div className="form-group">
                                                        <label>Program File *</label>
                                                        <div
                                                            className="program-file-drop"
                                                            onDragOver={handleDragOver}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={handleDrop}
                                                        >
                                                            <input
                                                                ref={fileInputRef}
                                                                type="file"
                                                                id={`programFile-${drawingId}`}
                                                                accept=".nc,.cnc,.txt,.prt,.sldprt,.sldasm,.pdf,.dwg"
                                                                onChange={handleProgramFileChange}
                                                                disabled={loadingProgram}
                                                                hidden
                                                            />
                                                            <label
                                                                htmlFor={`programFile-${drawingId}`}
                                                                className="program-file-label"
                                                            >
                                                                {programFileInfo ? (
                                                                    <div className="program-file-info">
                                                                        <FiFile size={24} />
                                                                        <span>{programFileInfo.nombre}</span>
                                                                        <small>({programFileInfo.tamanio} MB)</small>
                                                                        <button
                                                                            type="button"
                                                                            className="remove-file"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                setProgramFile(null);
                                                                                setProgramFileInfo(null);
                                                                                setNewProgram(prev => ({
                                                                                    ...prev,
                                                                                    RutaPrograma: null,
                                                                                    NumeroOperacion: '',
                                                                                    NombreOriginal: ''
                                                                                }));
                                                                                if (fileInputRef.current) {
                                                                                    fileInputRef.current.value = '';
                                                                                }
                                                                            }}
                                                                        >
                                                                            <FiX />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <FiUpload size={32} />
                                                                        <span>Drag a file here or click to select</span>
                                                                        <small>Formats: .nc, .cnc, .txt, .prt, .sldprt, .sldasm, .pdf, .dwg, .mcam</small>
                                                                        <small className="file-size-limit">Max: 50MB</small>
                                                                    </>
                                                                )}
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="form-actions">
                                                        <button
                                                            type="button"
                                                            className="button-cancel"
                                                            onClick={() => {
                                                                setShowAddProgram(null);
                                                                setNewProgram({
                                                                    DibujoId: '',
                                                                    NumeroOperacion: '',
                                                                    RutaPrograma: null,
                                                                    NombreOriginal: ''
                                                                });
                                                                setProgramFile(null);
                                                                setProgramFileInfo(null);
                                                                if (fileInputRef.current) {
                                                                    fileInputRef.current.value = '';
                                                                }
                                                            }}
                                                            disabled={loadingProgram}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button-save"
                                                            onClick={() => handleSubmitProgram(drawingId)}
                                                            disabled={loadingProgram}
                                                        >
                                                            {loadingProgram ? (
                                                                <>
                                                                    <span className="spinner"></span>
                                                                    SAVING...
                                                                </>
                                                            ) : (
                                                                'Add Program'
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="programs-list">
                                                {d.programas && d.programas.length > 0 ? (
                                                    d.programas.map(p => (
                                                        <div className="program-card" key={p.IdPrograma || p.id || `program-${Math.random()}`}>
                                                            <div>
                                                                <span className="program-name">
                                                                    <FiFile size={14} />
                                                                    {p.NombrePrograma || p.NumeroOperacion || 'Unnamed'}
                                                                </span>
                                                                <small>{formatDateOnly(p.FechaSubida)}</small>
                                                                <span className="program-uploader">
                                                                    <FiUser size={10} />
                                                                    Uploaded by: {p.SubidoPorNombre || 'Unknown'}
                                                                </span>
                                                                <div className="prog-mats">
                                                                    {(progMats[p.IdPrograma || p.id] || []).map(m => {
                                                                        const esBarraChip = m.Largo !== null && m.Largo !== undefined && m.Largo !== '';
                                                                        const corteTxt = !esBarraChip && (m.Ancho || m.Alto)
                                                                            ? ` · cut ${(m.Ancho ? `A:${m.Ancho} ` : '')}${(m.Alto ? `H:${m.Alto}` : '')}`.trim()
                                                                            : '';
                                                                        return (
                                                                        <span
                                                                            key={m.IdProgMat}
                                                                            className="prog-mat-chip"
                                                                            title={`${m.Material || 'Material #' + m.MaterialId} ${esBarraChip ? `· length ${m.Largo}` : `× ${m.Cantidad}`}${corteTxt} (in stock ${m.Existencia ?? '?'})`}
                                                                        >
                                                                            <FiBox size={11} /> {m.Material || `#${m.MaterialId}`} {esBarraChip ? `L:${m.Largo}` : `×${m.Cantidad}`}{corteTxt ? ` (${corteTxt})` : ''}
                                                                            {Number(m.Cantidad) > Number(m.Existencia ?? 0) && (
                                                                                <FiAlertTriangle size={11} className="prog-mat-warn" title="Insufficient stock (warning only)" />
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                className="prog-mat-x"
                                                                                title="Remove assignment (no stock returned)"
                                                                                onClick={() => handleMatDelete(m.IdProgMat)}
                                                                            >
                                                                                <FiX size={11} />
                                                                            </button>
                                                                        </span>
                                                                        );
                                                                    })}
                                                                    <button
                                                                        type="button"
                                                                        className="button-add-small prog-mat-add"
                                                                        onClick={() => openMatModal(p)}
                                                                        title="Assign material (informational, no deduction)"
                                                                    >
                                                                        <FiPlus /> Material
                                                                    </button>
                                                                    {(() => {
                                                                        const pid = p.IdPrograma || p.id;
                                                                        const conf = progMatsOk[pid] === true;
                                                                        const porte = programaListoParaMarcar(pid);
                                                                        return (
                                                                            <button
                                                                                type="button"
                                                                                className={`prog-mats-btn ${conf ? 'on' : ''}`}
                                                                                disabled={!conf && !porte.ok}
                                                                                onClick={() => toggleProgramaMats(pid)}
                                                                                title={conf ? 'Declared: has all materials (click to remove)' : (porte.ok ? 'Declare it has all required materials' : porte.motivo)}
                                                                            >
                                                                                <FiCheckCircle size={12} />
                                                                                {conf ? 'Mats ✓' : 'Mats?'}
                                                                            </button>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                            <div className="program-actions">
                                                                <button
                                                                    className="icon-btn"
                                                                    onClick={() => abrirArchivo('programa', p.RutaPrograma || p.rutaArchivo)}
                                                                    title="Open program"
                                                                >
                                                                    <FiEye />
                                                                </button>
                                                                <button
                                                                    className="icon-btn"
                                                                    onClick={() => handleDownloadProgram(p)}
                                                                    title="Download program"
                                                                >
                                                                    <FiDownload />
                                                                </button>
                                                                <button
                                                                    className="icon-btn delete"
                                                                    onClick={() => handleDeleteProgram(p.IdPrograma || p.id, p.NombrePrograma || p.NumeroOperacion || p.programa)}
                                                                    title="Delete program"
                                                                >
                                                                    <FiTrash2 />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="empty-state">
                                                        <p>No programs available for this drawing</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ============================================= */}
            {/* MODALES */}
            {/* ============================================= */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedDrawing(null);
                }}
                title="Add New Drawing"
            >
                <DrawingForm
                    isEditing={false}
                    bloqueId={blockId}
                    onSuccess={handleAddDrawing}
                    onCancel={() => {
                        setIsModalOpen(false);
                    }}
                />
            </Modal>

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedDrawing(null);
                }}
                title="Edit Drawing"
            >
                <DrawingForm
                    dibujo={selectedDrawing}
                    isEditing={true}
                    bloqueId={blockId}
                    onSuccess={() => {
                        fetchDrawings();
                        setIsEditModalOpen(false);
                        setSelectedDrawing(null);
                    }}
                    onCancel={() => {
                        setIsEditModalOpen(false);
                        setSelectedDrawing(null);
                    }}
                />
            </Modal>

            {/* MODAL: asignar materiales a programa (checklist, informativo, no descuenta) */}
            <Modal
                isOpen={isMatModalOpen}
                onClose={() => setIsMatModalOpen(false)}
                title={`Materials for program: ${matTarget?.NombrePrograma || matTarget?.NumeroOperacion || ''}`}
                className="inv-wide"
            >
                <form className="form-container" onSubmit={handleMatSubmit}>
                    <small className="form-hint">Check ✓ the materials. For bars only enter the length to use; for the rest, the quantity. It does not move inventory.</small>
                    <div className="inv-tipos-list mat-check-list">
                        {materialesInv.length === 0 && (
                            <div className="inv-empty">
                                <FiBox size={28} />
                                <p>No materials in inventory</p>
                            </div>
                        )}
                        {materialesInv.map(m => {
                            const sel = matSel[m.IdMateriales] || {};
                            const marcado = !!sel.check;
                            return (
                                <div key={m.IdMateriales} className={`mat-check-row ${marcado ? 'on' : ''}`}>
                                    <label className="mat-check-top">
                                        <input
                                            type="checkbox"
                                            checked={marcado}
                                            onChange={() => toggleMatCheck(m.IdMateriales)}
                                        />
                                        <span className="mat-check-name">{m.Material}</span>
                                        <span className="mat-check-stock">in stock {m.Cant ?? 0}</span>
                                    </label>
                                    {marcado && (
                                        <div className="mat-check-fields">
                                            {m.EsBarra ? (
                                            <div className="form-group">
                                                <label className="form-label">Length to use *</label>
                                                <input
                                                    type="number" min="0.01" step="0.01"
                                                    className="form-input"
                                                    value={sel.Largo || ''}
                                                    onChange={(e) => updateMatSel(m.IdMateriales, 'Largo', e.target.value)}
                                                    required
                                                    placeholder="length only"
                                                />
                                            </div>
                                            ) : (
                                            <div className="form-group">
                                                <label className="form-label">Qty. *</label>
                                                <input
                                                    type="number" min="0.01" step="0.01"
                                                    className="form-input"
                                                    value={sel.Cantidad || ''}
                                                    onChange={(e) => updateMatSel(m.IdMateriales, 'Cantidad', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsMatModalOpen(false)}>
                            Close
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Assign selected
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL: pin y funda por combos con cantidades */}
            <Modal
                isOpen={isPinModalOpen}
                onClose={() => setIsPinModalOpen(false)}
                title={`Pin and sleeve · ${blockInfo?.NoParte || ''} (${Number(blockInfo?.CantidadPines) || 0} pins)`}
                className="inv-wide"
            >
                {(() => {
                    const total = Number(blockInfo?.CantidadPines) || 0;
                    const asignados = pinCombos.reduce((a, c) => a + (Number(c.Cuantos) || 0), 0);
                    return (
                        <>
                            <small className="form-hint">
                                Build pin + sleeve combos with how many pins each one covers.
                                They are assigned in order (pin 1, 2, 3…). Total: {asignados}/{total} pins.
                            </small>
                            <div className="pin-picker-box">
                            <div className="pin-picker-title">
                                <FiEdit2 size={13} />
                                Build pin + sleeve combos
                            </div>
                            <div className="pin-combo-form">
                                <div className="form-group">
                                    <label className="form-label">Pin *</label>
                                    <select
                                        className="form-input"
                                        value={pinComboForm.PinMaterialId}
                                        onChange={(e) => setPinComboForm({ ...pinComboForm, PinMaterialId: e.target.value })}
                                    >
                                        <option value="">Select pin...</option>
                                        {pinesInv.map(m => (
                                            <option key={m.IdMateriales} value={m.IdMateriales}>
                                                {m.Material} (in stock {m.Cant ?? 0})
                                            </option>
                                        ))}
                                    </select>
                                    {pinesInv.length === 0 && (
                                        <small className="form-hint">No pin-type materials. Register them in Inventory.</small>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Sleeve</label>
                                    <select
                                        className="form-input"
                                        value={pinComboForm.FundaMaterialId}
                                        onChange={(e) => setPinComboForm({ ...pinComboForm, FundaMaterialId: e.target.value })}
                                    >
                                        <option value="">Select sleeve...</option>
                                        {fundasInv.map(m => (
                                            <option key={m.IdMateriales} value={m.IdMateriales}>
                                                {m.Material} (in stock {m.Cant ?? 0})
                                            </option>
                                        ))}
                                    </select>
                                    {fundasInv.length === 0 && (
                                        <small className="form-hint">No sleeve-type materials. Register them in Inventory.</small>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">How many *</label>
                                    <input
                                        type="number" min="1" max={total}
                                        className="form-input"
                                        value={pinComboForm.Cuantos}
                                        onChange={(e) => setPinComboForm({ ...pinComboForm, Cuantos: e.target.value })}
                                    />
                                </div>
                                <button type="button" className="btn btn-primary" onClick={handlePinComboAdd}>
                                    <FiPlus /> Add
                                </button>
                            </div>
                            <div className="inv-tipos-list">
                                {pinCombos.length === 0 && (
                                    <div className="inv-empty">
                                        <FiBox size={28} />
                                        <p>No combos. Add pin + sleeve + how many above.</p>
                                    </div>
                                )}
                                {pinCombos.map((c, idx) => (
                                    <div key={idx} className="inv-tipo-card">
                                        <div className="inv-tipo-row">
                                            <span className="inv-tipo-nombre">
                                                {nombreMat(c.PinMaterialId) || 'No pin'} + {nombreMat(c.FundaMaterialId) || 'No sleeve'}
                                            </span>
                                            <span className="inv-tipo-count">×{c.Cuantos} pins</span>
                                            <button
                                                className="icon-button inv-del"
                                                title="Remove combo"
                                                onClick={() => handlePinComboRemove(idx)}
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsPinModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-primary" onClick={handlePinSaveAll}>
                                    Save all
                                </button>
                            </div>
                        </>
                    );
                })()}
            </Modal>
        </>
    );
};