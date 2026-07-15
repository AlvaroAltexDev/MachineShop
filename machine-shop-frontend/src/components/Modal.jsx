import React, { useEffect } from 'react';
import { MdClose } from "react-icons/md";

export const Modal = ({ isOpen, onClose, children, title, darkMode = false }) => {
  useEffect(() => {
    const page = document.querySelector(".page-container");

    if (isOpen) {
      document.body.classList.add("no-scroll");
      page?.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
      page?.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
      page?.classList.remove("no-scroll");
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className={`modal-content ${darkMode ? 'modal-content-dark' : ''}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <MdClose />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};