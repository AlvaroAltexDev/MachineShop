import React, { useState } from 'react';
import axios from 'axios';
import { showToast } from 'nextjs-toast-notify';
import { TbPasswordUser } from "react-icons/tb";

export const UsersPassword = ({ usuario, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        Password: "",
        ConfirmPassword: ""
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.Password.trim()) {
            return showToast.error("Ingrese una contraseña.");
        }
        if (formData.Password.length < 8) {
            return showToast.error("La contraseña debe tener al menos 8 caracteres.");
        }
        if (formData.Password !== formData.ConfirmPassword) {
            return showToast.error("Las contraseñas no coinciden.");
        }
        try {
            setLoading(true);
            await axios.put(
                "http://localhost:3002/usuariosUpdatePassword",
                {
                    NoEmpleado: usuario.NoEmpleado,
                    Contraseña: formData.Password
                }
            );
            showToast.success("Contraseña actualizada correctamente.");
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error(error);
            showToast.error(
                error.response?.data?.error ||
                "Error al actualizar la contraseña."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="password-form" onSubmit={handleSubmit}>
            <div className="password-user-info">
                <div className="password-field">
                    <label>Número de empleado</label>
                    <input
                        type="text"
                        value={usuario?.NoEmpleado || ""}
                        disabled
                    />
                </div>
                <div className="password-field">
                    <label>Nombre</label>
                    <input
                        type="text"
                        value={usuario?.Nombre || ""}
                        disabled
                    />
                </div>
            </div>
            <div className="password-field">
                <label>Nueva contraseña</label>
                <input
                    type="password"
                    name="Password"
                    value={formData.Password}
                    onChange={handleChange}
                    placeholder="********"
                    required
                />
            </div>
            <div className="password-field">
                <label>Confirmar contraseña</label>
                <input
                    type="password"
                    name="ConfirmPassword"
                    value={formData.ConfirmPassword}
                    onChange={handleChange}
                    placeholder="********"
                    required
                />
            </div>
            <div className="password-actions">
                <button
                    type="submit"
                    className="button-icon button-green"
                    disabled={loading}
                >
                    <TbPasswordUser size={20} />
                    <span>
                        {loading
                            ? "ACTUALIZANDO..."
                            : "ACTUALIZAR CONTRASEÑA"}
                    </span>
                </button>
            </div>
        </form>
    );
};