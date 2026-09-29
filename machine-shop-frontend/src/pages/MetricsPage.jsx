import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { AuthContext } from '../context/AuthProvider'
import api from '../api/api';
import socket from '../api/socket';
import { showToast } from 'nextjs-toast-notify';
import {
    FiBarChart2, FiCheckCircle, FiClock, FiAlertTriangle,
    FiFlag, FiActivity
} from 'react-icons/fi';

const MESES_ES = {
    January: 'Jan', February: 'Feb', March: 'Mar', April: 'Apr',
    May: 'May', June: 'Jun', July: 'Jul', August: 'Aug',
    September: 'Sep', October: 'Oct', November: 'Nov', December: 'Dec'
};
const MESES_ORDEN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ESTADO_COLOR = {
    RECIBIDO: '#3498db',
    'DISEÑO': '#f39c12',
    PROGRAMA: '#9b59b6',
    ENSAMBLE: '#e67e22',
    MATERIALES: '#1abc9c',
    MAQUINADO: '#2ecc71',
    ARMADO: '#27ae60',
    COMPLETO: '#2e7d32',
    ENTREGADO: '#1565c0'
};

const mesCorto = (nombre) => MESES_ES[nombre] || nombre;

export const MetricsPage = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const isAdmin = Number(user?.rolId) === 1;

    const anioActual = new Date().getFullYear();
    const [year, setYear] = useState(anioActual);
    const [areaId, setAreaId] = useState('');
    const [modoTiempo, setModoTiempo] = useState('mes'); // mes | semana
    const [activeTab, setActiveTab] = useState('completados');
    const [loading, setLoading] = useState(true);

    const [areas, setAreas] = useState([]);
    const [porMes, setPorMes] = useState([]);
    const [porSemana, setPorSemana] = useState([]);
    const [enProceso, setEnProceso] = useState([]);
    const [porEstado, setPorEstado] = useState([]);
    const [porPrioridad, setPorPrioridad] = useState([]);
    const [retrasados, setRetrasados] = useState([]);
    const [promArea, setPromArea] = useState([]);

    const areaParam = areaId ? `areaId=${areaId}` : '';

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const q = (base) => `${base}?${[`year=${year}`, areaParam].filter(Boolean).join('&')}`;
            const qArea = (base) => areaParam ? `${base}?${areaParam}` : base;
            const [m, s, p, e, pr, r, a, ar] = await Promise.all([
                api.get(q('/metrics/ticketsCompletedByMonth')),
                api.get(qArea('/metrics/ticketsCompletedByWeek')),
                api.get(qArea('/metrics/ticketsInProgress')),
                api.get(qArea('/metrics/ticketsByStatus')),
                api.get(qArea('/metrics/ticketsByPriority')),
                api.get(qArea('/metrics/ticketsDelayed')),
                api.get(`/metrics/avgCompletionDays?year=${year}`),
                api.get('/metrics/areas'),
            ]);
            setPorMes(m.data || []);
            setPorSemana(s.data || []);
            setEnProceso(p.data || []);
            setPorEstado(e.data || []);
            setPorPrioridad(pr.data || []);
            setRetrasados(r.data || []);
            setPromArea(a.data || []);
            setAreas(ar.data || []);
        } catch (error) {
            console.error('Error loading metrics:', error);
            showToast.error('Error loading metrics', { duration: 3000, position: "top-right" });
        } finally {
            setLoading(false);
        }
    }, [year, areaParam]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        const h = () => fetchAll();
        socket.on('ticketsActualizados', h);
        return () => socket.off('ticketsActualizados', h);
    }, [fetchAll]);

    const datosTiempo = useMemo(() => {
        if (modoTiempo === 'semana') {
            return porSemana.map(s => ({ etiqueta: s.semanaNombre || `Week ${s.semana}`, total: Number(s.total) }));
        }
        const mapa = {};
        porMes.forEach(m => { mapa[mesCorto(m.mesNombre)] = Number(m.total); });
        return MESES_ORDEN.map(mes => ({ etiqueta: mes, total: mapa[mes] || 0 }));
    }, [modoTiempo, porMes, porSemana]);

    const maxTiempo = Math.max(1, ...datosTiempo.map(d => d.total));
    const totalCompletados = datosTiempo.reduce((a, d) => a + d.total, 0);

    const totalEstado = porEstado.reduce((a, s) => a + Number(s.total), 0);
    const radio = 54;
    const circ = 2 * Math.PI * radio;
    let acumulado = 0;
    const dona = porEstado.map(s => {
        const frac = totalEstado > 0 ? Number(s.total) / totalEstado : 0;
        const seg = { ...s, frac, offset: acumulado };
        acumulado += frac;
        return seg;
    });

    const maxPrioridad = Math.max(1, ...porPrioridad.map(p => Number(p.total)));
    const maxProm = Math.max(1, ...promArea.map(a => Number(a.promedioDias) || 0));
    const promGlobal = promArea.length > 0
        ? (promArea.reduce((a, x) => a + Number(x.promedioDias || 0) * Number(x.totalTickets || 0), 0) /
            Math.max(1, promArea.reduce((a, x) => a + Number(x.totalTickets || 0), 0)))
        : 0;

    const irATicket = (id) => navigate(`/tickets?view=${id}`);
    const anios = [anioActual, anioActual - 1, anioActual - 2];

    return (
        <div>
            <Navbar />
            {isAdmin && <Sidebar />}
            <div className={`page-container ${!isAdmin ? 'full-width' : ''}`}>
                {/* HEADER */}
                <div className="tickets-header-modern">
                    <div className="header-left">
                        <div className="header-icon-wrapper">
                            <FiBarChart2 className="header-icon" />
                        </div>
                        <div>
                            <h1 className="header-title">Metrics</h1>
                            <p className="header-subtitle">Shop performance in real time</p>
                        </div>
                    </div>
                    <div className="header-stats">
                        <div className="stat-item">
                            <span className="stat-number">{totalCompletados}</span>
                            <span className="stat-label">Completed {year}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{enProceso.length}</span>
                            <span className="stat-label">In progress</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{retrasados.length}</span>
                            <span className="stat-label">Delayed</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{promGlobal ? promGlobal.toFixed(1) : '—'}</span>
                            <span className="stat-label">Avg. days</span>
                        </div>
                    </div>
                </div>

                {/* FILTROS */}
                <div className="tickets-filters-discreta">
                    <div className="filters-main">
                        <div className="filter-group">
                            <label>Department</label>
                            <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                                <option value="">All</option>
                                {areas.map(a => (
                                    <option key={a.IdArea} value={a.IdArea}>{a.NombreArea}</option>
                                ))}
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>Year</label>
                            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                                {anios.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        {(areaId || year !== anioActual) && (
                            <button
                                className="clear-filters-btn"
                                onClick={() => { setAreaId(''); setYear(anioActual); }}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {/* TABS */}
                <div className="filters-bar">
                    <button className={`tab-btn ${activeTab === 'completados' ? 'active' : ''}`} onClick={() => setActiveTab('completados')}>
                        <FiCheckCircle />
                        Completed
                        <span className="tab-badge">{totalCompletados}</span>
                    </button>
                    <button className={`tab-btn ${activeTab === 'distribucion' ? 'active' : ''}`} onClick={() => setActiveTab('distribucion')}>
                        <FiFlag />
                        Status and priority
                    </button>
                    <button className={`tab-btn ${activeTab === 'promedio' ? 'active' : ''}`} onClick={() => setActiveTab('promedio')}>
                        <FiActivity />
                        Average by area
                    </button>
                    <button className={`tab-btn ${activeTab === 'proceso' ? 'active' : ''}`} onClick={() => setActiveTab('proceso')}>
                        <FiClock />
                        In progress
                        <span className="tab-badge">{enProceso.length}</span>
                    </button>
                    <button className={`tab-btn ${activeTab === 'retrasados' ? 'active' : ''}`} onClick={() => setActiveTab('retrasados')}>
                        <FiAlertTriangle />
                        Delayed
                        <span className="tab-badge">{retrasados.length}</span>
                    </button>
                </div>

                {loading ? (
                    <div className="loading-state">Loading metrics...</div>
                ) : (
                    <>
                        {/* COMPLETADOS POR TIEMPO */}
                        {activeTab === 'completados' && (
                        <div className="metrics-card">
                            <div className="metrics-card-header">
                                <span className="card-icon"><FiCheckCircle /></span>
                                <h4>Completed tickets</h4>
                                <div className="metrics-toggle">
                                    <button
                                        className={modoTiempo === 'mes' ? 'active' : ''}
                                        onClick={() => setModoTiempo('mes')}
                                    >
                                        By month
                                    </button>
                                    <button
                                        className={modoTiempo === 'semana' ? 'active' : ''}
                                        onClick={() => setModoTiempo('semana')}
                                    >
                                        By week
                                    </button>
                                </div>
                            </div>
                            <div className="metrics-bars">
                                {datosTiempo.map(d => (
                                    <div className="metrics-bar-row" key={d.etiqueta}>
                                        <span className="metrics-bar-label">{d.etiqueta}</span>
                                        <div className="metrics-bar-track">
                                            <div
                                                className="metrics-bar-fill red"
                                                style={{ width: `${(d.total / maxTiempo) * 100}%` }}
                                            />
                                        </div>
                                        <span className="metrics-bar-value">{d.total}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        )}

                        {activeTab === 'distribucion' && (
                        <div className="metrics-grid-2">
                            {/* POR ESTADO */}
                            <div className="metrics-card">
                                <div className="metrics-card-header">
                                    <span className="card-icon"><FiFlag /></span>
                                    <h4>By status</h4>
                                </div>
                                {totalEstado === 0 ? (
                                    <p className="metrics-empty">No tickets with this filter.</p>
                                ) : (
                                    <div className="metrics-dona-wrap">
                                        <svg className="metrics-dona" viewBox="0 0 140 140">
                                            <circle cx="70" cy="70" r={radio} fill="none" stroke="#eef0f2" strokeWidth="18" />
                                            {dona.map(s => (
                                                <circle
                                                    key={s.NombreEstado}
                                                    cx="70" cy="70" r={radio} fill="none"
                                                    stroke={ESTADO_COLOR[s.NombreEstado] || '#95a5a6'}
                                                    strokeWidth="18"
                                                    strokeDasharray={`${s.frac * circ} ${circ}`}
                                                    strokeDashoffset={-s.offset * circ}
                                                    transform="rotate(-90 70 70)"
                                                    strokeLinecap="butt"
                                                />
                                            ))}
                                            <text x="70" y="66" textAnchor="middle" className="dona-num">{totalEstado}</text>
                                            <text x="70" y="84" textAnchor="middle" className="dona-lbl">tickets</text>
                                        </svg>
                                        <div className="metrics-legend">
                                            {dona.map(s => (
                                                <div className="legend-item" key={s.NombreEstado}>
                                                    <span className="legend-dot" style={{ background: ESTADO_COLOR[s.NombreEstado] || '#95a5a6' }} />
                                                    <span className="legend-name">{s.NombreEstado}</span>
                                                    <span className="legend-val">{s.total}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* POR PRIORIDAD */}
                            <div className="metrics-card">
                                <div className="metrics-card-header">
                                    <span className="card-icon"><FiAlertTriangle /></span>
                                    <h4>By priority</h4>
                                </div>
                                {porPrioridad.length === 0 ? (
                                    <p className="metrics-empty">No tickets with this filter.</p>
                                ) : (
                                    <div className="metrics-bars">
                                        {porPrioridad.map(p => (
                                            <div className="metrics-bar-row" key={p.PrioridadNombre}>
                                                <span className="metrics-bar-label">{p.PrioridadNombre}</span>
                                                <div className="metrics-bar-track">
                                                    <div
                                                        className={`metrics-bar-fill ${String(p.PrioridadNombre).toUpperCase() === 'CRITICA' ? 'red' : String(p.PrioridadNombre).toUpperCase() === 'ALTA' ? 'orange' : String(p.PrioridadNombre).toUpperCase() === 'MEDIA' ? 'yellow' : 'green'}`}
                                                        style={{ width: `${(Number(p.total) / maxPrioridad) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="metrics-bar-value">{p.total}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        )}

                        {/* PROMEDIO POR ÁREA */}
                        {activeTab === 'promedio' && (
                        <div className="metrics-card">
                            <div className="metrics-card-header">
                                <span className="card-icon"><FiActivity /></span>
                                <h4>Average days to complete by area ({year})</h4>
                            </div>
                            {promArea.length === 0 ? (
                                <p className="metrics-empty">No closed tickets this year.</p>
                            ) : (
                                <div className="metrics-bars">
                                    {promArea.map(a => (
                                        <div className="metrics-bar-row" key={a.NombreArea}>
                                            <span className="metrics-bar-label wide">{a.NombreArea} <small>({a.totalTickets})</small></span>
                                            <div className="metrics-bar-track">
                                                <div
                                                    className="metrics-bar-fill graphite"
                                                    style={{ width: `${(Number(a.promedioDias) / maxProm) * 100}%` }}
                                                />
                                            </div>
                                            <span className="metrics-bar-value">{Number(a.promedioDias).toFixed(1)}d</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        )}

                        {/* A MEDIO CAMINO */}
                        {activeTab === 'proceso' && (
                        <div className="metrics-card">
                            <div className="metrics-card-header">
                                <span className="card-icon"><FiClock /></span>
                                <h4>In progress ({enProceso.length})</h4>
                            </div>
                            {enProceso.length === 0 ? (
                                <p className="metrics-empty">Nothing in progress. All up to date. 🎉</p>
                            ) : (
                                <div className="Table">
                                    <div className="table-scroll metrics-scroll">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Ticket</th>
                                                    <th>Requester</th>
                                                    <th>Status</th>
                                                    <th>Priority</th>
                                                    <th>Days left</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {enProceso.map(t => (
                                                    <tr
                                                        key={t.IdTicket}
                                                        className="clickable-row"
                                                        onClick={() => irATicket(t.IdTicket)}
                                                        title="View ticket"
                                                    >
                                                        <td><strong>#{t.IdTicket}</strong></td>
                                                        <td>{t.SolicitanteNombre || '—'}</td>
                                                        <td>{t.NombreEstado || '—'}</td>
                                                        <td>{t.PrioridadNombre || '—'}</td>
                                                        <td className={Number(t.diasRestantes) < 0 ? 'metrics-neg' : ''}>
                                                            {t.diasRestantes ?? '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {/* RETRASADOS */}
                        {activeTab === 'retrasados' && (
                        <div className="metrics-card">
                            <div className="metrics-card-header">
                                <span className="card-icon warn"><FiAlertTriangle /></span>
                                <h4>Delayed ({retrasados.length})</h4>
                            </div>
                            {retrasados.length === 0 ? (
                                <p className="metrics-empty">No delays. 🎉</p>
                            ) : (
                                <div className="Table">
                                    <div className="table-scroll metrics-scroll">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Ticket</th>
                                                    <th>Requester</th>
                                                    <th>Status</th>
                                                    <th>Days delayed</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {retrasados.map(t => (
                                                    <tr
                                                        key={t.IdTicket}
                                                        className="clickable-row"
                                                        onClick={() => irATicket(t.IdTicket)}
                                                        title="View ticket"
                                                    >
                                                        <td><strong>#{t.IdTicket}</strong></td>
                                                        <td>{t.SolicitanteNombre || '—'}</td>
                                                        <td>{t.NombreEstado || '—'}</td>
                                                        <td className="metrics-neg">+{t.diasRetraso}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default MetricsPage
