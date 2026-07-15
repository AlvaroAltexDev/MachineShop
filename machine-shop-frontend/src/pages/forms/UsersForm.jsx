import React, { useEffect, useState } from 'react';
import api from '../../api/api';
import Select from 'react-select';
import { showToast } from 'nextjs-toast-notify';

export const UsersForm = ({ usuario, isEditing = false, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [rol, setRol] = useState([]);

  const [formData, setFormData] = useState({
    NoEmpleado: '',
    Nombre: '',
    Contraseña: '',
    Correo: '',
    RolId: '',
  });

  useEffect(() => {
    if (isEditing && usuario) {
      setFormData({
        NoEmpleado: usuario.NoEmpleado || '',
        Nombre: usuario.Nombre || '',
        Contraseña: '',
        Correo: usuario.Correo || '',
        RolId: String(usuario.RolId || ''),
      });
    }
  }, [isEditing, usuario]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolRes] = await Promise.all([
          api.get("/rolesSelectAll")
        ]);
        setRol(rolRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  const rolesOptions = rol.map(r => ({
    value: String(r.IdRol),
    label: r.Rol
  }));

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
      if (isEditing && usuario) {
        const dataToSend = { ...formData };
        if (!dataToSend.Contraseña || dataToSend.Contraseña.trim() === '') {
          delete dataToSend.Contraseña;
        }

        await api.put(`/usuariosUpdate`, dataToSend);
        showToast.success("Usuario actualizado correctamente", {
          duration: 3000,
          position: "top-right",
        });
      } else {
        await api.post(`/usuariosInsert`, formData);
        showToast.success("Usuario agregado correctamente", {
          duration: 3000,
          position: "top-right",
        });
      }

      if (!isEditing) {
        setFormData({
          NoEmpleado: '',
          Nombre: '',
          Contraseña: '',
          Correo: '',
          RolId: '',
        });
      }

      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('Error al procesar usuario.', error);
      const errorMessage = error.response?.data?.error || "Error al procesar el usuario";
      showToast.error(errorMessage, {
        duration: 5000,
        position: "top-right",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-container users-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-column">
          <div className="form-group">
            <label className="form-label">Numero de Empleado</label>
            <input
              type="text"
              name="NoEmpleado"
              value={formData.NoEmpleado}
              onChange={handleChange}
              className="form-input"
              required
              autoFocus={!isEditing}
              disabled={isEditing}
              placeholder="Ej: 05050"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input
              type="text"
              name="Nombre"
              value={formData.Nombre}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="Ej: Juan Perez"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Correo</label>
            <input
              type="email"
              name="Correo"
              value={formData.Correo}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="Ej: juanpz@gmail.com"
            />
          </div>
          {!isEditing && (
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                name="Contraseña"
                value={formData.Contraseña}
                onChange={handleChange}
                className="form-input"
                required
                placeholder="* * * * *"
                minLength="8"
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Rol</label>
            <Select
              options={rolesOptions}
              value={rolesOptions.find(o => o.value === formData.RolId)}
              onChange={(selected) => {
                setFormData(prev => ({
                  ...prev,
                  RolId: selected ? selected.value : ''
                }))
              }}
              classNamePrefix="react-select"
              placeholder="Select a role"
              isClearable
            />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="button-icon button-green" disabled={loading}>
          {loading ? 'PROCESANDO...' : (isEditing ? 'ACTUALIZAR' : 'AGREGAR')}
        </button>
      </div>
    </form>
  );
};