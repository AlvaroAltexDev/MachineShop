import React, { useEffect, useState, useContext } from 'react';
import api from '../../api/api';
import { AuthContext } from '../../context/AuthProvider';
import { FiUploadCloud, FiX, FiBox, FiShield, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import { showToast } from 'nextjs-toast-notify';

export const BlocksForm = ({ block, isEditing = false, onSuccess, onCancel }) => {
    const { user } = useContext(AuthContext);
    const [conector, setConector] = useState([]);
    const [terminal, setTerminal] = useState([]);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const isAdmin = Number(user?.rolId) === 1;

    const [formData, setFormData] = useState({
        NoParte: '',
        Imagen: '',
        CantidadPines: '',
        CantPinPresencia: '',
        TipoConectorId: '',
        TipoTerminalId: '',
        ConectorFisico: 0, // ← 0 = No, 1 = Sí
        FechaAlta: new Date().toISOString().slice(0, 16),
        Creador: user?.noEmp || ''
    });

    const IMAGE_BASE_URL = 'http://localhost:3002/uploads/bloques/';

    useEffect(() => {
        if (isEditing && block) {
            console.log("🔍 Datos del bloque:", block);
            console.log("🔍 ConectorFisico:", block.ConectorFisico);
            console.log("🔍 Tipo:", typeof block.ConectorFisico);

            setFormData({
                NoParte: block.NoParte || '',
                Imagen: block.Imagen || '',
                CantidadPines: block.CantidadPines || '',
                CantPinPresencia: block.CantPinPresencia || '',
                TipoConectorId: String(block.TipoConectorId || ''),
                TipoTerminalId: String(block.TipoTerminalId || ''),
                ConectorFisico: block.ConectorFisico !== undefined ? Number(block.ConectorFisico) : 0,
                FechaAlta: block.FechaAlta
                    ? new Date(block.FechaAlta).toISOString().slice(0, 16)
                    : new Date().toISOString().slice(0, 16),
                Creador: block.Creador || user?.noEmp || ''
            });

            if (block.Imagen) {
                if (typeof block.Imagen === 'string' && block.Imagen.trim() !== '') {
                    if (block.Imagen.startsWith('http://') || block.Imagen.startsWith('https://')) {
                        setPreview(block.Imagen);
                    } else {
                        setPreview(`${IMAGE_BASE_URL}${block.Imagen}`);
                    }
                }
            }
        }
    }, [isEditing, block, user]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [conectorRes, terminalRes] = await Promise.all([
                    api.get("/tipoConectorSelectAll"),
                    api.get("/tipoTerminalSelectAll")
                ]);
                setConector(conectorRes.data);
                setTerminal(terminalRes.data);
            } catch (error) {
                console.error('Error al obtener datos de tipos:', error);
            }
        };

        fetchData();
    }, []);

    const handleImage = (file) => {
        if (!file) return;

        setFormData(prev => ({
            ...prev,
            Imagen: file
        }));
        setPreview(URL.createObjectURL(file));
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            handleImage(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    // ✅ Manejar el cambio de ConectorFisico
    const handleConectorFisicoChange = (e) => {
        const value = e.target.checked ? 1 : 0;
        console.log('🔄 ConectorFisico cambiado a:', value);
        setFormData(prev => ({
            ...prev,
            ConectorFisico: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const dataToSend = new FormData();
            dataToSend.append('NoParte', formData.NoParte);
            dataToSend.append('CantidadPines', formData.CantidadPines);
            dataToSend.append('CantPinPresencia', formData.CantPinPresencia);
            dataToSend.append('TipoConectorId', formData.TipoConectorId);
            dataToSend.append('TipoTerminalId', formData.TipoTerminalId);

            // ✅ Enviar ConectorFisico correctamente
            const conectorFisicoValue = Number(formData.ConectorFisico);
            dataToSend.append('ConectorFisico', conectorFisicoValue);
            console.log('📤 Enviando ConectorFisico:', conectorFisicoValue);

            let fechaHora = formData.FechaAlta;
            if (fechaHora && !fechaHora.includes(' ')) {
                fechaHora = fechaHora.replace('T', ' ');
            }
            dataToSend.append('FechaAlta', fechaHora);
            dataToSend.append('Creador', formData.Creador);

            if (formData.Imagen instanceof File) {
                dataToSend.append('Imagen', formData.Imagen);
            } else if (typeof formData.Imagen === 'string' && formData.Imagen.trim() !== '') {
                if (formData.Imagen.startsWith('http://') || formData.Imagen.startsWith('https://')) {
                    const filename = formData.Imagen.split('/').pop();
                    dataToSend.append('ImagenUrl', filename);
                } else {
                    dataToSend.append('ImagenUrl', formData.Imagen);
                }
            }

            if (isEditing && block) {
                dataToSend.append('NoParteOriginal', block.NoParte);
                await api.put(`/bloquesUpdate`, dataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast.success("Block actualizado correctamente", {
                    duration: 3000,
                    position: "top-right",
                });
            } else {
                await api.post(`/bloquesInsert`, dataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast.success("Block agregado correctamente", {
                    duration: 3000,
                    position: "top-right",
                });
            }

            if (!isEditing) {
                setFormData({
                    NoParte: '',
                    Imagen: '',
                    CantidadPines: '',
                    CantPinPresencia: '',
                    TipoConectorId: '',
                    TipoTerminalId: '',
                    ConectorFisico: 0,
                    FechaAlta: new Date().toISOString().slice(0, 16),
                    Creador: user?.noEmp || ''
                });
                setPreview(null);
            }

            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error('Error al procesar block.', error);
            console.error('Detalles del error:', error.response?.data);
            const errorMessage = error.response?.data?.error || "Error al procesar el block";
            showToast.error(errorMessage, {
                duration: 5000,
                position: "top-right",
            });
        } finally {
            setLoading(false);
        }
    };

    const tipoConectorOptions = conector.map(c => ({
        value: String(c.IdTipoConector),
        label: c.TipoConector
    }));
    const tipoTerminalOptions = terminal.map(t => ({
        value: String(t.IdTipoTerminal),
        label: t.TipoTerminal
    }));

    return (
        <form className="form-container blocks-form" onSubmit={handleSubmit}>
            <div className="form-grid">
                {/* COLUMNA IZQUIERDA */}
                <div className="form-column">
                    <div className="form-group">
                        <label className="form-label">Part Number</label>
                        <input
                            type="text"
                            name="NoParte"
                            value={formData.NoParte}
                            onChange={handleChange}
                            className="form-input"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Cant Pines</label>
                        <input
                            type="text"
                            name="CantidadPines"
                            value={formData.CantidadPines}
                            onChange={handleChange}
                            className="form-input"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Cant Pines de Presencia</label>
                        <input
                            type="number"
                            name="CantPinPresencia"
                            min="0"
                            value={formData.CantPinPresencia}
                            onChange={handleChange}
                            className="form-input"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Tipo Conector</label>
                        <select
                            name="TipoConectorId"
                            value={formData.TipoConectorId}
                            onChange={handleChange}
                            className="form-input"
                            required
                        >
                            <option value="">Seleccione un tipo de conector</option>
                            {tipoConectorOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Tipo Terminal</label>
                        <select
                            name="TipoTerminalId"
                            value={formData.TipoTerminalId}
                            onChange={handleChange}
                            className="form-input"
                            required
                        >
                            <option value="">Seleccione un tipo de terminal</option>
                            {tipoTerminalOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* COLUMNA DERECHA - IMAGEN */}
                <div className="form-column">
                    {/* ✅ Conector Fisico - En contenedor gris tipo card */}
                    <div className="form-group conector-fisico-card">
                        <div className="conector-fisico-header">
                            <span className="conector-fisico-title">
                                <FiBox className="conector-fisico-icon" />
                                Conector Físico
                            </span>
                            {isAdmin && isEditing && (
                                <span className="admin-badge">
                                    <FiShield /> Admin
                                </span>
                            )}
                        </div>
                        <div className="conector-fisico-content">
                            <label className="switch-container">
                                <input
                                    type="checkbox"
                                    checked={formData.ConectorFisico === 1}
                                    onChange={handleConectorFisicoChange}
                                    disabled={!isAdmin && isEditing}
                                    className="switch-input"
                                />
                                <span className="switch-slider"></span>
                                <span className="switch-label">
                                    <span className="switch-text">¿Tiene conector físico?</span>
                                    <span className="switch-status">
                                        {formData.ConectorFisico === 1 ? 'Activado' : 'Desactivado'}
                                    </span>
                                </span>
                            </label>
                            {!isAdmin && isEditing && (
                                <div className="conector-fisico-hint warning">
                                    <FiAlertTriangle />
                                    Solo los administradores pueden cambiar esta opción
                                </div>
                            )}
                            {isAdmin && isEditing && (
                                <div className="conector-fisico-hint success">
                                    <FiCheckCircle />
                                    Tienes permisos de administrador para modificar esta opción
                                </div>
                            )}
                        </div>
                    </div>
                    <label className="form-label">Block Image</label>

                    <div
                        className={`image-drop ${preview ? 'has-image' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        {preview ? (
                            <div className="image-preview-inline">
                                <img
                                    src={preview}
                                    alt="Block preview"
                                    onError={(e) => {
                                        console.error('Error cargando imagen:', preview);
                                        e.target.onerror = null;
                                        setPreview(null);
                                    }}
                                />
                                <button
                                    type="button"
                                    className="remove-image-inline"
                                    onClick={() => {
                                        setPreview(null);
                                        setFormData(prev => ({
                                            ...prev,
                                            Imagen: ""
                                        }));
                                    }}
                                >
                                    <FiX />
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    id="imageUpload"
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(e) => handleImage(e.target.files[0])}
                                />
                                <label
                                    htmlFor="imageUpload"
                                    className="image-drop-content"
                                >
                                    <FiUploadCloud />
                                    <h4>Drag an image here</h4>
                                    <span>or click to browse</span>
                                </label>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="form-actions">
                {onCancel && (
                    <button
                        type="button"
                        className="button-cancel"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                )}
                <button
                    type="submit"
                    className="button-icon button-green"
                    disabled={loading}
                >
                    {loading ? "SAVING..." : "SAVE BLOCK"}
                </button>
            </div>
        </form>
    );
};