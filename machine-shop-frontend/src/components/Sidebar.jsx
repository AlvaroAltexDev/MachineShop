import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHome,
  FiTool,
  FiClipboard,
  FiBarChart2,
  FiSettings,
  FiChevronRight,
  FiBox
} from "react-icons/fi";
import { MdOutlineMenuOpen } from "react-icons/md";
import { MdOutlineMenu } from "react-icons/md";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const toggleMenu = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  return (
    <aside className={`sidebar ${isOpen ? "open" : "collapsed"}`}>

      {/* HEADER */}
      <div className="sidebar-header">
        <span className="sidebar-title">
          {isOpen}
        </span>

        <button className="sidebar-toggle" onClick={toggleSidebar}>
          {isOpen ? <MdOutlineMenuOpen /> : <MdOutlineMenu />}
        </button>
      </div>

      {/* MENU */}
      <nav className="sidebar-menu">

        {/* ITEM HOME - Sin submenú */}
      {/*  <div className="sidebar-item">
          <NavLink 
            to="/Home" 
            className={({ isActive }) => 
              "sidebar-link " + (isActive ? "active" : "")
            }
          >
            <FiHome className="sidebar-icon" />
            {isOpen && <span>Home</span>}
            {!isOpen && <span className="tooltip">Home</span>}
          </NavLink>
        </div>*/} 

        {/* ITEM USERS - Con submenú */}
        <div className="sidebar-item">
          <button
            className="sidebar-button sidebar-link"
            onClick={() => toggleMenu("users")}
            style={{ 
              width: "100%",
              textAlign: "left"
            }}
          >
            <FiClipboard className="sidebar-icon" />
            {isOpen && (
              <>
                <span style={{ flex: 1 }}>Users</span>
                <FiChevronRight 
                  style={{
                    transform: openMenu === "users" ? "rotate(90deg)" : "none",
                    transition: "transform 0.3s ease"
                  }}
                />
              </>
            )}
            {!isOpen && <span className="tooltip">Users</span>}
          </button>

          {/* SUBMENU USERS */}
          <AnimatePresence>
            {openMenu === "users" && isOpen && (
              <motion.div
                className="submenu"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <NavLink
                  to="/users"
                  className={({ isActive }) =>
                    "submenu-link " + (isActive ? "active" : "")
                  }
                >
                  <FiClipboard />
                  Users
                </NavLink>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ITEM INVENTARIO */}
        <div className="sidebar-item">
          <NavLink
            to="/inventario"
            className={({ isActive }) =>
              "sidebar-link " + (isActive ? "active" : "")
            }
          >
            <FiBox className="sidebar-icon" />
            {isOpen && <span>Inventario</span>}
            {!isOpen && <span className="tooltip">Inventario</span>}
          </NavLink>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;