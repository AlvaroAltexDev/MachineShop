import React from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'

export const MetricsPage = () => {
    return (
        <div>
            <Navbar />
            <Sidebar />
            <div className="page-container">
                <div className="header-top">
                    <h1 className="page-title">METRICOS</h1>
                </div>
            </div>
        </div>
    )
}
