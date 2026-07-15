import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthProvider";
import { FiMenu, FiChevronDown, FiLogOut } from "react-icons/fi";
import { LuChartNoAxesGantt } from "react-icons/lu";
import { FaChartSimple } from "react-icons/fa6";
import { GrProjects } from "react-icons/gr";
import { TbTimeline } from "react-icons/tb";
import { FiActivity } from "react-icons/fi";
import { FaTools } from "react-icons/fa";
import { LuTickets, LuBlocks } from "react-icons/lu";
import { FaPuzzlePiece } from "react-icons/fa6";

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [adminMenuOpen, setAdminMenuOpen] = useState(false);

    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const userMenuRef = useRef(null);
    const adminMenuRef = useRef(null);

    const RELOAD_FLAG = "hasReloadedOnce";

    const toggleMenu = () => setIsOpen(!isOpen);
    const toggleAdminMenu = () => setAdminMenuOpen(!adminMenuOpen);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }

            if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
                setAdminMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const getUserInitials = () => {
        if (!user?.nombre) return "U";

        return user.nombre
            .split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const handleLogOut = () => {
        localStorage.removeItem("token");
        localStorage.removeItem(RELOAD_FLAG);
        navigate("/");
    };

    const isStandar = Number(user?.empRol) === 2;
    //if (user === null) return null;

    const mainMenuItems = [
        { to: "/metrics", label: "Metrics", icon: <FaChartSimple /> },
        { to: "/tickets", label: "Tickets", icon: <LuTickets /> },
        { to: "/blocks", label: "Blocks", icon: <LuBlocks /> },
        { to: "/TimeLine", label: "Assembly", icon: <FaPuzzlePiece /> },
    ];

   /*} if (isStandar) {
        mainMenuItems.push({
            to: "/Activities",
            label: "Activities",
            icon: <FiActivity />
        });
    }*/



    return (
        <nav className="navbar">

            {/* LEFT SIDE */}
            <div className="navbar-left">

                <FaTools className="navbar-logo"  size={30}/>
                <Link to="/" className="navbar-title">
                    Machine Shop - Altex
                </Link>
               {/*} <button className="nav-toggle" onClick={toggleMenu}>
                    <img src="/ximg.png" alt="menu" className="menu-icon-img" />
                </button>

                <Link to="/Home" className="navbar-title">
                    TimeLine NPI
                </Link>*/}

            </div>

            {/* CENTER MENU */}
            <div className={`menu ${isOpen ? "open" : ""}`}>

                {mainMenuItems.map((item) => (
                    <Link key={item.to} to={item.to} className="menu-item">
                        {item.icon && <span className="menu-icon">{item.icon}</span>}
                        {item.label}
                    </Link>
                ))}

            </div>

            {/* USER MENU */}
            <div className="user-menu-container" ref={userMenuRef}>

                <button
                    className="user-menu-button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                    {getUserInitials()}
                </button>

                {userMenuOpen && (
                    <div className="user-dropdown">

                        <div className="user-info">
                            <span className="user-name">
                                {user?.nombre || "User"}
                            </span>

                            <span className="user-role">
                                {user?.rolId === 1 ? "Admin" : "User"}
                            </span>
                        </div>

                        <div className="dropdown-divider"></div>

                        <button className="logout-button" onClick={handleLogOut}>
                            <FiLogOut />
                            Log Out
                        </button>

                    </div>
                )}

            </div>

        </nav>
    );
};

export default Navbar;