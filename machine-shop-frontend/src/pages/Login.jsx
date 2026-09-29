import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { FiUser, FiLock, FiLogIn } from "react-icons/fi";
import Swal from "sweetalert2";
import { AuthContext } from "../context/AuthProvider";
import logo from "../assets/alteximg.png"
import "../assets/Login.css";

export const Login = () => {
    const navigate = useNavigate();
    const { login } = useContext(AuthContext);
    const [formData, setFormData] = useState({
        NoEmpleado: "",
        Contraseña: ""
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    }

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post("/login",
                formData
            );
            login(res.data.token);
            Swal.fire({
                icon: "success",
                title: "Welcome",
                text: "Login successful",
                confirmButtonColor: "#86030e"
            });
            navigate("/home");
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error.response?.data?.error || "Connection error",
                confirmButtonColor: "#D71928"
            });
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-left">
                    <div className="login-brand">
                        <img src={logo} alt="logo" />
                        <h1>MACHINE SHOP</h1>
                        <span>Machining Support System</span>
                    </div>
                    <div className="login-description">
                        <h2>Machining Platform</h2>
                        <p>
                            Ticket management...
                        </p>
                    </div>
                </div>
                <div className="login-right">
                    <h2>Sign In</h2>
                    <p>Enter your credentials</p>
                    <form onSubmit={handleLogin}>
                        <div className="login-input">
                            <FiUser />
                            <input
                                type="text"
                                name="NoEmpleado"
                                placeholder="No. Employee"
                                value={formData.NoEmpleado}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="login-input">
                            <FiLock />
                            <input
                                type="password"
                                name="Contraseña"
                                placeholder="Password"
                                value={formData.Contraseña}
                                onChange={handleChange}
                            />
                        </div>
                        <button className="login-button">
                            <FiLogIn />
                            Login
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}