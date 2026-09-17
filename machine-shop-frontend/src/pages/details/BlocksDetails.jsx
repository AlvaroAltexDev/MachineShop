import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import { Modal } from '../../components/Modal';
import { DrawingForm } from "../forms/DrawingForm";
import api from '../../api/api';
import socket from "../../api/socket";
import { AuthContext } from '../../context/AuthProvider';
import { FiArrowLeft, FiChevronDown, FiChevronRight, FiFileText, FiCpu, FiDownload, FiImage, FiPlus, FiTrash2, FiEdit2, FiFolder, FiCode, FiBox, FiUpload, FiX, FiFile, FiAlertCircle, FiCalendar, FiUser, FiPackage, FiCheckCircle, FiClock } from "react-icons/fi";
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
                NombreDibujo: d.NombreDibujo || 'Sin nombre',
                nombre: d.NombreDibujo || 'Sin nombre',
                fecha: formatDateOnly(d.FechaSubida),
                image: d.RutaDibujo ? `${DRAWING_BASE_URL}${d.RutaDibujo}` : null,
                rutaArchivo: d.RutaDibujo,
                tipoDibujoNombre: d.TipoDibujoNombre || 'Sin tipo',
                subidoPor: d.SubidoPorNombre || 'Desconocido',
                programas: d.programas || []
            }));

            console.log('✅ Dibujos cargados:', drawingsData);
            setDrawings(drawingsData);

            // Solo registra si HAY dibujos (para habilitar/deshabilitar botones).
            // NO toca drawingsComplete: ese flag solo lo pone el botón + backend.
            setHasDrawings(drawingsData.length > 0);

        } catch (error) {
            console.error('❌ Error al cargar dibujos:', error);
            showToast.error("Error al cargar los dibujos", {
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
                NombreEnsamble: e.NombreEnsamble || 'Sin nombre',
                RutaEnsamble: e.RutaEnsamble,
                FechaSubida: e.FechaSubida,
                fecha: formatDateOnly(e.FechaSubida),
                rutaArchivo: e.RutaEnsamble,
                image: e.RutaEnsamble ? `${ENSEMBLE_BASE_URL}${e.RutaEnsamble}` : null,
                subidoPor: e.SubidoPorNombre || 'Desconocido'
            }));

            console.log('✅ Ensambles cargados:', ensamblesData);
            setEnsambles(ensamblesData);
        } catch (error) {
            console.error('❌ Error al cargar ensambles:', error);
            showToast.error("Error al cargar los ensambles", {
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
            showToast.error("Error al cargar la información del bloque", {
                duration: 3000,
                position: "top-right",
            });
            setBlockInfo(null);
        } finally {
            setLoadingBlock(false);
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
    // Cancelar NO cambia nada.
    const toggleDrawingsComplete = async () => {
        // No permitir si no hay dibujos
        if (!hasDrawings) {
            showToast.error("No hay dibujos subidos para este bloque", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        setIsUpdatingStatus(true);
        try {
            const result = await Swal.fire({
                title: drawingsComplete ? '¿Marcar dibujos como INCOMPLETOS?' : '¿Marcar dibujos como COMPLETOS?',
                text: drawingsComplete
                    ? 'El botón pasará a verde para poder marcarlos como completos de nuevo.'
                    : 'El botón pasará a naranja para poder marcarlos como incompletos.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#D71928',
                cancelButtonColor: '#64748b',
                confirmButtonText: drawingsComplete ? 'Sí, marcar incompletos' : 'Sí, marcar completos',
                cancelButtonText: 'Cancelar',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });

            // Cancelar NO cambia nada
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
                    ? '✅ Dibujos marcados como COMPLETOS'
                    : '🔓 Dibujos marcados como INCOMPLETOS',
                {
                    duration: 3000,
                    position: "top-right",
                }
            );
        } catch (error) {
            console.error('Error al actualizar estado de dibujos:', error);
            showToast.error(error.response?.data?.error || 'Error al actualizar el estado', {
                duration: 3000,
                position: "top-right",
            });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    // ✅ Marcar programas completos/incompletos (solo admin, guarda en backend)
    // Verde = "Marcar COMPLETOS" (cuando programsComplete=false) / Naranja = "Marcar INCOMPLETOS" (cuando true)
    // Cancelar NO cambia nada. Si no hay programas, el botón está deshabilitado y ni siquiera entra aquí.
    const toggleProgramsComplete = async () => {
        if (!hasPrograms) {
            showToast.error("No hay programas subidos para este bloque", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        setIsUpdatingStatus(true);
        try {
            const result = await Swal.fire({
                title: programsComplete ? '¿Marcar programas como INCOMPLETOS?' : '¿Marcar programas como COMPLETOS?',
                text: programsComplete
                    ? 'El botón pasará a verde para poder marcarlos como completos de nuevo.'
                    : 'El botón pasará a naranja para poder marcarlos como incompletos.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#D71928',
                cancelButtonColor: '#64748b',
                confirmButtonText: programsComplete ? 'Sí, marcar incompletos' : 'Sí, marcar completos',
                cancelButtonText: 'Cancelar',
                background: '#3F3F42',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });

            // Cancelar NO cambia nada
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
                    ? '✅ Programas marcados como COMPLETOS'
                    : '🔓 Programas marcados como INCOMPLETOS',
                {
                    duration: 3000,
                    position: "top-right",
                }
            );
        } catch (error) {
            console.error('Error al actualizar estado de programas:', error);
            showToast.error(error.response?.data?.error || 'Error al actualizar el estado', {
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
            showToast.error("No se encontró el bloque seleccionado", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        fetchBlockInfo();
        fetchDrawings();
        fetchEnsambles();
        fetchBlockStatus();

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
        });

        return () => {
            socket.off("dibujosActualizados");
            socket.off("bloquesActualizados");
            socket.off("ensamblesActualizados");
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
        showToast.success("Dibujo agregado correctamente", {
            duration: 3000,
            position: "top-right",
        });
    };

    const handleDeleteDibujo = async (IdDibujo, NombreDibujo) => {
        try {
            const result = await Swal.fire({
                title: '¿Estás seguro?',
                html: `¿Deseas eliminar al dibujo <strong>${NombreDibujo || ''}</strong>?<br>Esta acción no se puede deshacer.`,
                icon: 'warning',
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
            const errorMessage = error.response?.data?.error || 'Error al eliminar dibujo';
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
            showToast.error("El archivo excede el límite de 50MB", {
                duration: 4000,
                position: "top-right",
            });
            return false;
        }

        const allowedExtensions = ['.nc', '.cnc', '.txt', '.prt', '.sldprt', '.sldasm', '.pdf', '.dwg', '.mcam'];
        const fileName = file.name;
        const ext = '.' + fileName.split('.').pop().toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            showToast.error(`Formato no permitido. Permitidos: ${allowedExtensions.join(', ')}`, {
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
            showToast.error("Por favor seleccione un archivo", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        if (!newProgram.NumeroOperacion.trim()) {
            showToast.error("Por favor ingrese un número de operación", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        if (!drawingId || !user?.noEmp) {
            showToast.error("No se pudo identificar el dibujo o el usuario", {
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

            showToast.success("Programa agregado correctamente", {
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
            showToast.error(error.response?.data?.error || "Error al agregar el programa", {
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
                title: '¿Estás seguro?',
                html: `¿Deseas eliminar el programa <strong>${programName || ''}</strong>?<br>Esta acción no se puede deshacer.`,
                icon: 'warning',
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
            showToast.error(error.response?.data?.error || 'Error al eliminar programa', {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    const handleDownloadProgram = async (program) => {
        try {
            const programId = program.IdPrograma || program.id;

            if (!programId) {
                showToast.error("ID de programa no válido", {
                    duration: 3000,
                    position: "top-right",
                });
                return;
            }

            const response = await api.get(`/programasDownload/${programId}`, {
                responseType: 'blob',
            });

            let nombreArchivo = 'programa';
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

            if (nombreArchivo === 'programa' || !nombreArchivo) {
                const nombreBase = program.NombrePrograma || program.NumeroOperacion || program.operacion || 'programa';
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

            showToast.success("Programa descargado correctamente", {
                duration: 3000,
                position: "top-right",
            });

        } catch (error) {
            console.error('❌ Error al descargar programa:', error);
            showToast.error("Error al descargar el programa", {
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
            showToast.error("El archivo excede el límite de 50MB", {
                duration: 4000,
                position: "top-right",
            });
            return false;
        }

        const allowedExtensions = ['.pdf', '.dwg', '.step', '.stp', '.igs', '.iges', '.sldasm', '.sldprt'];
        const fileName = file.name;
        const ext = '.' + fileName.split('.').pop().toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            showToast.error(`Formato no permitido. Permitidos: ${allowedExtensions.join(', ')}`, {
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
            showToast.error("Por favor seleccione un archivo", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        if (!newEnsemble.NombreEnsamble.trim()) {
            showToast.error("No se pudo obtener el nombre del archivo", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        if (!blockId || !user?.noEmp) {
            showToast.error("No se pudo identificar el bloque o el usuario", {
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

            showToast.success("Ensemble agregado correctamente", {
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
            showToast.error(error.response?.data?.error || "Error al agregar el ensemble", {
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
                title: '¿Estás seguro?',
                html: `¿Deseas eliminar el ensemble <strong>${NombreEnsamble || ''}</strong>?<br>Esta acción no se puede deshacer.`,
                icon: 'warning',
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
            showToast.error(error.response?.data?.error || 'Error al eliminar ensemble', {
                duration: 4000,
                position: "top-right",
            });
        }
    };

    const handleDownloadEnsemble = async (ensemble) => {
        try {
            const ensembleId = ensemble.IdEnsamble;

            if (!ensembleId) {
                showToast.error("ID de ensemble no válido", {
                    duration: 3000,
                    position: "top-right",
                });
                return;
            }

            const response = await api.get(`/ensamblesDownload/${ensembleId}`, {
                responseType: 'blob',
            });

            let nombreArchivo = 'ensemble';
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

            if (nombreArchivo === 'ensemble' || !nombreArchivo) {
                const nombreBase = ensemble.NombreEnsamble || 'ensemble';
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

            showToast.success("Ensemble descargado correctamente", {
                duration: 3000,
                position: "top-right",
            });

        } catch (error) {
            console.error('❌ Error al descargar ensemble:', error);
            showToast.error("Error al descargar el ensemble", {
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
                    <div className="loading-state">Cargando información del bloque...</div>
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
                                    <h1>{blockInfo?.NoParte || 'Sin número de parte'}</h1>
                                    <span className="subtitle">{blockInfo?.TipoConector || 'Sin tipo de conector'}</span>
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
                                <span>{blockInfo?.CantidadPines || 0} Pins · {blockInfo?.TipoTerminal || 'Sin terminal'}</span>
                                {blockInfo?.CantPinPresencia >= 1 ? (
                                    <span className="has-lock">
                                        🔒 Lock ({blockInfo.CantPinPresencia} pins)
                                    </span>
                                ) : (
                                    <span className="no-lock">🔓 No Lock</span>
                                )}
                                {blockInfo?.ConectorFisico === 1 ? (
                                    <span className="conector-fisico-tag has-conector">
                                        ✅ Conector Físico
                                    </span>
                                ) : (
                                    <span className="conector-fisico-tag no-conector">
                                        ❌ Sin Conector Físico
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
                            Drawings & Ensambles
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
                                title={!hasDrawings ? 'Sube al menos un dibujo para poder marcar' : (drawingsComplete ? 'Marcar dibujos como INCOMPLETOS' : 'Marcar dibujos como COMPLETOS')}
                            >
                                {drawingsComplete ? (
                                    <>
                                        <FiClock /> Marcar INCOMPLETOS
                                    </>
                                ) : (
                                    <>
                                        <FiCheckCircle /> Marcar COMPLETOS
                                    </>
                                )}
                            </button>
                            {/* ✅ Marcar programas: VERDE = "Marcar COMPLETOS" / NARANJA = "Marcar INCOMPLETOS" */}
                            <button
                                className={programsComplete ? 'status-toggle-btn-orange' : 'status-toggle-btn-green'}
                                onClick={toggleProgramsComplete}
                                disabled={!hasPrograms || isUpdatingStatus}
                                title={!hasPrograms ? 'Sube al menos un programa para poder marcar' : (programsComplete ? 'Marcar programas como INCOMPLETOS' : 'Marcar programas como COMPLETOS')}
                            >
                                {programsComplete ? (
                                    <>
                                        <FiClock /> Marcar INCOMPLETOS
                                    </>
                                ) : (
                                    <>
                                        <FiCheckCircle /> Marcar COMPLETOS
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
                                Ensambles
                                <span className="ensemble-count">{ensambles.length}</span>
                            </h3>
                            <button
                                className="button-add-small"
                                onClick={() => setShowAddEnsemble(showAddEnsemble === 'ensemble' ? null : 'ensemble')}
                            >
                                <FiPlus />
                                Add Ensemble
                            </button>
                        </div>

                        {showAddEnsemble === 'ensemble' && (
                            <div className="add-ensemble-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Archivo del Ensemble *</label>
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
                                                        <span>Arrastra un archivo aquí o haz clic para seleccionar</span>
                                                        <small>Formatos: .pdf, .dwg, .step, .stp, .igs, .iges, .sldasm, .sldprt</small>
                                                        <small className="file-size-limit">Máx: 50MB</small>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                        {ensembleFile && (
                                            <small className="ensemble-name-preview">
                                                <FiFile size={12} />
                                                Nombre del ensemble: <strong>{newEnsemble.NombreEnsamble}</strong>
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
                                        Cancelar
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
                                                GUARDANDO...
                                            </>
                                        ) : (
                                            'Agregar Ensemble'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {loadingEnsemble ? (
                            <div className="loading-state">Loading ensambles...</div>
                        ) : ensambles.length === 0 ? (
                            <div className="empty-state-ensambles">
                                <FiPackage size={48} />
                                <h4>No ensambles yet</h4>
                                <p>Click "Add Ensemble" to upload an ensemble file for this block</p>
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
                                                    Subido por: {e.subidoPor}
                                                </span>
                                            </div>
                                            <div className="ensemble-actions">
                                                <button
                                                    className="icon-btn"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDownloadEnsemble(e);
                                                    }}
                                                    title="Descargar ensemble"
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
                                                            Subido por: {e.subidoPor}
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
                    {/* DRAWINGS - Lista de dibujos */}
                    {/* ============================================= */}
                    {loading ? (
                        <div className="loading-state">Loading drawings...</div>
                    ) : drawings.length === 0 && ensambles.length === 0 ? (
                        <div className="empty-state-drawings">
                            <FiImage size={48} />
                            <h3>No drawings or ensambles yet</h3>
                            <p>Click "Add Drawing" or "Add Ensemble" to upload files for this block</p>
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
                                                Subido por: {d.subidoPor}
                                            </span>
                                        </div>
                                        <div className="drawing-actions">
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
                                                        Subido por: {d.subidoPor}
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
                                                        <label>Archivo del Programa *</label>
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
                                                                        <span>Arrastra un archivo aquí o haz clic para seleccionar</span>
                                                                        <small>Formatos: .nc, .cnc, .txt, .prt, .sldprt, .sldasm, .pdf, .dwg, .mcam</small>
                                                                        <small className="file-size-limit">Máx: 50MB</small>
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
                                                            Cancelar
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
                                                                    GUARDANDO...
                                                                </>
                                                            ) : (
                                                                'Agregar Programa'
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
                                                                    {p.NombrePrograma || p.NumeroOperacion || 'Sin nombre'}
                                                                </span>
                                                                <small>{formatDateOnly(p.FechaSubida)}</small>
                                                                <span className="program-uploader">
                                                                    <FiUser size={10} />
                                                                    Subido por: {p.SubidoPorNombre || 'Desconocido'}
                                                                </span>
                                                            </div>
                                                            <div className="program-actions">
                                                                <button
                                                                    className="icon-btn"
                                                                    onClick={() => handleDownloadProgram(p)}
                                                                    title="Descargar programa"
                                                                >
                                                                    <FiDownload />
                                                                </button>
                                                                <button
                                                                    className="icon-btn delete"
                                                                    onClick={() => handleDeleteProgram(p.IdPrograma || p.id, p.NombrePrograma || p.NumeroOperacion || p.programa)}
                                                                    title="Eliminar programa"
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
        </>
    );
};