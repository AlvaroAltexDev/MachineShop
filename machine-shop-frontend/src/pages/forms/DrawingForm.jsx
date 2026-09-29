import React, { useEffect, useState, useContext } from 'react';
import api from '../../api/api';
import { AuthContext } from '../../context/AuthProvider';
import { showToast } from 'nextjs-toast-notify';
import { FiUploadCloud, FiX, FiFile, FiCalendar, FiImage, FiInfo, FiFolder, FiCheck, FiAlertCircle } from "react-icons/fi";

export const DrawingForm = ({ dibujo, isEditing = false, onSuccess, bloqueId, onCancel }) => {
    const { user } = useContext(AuthContext);

    const [tipoDibujo, setTipoDibujo] = useState([]);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [fileInfo, setFileInfo] = useState(null);

    const getCurrentHermosilloDate = () => {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Hermosillo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(new Date());
    };

    const [formData, setFormData] = useState({
        BloqueId: bloqueId || '',
        TipoDibujoId: '',
        RutaDibujo: '',
        NombreDibujo: '',
        FechaSubida: getCurrentHermosilloDate(),
        UsuarioId: user?.noEmp || '',
    });

    // Actualizar UsuarioId cuando el usuario cargue
    useEffect(() => {
        if (user?.noEmp) {
            setFormData(prev => ({ ...prev, UsuarioId: String(user.noEmp) }));
        }
    }, [user]);

    useEffect(() => {
        if (isEditing && dibujo) {
            let fechaSubida = dibujo.FechaSubida || '';
            if (fechaSubida.includes(' ')) {
                fechaSubida = fechaSubida.split(' ')[0];
            } else if (fechaSubida.includes('T')) {
                fechaSubida = fechaSubida.split('T')[0];
            }

            // Obtener el nombre del dibujo
            const nombreArchivo = dibujo.NombreDibujo || dibujo.nombre || dibujo.RutaDibujo || 'Unnamed';

            setFormData({
                BloqueId: dibujo.BloqueId || bloqueId || '',
                TipoDibujoId: String(dibujo.TipoDibujoId || ''),
                RutaDibujo: dibujo.RutaDibujo || '',
                NombreDibujo: nombreArchivo,
                FechaSubida: fechaSubida || getCurrentHermosilloDate(),
                UsuarioId: dibujo.UsuarioId || user?.noEmp || '',
            });

            // Mostrar el archivo con su nombre original
            const rutaArchivo = dibujo.RutaDibujo;
            if (rutaArchivo) {
                const ext = rutaArchivo.split('.').pop().toLowerCase();
                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                
                if (imageExtensions.includes(ext)) {
                    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';
                    setPreview(`${API_URL}/uploads/dibujos/${rutaArchivo}`);
                    setFileInfo(null);
                } else {
                    setFileInfo({
                        nombre: nombreArchivo,
                        extension: ext,
                        tamanio: 'N/A'
                    });
                    setPreview(null);
                }
            }
        } else {
            // Resetear formulario si no es edición
            setFormData({
                BloqueId: bloqueId || '',
                TipoDibujoId: '',
                RutaDibujo: '',
                NombreDibujo: '',
                FechaSubida: getCurrentHermosilloDate(),
                UsuarioId: user?.noEmp || '',
            });
            setPreview(null);
            setFileInfo(null);
        }
    }, [isEditing, dibujo, bloqueId, user]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const tipoDibujoRes = await api.get("/tiposDibujosSelectAll");
                setTipoDibujo(tipoDibujoRes.data);
            } catch (error) {
                console.error('Error fetching drawing types:', error);
            }
        };

        fetchData();
    }, []);

    const handleFile = (file) => {
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
            showToast.error("File exceeds the 50MB limit", {
                duration: 4000,
                position: "top-right",
            });
            return;
        }

        const allowedExtensions = ['.prt', '.sldprt', '.sldasm', '.jpg', '.jpeg', '.png', '.pdf', '.dwg'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            showToast.error(`Format not allowed. Allowed: ${allowedExtensions.join(', ')}`, {
                duration: 4000,
                position: "top-right",
            });
            return;
        }

        setFormData(prev => ({
            ...prev,
            RutaDibujo: file,
            NombreDibujo: file.name
        }));

        setFileInfo({
            nombre: file.name,
            tamanio: (file.size / 1024 / 1024).toFixed(2),
            extension: ext,
            tipo: file.type
        });

        if (file.type.startsWith('image/')) {
            // Limpiar preview anterior si existe
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
            setPreview(URL.createObjectURL(file));
        } else {
            setPreview(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
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
            if (!formData.TipoDibujoId) {
                showToast.error("Please select a drawing type", {
                    duration: 3000,
                    position: "top-right",
                });
                setLoading(false);
                return;
            }

            if (!formData.UsuarioId) {
                showToast.error("Error: User not identified. Please reload the page.", {
                    duration: 4000,
                    position: "top-right",
                });
                setLoading(false);
                return;
            }

            const dataToSend = new FormData();
            dataToSend.append('BloqueId', formData.BloqueId);
            dataToSend.append('TipoDibujoId', formData.TipoDibujoId);
            dataToSend.append('UsuarioId', String(formData.UsuarioId));
            
            if (formData.NombreDibujo) {
                dataToSend.append('NombreDibujo', formData.NombreDibujo);
            }

            if (isEditing && formData.FechaSubida) {
                let fecha = formData.FechaSubida;
                if (fecha.includes(' ')) {
                    fecha = fecha.split(' ')[0];
                } else if (fecha.includes('T')) {
                    fecha = fecha.split('T')[0];
                }
                dataToSend.append('FechaSubida', fecha);
            }

            if (formData.RutaDibujo instanceof File) {
                dataToSend.append('RutaDibujo', formData.RutaDibujo);
            } else if (typeof formData.RutaDibujo === 'string' && formData.RutaDibujo.trim() !== '') {
                dataToSend.append('RutaDibujoUrl', formData.RutaDibujo);
            }

            console.log('📤 Enviando dibujo:', {
                BloqueId: formData.BloqueId,
                TipoDibujoId: formData.TipoDibujoId,
                NombreDibujo: formData.NombreDibujo,
                FechaSubida: formData.FechaSubida,
                tieneArchivo: formData.RutaDibujo instanceof File
            });

            let response;
            if (isEditing && dibujo) {
                dataToSend.append('IdDibujo', dibujo.IdDibujo || dibujo.Id);
                response = await api.put(`/dibujosUpdate`, dataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                response = await api.post(`/dibujosInsert`, dataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            console.log('✅ Respuesta del servidor:', response.data);

            if (!isEditing) {
                setFormData({
                    BloqueId: bloqueId || '',
                    TipoDibujoId: '',
                    RutaDibujo: '',
                    NombreDibujo: '',
                    FechaSubida: getCurrentHermosilloDate(),
                    UsuarioId: user?.noEmp || '',
                });
                setPreview(null);
                setFileInfo(null);
            }

            if (onSuccess) {
                onSuccess(response.data);
            }

            showToast.success(isEditing ? "Drawing updated successfully" : "Drawing saved successfully", {
                duration: 3000,
                position: "top-right",
            });

        } catch (error) {
            console.error('❌ Error al procesar dibujo:', error);
            console.error('Detalles:', error.response?.data);

            const errorMessage = error.response?.data?.error || "Error processing the drawing";
            showToast.error(errorMessage, {
                duration: 5000,
                position: "top-right",
            });
        } finally {
            setLoading(false);
        }
    };

    const tipoDibujoOptions = tipoDibujo
        .filter(d => d && d.IdTipo)
        .map(d => ({
            value: String(d.IdTipo),
            label: d.TipoDibujo || 'Unnamed'
        }));

    // Limpiar URLs de objeto al desmontar
    useEffect(() => {
        return () => {
            if (preview && preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    return (
        <form className="drawing-form-container" onSubmit={handleSubmit}>
            <div className="drawing-form-grid">
                <div className="drawing-form-column">
                    <div className="form-group">
                        <label className="form-label">
                            <FiImage className="form-icon" />
                            Drawing Type *
                        </label>
                        <select
                            name="TipoDibujoId"
                            value={formData.TipoDibujoId}
                            onChange={handleChange}
                            className="form-input"
                            required
                        >
                            <option value="">Select a drawing type</option>
                            {tipoDibujoOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {isEditing && (
                        <div className="form-group">
                            <label className="form-label">
                                <FiCalendar className="form-icon" />
                                Upload Date
                            </label>
                            <input
                                type="date"
                                name="FechaSubida"
                                value={formData.FechaSubida}
                                onChange={handleChange}
                                className="form-input"
                            />
                            <small className="form-hint">
                                Only change if necessary
                            </small>
                        </div>
                    )}
                </div>

                <div className="drawing-form-column">
                    <label className="form-label">
                        <FiUploadCloud className="form-icon" />
                        Drawing File {!isEditing && '*'}
                    </label>
                    <div
                        className={`drawing-drop ${preview || fileInfo ? 'has-file' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        {preview ? (
                            <div className="drawing-preview-container">
                                <img
                                    src={preview}
                                    alt="Drawing preview"
                                    onError={(e) => {
                                        console.error('Error cargando preview:', preview);
                                        e.target.onerror = null;
                                        setPreview(null);
                                    }}
                                />
                                <button
                                    type="button"
                                    className="remove-file-btn"
                                    onClick={() => {
                                        if (preview && preview.startsWith('blob:')) {
                                            URL.revokeObjectURL(preview);
                                        }
                                        setPreview(null);
                                        setFileInfo(null);
                                        setFormData(prev => ({
                                            ...prev,
                                            RutaDibujo: "",
                                            NombreDibujo: ""
                                        }));
                                    }}
                                >
                                    <FiX />
                                </button>
                            </div>
                        ) : fileInfo ? (
                            <div className="file-info-container">
                                <div className="file-icon">
                                    <FiFile size={40} />
                                </div>
                                <div className="file-details">
                                    <h4>{fileInfo.nombre}</h4>
                                    <span>{fileInfo.tamanio} MB</span>
                                    <span className="file-extension">{fileInfo.extension}</span>
                                </div>
                                <button
                                    type="button"
                                    className="remove-file-btn"
                                    onClick={() => {
                                        setFileInfo(null);
                                        setFormData(prev => ({
                                            ...prev,
                                            RutaDibujo: "",
                                            NombreDibujo: ""
                                        }));
                                    }}
                                >
                                    <FiX />
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    id="drawingUpload"
                                    type="file"
                                    accept=".prt,.sldprt,.sldasm,.jpg,.jpeg,.png,.pdf,.dwg"
                                    hidden
                                    onChange={(e) => handleFile(e.target.files[0])}
                                />
                                <label
                                    htmlFor="drawingUpload"
                                    className="drawing-drop-content"
                                >
                                    <FiUploadCloud size={48} />
                                    <h4>Drag a file here</h4>
                                    <span>or click to select</span>
                                    <div className="supported-formats">
                                        <FiCheck />
                                        <small>Supported formats:</small>
                                        <div className="format-tags">
                                            <span className="format-tag">.prt</span>
                                            <span className="format-tag">.sldprt</span>
                                            <span className="format-tag">.sldasm</span>
                                            <span className="format-tag">.jpg</span>
                                            <span className="format-tag">.png</span>
                                            <span className="format-tag">.pdf</span>
                                            <span className="format-tag">.dwg</span>
                                        </div>
                                        <small className="size-limit">Max: 50MB</small>
                                    </div>
                                </label>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="drawing-form-actions">
                <button
                    type="button"
                    className="button-cancel"
                    onClick={() => onCancel && onCancel()}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="button-save"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <span className="spinner"></span>
                            SAVING...
                        </>
                    ) : (
                        isEditing ? 'UPDATE DRAWING' : 'SAVE DRAWING'
                    )}
                </button>
            </div>
        </form>
    );
};