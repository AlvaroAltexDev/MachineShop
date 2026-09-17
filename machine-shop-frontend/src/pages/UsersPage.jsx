import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Modal } from '../components/Modal';
import { UsersForm } from './forms/UsersForm';
import api from '../api/api';
import socket from '../api/socket';
import { MdFilterList, MdFilterListOff, MdModeEditOutline } from "react-icons/md";
import { FaUserAltSlash, FaUser, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { TbPasswordUser } from "react-icons/tb";
import { IoMdPersonAdd } from "react-icons/io";
import { UsersPassword } from './forms/UsersPassword';

export const UsersPage = () => {

  const [usuarios, setUsuarios] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  useEffect(() => {
    fetchUsuarios();
    socket.on("usuariosActualizados", fetchUsuarios);
    return () => {
      socket.off("usuariosActualizados", fetchUsuarios);
    };

  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const res = await api.get("/usuariosSelectAll");
      const data = Array.isArray(res.data) ? res.data : [];
      const usuariosValidos = data.filter(us =>
        us && us.NoEmpleado !== null && us.NoEmpleado !== undefined
      );
      setUsuarios(usuariosValidos);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      setUsuarios([]);
      showToast.error("Error al obtener usuarios", {
        position: "top-right",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (usuario) => {
    setSelectedUsuario(usuario);
    setIsEditModalOpen(true);
  };

  const handlePasswordChange = (usuario) => {
    setSelectedUsuario(usuario);
    setIsPasswordModalOpen(true);
  }

  /* ================= FILTER ================= */
  useEffect(() => {
    if (!filterType || !filterValue) {
      setFilteredUsers(usuarios);
      return;
    }

    const filtered = usuarios.filter(u =>
      String(u[filterType])
        .toLowerCase()
        .includes(filterValue.toLowerCase())
    );

    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [filterType, filterValue, usuarios]);

  /* ================= PAGINATION ================= */
  const indexLast = currentPage * itemsPerPage;
  const indexFirst = indexLast - itemsPerPage;
  const paginatedUsers = filteredUsers.slice(indexFirst, indexLast);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  /* ================= ACTIONS ================= */
  const handleStatus = (emp) => {
    setUsers(prev =>
      prev.map(u =>
        u.EmpNumber === emp
          ? { ...u, Status: u.Status === "Active" ? "Inactive" : "Active" }
          : u
      )
    );
  };

  return (
    <>
      <Navbar />
      <Sidebar />

      <div className="page-container">

        {/* HEADER */}
        <div className="page-header-with-filters">

          <div className="header-top">
            <h1 className="page-title">Users</h1>

            <div className="header-buttons">
              <button className="button-icon button-red" onClick={() => setIsModalOpen(true)}>
                <IoMdPersonAdd className="icon" /> Add User
              </button>

              <button
                className={`filter-toggle ${showFilter ? 'active' : ''}`}
                onClick={() => setShowFilter(!showFilter)}
              >
                {showFilter ? <MdFilterListOff /> : <MdFilterList />}
              </button>
            </div>
          </div>

          {/* FILTROS */}
          {showFilter && (
            <div className="header-filters">

              <select
                className="filter-type-select"
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setFilterValue('');
                }}
              >
                <option value="">All filters</option>
                <option value="EmpNumber">Employee Number</option>
                <option value="UserName">Name</option>
                <option value="Rol">Role</option>
                <option value="NombreArea">Area</option>
              </select>

              {filterType && (
                <input
                  className="filter-input"
                  placeholder="Search..."
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                />
              )}

            </div>
          )}

        </div>

        {/* TABLA */}
        <div className="Table users-table">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Num. Empleado</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Role</th>
                  <th>Área</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedUsers.map(u => (
                  <tr key={u.NoEmpleado}>
                    <td>{u.NoEmpleado}</td>
                    <td>{u.Nombre}</td>
                    <td>{u.Correo}</td>
                    <td>{u.Rol}</td>
                    <td>{u.NombreArea || 'Sin área'}</td>
                    <td>
                      <button className="icon-button" onClick={() => handleEdit(u)}>
                        <MdModeEditOutline />
                      </button>
                      <button className="icon-button" onClick={() => handlePasswordChange(u)}>
                        <TbPasswordUser />
                      </button>
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINACION */}
        <div className="pagination-container">

          <div className="pagination-info">
            Total: {filteredUsers.length}
          </div>

          <div className="pagination-buttons">

            <button
              onClick={() => goToPage(currentPage - 1)}
              className="pagination-btn"
            >
              <FaChevronLeft />
            </button>

            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => goToPage(i + 1)}
                className={`pagination-page-btn ${currentPage === i + 1 ? 'active' : ''}`}
              >
                {i + 1}
              </button>
            ))}

            <button
              onClick={() => goToPage(currentPage + 1)}
              className="pagination-btn"
            >
              <FaChevronRight />
            </button>

          </div>
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuevo Usuario">
          <UsersForm
            onSuccess={() => {
              setIsModalOpen(false);
            }}
          />
        </Modal>

        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Usuario">
          <UsersForm
            usuario={selectedUsuario}
            isEditing={true}
            onSuccess={() => {
              setIsEditModalOpen(false);
            }}
          />
        </Modal>

        <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Cambiar Contraseña">
          <UsersPassword
            usuario={selectedUsuario}
            isEditing={true}
            onSuccess={() => {
              setIsPasswordModalOpen(false);
            }}
          />
        </Modal>
      </div>
    </>
  );
};