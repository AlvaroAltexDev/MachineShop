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
                    <h2>Unauthorized</h2>
                    <p>You don't have permission to view this page. If you think this is a mistake, contact an administrator.</p>
                    <div className="unauth-actions">
                        <button className="button-icon button-gray" onClick={() => navigate(-1)}>
                            <FiArrowLeft />
                            Back
                        </button>
                        <button className="button-icon button-red" onClick={() => navigate('/tickets')}>
                            Go to Tickets
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Unauthorized;
