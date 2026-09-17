import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { Modal } from '../components/Modal';
import { BlocksForm } from "./forms/BlocksForm";
import api from '../api/api';
import socket from "../api/socket";
import { FiSearch, FiPlus, FiFileText, FiCpu, FiArrowRight, FiImage, FiUser, FiCalendar, FiClock, FiChevronLeft, FiChevronRight, FiTrash2, FiCheckCircle } from "react-icons/fi";
import { showToast } from "nextjs-toast-notify";
import Swal from 'sweetalert2';
import { AuthContext } from '../context/AuthProvider';

export const BlocksPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);

  // ✅ Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  const IMAGE_BASE_URL = `${api.defaults.baseURL}/uploads/bloques/`;

  // ✅ Verificar si es administrador
  const isAdmin = Number(user?.rolId) === 1;

  useEffect(() => {
    fetchBlocks();
    socket.on("bloquesActualizados", fetchBlocks);
    return () => {
      socket.off("bloquesActualizados", fetchBlocks);
    };
  }, []);

  const goToBlocksDetails = (block) => {
    sessionStorage.setItem("selectedBlockId", block.NoParte);
    navigate("/blocksDetails");
  };

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const res = await api.get("/bloquesSelect");
      const data = Array.isArray(res.data) ? res.data : [];

      const processedData = data.map(block => ({
        ...block,
        Imagen: block.Imagen && typeof block.Imagen === 'object'
          ? null
          : block.Imagen || null
      }));

      setBlocks(processedData);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error al obtener bloques:", error);
      setBlocks([]);
      showToast.error("Error al obtener bloques", {
        position: "top-right",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (block) => {
    setSelectedBlock(block);
    setIsEditModalOpen(true);
  };

  const getImageUrl = (imagen) => {
    if (!imagen) return null;
    if (typeof imagen !== 'string') return null;
    if (imagen.trim() === '') return null;

    if (imagen.startsWith('http://') || imagen.startsWith('https://')) {
      return imagen;
    }

    return `${IMAGE_BASE_URL}${imagen}`;
  };

  const handleDelete = async (NoParte) => {
    try {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        html: `¿Deseas eliminar al block <strong>${NoParte || ''}</strong>?<br>Esta acción no se puede deshacer.`,
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

      const response = await api.delete(`/blocksDelete/${NoParte}`);

      if (response.data.success) {
        showToast.success(response.data.message, {
          duration: 3000,
          position: "top-right",
        });
        fetchBlocks();
      }

    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.error || 'Error al eliminar participante';
      showToast.error(errorMessage, {
        duration: 4000,
        position: "top-right",
      });
    }
  };

  // ✅ Filtrar bloques por búsqueda
  const filteredBlocks = blocks.filter(block =>
    block.NoParte?.toLowerCase().includes(search.toLowerCase()) ||
    block.Descripcion?.toLowerCase().includes(search.toLowerCase())
  );

  // ✅ Paginación
  const indexLast = currentPage * itemsPerPage;
  const indexFirst = indexLast - itemsPerPage;
  const currentBlocks = filteredBlocks.slice(indexFirst, indexLast);
  const totalPages = Math.ceil(filteredBlocks.length / itemsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ✅ Resetear a página 1 cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <>
      <Navbar />
      {/* ✅ Renderizar Sidebar solo si es admin */}
      {isAdmin && <Sidebar />}
      
      {/* ✅ Agregar clase para ajustar el contenedor cuando no hay sidebar */}
      <div className={`page-container ${!isAdmin ? 'full-width' : ''}`}>
        {/* HEADER */}
        <div className="blocks-header">
          <div>
            <h1>Blocks</h1>
            <span>Manage drawings, programs and assemblies.</span>
          </div>
          <button className="button-icon button-red" onClick={() => setIsModalOpen(true)}>
            <FiPlus className="icon" /> New Block
          </button>
        </div>

        {/* SEARCH */}
        <div className="blocks-search">
          <FiSearch />
          <input
            type="text"
            placeholder="Search by Part Number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="search-results-count">
            {filteredBlocks.length} blocks found
          </span>
        </div>

        {/* GRID DE BLOQUES */}
        <div className="blocks-grid">
          {loading ? (
            <div className="loading-state">Loading blocks...</div>
          ) : filteredBlocks.length === 0 ? (
            <div className="empty-state">
              <FiImage size={48} />
              <h3>No blocks found</h3>
              <p>Try adjusting your search or create a new block</p>
            </div>
          ) : (
            currentBlocks.map((block) => {
              const imageUrl = getImageUrl(block.Imagen);
              return (
                <div className="block-card" key={block.Id || block.NoParte}>
                  {isAdmin && (
                    <div className="block-actions-left">
                      <button className="edit-btn" onClick={() => handleEdit(block)}>
                        Edit
                      </button>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="block-actions-right">
                      <button className="delete-btn" onClick={() => handleDelete(block.NoParte)}>
                        <FiTrash2 />
                      </button>
                    </div>
                  )}

                  <div className="block-image">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={block.NoParte || 'Block'}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          const parent = e.target.parentNode;
                          const placeholder = document.createElement('div');
                          placeholder.className = 'block-image-placeholder';
                          placeholder.innerHTML = `
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                              <circle cx="8.5" cy="8.5" r="1.5"></circle>
                              <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                            <span>Error loading image</span>
                          `;
                          parent.appendChild(placeholder);
                        }}
                      />
                    ) : (
                      <div className="block-image-placeholder">
                        <FiImage size={48} />
                        <span>No Image</span>
                      </div>
                    )}
                  </div>
                  <div className="block-body">
                    <div className="block-title-row">
                      <h2 title={block.NoParte || 'N/A'}>{block.NoParte || 'N/A'}</h2>
                      <span className={`conector-tag ${Number(block.ConectorFisico) === 1 ? 'has-conector' : 'no-conector'}`}>
                        {Number(block.ConectorFisico) === 1 ? (<><FiCheckCircle className="inv-check" /> Conector físico</>) : '❌ Sin conector'}
                      </span>
                    </div>

                    <div className="block-meta">
                      <div className="meta-item">
                        <FiUser className="meta-icon" />
                        <div>
                          <small>Created by</small>
                          <span>{block.CreadorNombre || block.Creator || 'Unknown'}</span>
                        </div>
                      </div>
                      <div className="meta-item">
                        <FiCalendar className="meta-icon" />
                        <div>
                          <small>Date & Time</small>
                          <span>{block.FechaFormateada || block.FechaAlta || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        className="button-icon button-red"
                        onClick={() => goToBlocksDetails(block)}
                      >
                        Explore
                        <FiArrowRight />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ✅ PAGINACIÓN */}
        {!loading && filteredBlocks.length > 0 && (
          <div className="blocks-pagination">
            <div className="pagination-info">
              Showing {indexFirst + 1} - {Math.min(indexLast, filteredBlocks.length)} of {filteredBlocks.length} blocks
            </div>

            <div className="pagination-controls">
              <button
                onClick={() => goToPage(currentPage - 1)}
                className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                disabled={currentPage === 1}
              >
                <FiChevronLeft />
              </button>

              <div className="pagination-pages">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => goToPage(i + 1)}
                    className={`pagination-page ${currentPage === i + 1 ? 'active' : ''}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                disabled={currentPage === totalPages}
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Block">
        <BlocksForm
          onSuccess={() => {
            setIsModalOpen(false);
          }}
        />
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Block">
        <BlocksForm
          block={selectedBlock}
          isEditing={true}
          onSuccess={() => {
            setIsEditModalOpen(false);
          }}
        />
      </Modal>
    </>
  );
};