import React from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'

export const Home = () => {
  return (
    <div className="home-container">
      <Navbar />
      <Sidebar />
      <div className="page-container">
        <div className="header-top">
          <h1 className="page-title">HOME</h1>
        </div>
      </div>
    </div>
  )
}
