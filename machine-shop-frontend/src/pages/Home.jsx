import React, { useState, useEffect, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { AuthContext } from '../context/AuthProvider'
import api from '../api/api';
import socket from '../api/socket';
import { showToast } from 'nextjs-toast-notify';
import {
  FiFileText, FiBox, FiBarChart2, FiUsers, FiBell,
  FiClock, FiAlertTriangle, FiCheckCircle, FiChevronRight
} from 'react-icons/fi';

const esCompletado = (t) => {
  const n = (t.NombreEstado || '').toUpperCase();
  return n === 'COMPLETO' || n === 'ENTREGADO';
};

const hoyStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fechaCorta = () => {
  const d = new Date();
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const Home = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isAdmin = Number(user?.rolId) === 1;

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [demanda, setDemanda] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user?.noEmp) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ todos: 'true' });
      if (!isAdmin) params.append('usuarioId', user.noEmp);
      const [tRes] = await Promise.all([api.get(`/ticketsSelect?${params.toString()}`)]);
      setTickets(Array.isArray(tRes.data) ? tRes.data : []);
      if (isAdmin) {
        const [mRes, dRes] = await Promise.all([
          api.get('/materialesSelect'),
          api.get('/inventarioDemandaBlocks'),
        ]);
        setMateriales(mRes.data || []);
        setDemanda(dRes.data || []);
      }
    } catch (error) {
      console.error('Error loading home:', error);
      showToast.error('Error loading home', { duration: 3000, position: "top-right" });
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    socket.on('ticketsActualizados', fetchData);
    socket.on('inventarioActualizado', fetchData);
    socket.on('bloqueInventarioActualizado', fetchData);
    return () => {
      socket.off('ticketsActualizados', fetchData);
      socket.off('inventarioActualizado', fetchData);
      socket.off('bloqueInventarioActualizado', fetchData);
    };
  }, [fetchData]);

  const hoy = hoyStr();
  const activos = tickets.filter(t => t.Activo === 1 && !esCompletado(t));
  const completados = tickets.filter(t => esCompletado(t));
  const vencidos = activos.filter(t => t.FechaDeseada && t.FechaDeseada.slice(0, 10) < hoy);
  const bajoStock = materiales.filter(m => Number(m.Cant) <= Number(m.StockMinimo));
  const conFaltante = demanda.filter(d => Number(d.Faltante || 0) > 0);
  const recientes = [...tickets]
    .sort((a, b) => String(b.FechaSolicitacion || '').localeCompare(String(a.FechaSolicitacion || '')))
    .slice(0, 5);

  const accesos = isAdmin ? [
    { to: '/tickets', icon: <FiFileText />, titulo: 'Tickets', desc: `${activos.length} active` },
    { to: '/inventario', icon: <FiBox />, titulo: 'Inventory', desc: `${bajoStock.length} low stock` },
    { to: '/metrics', icon: <FiBarChart2 />, titulo: 'Metrics', desc: 'Shop performance' },
    { to: '/blocks', icon: <FiBox />, titulo: 'Blocks', desc: `${conFaltante.length} short` },
    { to: '/users', icon: <FiUsers />, titulo: 'Users', desc: 'Manage access' },
    { to: '/notifications', icon: <FiBell />, titulo: 'Notifications', desc: 'Notice history' },
  ] : [
    { to: '/tickets', icon: <FiFileText />, titulo: 'My tickets', desc: `${activos.length} active` },
    { to: '/blocks', icon: <FiBox />, titulo: 'Blocks', desc: 'Browse connectors' },
    { to: '/notifications', icon: <FiBell />, titulo: 'Notifications', desc: 'Notice history' },
  ];

  return (
    <div className="home-container">
      <Navbar />
      {isAdmin && <Sidebar />}
      <div className={`page-container ${!isAdmin ? 'full-width' : ''}`}>
        {/* SALUDO */}
        <div className="home-hero">
          <div>
            <p className="home-fecha">{fechaCorta()}</p>
            <h1 className="home-titulo">Welcome, {user?.nombre?.split(' ')[0] || 'Welcome'} 👋</h1>
            <p className="home-sub">
              {isAdmin ? 'Here is how the shop is doing today.' : 'Here are your requests.'}
            </p>
          </div>
          <span className={`home-rol ${isAdmin ? 'admin' : 'user'}`}>
            {isAdmin ? 'Administrator' : 'User'}
          </span>
        </div>

          {loading ? (
          <div className="loading-state">Loading home...</div>
        ) : (
          <>
            {/* STATS */}
            <div className="home-stats">
              <div className="home-stat" onClick={() => navigate('/tickets')}>
                <span className="home-stat-icon blue"><FiFileText /></span>
                <div>
                  <strong>{activos.length}</strong>
                  <small>{isAdmin ? 'Active tickets' : 'My active'}</small>
                </div>
              </div>
              <div className="home-stat alert" onClick={() => navigate('/tickets')}>
                <span className="home-stat-icon orange"><FiClock /></span>
                <div>
                  <strong>{vencidos.length}</strong>
                  <small>Overdue</small>
                </div>
              </div>
              <div className="home-stat ok" onClick={() => navigate('/tickets')}>
                <span className="home-stat-icon green"><FiCheckCircle /></span>
                <div>
                  <strong>{completados.length}</strong>
                  <small>Completed</small>
                </div>
              </div>
              {isAdmin && (
                <div className="home-stat alert" onClick={() => navigate('/inventario')}>
                  <span className="home-stat-icon red"><FiAlertTriangle /></span>
                  <div>
                    <strong>{bajoStock.length + conFaltante.length}</strong>
                    <small>Stock alerts</small>
                  </div>
                </div>
              )}
            </div>

            {/* ACCESOS */}
            <h3 className="home-seccion">Quick access</h3>
            <div className="home-grid">
              {accesos.map(a => (
                <button key={a.to + a.titulo} className="home-card" onClick={() => navigate(a.to)}>
                  <span className="home-card-icon">{a.icon}</span>
                  <span className="home-card-txt">
                    <strong>{a.titulo}</strong>
                    <small>{a.desc}</small>
                  </span>
                  <FiChevronRight className="home-card-go" />
                </button>
              ))}
            </div>

            {/* RECIENTES / ALERTAS */}
            <div className="home-cols">
              <div className="details-card-modern">
                <div className="card-header-modern">
                  <span className="card-icon"><FiClock /></span>
                            <h4>{isAdmin ? 'Recent activity' : 'My latest tickets'}</h4>
                        </div>
                        <div className="card-body-modern">
                            {recientes.length === 0 ? (
                                <p className="metrics-empty">No activity yet.</p>
                            ) : recientes.map(t => (
                                <div
                                    key={t.IdTicket}
                                    className="home-row"
                                    onClick={() => navigate(`/tickets?view=${t.IdTicket}`)}
                                    title="View ticket"
                                >
                                    <strong>#{t.IdTicket}</strong>
                                    <span className="home-row-desc">{t.Descripcion?.slice(0, 60) || t.SolicitanteNombre || 'No description'}</span>
                      <span className={`hist-badge ${esCompletado(t) ? 'ev-cierre' : 'ev-estado'}`}>
                        {t.NombreEstado || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <div className="details-card-modern">
                  <div className="card-header-modern">
                    <span className="card-icon"><FiAlertTriangle /></span>
                            <h4>Needs attention</h4>
                        </div>
                        <div className="card-body-modern">
                            {vencidos.length === 0 && bajoStock.length === 0 && conFaltante.length === 0 ? (
                                <p className="metrics-empty">All clear. 🎉</p>
                            ) : (
                                <>
                                    {vencidos.slice(0, 3).map(t => (
                                        <div key={'v' + t.IdTicket} className="home-row" onClick={() => navigate(`/tickets?view=${t.IdTicket}`)} title="View ticket">
                                            <strong>#{t.IdTicket}</strong>
                                            <span className="home-row-desc">Overdue · {t.FechaDeseada?.slice(0, 10) || ''}</span>
                                            <span className="hist-badge ev-papelera">Overdue</span>
                                        </div>
                                    ))}
                                    {bajoStock.slice(0, 3).map(m => (
                                        <div key={'m' + m.IdMateriales} className="home-row" onClick={() => navigate('/inventario')} title="View inventory">
                                            <strong>{m.Material}</strong>
                                            <span className="home-row-desc">Stock {m.Cant} / min {m.StockMinimo}</span>
                                            <span className="hist-badge ev-edicion">Low stock</span>
                                        </div>
                                    ))}
                                    {conFaltante.slice(0, 3).map(d => (
                                        <div key={'d' + d.NoParte} className="home-row" onClick={() => navigate('/inventario')} title="View inventory">
                                            <strong>{d.NoParte}</strong>
                                            <span className="home-row-desc">Short {d.Faltante} of {d.Requerido}</span>
                                            <span className="hist-badge ev-bloque">Short</span>
                                        </div>
                                    ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
