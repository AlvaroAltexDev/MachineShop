import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { Modal } from '../components/Modal';
import { BlocksForm } from "./forms/BlocksForm";
import api from '../api/api';
import socket from "../api/socket";
import { FiSearch, FiPlus, FiFileText, FiCpu, FiArrowRight, FiImage, FiUser, FiCalendar, FiClock } from "react-icons/fi";
import { showToast } from "nextjs-toast-notify";

export const BlocksPage = () => {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);

  const IMAGE_BASE_URL = 'http://localhost:3002/uploads/bloques/';

  useEffect(() => {
    fetchBlocks();
    socket.on("bloquesActualizados", fetchBlocks);
    return () => {
      socket.off("bloquesActualizados", fetchBlocks);
    };
  }, []);

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

  const filteredBlocks = blocks.filter(block =>
    block.NoParte?.toLowerCase().includes(search.toLowerCase()) ||
    block.Descripcion?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <Sidebar />
      <div className="page-container">
        <div className="blocks-header">
          <div>
            <h1>Blocks</h1>
            <span>Manage drawings, programs and assemblies.</span>
          </div>
          <button className="button-icon button-red" onClick={() => setIsModalOpen(true)}>
            <FiPlus className="icon" /> New Block
          </button>
        </div>
        <div className="blocks-search">
          <FiSearch />
          <input
            type="text"
            placeholder="Search by Part Number or Description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
            filteredBlocks.map((block) => {
              const imageUrl = getImageUrl(block.Imagen);
              return (
                <div className="block-card" key={block.Id || block.NoParte}>
                  <div className="block-actions">
                    <button className="edit-btn" onClick={() => handleEdit(block)}>
                      Edit
                    </button>
                  </div>
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
                    <h2>{block.NoParte || 'N/A'}</h2>
                    <p>{block.Descripcion || 'No description'}</p>

                    {/* INFO DEL CREADOR Y FECHA */}
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

                    {/* <div className="block-info">
                      <div>
                        <FiFileText />
                        {block.dibujos || 0} Drawings
                      </div>
                      <div>
                        <FiCpu />
                        {block.programas || 0} Programs
                      </div>
                    </div>
                   */}
                    <button className="button-icon button-red">
                      Explore
                      <FiArrowRight />
                    </button>
                  </div>
                </div>
              );
            })
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
      </div>
    </>
  );
};