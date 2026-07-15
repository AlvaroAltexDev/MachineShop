import React, { useEffect, useState, useContext } from 'react';
import api from '../../api/api';
import { AuthContext } from '../../context/AuthProvider';
import { FiUploadCloud, FiX } from "react-icons/fi";
import { showToast } from 'nextjs-toast-notify';

export const BlocksForm = ({ block, isEditing = false, onSuccess }) => {
    const { user } = useContext(AuthContext);
    const [conector, setConector] = useState([]);
    const [terminal, setTerminal] = useState([]);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [formData, setFormData] = useState({
        NoParte: '',
        Imagen: '',
        CantidadPines: '',
        TipoConectorId: '',
        TipoTerminalId: '',
        Candado: 0, // ← Cambia de '' a 0 (tinyint)
        LlevaCandado: false,
        FechaAlta: new Date().toISOString().slice(0, 16), // ← Cambiado para incluir hora
        Creador: user?.noEmp || ''  // ← Usar noEmp (número de empleado)
    });

    const IMAGE_BASE_URL = 'http://localhost:3002/uploads/bloques/';

    useEffect(() => {
        if (isEditing && block) {

            console.log("Candado:", block.Candado);         
            console.log("Tipo:", typeof block.Candado);
            setFormData({
                NoParte: block.NoParte || '',
                Imagen: block.Imagen || '',
                CantidadPines: block.CantidadPines || '',
                TipoConectorId: String(block.TipoConectorId || ''),
                TipoTerminalId: String(block.TipoTerminalId || ''),
                Candado: block.Candado !== undefined ? block.Candado : 0,
                LlevaCandado: block.Candado === 1 ? true : false,
                FechaAlta: block.FechaAlta
                    ? new Date(block.FechaAlta).toISOString().slice(0, 16)
                    : new Date().toISOString().slice(0, 16),
                Creador: block.Creador || user?.noEmp || ''  // ← Usar noEmp
            });

            if (block.Imagen) {
                if (typeof block.Imagen === 'string' && block.Imagen.trim() !== '') {
                    if (block.Imagen.startsWith('http://') || block.Imagen.startsWith('https://')) {
                        setPreview(block.Imagen);
                    } else {
                        setPreview(`${IMAGE_BASE_URL}${block.Imagen}`);
                    }
                } else if (typeof block.Imagen === 'object') {
                    console.log('La imagen es un Buffer, no se puede previsualizar directamente');
                    setPreview(null);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const dataToSend = new FormData();
            dataToSend.append('NoParte', formData.NoParte);
            dataToSend.append('CantidadPines', formData.CantidadPines);
            dataToSend.append('TipoConectorId', formData.TipoConectorId);
            dataToSend.append('TipoTerminalId', formData.TipoTerminalId);
            dataToSend.append('Candado', formData.LlevaCandado ? 1 : 0);

            let fechaHora = formData.FechaAlta;
            if (fechaHora && !fechaHora.includes(' ')) {
                // Si viene en formato ISO, lo convertimos
                fechaHora = fechaHora.replace('T', ' ');
            }
            dataToSend.append('FechaAlta', fechaHora);

            dataToSend.append('Creador', formData.Creador);

            console.log('Fecha a enviar:', fechaHora); // Debug
            // Enviar el NoEmpleado como Creador
            console.log('Creador a enviar (NoEmpleado):', formData.Creador);

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
                    TipoConectorId: '',
                    TipoTerminalId: '',
                    FechaAlta: new Date().toISOString().slice(0, 16),
                    Creador: user?.noEmp || ''  // ← Usar noEmp
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
                    <label className="checkbox-group">
                        <input
                            type="checkbox"
                            checked={formData.LlevaCandado}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    LlevaCandado: e.target.checked
                                })
                            }
                        />
                        <span>Uses Lock</span>
                        <span className="lock-status">
                            {formData.LlevaCandado ? 'Locked' : 'Unlocked'}
                        </span>
                    </label>
                    {/* <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            rows="3"
                            name="Descripcion"
                            value={formData.Descripcion}
                            onChange={handleChange}
                            className="form-textarea"
                        />
                    </div>*/}
                </div>

                {/* COLUMNA DERECHA - IMAGEN */}
                <div className="form-column">
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