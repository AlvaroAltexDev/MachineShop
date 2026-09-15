import React, { useContext, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ProtectedRoutes } from './ProtectedRoutes'
import { AuthContext } from '../context/AuthProvider'
import { Home } from '../pages/Home'
import { UsersPage } from '../pages/UsersPage'
import { TicketsPage } from '../pages/TicketsPage'
import { BlocksPage } from '../pages/BlocksPage'
import { MetricsPage } from '../pages/MetricsPage'
import { BlocksDetails } from '../pages/details/BlocksDetails'
import { TicketHistoryPage } from '../pages/TicketHistoryPage'
import { Login } from '../pages/Login'
import { NotificationsHistoryPage } from '../pages/NotificationsHistoryPage'

export const Pages = () => {
    const { user } = useContext(AuthContext);

    return (
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/Home" element={<Home />} />
            <Route path="/metrics" element={<ProtectedRoutes roles={[1, 2]}><MetricsPage /></ProtectedRoutes>} />
            <Route path="/users" element={<ProtectedRoutes roles={[1]}><UsersPage /></ProtectedRoutes>} />
            <Route path='/tickets' element={<ProtectedRoutes roles={[1, 2]}><TicketsPage /></ProtectedRoutes>} />
            <Route path='/tickets/:id/historial' element={<ProtectedRoutes roles={[1, 2]}><TicketHistoryPage /></ProtectedRoutes>} />
            <Route path='/blocks' element={<ProtectedRoutes roles={[1, 2]}><BlocksPage /></ProtectedRoutes>} />
            <Route path='/blocksdetails' element={<ProtectedRoutes roles={[1]}><BlocksDetails /></ProtectedRoutes>} />
            <Route path='/notifications' element={<ProtectedRoutes roles={[1, 2]}><NotificationsHistoryPage /></ProtectedRoutes>} />
        </Routes>
    )
}