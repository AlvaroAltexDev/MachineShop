import React, { useContext } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { AuthContext } from '../context/AuthProvider'

export const Home = () => {
  const { user } = useContext(AuthContext);
  const isAdmin = Number(user?.rolId) === 1;
  return (
    <div className="home-container">
      <Navbar />
      {isAdmin && <Sidebar />}
      <div className={`page-container ${!isAdmin ? 'full-width' : ''}`}>
        <div className="header-top">
          <h1 className="page-title">HOME</h1>
        </div>
      </div>
    </div>
  )
}
