import React, { useContext, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ProtectedRoutes } from './ProtectedRoutes'
import { AuthContext } from '../context/AuthProvider'
import { Home } from '../pages/Home'
import { UsersPage } from '../pages/UsersPage'
import { TicketsPage } from '../pages/TicketsPage'
import { BlocksPage } from '../pages/BlocksPage'
import { MetricsPage } from '../pages/MetricsPage'
import { Login } from '../pages/Login'
export const Pages = () => {
    const { user } = useContext(AuthContext);

    return (
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/Home" element={<Home />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path='/tickets' element={<TicketsPage />} />
            <Route path='/blocks' element={<BlocksPage />} />
        </Routes>
    )
}
