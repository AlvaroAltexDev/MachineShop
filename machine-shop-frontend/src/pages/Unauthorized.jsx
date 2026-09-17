import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShield, FiArrowLeft } from 'react-icons/fi';
import Navbar from '../components/Navbar';

export const Unauthorized = () => {
    const navigate = useNavigate();

    return (
        <>
            <Navbar />
            <div className="unauth-page">
                <div className="unauth-card">
                    <div className="unauth-icon">
                        <FiShield />
                    </div>
                    <h1>403</h1>
                    <h2>Sin autorización</h2>
                    <p>No tienes permiso para ver esta página. Si crees que es un error, contacta a un administrador.</p>
                    <div className="unauth-actions">
                        <button className="button-icon button-gray" onClick={() => navigate(-1)}>
                            <FiArrowLeft />
                            Volver
                        </button>
                        <button className="button-icon button-red" onClick={() => navigate('/tickets')}>
                            Ir a Tickets
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Unauthorized;
