import React from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

import {
  FiUser,
  FiCalendar,
  FiFlag,
  FiFileText,
  FiArrowRight,
  FiPlus,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiTool,
  FiCpu,
  FiWifi,
  FiServer,
  FiHardDrive
} from "react-icons/fi";

export const TicketsPage = () => {

  // Datos de ejemplo
  const tickets = [
    {
      id: 1025,
      status: "Blocked",
      priority: "High",
      requester: "Juan Pérez",
      date: "24/05/2025 09:30",
      description: "Failure in X Axis Position Sensor.",
      category: "Mechanical",
      progress: 0
    },
    {
      id: 1024,
      status: "In Process",
      priority: "Medium",
      requester: "Maria Lopez",
      date: "24/05/2025 08:15",
      description: "Conveyor belt worn.",
      category: "Electrical",
      progress: 60
    },
    {
      id: 1023,
      status: "Completed",
      priority: "Low",
      requester: "Luis Garcia",
      date: "23/05/2025 16:45",
      description: "Preventive maintenance completed.",
      category: "Mechanical",
      progress: 100
    }
  ];

  const getStatusClass = (status) => {
    switch(status) {
      case 'Blocked': return 'status-blocked';
      case 'In Process': return 'status-in-process';
      case 'Completed': return 'status-completed';
      case 'New': return 'status-new';
      case 'Assigned': return 'status-assigned';
      default: return '';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Blocked': return <FiAlertCircle />;
      case 'In Process': return <FiClock />;
      case 'Completed': return <FiCheckCircle />;
      default: return <FiClock />;
    }
  };

  const getCategoryIcon = (category) => {
    switch(category) {
      case 'Mechanical': return <FiTool />;
      case 'Electrical': return <FiCpu />;
      case 'IT': return <FiWifi />;
      case 'Server': return <FiServer />;
      default: return <FiHardDrive />;
    }
  };

  const getProgressSteps = (status) => {
    const steps = ['Received', 'Assigned', 'In Process', 'In Repair', 'Completed'];
    const statusMap = {
      'New': 0,
      'Assigned': 1,
      'In Process': 2,
      'Blocked': 2,
      'In Repair': 3,
      'Completed': 4
    };
    const currentStep = statusMap[status] || 0;
    
    return steps.map((step, index) => ({
      label: step,
      completed: index <= currentStep,
      active: index === currentStep
    }));
  };

  return (
    <>
      <Navbar />
      <Sidebar />

      <div className="page-container">

        {/* HEADER MEJORADO */}
        <div className="tickets-header-modern">
          <div className="header-left">
            <div className="header-icon-wrapper">
              <FiFileText className="header-icon" />
            </div>
            <div>
              <h1 className="header-title">Support Tickets</h1>
              <p className="header-subtitle">Machining Support Requests</p>
            </div>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-number">{tickets.length}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{tickets.filter(t => t.status === 'Blocked').length}</span>
              <span className="stat-label">Blocked</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{tickets.filter(t => t.status === 'In Process').length}</span>
              <span className="stat-label">In Process</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{tickets.filter(t => t.status === 'Completed').length}</span>
              <span className="stat-label">Completed</span>
            </div>
          </div>
          <button className="button-icon button-red">
            <FiPlus />
            New Ticket
          </button>
        </div>

        {/* FILTROS */}
        <div className="tickets-filters-modern">
          <input
            type="text"
            placeholder="Search tickets..."
            className="filter-input"
          />
          <select className="filter-select">
            <option>All Status</option>
            <option>Blocked</option>
            <option>In Process</option>
            <option>Completed</option>
          </select>
          <select className="filter-select">
            <option>All Priorities</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>

        {/* TICKETS GRID */}
        <div className="tickets-grid">

          {tickets.map(ticket => {
            const steps = getProgressSteps(ticket.status);
            return (
              <div className="ticket-card-modern" key={ticket.id}>

                {/* Muescas de ticket - Efecto de talonario */}
                <div className="ticket-notches">
                  <div className="notch"></div>
                  <div className="notch"></div>
                  <div className="notch"></div>
                  <div className="notch"></div>
                  <div className="notch"></div>
                  <div className="notch"></div>
                </div>

                <div className="ticket-red-bar"></div>

                <div className="ticket-content">

                  {/* TOP */}
                  <div className="ticket-top-modern">
                    <div className="ticket-brand">
                      <h2>OMNITEC</h2>
                      <span>Machinery</span>
                    </div>
                    <div className="ticket-id-status">
                      <span className="ticket-number">#{ticket.id}</span>
                      <span className={`ticket-status-badge ${getStatusClass(ticket.status)}`}>
                        {getStatusIcon(ticket.status)}
                        {ticket.status}
                      </span>
                    </div>
                  </div>

                  {/* INFO */}
                  <div className="ticket-info-modern">
                    <div className="info-item">
                      <FiUser className="info-icon" />
                      <div>
                        <small>Requester</small>
                        <strong>{ticket.requester}</strong>
                      </div>
                    </div>
                    <div className="info-item">
                      <FiCalendar className="info-icon" />
                      <div>
                        <small>Date</small>
                        <strong>{ticket.date}</strong>
                      </div>
                    </div>
                    <div className="info-item">
                      <FiFlag className="info-icon" />
                      <div>
                        <small>Priority</small>
                        <strong className={`priority-${ticket.priority.toLowerCase()}`}>
                          {ticket.priority}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* DESCRIPTION */}
                  <div className="ticket-description-modern">
                    <FiFileText className="desc-icon" />
                    <div>
                      <small>Description</small>
                      <p>{ticket.description}</p>
                    </div>
                  </div>

                  {/* PROGRESS - Solo para usuarios */}
                  <div className="ticket-progress">
                    <div className="progress-header">
                      <small>Progress</small>
                      <span className="progress-percentage">{ticket.progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${ticket.progress}%` }}
                      ></div>
                    </div>
                    <div className="progress-steps">
                      {steps.map((step, index) => (
                        <div key={index} className={`step ${step.completed ? 'completed' : ''} ${step.active ? 'active' : ''}`}>
                          <div className="step-circle">
                            {step.completed ? '✓' : index + 1}
                          </div>
                          <span className="step-label">{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="ticket-footer-modern">
                    <span className="ticket-category-modern">
                      {getCategoryIcon(ticket.category)}
                      {ticket.category}
                    </span>
                    <button className="details-btn-modern">
                      View Details
                      <FiArrowRight />
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};