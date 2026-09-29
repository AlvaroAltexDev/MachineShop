import React, { useEffect, useState } from 'react';
import api from '../../api/api';
import Select from 'react-select';
import { showToast } from 'nextjs-toast-notify';

export const UsersForm = ({ usuario, isEditing = false, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [rol, setRol] = useState([]);
  const [areas, setAreas] = useState([]);

  const [formData, setFormData] = useState({
    NoEmpleado: '',
    Nombre: '',
    Contraseña: '',
    Correo: '',
    RolId: '',
    AreaId: '',
  });

  useEffect(() => {
    if (isEditing && usuario) {
      setFormData({
        NoEmpleado: usuario.NoEmpleado || '',
        Nombre: usuario.Nombre || '',
        Contraseña: '',
        Correo: usuario.Correo || '',
        RolId: String(usuario.RolId || ''),
        AreaId: String(usuario.AreaId || ''),
      });
    }
  }, [isEditing, usuario]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolRes, areasRes] = await Promise.all([
          api.get("/rolesSelectAll"),
          api.get("/areasSelectAll")
        ]);
        setRol(rolRes.data);
        setAreas(areasRes.data || []);
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

  const areasOptions = areas.map(a => ({
    value: String(a.IdArea),
    label: a.NombreArea
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
        showToast.success("User updated successfully", {
          duration: 3000,
          position: "top-right",
        });
      } else {
        await api.post(`/usuariosInsert`, formData);
        showToast.success("User added successfully", {
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
          AreaId: '',
        });
      }

      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('Error al procesar usuario.', error);
      const errorMessage = error.response?.data?.error || "Error processing user";
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
            <label className="form-label">Employee Number</label>
            <input
              type="text"
              name="NoEmpleado"
              value={formData.NoEmpleado}
              onChange={handleChange}
              className="form-input"
              required
              autoFocus={!isEditing}
              disabled={isEditing}
              placeholder="Ex: 05050"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              type="text"
              name="Nombre"
              value={formData.Nombre}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="Ex: Juan Perez"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="Correo"
              value={formData.Correo}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="Ex: juanpz@gmail.com"
            />
          </div>
          {!isEditing && (
            <div className="form-group">
              <label className="form-label">Password</label>
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
            <label className="form-label">Role</label>
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
          <div className="form-group">
            <label className="form-label">Area</label>
            <Select
              options={areasOptions}
              value={areasOptions.find(o => o.value === formData.AreaId)}
              onChange={(selected) => {
                setFormData(prev => ({
                  ...prev,
                  AreaId: selected ? selected.value : ''
                }))
              }}
              classNamePrefix="react-select"
              placeholder="Select an area"
              isClearable
            />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="button-icon button-green" disabled={loading}>
          {loading ? 'PROCESSING...' : (isEditing ? 'UPDATE' : 'ADD')}
        </button>
      </div>
    </form>
  );
};