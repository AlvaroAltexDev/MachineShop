import express from 'express';
import http from 'http';
import pool from './db.js';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import multer from 'multer';
import path from 'path';
import dotenv from "dotenv";
import moment from 'moment-timezone';
import { Server } from 'socket.io';
import { error } from 'console';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import fsp from 'fs/promises';


const app = express();
dotenv.config();
const port = process.env.PORT || 3002;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
    }
});

const getHermosilloDateOnly = () => moment().tz('America/Hermosillo').format('YYYY-MM-DD');
const getHermosilloDateTime = () => moment().tz('America/Hermosillo').format('YYYY-MM-DD HH:mm:ss');

// Configurar multer para almacenar imágenes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/bloques/'); // Carpeta donde se guardarán las imágenes
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'block-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only images are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

const storageDibujos = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/dibujos/'); // Carpeta específica para dibujos
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, 'dibujo-' + uniqueSuffix + extension);
    }
});

const fileFilterDibujos = (req, file, cb) => {
    const allowedTypes = [
        'application/sldprt', // .prt
        'application/sldasm', // .sldasm
        'application/octet-stream', // para archivos binarios
        'application/x-solidworks-part',
        'application/x-solidworks-assembly',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf'
    ];

    // También permitir por extensión
    const allowedExtensions = ['.prt', '.sldprt', '.sldasm', '.jpg', '.jpeg', '.png', '.pdf', '.dwg'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Tipo de archivo no permitido: ${file.originalname}`), false);
    }
};

const uploadDibujo = multer({
    storage: storageDibujos,
    fileFilter: fileFilterDibujos,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB para archivos de CAD
});

const storageProgramas = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/programas/'); // Carpeta para programas
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, 'programa-' + uniqueSuffix + extension);
    }
});

const uploadPrograma = multer({
    storage: storageProgramas,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const storageEnsambles = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/ensambles/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, 'ensemble-' + uniqueSuffix + extension);
    }
});

const uploadEnsemble = multer({
    storage: storageEnsambles,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.use('/uploads', express.static('uploads'));
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    moment.tz.setDefault("America/Hermosillo");

    const horaActual = moment().format('YYYY-MM-DD HH:mm:ss');
    //console.log(`🕐 Hora en Nogales (${horaActual}) - UTC: ${new Date().toUTCString()}`);
    next();
});

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const SECRET_KEY = '@T5#VH?>zJYegGO_2y*N?gFD3LSmSuTx@hntimlawf&vamliDJGV*ifF%4tz-tS&@L15yIK1a(z!pas0[U4I^';

/*---------------------------------------------------LOGIN---------------------------------------------------*/
app.post('/login', async (req, res) => {
    const { NoEmpleado, Contraseña } = req.body;
    if (!NoEmpleado || !Contraseña) {
        return res.status(400).json({
            message: 'Enter username and password'
        });
    }
    try {
        const [rows] = await pool.query(
            `SELECT * FROM usuarios WHERE NoEmpleado = ?`, [NoEmpleado]);
        const user = rows[0];
        if (!user) { return res.status(401).json({ error: 'Invalid credentials' }); }
        const match = await bcrypt.compare(Contraseña, user.Contraseña);
        if (!match) { return res.status(401).json({ error: 'Invalid credentials' }); }
        const payload = {
            NoEmpleado: user.NoEmpleado,
            Nombre: user.Nombre,
            Correo: user.Correo,
            AreaId: user.AreaId,
            RolId: user.RolId
        };
        const token = jwt.sign(payload, SECRET_KEY, {
            expiresIn: '8h'
        });
        res.json({
            message: 'Login successful',
            token,
            usuario: {
                noEmp: user.NoEmpleado,
                nombre: user.Nombre,
                correo: user.Correo,
                areaId: user.AreaId,
                rolId: user.RolId
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

/*!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!INSERTS!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/
/*---------------------------------------------------USUARIOS---------------------------------------------------*/
app.post('/usuariosInsert', async (req, res) => {
    const { NoEmpleado, Nombre, Contraseña, Correo, AreaId, RolId } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(Contraseña, 10);
        const [result] = await pool.query(
            'INSERT INTO usuarios (NoEmpleado, Nombre, Contraseña, Correo, AreaId,RolId) VALUES (?, ?, ?, ?, ?, ?)',
            [NoEmpleado, Nombre, hashedPassword, Correo, AreaId, RolId]
        );

        io.emit('usuariosActualizados');

        res.status(201).json({ message: 'User created', id: result.insertId });
    } catch (error) {
        console.error('Error al insertar usuario:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/*---------------------------------------------------BLOQUES---------------------------------------------------*/
app.post('/bloquesInsert', upload.single('Imagen'), async (req, res) => {
    try {
        const { NoParte, CantidadPines, CantPinPresencia, TipoConectorId, TipoTerminalId, ConectorFisico, FechaAlta, Creador } = req.body;
        const Imagen = req.file ? req.file.filename : null;

        if (!NoParte) {
            return res.status(400).json({ error: 'NoParte is required' });
        }

        // Si no se envía FechaAlta, usar la fecha/hora actual en Hermosillo
        const fechaHora = getHermosilloDateTime();

        console.log(`📍 Hora Hermosillo: ${fechaHora}`);

        const [result] = await pool.query(
            'INSERT INTO bloques (NoParte, Imagen, CantidadPines, CantPinPresencia, TipoConectorId, TipoTerminalId, ConectorFisico, FechaAlta, Creador) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [NoParte, Imagen, CantidadPines, CantPinPresencia, TipoConectorId, TipoTerminalId, ConectorFisico, fechaHora, Creador]
        );

        io.emit('bloquesActualizados');
        const notifBlockCreated = {
            type: 'block_created',
            title: 'New Block Created',
            message: `Block ${NoParte} created`,
            noParte: NoParte,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifBlockCreated);
        saveNotification({ ...notifBlockCreated, referenciaTipo: 'bloque', referenciaId: NoParte, emisorId: Creador, targetUserId: Creador });
        res.status(201).json({
            message: 'Block created',
            id: result.insertId,
            imagen: Imagen
        });
    } catch (error) {
        console.error('Error al insertar bloque:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/*---------------------------------------------------DIBUJOS---------------------------------------------------*/
app.post('/dibujosInsert', uploadDibujo.single('RutaDibujo'), async (req, res) => {
    try {
        const { BloqueId, TipoDibujoId, UsuarioId } = req.body;

        // Validar campos requeridos
        if (!BloqueId || !TipoDibujoId || !UsuarioId) {
            return res.status(400).json({
                error: 'Missing required fields: BloqueId, TipoDibujoId, UsuarioId'
            });
        }

        // ✅ Solo fecha (sin horas) en zona horaria de Hermosillo
        const fechaSubida = getHermosilloDateOnly();

        // Determinar la ruta del archivo
        let rutaDibujo = req.file ? req.file.filename : null;
        const nombreDibujo = req.file ? req.file.originalname : null;

        // Si se envió una URL, usarla
        if (!rutaDibujo && req.body.RutaDibujoUrl) {
            rutaDibujo = req.body.RutaDibujoUrl;
        }

        // Si no hay archivo y no hay URL, error
        if (!rutaDibujo) {
            return res.status(400).json({
                error: 'You must provide a file or a URL'
            });
        }

        // Insertar en la base de datos
        const [result] = await pool.query(
            `INSERT INTO dibujos_bloques 
             (BloqueId, TipoDibujoId, nombreDibujo, RutaDibujo, FechaSubida, SubidoPor) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [BloqueId, TipoDibujoId, nombreDibujo, rutaDibujo, fechaSubida, UsuarioId]
        );

        // Emitir evento para actualizar la interfaz
        io.emit('dibujosActualizados');
        const dibujoDuenosNuevo = await getBlockUserIds(BloqueId);
        const notifDrawingCreated = {
            type: 'drawing_created',
            title: 'Drawing Added',
            message: `Drawing ${nombreDibujo || ''} added to block ${BloqueId}`,
            dibujoId: result.insertId,
            bloqueId: BloqueId,
            userIds: dibujoDuenosNuevo,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifDrawingCreated);
        saveNotification({ ...notifDrawingCreated, referenciaTipo: 'dibujo', referenciaId: result.insertId, emisorId: UsuarioId, targetUserId: UsuarioId });

        res.status(201).json({
            message: 'Drawing created successfully',
            id: result.insertId,
            rutaDibujo: rutaDibujo,
            fechaSubida: fechaSubida
        });

    } catch (error) {
        console.error('Error al insertar dibujo:', error);
        res.status(500).json({
            error: 'Error saving drawing to database',
            details: error.message
        });
    }
});
/*---------------------------------------------------PROGRAMAS---------------------------------------------------*/
app.post('/programasInsert', uploadPrograma.single('RutaPrograma'), async (req, res) => {
    try {
        const { DibujoId, NumeroOperacion, UsuarioId } = req.body;

        console.log('📝 Insertando programa:', {
            DibujoId,
            NumeroOperacion
        });

        if (!DibujoId || !UsuarioId) {
            return res.status(400).json({
                error: 'Missing required fields: DibujoId, UsuarioId'
            });
        }

        // Fecha actual en Hermosillo (solo fecha)
        const fechaSubida = getHermosilloDateOnly();

        // Archivo
        let rutaPrograma = req.file ? req.file.filename : null;
        let nombrePrograma = req.file ? req.file.originalname : null;

        // Validar archivo
        if (!rutaPrograma) {
            return res.status(400).json({
                error: 'You must provide a file'
            });
        }

        console.log('📁 Archivo original:', nombrePrograma);
        console.log('📁 Archivo guardado:', rutaPrograma);

        // Bloque dueño (para recetas, consumo y demanda: sin esto el programa queda huérfano)
        const [dibRow] = await pool.query('SELECT BloqueId FROM dibujos_bloques WHERE IdDibujo = ?', [DibujoId]);
        const bloqueDueno = dibRow.length > 0 ? dibRow[0].BloqueId : null;

        // Insertar programa
        const [result] = await pool.query(
            `INSERT INTO programas
            (BloqueId, DibujoId, NumeroOperacion, NombrePrograma, RutaPrograma, FechaSubida, SubidoPor)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                bloqueDueno,
                DibujoId,
                NumeroOperacion || null,
                nombrePrograma,
                rutaPrograma,
                fechaSubida,
                UsuarioId
            ]
        );

        //console.log('✅ Programa insertado:', result);

        io.emit('programasActualizados');
        const bloqueDelProgNuevo = await getDibujoBloque(DibujoId);
        const progDuenosNuevo = await getBlockUserIds(bloqueDelProgNuevo);
        const notifProgramCreated = {
            type: 'program_created',
            title: 'Program Added',
            message: `Program ${nombrePrograma || ''} added`,
            programaId: result.insertId,
            bloqueId: bloqueDelProgNuevo,
            userIds: progDuenosNuevo,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifProgramCreated);
        saveNotification({ ...notifProgramCreated, referenciaTipo: 'programa', referenciaId: result.insertId, emisorId: UsuarioId, targetUserId: UsuarioId });

        res.status(201).json({
            message: 'Program created successfully',
            id: result.insertId,
            nombrePrograma: nombrePrograma,
            rutaPrograma: rutaPrograma,
            fechaSubida: fechaSubida
        });

    } catch (error) {
        console.error('❌ Error al insertar programa:', error);

        res.status(500).json({
            error: 'Error saving program to database',
            details: error.message
        });
    }
});
/*---------------------------------------------------ENSAMBLES---------------------------------------------------*/
app.post('/ensamblesInsert', uploadEnsemble.single('RutaEnsamble'), async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
        const { BloqueId, NombreEnsamble, UsuarioId } = req.body;

        if (!BloqueId || !NombreEnsamble || !UsuarioId) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                error: 'Missing required fields: BloqueId, NombreEnsamble, UsuarioId'
            });
        }

        if (!req.file) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                error: 'You must provide a file'
            });
        }

        // Fecha actual en Hermosillo (solo fecha)
        const now = new Date();
        const hermosilloTime = new Date(now.getTime() - (7 * 60 * 60 * 1000));
        const fechaSubida = hermosilloTime.toISOString().slice(0, 10);

        const RutaEnsamble = req.file.filename;

        const [result] = await connection.query(
            `INSERT INTO ensambles 
             (BloqueId, NombreEnsamble, RutaEnsamble, FechaSubida, SubidoPor) 
             VALUES (?, ?, ?, ?, ?)`,
            [BloqueId, NombreEnsamble, RutaEnsamble, fechaSubida, UsuarioId]
        );

        // Auto-set EnsambleCompleto
        const fechaEnsamble = getHermosilloDateTime();
        await connection.query(
            `UPDATE bloques SET EnsambleCompleto = 1, FechaEnsambleCompleto = ? WHERE NoParte = ?`,
            [fechaEnsamble, BloqueId]
        );

        // Historial: avance automático a ENSAMBLE en tickets activos con todos los bloques completos
        const [estadosRowsEns] = await connection.query('SELECT IdEstado, NombreEstado FROM estados');
        const normEns = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        let ensambleId = null;
        estadosRowsEns.forEach(e => { if (normEns(e.NombreEstado) === 'ENSAMBLE') ensambleId = e.IdEstado; });
        const [ticketsEns] = await connection.query(
            `SELECT DISTINCT td.TicketId FROM tickets_details td
             JOIN tickets t ON t.IdTicket = td.TicketId
             WHERE td.BloqueId = ? AND t.Activo = 1`,
            [BloqueId]
        );
        const ticketsEnsambleAvance = [];
        for (const t of ticketsEns) {
            await connection.query(
                `INSERT INTO ordenes_estados_historial
                 (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
                 VALUES (?, NULL, ?, ?, ?, ?)`,
                [t.TicketId, fechaEnsamble, UsuarioId,
                 `Bloque ${BloqueId}: ensamble subido`, 'bloque']
            );
            if (ensambleId !== null) {
                const [fases] = await connection.query(
                    `SELECT b.EnsambleCompleto FROM tickets_details td
                     LEFT JOIN bloques b ON b.NoParte = td.BloqueId
                     WHERE td.TicketId = ?`,
                    [t.TicketId]
                );
                const todosEns = fases.length > 0 && fases.every(r => Number(r.EnsambleCompleto) === 1);
                if (todosEns) {
                    const [ult] = await connection.query(
                        `SELECT EstadoId, TipoEvento, Comentario FROM ordenes_estados_historial
                         WHERE TicketId = ? ORDER BY IdHistorial DESC LIMIT 1`,
                        [t.TicketId]
                    );
                    const yaAvanzado = ult.length > 0 && ult[0].TipoEvento === 'cambio_estado'
                        && ult[0].EstadoId === ensambleId
                        && (ult[0].Comentario || '').startsWith('Avance automático');
                    if (!yaAvanzado) {
                        await connection.query(
                            `INSERT INTO ordenes_estados_historial
                             (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [t.TicketId, ensambleId, fechaEnsamble, UsuarioId,
                             'Avance automático: fase ENSAMBLE completada', 'cambio_estado']
                        );
                    }
                }
            }
            ticketsEnsambleAvance.push(t.TicketId);
        }

        await connection.commit();
        connection.release();

        io.emit('bloqueStatusActualizado', { noParte: BloqueId, campo: 'EnsambleCompleto', valor: true });
        io.emit('ensamblesActualizados');
        ticketsEnsambleAvance.forEach(ticketId => io.emit('ticketEstadoActualizado', { ticketId }));
        const ensembleDuenosNuevo = await getBlockUserIds(BloqueId);
        const notifEnsembleCreated = {
            type: 'ensemble_created',
            title: 'Ensemble Added',
            message: `Ensemble ${NombreEnsamble || ''} added to block ${BloqueId}`,
            ensembleId: result.insertId,
            bloqueId: BloqueId,
            userIds: ensembleDuenosNuevo,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifEnsembleCreated);
        saveNotification({ ...notifEnsembleCreated, referenciaTipo: 'ensamble', referenciaId: result.insertId, emisorId: UsuarioId, targetUserId: UsuarioId });

        res.status(201).json({
            message: 'Ensemble created successfully',
            id: result.insertId,
            RutaEnsamble: RutaEnsamble,
            fechaSubida: fechaSubida
        });

    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error al insertar ensemble:', error);
        res.status(500).json({
            error: 'Error saving ensemble to database',
            details: error.message
        });
    }
});
/*---------------------------------------------------TICKETS---------------------------------------------------*/
app.post('/ticketsInsert', async (req, res) => {
    try {
        const { SolicitanteId, FechaDeseada, PrioridadId, Descripcion, Detalles } = req.body;

        const criticaId = 4; // ID de la prioridad "CRITICA" en tu BD

        if (PrioridadId === criticaId) {
            // Obtener el área del solicitante
            const [userArea] = await pool.query(
                'SELECT AreaId FROM usuarios WHERE NoEmpleado = ?',
                [SolicitanteId]
            );

            if (userArea.length === 0) {
                return res.status(400).json({ error: 'User not found' });
            }

            const areaId = userArea[0].AreaId;

            // Obtener el ID del estado "COMPLETO"
            const [estadoCompleto] = await pool.query(
                'SELECT IdEstado FROM estados WHERE NombreEstado = ?',
                ['COMPLETO']
            );

            const estadoCompletoId = estadoCompleto.length > 0 ? estadoCompleto[0].IdEstado : 7;

            // Verificar si ya existe un ticket crítico activo en el área
            const [criticoExistente] = await pool.query(
                `SELECT COUNT(*) as total 
                 FROM tickets t
                 LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
                 WHERE u.AreaId = ? 
                 AND t.PrioridadId = ? 
                 AND t.EstadoId != ?
                 AND t.Activo = 1`,
                [areaId, criticaId, estadoCompletoId]
            );

            if (criticoExistente[0].total > 0) {
                return res.status(400).json({
                    error: 'A CRITICAL ticket already exists in your area. Multiple critical tickets per area are not allowed.'
                });
            }
        }

        // Fecha solicitación automática (fecha/hora actual en Hermosillo)
        const now = new Date();
        const hermosilloTime = new Date(now.getTime() - (7 * 60 * 60 * 1000));
        const fechaSolicitacion = hermosilloTime.toISOString().slice(0, 19).replace('T', ' ');

        // Fecha estimada = FechaDeseada + 3 días (ejemplo)
        const fechaDeseada = new Date(FechaDeseada);
        const fechaEstimada = new Date(fechaDeseada);
        fechaEstimada.setDate(fechaEstimada.getDate() + 3);
        const fechaEstimadaStr = fechaEstimada.toISOString().slice(0, 10);

        // Iniciar transacción
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Insertar ticket - Siempre con EstadoId = 1 (RECIBIDO)
            const [ticketResult] = await connection.query(
                `INSERT INTO tickets 
                (SolicitanteId, FechaSolicitacion, FechaDeseada, FechaEstimada, PrioridadId, Descripcion, EstadoId) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [SolicitanteId, fechaSolicitacion, FechaDeseada, fechaEstimadaStr, PrioridadId, Descripcion, 1] // <-- EstadoId = 1
            );

            const ticketId = ticketResult.insertId;

            // 2. Insertar detalles del ticket
            for (const detalle of Detalles) {
                const { BloqueId, Cantidad } = detalle;

                if (!BloqueId || !Cantidad || Cantidad <= 0) {
                    throw new Error(`BloqueId and Cantidad are required for each detail`);
                }

                await connection.query(
                    `INSERT INTO tickets_details
                    (TicketId, BloqueId, Cantidad)
                    VALUES (?, ?, ?)`,
                    [ticketId, BloqueId, Cantidad]
                );
            }

            // 3. Historial inicial: ticket creado en estado RECIBIDO
            await connection.query(
                `INSERT INTO ordenes_estados_historial
                 (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [ticketId, 1, fechaSolicitacion, SolicitanteId, 'Ticket creado', 'creacion']
            );

            // 4. Auto-apartado: cubrir lo que se pueda con el stock disponible
            // (también sirve para stock dado de alta ANTES de crear el ticket).
            // Solo usa lo disponible, sin quitar lo ya apartado a otros.
            const qTicket = (sql, params) => connection.query(sql, params);
            const bloquesUnicos = [...new Set(Detalles.map(d => d.BloqueId))];
            let apartadosNuevo = 0;
            const bloquesApartados = [];
            for (const bp of bloquesUnicos) {
                const rAuto = await repartirBloque(qTicket, bp, SolicitanteId, fechaSolicitacion);
                apartadosNuevo += rAuto.apartados;
                if (rAuto.apartados > 0) bloquesApartados.push(bp);
            }

            await connection.commit();
            connection.release();

            // Emitir eventos
            io.emit('ticketsActualizados');
            bloquesApartados.forEach(noParte => io.emit('bloqueInventarioActualizado', { noParte }));
            io.emit('ticketEstadoActualizado', { ticketId });
            const notifTicketCreated = {
                type: 'ticket_created',
                title: 'New Ticket Created',
                message: `Ticket #${ticketId} created by ${SolicitanteId}`,
                ticketId,
                prioridad: PrioridadId,
                solicitanteId: SolicitanteId,
                userIds: [SolicitanteId],
                timestamp: getHermosilloDateTime()
            };
            io.emit('notification', notifTicketCreated);
            saveNotification({ ...notifTicketCreated, referenciaTipo: 'ticket', referenciaId: ticketId, emisorId: SolicitanteId, targetUserId: SolicitanteId });

            res.status(201).json({
                message: apartadosNuevo > 0
                    ? `Ticket created successfully and ${apartadosNuevo} piece(s) reserved`
                    : 'Ticket created successfully',
                ticketId: ticketId,
                estadoId: 1, // <-- Indicar que se asignó el estado RECIBIDO
                fechaSolicitacion: fechaSolicitacion,
                fechaEstimada: fechaEstimadaStr,
                apartados: apartadosNuevo
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error al insertar ticket:', error);
        res.status(500).json({
            error: 'Error saving ticket',
            details: error.message
        });
    }
});
/*!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!UPDATES!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/
/*---------------------------------------------------USUARIOS---------------------------------------------------*/
app.put('/usuariosUpdate', async (req, res) => {
    const { NoEmpleado, Nombre, Correo, AreaId, RolId } = req.body;

    try {
        const [rows] = await pool.query(
            'UPDATE usuarios SET Nombre = ?, Correo = ?, AreaId = ?,RolId = ? WHERE NoEmpleado = ?',
            [Nombre, Correo, AreaId, RolId, NoEmpleado]
        );
        io.emit("usuariosActualizados");

        res.json({ message: 'User updated successfully', data: rows });
    } catch (error) {
        console.log('Error al actualizar usuario:', error);

        res.status(500).json({
            error: 'Server error'
        });
    }
});

app.put('/usuariosUpdatePassword', async (req, res) => {
    const { NoEmpleado, Contraseña } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(Contraseña, 10);
        const [rows] = await pool.query(
            'UPDATE usuarios SET Contraseña = ? WHERE NoEmpleado = ?',
            [hashedPassword, NoEmpleado]
        );
        io.emit("usuariosActualizados");

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error al actualizar contraseña:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------BLOQUES---------------------------------------------------*/
app.put('/bloquesUpdate', upload.single('Imagen'), async (req, res) => {
    try {
        const { NoParte, NoParteOriginal, CantidadPines, CantPinPresencia, TipoConectorId, TipoTerminalId, ConectorFisico, ImagenUrl, Creador } = req.body;

        if (!NoParteOriginal) {
            return res.status(400).json({ error: 'NoParteOriginal is required' });
        }

        // Si se subió una nueva imagen, usarla; si no, mantener la existente
        const Imagen = req.file ? req.file.filename : (ImagenUrl || null);

        // Usar NoParteOriginal para identificar el registro
        // El ON UPDATE CASCADE actualizará automáticamente las tablas relacionadas
        const [rows] = await pool.query(
            'UPDATE bloques SET NoParte = ?, Imagen = ?, CantidadPines = ?, CantPinPresencia = ?, TipoConectorId = ?, TipoTerminalId = ?, ConectorFisico = ? WHERE NoParte = ?',
            [NoParte, Imagen, CantidadPines, CantPinPresencia, TipoConectorId, TipoTerminalId, ConectorFisico, NoParteOriginal]
        );

        io.emit("bloquesActualizados");
        const bloqueDuenos = await getBlockUserIds(NoParte);
        const notifBlockUpdated = {
            type: 'block_updated',
            title: 'Block Updated',
            message: `Block ${NoParte} has been updated`,
            noParte: NoParte,
            userIds: bloqueDuenos,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifBlockUpdated);
        saveNotification({ ...notifBlockUpdated, referenciaTipo: 'bloque', referenciaId: NoParte, emisorId: Creador, targetUserId: Creador });

        res.json({
            message: 'Block updated successfully',
            data: rows,
            imagen: Imagen,
            nuevoNoParte: NoParte
        });
    } catch (error) {
        console.error('Error al actualizar bloque:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------DIBUJOS---------------------------------------------------*/
app.post('/dibujosInsert', uploadDibujo.single('RutaDibujo'), async (req, res) => {
    try {
        const { BloqueId, TipoDibujoId, UsuarioId } = req.body;

        // Validar campos requeridos
        if (!BloqueId || !TipoDibujoId || !UsuarioId) {
            return res.status(400).json({
                error: 'Missing required fields: BloqueId, TipoDibujoId, UsuarioId'
            });
        }

        // Solo fecha (sin horas) en zona horaria de Hermosillo
        const now = new Date();
        const hermosilloTime = new Date(now.getTime() - (7 * 60 * 60 * 1000));
        const fechaSubida = hermosilloTime.toISOString().slice(0, 10);

        // Determinar la ruta del archivo
        let rutaDibujo = req.file ? req.file.filename : null;
        // ✅ Guardar el nombre original del archivo
        const nombreDibujo = req.file ? req.file.originalname : null;

        // Si se envió una URL, usarla
        if (!rutaDibujo && req.body.RutaDibujoUrl) {
            rutaDibujo = req.body.RutaDibujoUrl;
        }

        // Si no hay archivo y no hay URL, error
        if (!rutaDibujo) {
            return res.status(400).json({
                error: 'You must provide a file or a URL'
            });
        }

        // Insertar en la base de datos
        const [result] = await pool.query(
            `INSERT INTO dibujos_bloques 
             (BloqueId, TipoDibujoId, NombreDibujo, RutaDibujo, FechaSubida, SubidoPor) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [BloqueId, TipoDibujoId, nombreDibujo, rutaDibujo, fechaSubida, UsuarioId]
        );

        io.emit('dibujosActualizados');

        res.status(201).json({
            message: 'Drawing created successfully',
            id: result.insertId,
            rutaDibujo: rutaDibujo,
            nombreDibujo: nombreDibujo,
            fechaSubida: fechaSubida
        });

    } catch (error) {
        console.error('Error al insertar dibujo:', error);
        res.status(500).json({
            error: 'Error saving drawing to database',
            details: error.message
        });
    }
});

app.put('/dibujosUpdate', uploadDibujo.single('RutaDibujo'), async (req, res) => {
    try {
        const { IdDibujo, BloqueId, TipoDibujoId, FechaSubida, RutaDibujoUrl } = req.body;

        console.log('📝 Actualizando dibujo:', { IdDibujo, BloqueId, TipoDibujoId, FechaSubida });

        if (!IdDibujo) {
            return res.status(400).json({ error: 'IdDibujo is required' });
        }

        // Obtener el dibujo actual
        const [current] = await pool.query(
            'SELECT RutaDibujo, NombreDibujo FROM dibujos_bloques WHERE IdDibujo = ?',
            [IdDibujo]
        );

        if (current.length === 0) {
            return res.status(404).json({ error: 'Drawing not found' });
        }

        let rutaDibujo = current[0]?.RutaDibujo || null;
        let nombreDibujo = current[0]?.NombreDibujo || null;

        // Si se subió un nuevo archivo, actualizar la ruta y el nombre
        if (req.file) {
            rutaDibujo = req.file.filename;
            nombreDibujo = req.file.originalname; // ✅ Actualizar nombre original
            console.log('📝 Nuevo archivo subido:', rutaDibujo, 'nombre:', nombreDibujo);
        } else if (RutaDibujoUrl) {
            rutaDibujo = RutaDibujoUrl;
        }

        // Si no se envió FechaSubida, usar la fecha actual en Hermosillo
        let fechaSubidaFinal = FechaSubida;
        if (!fechaSubidaFinal) {
            fechaSubidaFinal = getHermosilloDateOnly();
        }

        // Actualizar en la base de datos
        const [result] = await pool.query(
            `UPDATE dibujos_bloques 
             SET BloqueId = ?, TipoDibujoId = ?, FechaSubida = ?, RutaDibujo = ?, NombreDibujo = ?
             WHERE IdDibujo = ?`,
            [BloqueId, TipoDibujoId, fechaSubidaFinal, rutaDibujo, nombreDibujo, IdDibujo]
        );

        console.log('✅ Dibujo actualizado:', result);

        io.emit('dibujosActualizados');

        res.json({
            message: 'Drawing updated successfully',
            data: result,
            rutaDibujo: rutaDibujo,
            nombreDibujo: nombreDibujo,
            fechaSubida: fechaSubidaFinal
        });

    } catch (error) {
        console.error('Error al actualizar dibujo:', error);
        res.status(500).json({
            error: 'Error updating drawing',
            details: error.message
        });
    }
});
/*---------------------------------------------------ENSAMBLES---------------------------------------------------*/
app.put('/ensamblesUpdate', uploadEnsemble.single('RutaEnsamble'), async (req, res) => {
    try {
        const { IdEnsamble, BloqueId, NombreEnsamble, RutaEnsambleUrl } = req.body;

        if (!IdEnsamble) {
            return res.status(400).json({ error: 'IdEnsamble is required' });
        }

        const [current] = await pool.query(
            'SELECT RutaEnsamble FROM ensambles WHERE IdEnsamble = ?',
            [IdEnsamble]
        );

        if (current.length === 0) {
            return res.status(404).json({ error: 'Ensemble not found' });
        }

        let RutaEnsamble = current[0]?.RutaEnsamble || null;

        if (req.file) {
            RutaEnsamble = req.file.filename;
        } else if (RutaEnsambleUrl) {
            RutaEnsamble = RutaEnsambleUrl;
        }

        const [result] = await pool.query(
            `UPDATE ensambles 
             SET BloqueId = ?, NombreEnsamble = ?, RutaEnsamble = ?
             WHERE IdEnsamble = ?`,
            [BloqueId, NombreEnsamble, RutaEnsamble, IdEnsamble]
        );

        io.emit('ensamblesActualizados');

        res.json({
            message: 'Ensemble updated successfully',
            data: result,
            RutaEnsamble: RutaEnsamble
        });

    } catch (error) {
        console.error('Error al actualizar ensemble:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/*---------------------------------------------------TICKETS UPDATE---------------------------------------------------*/
app.put('/ticketsUpdate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            SolicitanteId,     // ✅ Extraer del body
            FechaDeseada,
            PrioridadId,       // ✅ Extraer del body
            Descripcion,
            Detalles
        } = req.body;

        // Obtener el ticket actual para verificar su estado
        const [ticketActual] = await pool.query(
            'SELECT PrioridadId, SolicitanteId, EstadoId, Activo FROM tickets WHERE IdTicket = ?',
            [id]
        );

        if (ticketActual.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const ticket = ticketActual[0];

        // ✅ Si el ticket está en papelera, no se puede actualizar
        if (ticket.Activo === 0) {
            return res.status(400).json({ error: 'Cannot update a ticket in trash' });
        }

        // 🔒 Candado ENTREGADO: un ticket entregado ya no admite actualizaciones
        const [estadoEntregadoCheck] = await pool.query(
            'SELECT IdEstado FROM estados WHERE NombreEstado = ?',
            ['ENTREGADO']
        );
        if (estadoEntregadoCheck.length > 0 && ticket.EstadoId === estadoEntregadoCheck[0].IdEstado) {
            return res.status(400).json({ error: 'Cannot update a DELIVERED ticket' });
        }

        // ✅ VALIDACIÓN: Verificar si es CRÍTICO y si ya existe uno en el área
        const criticaId = 4; // ID de la prioridad "CRITICA" en tu BD

        // Si se está cambiando a CRÍTICO o ya es CRÍTICO y se está actualizando
        const esCritico = PrioridadId === criticaId || ticket.PrioridadId === criticaId;

        if (esCritico) {
            // Usar el SolicitanteId del body o el del ticket actual
            const solicitanteId = SolicitanteId || ticket.SolicitanteId;

            // Obtener el área del solicitante
            const [userArea] = await pool.query(
                'SELECT AreaId FROM usuarios WHERE NoEmpleado = ?',
                [solicitanteId]
            );

            if (userArea.length === 0) {
                return res.status(400).json({ error: 'User not found' });
            }

            const areaId = userArea[0].AreaId;

            // Obtener el ID del estado "COMPLETO"
            const [estadoCompleto] = await pool.query(
                'SELECT IdEstado FROM estados WHERE NombreEstado = ?',
                ['COMPLETO']
            );

            const estadoCompletoId = estadoCompleto.length > 0 ? estadoCompleto[0].IdEstado : 7;

            // Verificar si ya existe un ticket crítico activo en el área (excluyendo el actual)
            const [criticoExistente] = await pool.query(
                `SELECT COUNT(*) as total 
                 FROM tickets t
                 LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
                 WHERE u.AreaId = ? 
                 AND t.PrioridadId = ? 
                 AND t.EstadoId != ?
                 AND t.Activo = 1
                 AND t.IdTicket != ?`,
                [areaId, criticaId, estadoCompletoId, id]
            );

            if (criticoExistente[0].total > 0) {
                return res.status(400).json({
                    error: 'A CRITICAL ticket already exists in your area. Multiple critical tickets per area are not allowed.'
                });
            }
        }

        // ✅ Construir la consulta de actualización
        let query = 'UPDATE tickets SET ';
        const updates = [];
        const values = [];

        if (SolicitanteId) {
            updates.push('SolicitanteId = ?');
            values.push(SolicitanteId);
        }

        if (FechaDeseada) {
            updates.push('FechaDeseada = ?');
            values.push(FechaDeseada);
        }

        if (PrioridadId) {
            updates.push('PrioridadId = ?');
            values.push(PrioridadId);
        }

        if (Descripcion !== undefined) {
            updates.push('Descripcion = ?');
            values.push(Descripcion);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        query += updates.join(', ');
        query += ' WHERE IdTicket = ? AND Activo = 1';
        values.push(id);

        const [result] = await pool.query(query, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ticket not found or not active' });
        }

        // ✅ Si hay detalles, actualizarlos (guardar los anteriores para el historial)
        let detallesAnteriores = [];
        if (Detalles && Detalles.length > 0) {
            const [prevDet] = await pool.query(
                'SELECT BloqueId, Cantidad FROM tickets_details WHERE TicketId = ?',
                [id]
            );
            detallesAnteriores = prevDet;

            // Eliminar detalles existentes
            await pool.query('DELETE FROM tickets_details WHERE TicketId = ?', [id]);

            // Insertar nuevos detalles
            for (const detalle of Detalles) {
                const { BloqueId, Cantidad } = detalle;
                if (BloqueId && Cantidad > 0) {
                    await pool.query(
                        'INSERT INTO tickets_details (TicketId, BloqueId, Cantidad) VALUES (?, ?, ?)',
                        [id, BloqueId, Cantidad]
                    );
                }
            }
        }

        // Historial de edición: registrar qué campos cambiaron
        const camposCambiados = [];
        if (SolicitanteId && String(SolicitanteId) !== String(ticket.SolicitanteId)) camposCambiados.push('Solicitante');
        if (FechaDeseada) camposCambiados.push('FechaDeseada');
        if (PrioridadId && String(PrioridadId) !== String(ticket.PrioridadId)) camposCambiados.push('Prioridad');
        if (Descripcion !== undefined) camposCambiados.push('Descripción');
        if (Detalles && Detalles.length > 0) {
            const fmt = (arr) => (arr || []).map(d => `${d.BloqueId}x${d.Cantidad}`).sort().join(',');
            if (fmt(detallesAnteriores) !== fmt(Detalles)) camposCambiados.push('Bloques');
        }
        const editorId = SolicitanteId || ticket.SolicitanteId;
        await pool.query(
            `INSERT INTO ordenes_estados_historial
             (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
             VALUES (?, NULL, ?, ?, ?, ?)`,
            [id, getHermosilloDateTime(), editorId,
             camposCambiados.length > 0 ? `Ticket editado: ${camposCambiados.join(', ')}` : 'Ticket editado',
             'edicion']
        );

        io.emit('ticketsActualizados');
        io.emit('ticketEstadoActualizado', { ticketId: id });
        const solicitanteTicket = SolicitanteId || ticket.SolicitanteId;
        const notifTicketUpdated = {
            type: 'ticket_updated',
            title: 'Ticket Updated',
            message: `Ticket #${id} has been updated`,
            ticketId: id,
            solicitanteId: solicitanteTicket,
            userIds: solicitanteTicket ? [solicitanteTicket] : [],
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifTicketUpdated);
        saveNotification({ ...notifTicketUpdated, referenciaTipo: 'ticket', referenciaId: id, emisorId: SolicitanteId, targetUserId: solicitanteTicket });

        res.json({
            message: 'Ticket updated successfully',
            data: result
        });

    } catch (error) {
        console.error('Error al actualizar ticket:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/*!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!SELECT!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/
/*---------------------------------------------------USUARIOS---------------------------------------------------*/
app.get('/usuariosSelectAll', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT u.*, a.NombreArea, r.Rol FROM usuarios u LEFT JOIN areas a ON u.AreaId = a.IdArea LEFT JOIN roles r ON u.RolId = r.IdRol;');
        res.json(rows);
    } catch (error) {
        console.error('Error al seleccionar usuarios:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------ROLES---------------------------------------------------*/
app.get('/rolesSelectAll', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM roles');
        res.json(rows);
    } catch (error) {
        console.error('Error al seleccionar roles:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------AREAS---------------------------------------------------*/
app.get('/areasSelectAll', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM areas');
        res.json(rows);
    } catch (error) {
        console.error('Error al seleccionar áreas:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------BLOQUES---------------------------------------------------*/
app.get('/bloquesSelect', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT 
                b.NoParte, 
                b.Imagen, 
                b.CantidadPines,
                b.CantPinPresencia,
                b.TipoConectorId,
                b.TipoTerminalId,
                b.ConectorFisico,
                b.FechaAlta,
                b.Creador,
                u.Nombre as CreadorNombre,
                DATE_FORMAT(b.FechaAlta, '%d/%m/%Y %H:%i') as FechaFormateada
            FROM bloques b
            LEFT JOIN usuarios u ON b.Creador = u.NoEmpleado
            ORDER BY b.FechaAlta DESC`
        );

        const processedRows = rows.map(row => ({
            ...row,
            Imagen: row.Imagen ? String(row.Imagen) : null
        }));

        res.json(processedRows);
    } catch (error) {
        console.error('Error al obtener bloques:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
// Endpoint para obtener un bloque específico por NoParte
app.get('/bloquesSelectAll/:noParte', async (req, res) => {
    try {
        const { noParte } = req.params;

        const [rows] = await pool.query(
            `SELECT 
                b.NoParte, 
                b.Imagen, 
                b.CantidadPines,
                b.CantPinPresencia,
                b.TipoConectorId,
                b.TipoTerminalId,
                b.ConectorFisico,
                b.FechaAlta,
                b.Creador,
                tc.TipoConector,
                tt.TipoTerminal,
                u.Nombre as CreadorNombre,
                DATE_FORMAT(b.FechaAlta, '%d/%m/%Y %H:%i') as FechaFormateada
            FROM bloques b
            LEFT JOIN tipo_conector tc ON b.TipoConectorId = tc.IdTipoConector
            LEFT JOIN tipo_terminal tt ON b.TipoTerminalId = tt.IdTipoTerminal
            LEFT JOIN usuarios u ON b.Creador = u.NoEmpleado
            WHERE b.NoParte = ?
            ORDER BY b.FechaAlta DESC`,
            [noParte]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Block not found' });
        }

        const row = rows[0];
        const processedRow = {
            ...row,
            Imagen: row.Imagen ? String(row.Imagen) : null
        };

        res.json(processedRow);
    } catch (error) {
        console.error('Error al obtener bloque:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------TIPOSDIBUJOS---------------------------------------------------*/
app.get('/tiposDibujosSelectAll', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tipos_dibujo');
        res.json(rows);
    } catch (error) {
        console.error('Error al seleccionar roles:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------TIPOSCONECTOR---------------------------------------------------*/
app.get('/tipoConectorSelectAll', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tipo_conector');
        res.json(rows);
    } catch (error) {
        console.error('Error al seleccionar tipos de conector:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------TIPOSTERMINAL---------------------------------------------------*/
app.get('/tipoTerminalSelectAll', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tipo_terminal');
        res.json(rows);
    } catch (error) {
        console.error('Error al seleccionar tipos de terminal:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------DIBUJOSBYBLOQUES---------------------------------------------------*/
app.get('/dibujosByBloque/:bloqueId', async (req, res) => {
    try {
        const { bloqueId } = req.params;

        const [rows] = await pool.query(
            `SELECT d.*, t.TipoDibujo as TipoDibujoNombre, u.Nombre as SubidoPorNombre
             FROM dibujos_bloques d
             LEFT JOIN tipos_dibujo t ON d.TipoDibujoId = t.IdTipo
             LEFT JOIN usuarios u ON d.SubidoPor = u.NoEmpleado
             WHERE d.BloqueId = ?
             ORDER BY d.FechaSubida DESC`,
            [bloqueId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error al obtener dibujos:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/*---------------------------------------------------PROGRAMASBYDIBUJOS---------------------------------------------------*/
app.get('/programasByDibujo/:dibujoId', async (req, res) => {
    try {
        const { dibujoId } = req.params;

        const [rows] = await pool.query(
            `SELECT p.*, u.Nombre as SubidoPorNombre
             FROM programas p
             LEFT JOIN usuarios u ON p.SubidoPor = u.NoEmpleado
             WHERE p.DibujoId = ?
             ORDER BY p.FechaSubida DESC`,
            [dibujoId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error al obtener programas:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------ENSAMBLESBYBLOQUES---------------------------------------------------*/
app.get('/ensamblesByBloque/:bloqueId', async (req, res) => {
    try {
        const { bloqueId } = req.params;

        const [rows] = await pool.query(
            `SELECT e.*, u.Nombre as SubidoPorNombre
             FROM ensambles e
             LEFT JOIN usuarios u ON e.SubidoPor = u.NoEmpleado
             WHERE e.BloqueId = ?
             ORDER BY e.FechaSubida DESC`,
            [bloqueId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error al obtener ensambles:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/*---------------------------------------------------PRIORIDADES---------------------------------------------------*/
app.get('/prioridadesSelectAll', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM prioridades');
        res.json(rows);
    } catch (error) {
        console.error('Error al seleccionar prioridades:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------ESTADOS---------------------------------------------------*/
app.get('/estadosSelectAll', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM estados');
        res.json(rows);
    } catch (error) {
        console.error('Error al seleccionar estados:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/*---------------------------------------------------TICKETS---------------------------------------------------*/
app.get('/ticketEstados/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;

        // Reconciliación: si los bloques YA están marcados (de antes de existir
        // el historial o sin toggle reciente), generar las filas de avance
        // DISEÑO/PROGRAMA/ENSAMBLE que falten para que salgan en el timeline
        // sin tener que desmarcar y remarcar.
        try {
            const [estHist] = await pool.query('SELECT IdEstado, NombreEstado FROM estados');
            const normHist = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            const faseId = {};
            estHist.forEach(e => { faseId[normHist(e.NombreEstado)] = e.IdEstado; });
            const fasesDef = [
                { clave: 'DISENO', campo: 'DibujosCompleto', fechaCampo: 'FechaDibujosCompleto', nombre: 'DISEÑO' },
                { clave: 'PROGRAMA', campo: 'ProgramasCompleto', fechaCampo: 'FechaProgramasCompleto', nombre: 'PROGRAMA' },
                { clave: 'ENSAMBLE', campo: 'EnsambleCompleto', fechaCampo: 'FechaEnsambleCompleto', nombre: 'ENSAMBLE' },
            ];
            for (const fase of fasesDef) {
                const estadoId = faseId[fase.clave];
                if (!estadoId) continue;
                const [blqs] = await pool.query(
                    `SELECT b.${fase.campo} AS flag, b.${fase.fechaCampo} AS fecha
                     FROM tickets_details td
                     LEFT JOIN bloques b ON b.NoParte = td.BloqueId
                     WHERE td.TicketId = ?`,
                    [ticketId]
                );
                if (blqs.length === 0) continue;
                const todos = blqs.every(r => Number(r.flag) === 1);
                if (!todos) continue;
                const [existe] = await pool.query(
                    `SELECT COUNT(*) AS total FROM ordenes_estados_historial
                     WHERE TicketId = ? AND EstadoId = ? AND TipoEvento = 'cambio_estado'
                     AND Comentario LIKE 'Avance automático: fase ${fase.nombre}%'`,
                    [ticketId, estadoId]
                );
                if (existe[0].total > 0) continue;
                // Fecha del avance: la más reciente en que se marcó cada bloque
                let fechaAvance = getHermosilloDateTime();
                const fechas = blqs.map(r => r.fecha).filter(Boolean).sort();
                if (fechas.length > 0) fechaAvance = fechas[fechas.length - 1];
                await pool.query(
                    `INSERT INTO ordenes_estados_historial
                     (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
                     VALUES (?, ?, ?, NULL, ?, ?)`,
                    [ticketId, estadoId, fechaAvance,
                     `Avance automático: fase ${fase.nombre} completada`, 'cambio_estado']
                );
            }
        } catch (recErr) {
            console.error('Error reconciliando avances del ticket:', recErr);
            // No bloquear la lectura del historial si la reconciliación falla
        }

        const [rows] = await pool.query(
            `SELECT
                oh.IdHistorial,
                oh.TicketId,
                oh.EstadoId,
                oh.TipoEvento,
                oh.FechaCambio,
                DATE_FORMAT(oh.FechaCambio, '%d/%m/%Y %H:%i') as FechaCambioFormateada,
                oh.UsuarioId,
                oh.Comentario,
                e.NombreEstado,
                e.Orden,
                e.EsAutomatico,
                u.Nombre as UsuarioNombre
             FROM ordenes_estados_historial oh
             LEFT JOIN estados e ON oh.EstadoId = e.IdEstado
             LEFT JOIN usuarios u ON oh.UsuarioId = u.NoEmpleado
             WHERE oh.TicketId = ?
             ORDER BY (oh.TipoEvento = 'creacion') DESC, oh.FechaCambio ASC, oh.IdHistorial ASC`,
            [ticketId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error al obtener historial de estados:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// OBTENER ESTADO ACTUAL DEL TICKET
app.get('/ticketEstadoActual/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;

        const [rows] = await pool.query(
            `SELECT 
                t.EstadoId,
                e.NombreEstado,
                e.Orden,
                e.EsAutomatico
             FROM tickets t
             LEFT JOIN estados e ON t.EstadoId = e.IdEstado
             WHERE t.IdTicket = ?`,
            [ticketId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener estado actual:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// VERIFICAR ESTADOS AUTOMÁTICOS (Diseño, Programa, Ensamble)
app.post('/ticketVerificarAutomatico/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { UsuarioId } = req.body;

        // Obtener los bloques del ticket
        const [detalles] = await pool.query(
            `SELECT BloqueId FROM tickets_details WHERE TicketId = ?`,
            [ticketId]
        );

        // Obtener estado actual
        const [estadoActual] = await pool.query(
            `SELECT EstadoId FROM tickets WHERE IdTicket = ?`,
            [ticketId]
        );

        let nuevoEstadoId = estadoActual[0].EstadoId;
        let estadosAActualizar = [];

        // Verificar cada bloque
        let tieneDibujo = false;
        let tienePrograma = false;
        let tieneEnsamble = false;

        for (const detalle of detalles) {
            // Verificar si el bloque tiene dibujos
            const [dibujos] = await pool.query(
                'SELECT COUNT(*) as total FROM dibujos_bloques WHERE BloqueId = ?',
                [detalle.BloqueId]
            );
            if (dibujos[0].total > 0) tieneDibujo = true;

            // Verificar si el bloque tiene programas
            const [programas] = await pool.query(
                `SELECT COUNT(*) as total 
                 FROM programas p
                 JOIN dibujos_bloques d ON p.DibujoId = d.IdDibujo
                 WHERE d.BloqueId = ?`,
                [detalle.BloqueId]
            );
            if (programas[0].total > 0) tienePrograma = true;

            // Verificar si el bloque tiene ensamble
            const [ensambles] = await pool.query(
                'SELECT COUNT(*) as total FROM ensambles WHERE BloqueId = ?',
                [detalle.BloqueId]
            );
            if (ensambles[0].total > 0) tieneEnsamble = true;
        }

        // Estados automáticos (orden 2, 3, 4)
        const estadosMap = {
            'Diseño': { id: 2, condicion: tieneDibujo },
            'Programa': { id: 3, condicion: tienePrograma },
            'Ensamble': { id: 4, condicion: tieneEnsamble }
        };

        for (const [nombre, config] of Object.entries(estadosMap)) {
            if (config.condicion) {
                // Verificar si el estado ya está en el historial
                const [existe] = await pool.query(
                    'SELECT COUNT(*) as total FROM ordenes_estados_historial WHERE TicketId = ? AND EstadoId = ?',
                    [ticketId, config.id]
                );

                if (existe[0].total === 0) {
                    estadosAActualizar.push({ estadoId: config.id, nombre });
                    nuevoEstadoId = Math.max(nuevoEstadoId, config.id);
                }
            }
        }

        // Guardar estados automáticos en el historial
        const now = new Date();
        const hermosilloTime = new Date(now.getTime() - (7 * 60 * 60 * 1000));
        const fechaCambio = hermosilloTime.toISOString().slice(0, 19).replace('T', ' ');

        for (const estado of estadosAActualizar) {
            await pool.query(
                `INSERT INTO ordenes_estados_historial
                 (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [ticketId, estado.estadoId, fechaCambio, UsuarioId, `Auto-detected: ${estado.nombre}`, 'cambio_estado']
            );
        }

        // Actualizar estado actual del ticket
        if (nuevoEstadoId !== estadoActual[0].EstadoId) {
            await pool.query(
                `UPDATE tickets SET EstadoId = ? WHERE IdTicket = ?`,
                [nuevoEstadoId, ticketId]
            );
        }

        io.emit('ticketEstadoActualizado', { ticketId, nuevoEstadoId });

        res.json({
            success: true,
            estadosActualizados: estadosAActualizar,
            nuevoEstadoId
        });
    } catch (error) {
        console.error('Error al verificar estados automáticos:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ACTUALIZAR ESTADO MANUALMENTE
app.put('/ticketActualizarEstado/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { EstadoId, UsuarioId, Comentario } = req.body;

        // Verificar que el estado exista
        const [estadoCheck] = await pool.query(
            'SELECT IdEstado, NombreEstado, EsAutomatico FROM estados WHERE IdEstado = ?',
            [EstadoId]
        );

        if (estadoCheck.length === 0) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Verificar que el estado sea manual
        if (estadoCheck[0].EsAutomatico === 1) {
            return res.status(400).json({
                error: 'This status is automatic and cannot be assigned manually'
            });
        }

        // Verificar que el estado no esté antes que el actual
        const [estadoActual] = await pool.query(
            'SELECT EstadoId FROM tickets WHERE IdTicket = ?',
            [ticketId]
        );

        // NOTA: se permite regresar a estados anteriores (queda registrado en
        // el historial). El consumo de material en MAQUINADO solo ocurre la
        // primera vez que el ticket entra a ese estado (ver abajo).

        // VALIDACIÓN: Si el nuevo estado es ENTREGADO, verificar que todos los bloques tengan EnsambleCompleto
        const [estadoEntregado] = await pool.query(
            'SELECT IdEstado FROM estados WHERE NombreEstado = ?',
            ['ENTREGADO']
        );
        
        if (estadoEntregado.length > 0 && EstadoId === estadoEntregado[0].IdEstado) {
            // Obtener bloques del ticket
            const [bloquesTicket] = await pool.query(
                'SELECT BloqueId FROM tickets_details WHERE TicketId = ?',
                [ticketId]
            );
            
            if (bloquesTicket.length === 0) {
                return res.status(400).json({ 
                    error: 'Ticket has no associated blocks' 
                });
            }
            
            // Verificar que cada bloque tenga EnsambleCompleto (implica que ya pasó dibujos y programas)
            for (const bloque of bloquesTicket) {
                const [bloqueStatus] = await pool.query(
                    'SELECT EnsambleCompleto FROM bloques WHERE NoParte = ?',
                    [bloque.BloqueId]
                );
                
                if (bloqueStatus.length === 0) {
                    return res.status(400).json({ 
                        error: `Block ${bloque.BloqueId} does not exist` 
                    });
                }
                
                if (!bloqueStatus[0].EnsambleCompleto) {
                    return res.status(400).json({ 
                        error: `Block ${bloque.BloqueId} does not have a complete Ensemble. You must upload the ensemble before delivering.` 
                    });
                }
            }
        }

        // Insertar en historial
        const now = new Date();
        const hermosilloTime = new Date(now.getTime() - (7 * 60 * 60 * 1000));
        const fechaCambio = hermosilloTime.toISOString().slice(0, 19).replace('T', ' ');

        await pool.query(
            `INSERT INTO ordenes_estados_historial
             (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ticketId, EstadoId, fechaCambio, UsuarioId, Comentario || '', 'cambio_estado']
        );

        // Actualizar estado actual del ticket
        await pool.query(
            `UPDATE tickets SET EstadoId = ? WHERE IdTicket = ?`,
            [EstadoId, ticketId]
        );

        // Inventario blocks: al ENTREGAR se consume lo apartado (salida física)
        if (estadoCheck[0].NombreEstado === 'ENTREGADO') {
            await consumirApartadosTicket((sql, params) => pool.query(sql, params), ticketId, UsuarioId);
        }


        // Si el nuevo estado es COMPLETO, notificar al solicitante
        if (estadoCheck[0].NombreEstado === 'COMPLETO') {
            const [ticketInfo] = await pool.query(
                'SELECT SolicitanteId FROM tickets WHERE IdTicket = ?',
                [ticketId]
            );
            
            if (ticketInfo.length > 0 && ticketInfo[0].SolicitanteId !== UsuarioId) {
                const notifTicketCompleted = {
                    type: 'ticket_completed',
                    title: 'Your Ticket Has Been Completed',
                    message: `Ticket #${ticketId} has been marked as COMPLETE`,
                    ticketId,
                    targetUserId: ticketInfo[0].SolicitanteId,
                    solicitanteId: ticketInfo[0].SolicitanteId,
                    userIds: [ticketInfo[0].SolicitanteId],
                    timestamp: getHermosilloDateTime()
                };
                io.emit('notification', notifTicketCompleted);
                saveNotification({ ...notifTicketCompleted, referenciaTipo: 'ticket', referenciaId: ticketId, emisorId: UsuarioId, targetUserId: ticketInfo[0].SolicitanteId });
            }
        }

        io.emit('ticketEstadoActualizado', { ticketId, nuevoEstadoId: EstadoId });

        res.json({
            success: true,
            message: `Status updated to: ${estadoCheck[0].NombreEstado}`,
            nuevoEstado: estadoCheck[0].NombreEstado,
            fechaCambio,
        });
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// VERIFICAR SI UN BLOQUE ESTÁ COMPLETO (tiene dibujo, programa y ensamble)
app.get('/bloqueVerificarCompleto/:noParte', async (req, res) => {
    try {
        const { noParte } = req.params;

        // Verificar si tiene dibujos
        const [dibujos] = await pool.query(
            'SELECT COUNT(*) as total FROM dibujos_bloques WHERE BloqueId = ?',
            [noParte]
        );

        // Verificar si tiene programas
        const [programas] = await pool.query(
            `SELECT COUNT(*) as total 
             FROM programas p
             JOIN dibujos_bloques d ON p.DibujoId = d.IdDibujo
             WHERE d.BloqueId = ?`,
            [noParte]
        );

        // Verificar si tiene ensambles
        const [ensambles] = await pool.query(
            'SELECT COUNT(*) as total FROM ensambles WHERE BloqueId = ?',
            [noParte]
        );

        const tieneDibujo = dibujos[0].total > 0;
        const tienePrograma = programas[0].total > 0;
        const tieneEnsamble = ensambles[0].total > 0;
        const estaCompleto = tieneDibujo && tienePrograma && tieneEnsamble;

        res.json({
            noParte,
            tieneDibujo,
            tienePrograma,
            tieneEnsamble,
            estaCompleto,
            detalles: {
                dibujos: dibujos[0].total,
                programas: programas[0].total,
                ensambles: ensambles[0].total
            }
        });
    } catch (error) {
        console.error('Error al verificar completitud del bloque:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
 
// =============================================
// NUEVOS ENDPOINTS: ESTADO GRANULAR DE BLOQUES
// =============================================
 
// GET /bloquesGetStatus/:noParte - Obtener estado detallado de dibujos/programas/ensamble
app.get('/bloquesGetStatus/:noParte', async (req, res) => {
    try {
        const { noParte } = req.params;
 
        // Obtener todos los dibujos del bloque con sus IDs
        const [dibujos] = await pool.query(
            'SELECT IdDibujo, NombreDibujo FROM dibujos_bloques WHERE BloqueId = ?',
            [noParte]
        );
 
        // Para cada dibujo, verificar si tiene programas
        const drawingsWithoutPrograms = [];
        let totalProgramas = 0;
        
        for (const dibujo of dibujos) {
            const [progs] = await pool.query(
                'SELECT COUNT(*) as total FROM programas WHERE DibujoId = ?',
                [dibujo.IdDibujo]
            );
            totalProgramas += progs[0].total;
            if (progs[0].total === 0) {
                drawingsWithoutPrograms.push({ IdDibujo: dibujo.IdDibujo, NombreDibujo: dibujo.NombreDibujo });
            }
        }
 
        // Contar ensambles
        const [ensambles] = await pool.query(
            'SELECT COUNT(*) as total FROM ensambles WHERE BloqueId = ?',
            [noParte]
        );
 
        // Obtener flags actuales del bloque
        const [bloque] = await pool.query(
            'SELECT DibujosCompleto, ProgramasCompleto, EnsambleCompleto FROM bloques WHERE NoParte = ?',
            [noParte]
        );

        // Resumen de materiales por programa (para el paso MATERIALES del ticket):
        // cada programa debe tener ≥1 material asignado, stock suficiente y flag explícito.
        const [matsProg] = await pool.query(
            `SELECT p.IdPrograma, p.MaterialesCompleto,
                    (SELECT COUNT(*) FROM programa_materiales pm WHERE pm.ProgramaId = p.IdPrograma) AS recetas,
                    (SELECT COUNT(*) FROM programa_materiales pm
                     LEFT JOIN materiales m ON m.IdMateriales = pm.MaterialId
                     LEFT JOIN tipo_materiales t ON t.IdTipoMaterial = m.TipoMaterialId
                     WHERE pm.ProgramaId = p.IdPrograma
                     AND ((COALESCE(t.EsBarra, 0) = 1
                           AND m.LargoDisponible IS NOT NULL AND pm.Largo IS NOT NULL
                           AND m.LargoDisponible >= pm.Largo)
                          OR (COALESCE(t.EsBarra, 0) <> 1
                           AND m.Cant IS NOT NULL AND m.Cant >= pm.Cantidad))) AS recetasOk
             FROM programas p
             LEFT JOIN dibujos_bloques d ON d.IdDibujo = p.DibujoId
             WHERE p.BloqueId = ? OR d.BloqueId = ?`,
            [noParte, noParte]
        );
        const totalProgs = matsProg.length;
        const progsConMaterial = matsProg.filter(r => Number(r.recetas) > 0).length;
        const progsSuficientes = matsProg.filter(r => Number(r.recetas) > 0 && Number(r.recetas) === Number(r.recetasOk)).length;
        const progsConfirmados = matsProg.filter(r => Number(r.MaterialesCompleto) === 1).length;
        const materialesOk = totalProgs > 0 && progsConMaterial === totalProgs
            && progsSuficientes === totalProgs && progsConfirmados === totalProgs;

        res.json({
            noParte,
            DibujosCompleto: bloque[0]?.DibujosCompleto || false,
            ProgramasCompleto: bloque[0]?.ProgramasCompleto || false,
            EnsambleCompleto: bloque[0]?.EnsambleCompleto || false,
            dibujosCount: dibujos.length,
            programasCount: totalProgramas,
            ensamblesCount: ensambles[0].total,
            drawingsWithoutPrograms,
            programasTotal: totalProgs,
            programasConMaterial: progsConMaterial,
            programasMaterialOk: progsConfirmados,
            materialesOk
        });
    } catch (error) {
        console.error('Error al obtener estado del bloque:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
 
// PUT /bloquesUpdateDibujosStatus/:noParte - Marcar dibujos como completos/incompletos (solo admin)
app.put('/bloquesUpdateDibujosStatus/:noParte', async (req, res) => {
    try {
        const { noParte } = req.params;
        const { UsuarioId } = req.body;
 
        // Validar admin
        const [userCheck] = await pool.query('SELECT RolId FROM usuarios WHERE NoEmpleado = ?', [UsuarioId]);
        if (userCheck.length === 0 || userCheck[0].RolId !== 1) {
            return res.status(403).json({ error: 'Only administrators can mark drawings as complete' });
        }
 
        // Validar que existan dibujos
        const [dibujos] = await pool.query('SELECT COUNT(*) as total FROM dibujos_bloques WHERE BloqueId = ?', [noParte]);
        if (dibujos[0].total === 0) {
            return res.status(400).json({ error: 'No drawings uploaded for this block' });
        }
 
        // Obtener estado actual
        const [current] = await pool.query('SELECT DibujosCompleto FROM bloques WHERE NoParte = ?', [noParte]);
        const nuevoValor = !current[0]?.DibujosCompleto;
 
        // Actualizar
        const fechaToggle = getHermosilloDateTime();
        await pool.query(
            `UPDATE bloques SET DibujosCompleto = ?, FechaDibujosCompleto = ? WHERE NoParte = ?`,
            [nuevoValor, nuevoValor ? fechaToggle : null, noParte]
        );

        // Historial: registrar en cada ticket ACTIVO que contenga este bloque
        const [ticketsAfectados] = await pool.query(
            `SELECT DISTINCT td.TicketId FROM tickets_details td
             JOIN tickets t ON t.IdTicket = td.TicketId
             WHERE td.BloqueId = ? AND t.Activo = 1`,
            [noParte]
        );
        const [estadosRowsDib] = await pool.query('SELECT IdEstado, NombreEstado FROM estados');
        const normDib = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        let disenoId = null;
        estadosRowsDib.forEach(e => { if (normDib(e.NombreEstado) === 'DISENO') disenoId = e.IdEstado; });
        for (const t of ticketsAfectados) {
            await pool.query(
                `INSERT INTO ordenes_estados_historial
                 (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
                 VALUES (?, NULL, ?, ?, ?, ?)`,
                [t.TicketId, fechaToggle, UsuarioId,
                 `Block ${noParte}: drawings marked ${nuevoValor ? 'COMPLETE' : 'INCOMPLETE'}`,
                 'bloque']
            );
            // Avance automático a DISEÑO: todos los bloques del ticket con dibujos completos
            if (nuevoValor === true && disenoId !== null) {
                const [fases] = await pool.query(
                    `SELECT b.DibujosCompleto FROM tickets_details td
                     LEFT JOIN bloques b ON b.NoParte = td.BloqueId
                     WHERE td.TicketId = ?`,
                    [t.TicketId]
                );
                const todosDib = fases.length > 0 && fases.every(r => Number(r.DibujosCompleto) === 1);
                if (todosDib) {
                    const [ult] = await pool.query(
                        `SELECT EstadoId, TipoEvento, Comentario FROM ordenes_estados_historial
                         WHERE TicketId = ? ORDER BY IdHistorial DESC LIMIT 1`,
                        [t.TicketId]
                    );
                    const yaAvanzado = ult.length > 0 && ult[0].TipoEvento === 'cambio_estado'
                        && ult[0].EstadoId === disenoId
                        && (ult[0].Comentario || '').startsWith('Avance automático');
                    if (!yaAvanzado) {
                        await pool.query(
                            `INSERT INTO ordenes_estados_historial
                             (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [t.TicketId, disenoId, fechaToggle, UsuarioId,
                             'Avance automático: fase DISEÑO completada', 'cambio_estado']
                        );
                    }
                }
            }
            io.emit('ticketEstadoActualizado', { ticketId: t.TicketId });
        }

        io.emit('bloqueStatusActualizado', { noParte, campo: 'DibujosCompleto', valor: nuevoValor });

        // Campana + historial con QUIÉN lo marcó
        const dibujoMarcadores = await getBlockUserIds(noParte);
        const notifDibujosMarcados = {
            type: 'block_updated',
            title: nuevoValor ? 'Drawings Marked Complete' : 'Drawings Marked Incomplete',
            message: `Block ${noParte}: drawings marked ${nuevoValor ? 'COMPLETE' : 'INCOMPLETE'}`,
            noParte,
            userIds: dibujoMarcadores,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifDibujosMarcados);
        saveNotification({ ...notifDibujosMarcados, referenciaTipo: 'bloque', referenciaId: noParte, emisorId: UsuarioId, targetUserId: UsuarioId });

        res.json({ success: true, DibujosCompleto: nuevoValor, message: nuevoValor ? 'Drawings marked as complete' : 'Drawings marked as incomplete' });
    } catch (error) {
        console.error('Error al actualizar estado de dibujos:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
 
// PUT /bloquesUpdateProgramasStatus/:noParte - Marcar programas como completos/incompletos (solo admin)
app.put('/bloquesUpdateProgramasStatus/:noParte', async (req, res) => {
    try {
        const { noParte } = req.params;
        const { UsuarioId } = req.body;
 
        // Validar admin
        const [userCheck] = await pool.query('SELECT RolId FROM usuarios WHERE NoEmpleado = ?', [UsuarioId]);
        if (userCheck.length === 0 || userCheck[0].RolId !== 1) {
            return res.status(403).json({ error: 'Only administrators can mark programs as complete' });
        }
 
        // Validar que existan dibujos
        const [dibujos] = await pool.query('SELECT IdDibujo, NombreDibujo FROM dibujos_bloques WHERE BloqueId = ?', [noParte]);
        if (dibujos.length === 0) {
            return res.status(400).json({ error: 'Drawings must be uploaded first' });
        }
 
        // Verificar que CADA dibujo tenga al menos 1 programa
        const sinProgramas = [];
        for (const d of dibujos) {
            const [progs] = await pool.query('SELECT COUNT(*) as total FROM programas WHERE DibujoId = ?', [d.IdDibujo]);
            if (progs[0].total === 0) {
                sinProgramas.push(d.NombreDibujo);
            }
        }
        if (sinProgramas.length > 0) {
            return res.status(400).json({ 
                error: `The following drawings have no programs: ${sinProgramas.join(', ')}` 
            });
        }
 
        // Obtener estado actual
        const [current] = await pool.query('SELECT ProgramasCompleto FROM bloques WHERE NoParte = ?', [noParte]);
        const nuevoValor = !current[0]?.ProgramasCompleto;
 
        // Actualizar
        const fechaToggleProg = getHermosilloDateTime();
        await pool.query(
            `UPDATE bloques SET ProgramasCompleto = ?, FechaProgramasCompleto = ? WHERE NoParte = ?`,
            [nuevoValor, nuevoValor ? fechaToggleProg : null, noParte]
        );

        // Historial: registrar en cada ticket ACTIVO que contenga este bloque
        const [ticketsAfectadosProg] = await pool.query(
            `SELECT DISTINCT td.TicketId FROM tickets_details td
             JOIN tickets t ON t.IdTicket = td.TicketId
             WHERE td.BloqueId = ? AND t.Activo = 1`,
            [noParte]
        );
        const [estadosRowsProg] = await pool.query('SELECT IdEstado, NombreEstado FROM estados');
        const normProg = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        let programaId = null;
        estadosRowsProg.forEach(e => { if (normProg(e.NombreEstado) === 'PROGRAMA') programaId = e.IdEstado; });
        for (const t of ticketsAfectadosProg) {
            await pool.query(
                `INSERT INTO ordenes_estados_historial
                 (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
                 VALUES (?, NULL, ?, ?, ?, ?)`,
                [t.TicketId, fechaToggleProg, UsuarioId,
                 `Block ${noParte}: programs marked ${nuevoValor ? 'COMPLETE' : 'INCOMPLETE'}`,
                 'bloque']
            );
            // Avance automático a PROGRAMA: todos los bloques del ticket con programas completos
            if (nuevoValor === true && programaId !== null) {
                const [fases] = await pool.query(
                    `SELECT b.ProgramasCompleto FROM tickets_details td
                     LEFT JOIN bloques b ON b.NoParte = td.BloqueId
                     WHERE td.TicketId = ?`,
                    [t.TicketId]
                );
                const todosProg = fases.length > 0 && fases.every(r => Number(r.ProgramasCompleto) === 1);
                if (todosProg) {
                    const [ult] = await pool.query(
                        `SELECT EstadoId, TipoEvento, Comentario FROM ordenes_estados_historial
                         WHERE TicketId = ? ORDER BY IdHistorial DESC LIMIT 1`,
                        [t.TicketId]
                    );
                    const yaAvanzado = ult.length > 0 && ult[0].TipoEvento === 'cambio_estado'
                        && ult[0].EstadoId === programaId
                        && (ult[0].Comentario || '').startsWith('Avance automático');
                    if (!yaAvanzado) {
                        await pool.query(
                            `INSERT INTO ordenes_estados_historial
                             (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [t.TicketId, programaId, fechaToggleProg, UsuarioId,
                             'Avance automático: fase PROGRAMA completada', 'cambio_estado']
                        );
                    }
                }
            }
            io.emit('ticketEstadoActualizado', { ticketId: t.TicketId });
        }

        io.emit('bloqueStatusActualizado', { noParte, campo: 'ProgramasCompleto', valor: nuevoValor });

        // Campana + historial con QUIÉN lo marcó
        const programaMarcadores = await getBlockUserIds(noParte);
        const notifProgramasMarcados = {
            type: 'block_updated',
            title: nuevoValor ? 'Programs Marked Complete' : 'Programs Marked Incomplete',
            message: `Block ${noParte}: programs marked ${nuevoValor ? 'COMPLETE' : 'INCOMPLETE'}`,
            noParte,
            userIds: programaMarcadores,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifProgramasMarcados);
        saveNotification({ ...notifProgramasMarcados, referenciaTipo: 'bloque', referenciaId: noParte, emisorId: UsuarioId, targetUserId: UsuarioId });

        res.json({ success: true, ProgramasCompleto: nuevoValor, message: nuevoValor ? 'Programs marked as complete' : 'Programs marked as incomplete' });
    } catch (error) {
        console.error('Error al actualizar estado de programas:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
 
// MARCAR UN BLOQUE COMO COMPLETO (solo admin)
app.put('/bloqueMarcarCompleto/:noParte', async (req, res) => {
    try {
        const { noParte } = req.params;
        const { UsuarioId } = req.body;

        // Verificar que el usuario sea admin
        const [userCheck] = await pool.query(
            'SELECT RolId FROM usuarios WHERE NoEmpleado = ?',
            [UsuarioId]
        );

        if (userCheck.length === 0 || userCheck[0].RolId !== 1) {
            return res.status(403).json({ error: 'Only administrators can mark blocks as complete' });
        }

        // Verificar si el bloque existe
        const [bloqueCheck] = await pool.query(
            'SELECT NoParte FROM bloques WHERE NoParte = ?',
            [noParte]
        );

        if (bloqueCheck.length === 0) {
            return res.status(404).json({ error: 'Block not found' });
        }

        // Marcar el bloque como completo (podrías agregar un campo "Completo" en la tabla bloques)
        await pool.query(
            'UPDATE bloques SET Completo = 1, FechaCompletado = NOW() WHERE NoParte = ?',
            [noParte]
        );

        io.emit('bloqueCompletado', { noParte });

        res.json({
            success: true,
            message: 'Block marked as complete'
        });
    } catch (error) {
        console.error('Error al marcar bloque como completo:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET TICKETS con estados
app.get('/ticketsSelect', async (req, res) => {
    try {
        const { papelera, completados, todos, usuarioId, area, prioridad, search, fecha } = req.query;

        let query = `
            SELECT 
                t.IdTicket,
                t.SolicitanteId,
                t.FechaSolicitacion,
                t.FechaDeseada,
                t.FechaEstimada,
                t.FechaEntrega,
                t.PrioridadId,
                t.EstadoId,
                t.Descripcion,
                t.Activo,
                t.FechaCierre,
                t.CerradoPor,
                t.ComentarioCierre,
                t.FechaEliminacion,
                p.Prioridad as PrioridadNombre,
                e.NombreEstado,
                e.Orden as EstadoOrden,
                u.Nombre as SolicitanteNombre,
                u.AreaId,
                a.NombreArea,
                DATE_FORMAT(t.FechaSolicitacion, '%d/%m/%Y') as FechaSolicitacionFormateada,
                DATE_FORMAT(t.FechaDeseada, '%d/%m/%Y') as FechaDeseadaFormateada,
                DATE_FORMAT(t.FechaEstimada, '%d/%m/%Y') as FechaEstimadaFormateada,
                DATE_FORMAT(t.FechaEntrega, '%d/%m/%Y') as FechaEntregaFormateada,
                DATE_FORMAT(t.FechaCierre, '%d/%m/%Y %H:%i') as FechaCierreFormateada
            FROM tickets t
            LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
            LEFT JOIN prioridades p ON t.PrioridadId = p.IdPrioridad
            LEFT JOIN areas a ON u.AreaId = a.IdArea
            LEFT JOIN estados e ON t.EstadoId = e.IdEstado
            WHERE 1=1
        `;

        const params = [];

        // ✅ Si viene 'todos', NO filtramos por estado
        if (todos !== 'true') {
            // ✅ Manejar los diferentes modos de visualización
            if (papelera === 'true') {
                // Papelera: solo tickets inactivos
                query += ` AND t.Activo = 0`;
            } else if (completados === 'true') {
                // Completados: tickets activos con estado COMPLETO o ENTREGADO
                query += ` AND t.Activo = 1`;
                query += ` AND e.NombreEstado IN ('COMPLETO', 'ENTREGADO')`;
            } else {
                // Activos: tickets activos que NO están completados
                query += ` AND t.Activo = 1`;
                query += ` AND e.NombreEstado NOT IN ('COMPLETO', 'ENTREGADO')`;
            }
        }

        if (usuarioId) {
            query += ` AND t.SolicitanteId = ?`;
            params.push(usuarioId);
        }

        if (area && area !== 'All') {
            query += ` AND u.AreaId = ?`;
            params.push(area);
        }

        if (prioridad && prioridad !== 'All') {
            query += ` AND p.Prioridad = ?`;
            params.push(prioridad);
        }

        if (search) {
            query += ` AND (t.Descripcion LIKE ? OR u.Nombre LIKE ? OR t.IdTicket LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, `%${search}%`);
        }

        if (fecha) {
            query += ` AND DATE(t.FechaSolicitacion) = ?`;
            params.push(fecha);
        }

        // ✅ ORDEN: CRITICA (4) primero, luego ALTA (3), MEDIA (2), BAJA (1)
        // ✅ Dentro de cada prioridad, los más recientes primero
        query += ` ORDER BY t.PrioridadId DESC, t.FechaSolicitacion DESC`;

        const [tickets] = await pool.query(query, params);

        const ticketsWithDetails = await Promise.all(
            tickets.map(async (ticket) => {
                const [detalles] = await pool.query(
                    `SELECT
                        td.IdTicketDetail,
                        td.BloqueId,
                        td.Cantidad,
                        b.NoParte,
                        tc.TipoConector,
                        (SELECT COALESCE(SUM(ap.Cantidad), 0) FROM bloque_apartados ap
                         WHERE ap.TicketId = td.TicketId AND ap.BloqueId = td.BloqueId) AS Apartado
                    FROM tickets_details td
                    LEFT JOIN bloques b ON td.BloqueId = b.NoParte
                    LEFT JOIN tipo_conector tc ON b.TipoConectorId = tc.IdTipoConector
                    WHERE td.TicketId = ?`,
                    [ticket.IdTicket]
                );

                return {
                    ...ticket,
                    Detalles: detalles || []
                };
            })
        );

        res.json(ticketsWithDetails);
    } catch (error) {
        console.error('Error al obtener tickets:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET TICKETS COMPLETADOS (alternativa)
app.get('/ticketsCompletados', async (req, res) => {
    try {
        const query = `
            SELECT 
                t.IdTicket,
                t.SolicitanteId,
                t.FechaSolicitacion,
                t.FechaDeseada,
                t.FechaEstimada,
                t.FechaEntrega,
                t.PrioridadId,
                t.EstadoId,
                t.Descripcion,
                t.Activo,
                t.FechaCierre,
                t.CerradoPor,
                t.ComentarioCierre,
                p.Prioridad as PrioridadNombre,
                e.NombreEstado,
                e.Orden as EstadoOrden,
                u.Nombre as SolicitanteNombre,
                u.AreaId,
                a.NombreArea,
                DATE_FORMAT(t.FechaSolicitacion, '%d/%m/%Y') as FechaSolicitacionFormateada,
                DATE_FORMAT(t.FechaDeseada, '%d/%m/%Y') as FechaDeseadaFormateada,
                DATE_FORMAT(t.FechaEstimada, '%d/%m/%Y') as FechaEstimadaFormateada,
                DATE_FORMAT(t.FechaEntrega, '%d/%m/%Y') as FechaEntregaFormateada,
                DATE_FORMAT(t.FechaCierre, '%d/%m/%Y ') as FechaCierreFormateada
            FROM tickets t
            LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
            LEFT JOIN prioridades p ON t.PrioridadId = p.IdPrioridad
            LEFT JOIN areas a ON u.AreaId = a.IdArea
            LEFT JOIN estados e ON t.EstadoId = e.IdEstado
            WHERE t.Activo = 1 
            AND e.NombreEstado IN ('COMPLETO', 'ENTREGADO')
            ORDER BY t.FechaCierre DESC
        `;

        const [tickets] = await pool.query(query);

        const ticketsWithDetails = await Promise.all(
            tickets.map(async (ticket) => {
                const [detalles] = await pool.query(
                    `SELECT
                        td.IdTicketDetail,
                        td.BloqueId,
                        td.Cantidad,
                        b.NoParte,
                        tc.TipoConector,
                        (SELECT COALESCE(SUM(ap.Cantidad), 0) FROM bloque_apartados ap
                         WHERE ap.TicketId = td.TicketId AND ap.BloqueId = td.BloqueId) AS Apartado
                    FROM tickets_details td
                    LEFT JOIN bloques b ON td.BloqueId = b.NoParte
                    LEFT JOIN tipo_conector tc ON b.TipoConectorId = tc.IdTipoConector
                    WHERE td.TicketId = ?`,
                    [ticket.IdTicket]
                );

                return {
                    ...ticket,
                    Detalles: detalles || []
                };
            })
        );

        res.json(ticketsWithDetails);
    } catch (error) {
        console.error('Error al obtener tickets completados:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/ticketsCheckCritico/:areaId', async (req, res) => {
    try {
        const { areaId } = req.params;

        // Obtener el ID del estado "COMPLETO"
        const [estadoCompleto] = await pool.query(
            'SELECT IdEstado FROM estados WHERE NombreEstado = ?',
            ['COMPLETO']
        );

        const estadoCompletoId = estadoCompleto.length > 0 ? estadoCompleto[0].IdEstado : 7;

        const [rows] = await pool.query(
            `SELECT COUNT(*) as total 
             FROM tickets t
             LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
             WHERE u.AreaId = ? 
             AND t.PrioridadId = 4 
             AND t.EstadoId != ?
             AND t.Activo = 1`,
            [areaId, estadoCompletoId]
        );

        res.json({
            tieneCritico: rows[0].total > 0,
            total: rows[0].total
        });
    } catch (error) {
        console.error('Error al verificar ticket crítico:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// READINESS PARA CIERRE: indica si el ticket ya se puede cerrar (no bloquea).
// Revisa ensambles listos, programas con material + Mats ✓, y apartados pendientes.
app.get('/ticketListoParaCierre/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [tick] = await pool.query('SELECT IdTicket FROM tickets WHERE IdTicket = ?', [id]);
        if (tick.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        const [dets] = await pool.query('SELECT BloqueId, Cantidad FROM tickets_details WHERE TicketId = ?', [id]);
        const checks = [];
        let todoOk = true;
        if (dets.length === 0) {
            checks.push({ clave: 'bloques', etiqueta: 'Bloques en el ticket', ok: false, detalle: 'sin bloques' });
            todoOk = false;
        } else {
            // 1. Ensambles de todos los bloques
            const [ens] = await pool.query(
                `SELECT td.BloqueId, COALESCE(MAX(b.EnsambleCompleto), 0) AS okEns
                 FROM tickets_details td
                 LEFT JOIN bloques b ON b.NoParte = td.BloqueId
                 WHERE td.TicketId = ?
                 GROUP BY td.BloqueId`,
                [id]
            );
            const faltanEns = ens.filter(e => Number(e.okEns) !== 1).map(e => e.BloqueId);
            checks.push({
                clave: 'ensambles',
                etiqueta: 'Ensambles completos',
                ok: faltanEns.length === 0,
                detalle: faltanEns.length === 0 ? `${ens.length} bloque(s) OK` : `faltan: ${faltanEns.join(', ')}`
            });
            if (faltanEns.length > 0) todoOk = false;
            // 2. Programas con material + Mats ✓
            const [progs] = await pool.query(
                `SELECT DISTINCT p.IdPrograma, COALESCE(p.MaterialesCompleto, 0) AS flag,
                        (SELECT COUNT(*) FROM programa_materiales pm WHERE pm.ProgramaId = p.IdPrograma) AS recetas
                 FROM programas p
                 LEFT JOIN dibujos_bloques d ON d.IdDibujo = p.DibujoId
                 JOIN tickets_details td ON td.BloqueId = p.BloqueId OR td.BloqueId = d.BloqueId
                 WHERE td.TicketId = ?`,
                [id]
            );
            if (progs.length === 0) {
                checks.push({ clave: 'programas', etiqueta: 'Programas con material', ok: false, detalle: 'sin programas' });
                todoOk = false;
            } else {
                const sinMat = progs.filter(p => Number(p.recetas) === 0).length;
                const sinFlag = progs.filter(p => Number(p.flag) !== 1).length;
                const okProg = sinMat === 0 && sinFlag === 0;
                checks.push({
                    clave: 'programas',
                    etiqueta: 'Materiales en programas (Mats ✓)',
                    ok: okProg,
                    detalle: okProg
                        ? `${progs.length} programa(s) OK`
                        : `${sinMat > 0 ? `${sinMat} sin material` : ''}${sinMat > 0 && sinFlag > 0 ? ' · ' : ''}${sinFlag > 0 ? `${sinFlag} sin confirmar` : ''}`
                });
                if (!okProg) todoOk = false;
            }
        }
        // 3. Apartados pendientes (informativo)
        const [ap] = await pool.query(
            'SELECT COALESCE(SUM(Cantidad), 0) AS total FROM bloque_apartados WHERE TicketId = ?',
            [id]
        );
        const apartados = Number(ap[0].total) || 0;
        checks.push({
            clave: 'apartados',
            etiqueta: 'Piezas apartadas',
            ok: true,
            detalle: apartados > 0 ? `${apartados} reservada(s) (se consumen al entregar)` : 'sin apartados'
        });
        res.json({ listo: todoOk, checks });
    } catch (error) {
        console.error('Error al verificar cierre:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// CERRAR TICKET (usando EstadoId en lugar de string)
app.put('/ticketsCerrar/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { CerradoPor, ComentarioCierre } = req.body;

        // Verificar que el usuario tenga permisos (admin)
        const [userCheck] = await pool.query(
            'SELECT RolId FROM usuarios WHERE NoEmpleado = ?',
            [CerradoPor]
        );

        if (userCheck.length === 0 || userCheck[0].RolId !== 1) {
            return res.status(403).json({ error: 'You do not have permission to close tickets' });
        }

        // VALIDACIÓN: Verificar que todos los bloques del ticket tengan EnsambleCompleto
        const [bloquesTicket] = await pool.query(
            'SELECT BloqueId FROM tickets_details WHERE TicketId = ?',
            [id]
        );
        
        if (bloquesTicket.length === 0) {
            return res.status(400).json({ 
                error: 'Ticket has no associated blocks' 
            });
        }
        
        // Verificar que cada bloque tenga EnsambleCompleto
        for (const bloque of bloquesTicket) {
            const [bloqueStatus] = await pool.query(
                'SELECT EnsambleCompleto FROM bloques WHERE NoParte = ?',
                [bloque.BloqueId]
            );
            
            if (bloqueStatus.length === 0) {
                return res.status(400).json({ 
                    error: `Block ${bloque.BloqueId} does not exist` 
                });
            }
            
            if (!bloqueStatus[0].EnsambleCompleto) {
                return res.status(400).json({ 
                    error: `Block ${bloque.BloqueId} does not have a complete Ensemble. You must upload the ensemble before closing.` 
                });
            }
        }

        // Obtener el ID del estado "COMPLETO"
        const [estadoCompleto] = await pool.query(
            'SELECT IdEstado FROM estados WHERE NombreEstado = ?',
            ['COMPLETO']
        );

        if (estadoCompleto.length === 0) {
            return res.status(500).json({ error: 'Status "COMPLETO" not found' });
        }

        const now = new Date();
        const hermosilloTime = new Date(now.getTime() - (7 * 60 * 60 * 1000));
        const fechaCierre = hermosilloTime.toISOString().slice(0, 19).replace('T', ' ');

        const [result] = await pool.query(
            `UPDATE tickets 
             SET EstadoId = ?, 
                 FechaCierre = ?, 
                 CerradoPor = ?,
                 ComentarioCierre = ?
             WHERE IdTicket = ? AND Activo = 1`,
            [estadoCompleto[0].IdEstado, fechaCierre, CerradoPor, ComentarioCierre, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Obtener el solicitante del ticket para notificarle
        const [ticketInfo] = await pool.query(
            'SELECT SolicitanteId, Descripcion FROM tickets WHERE IdTicket = ?',
            [id]
        );

        // Insertar en historial
        await pool.query(
            `INSERT INTO ordenes_estados_historial
             (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, estadoCompleto[0].IdEstado, fechaCierre, CerradoPor, ComentarioCierre || 'Ticket cerrado', 'cierre']
        );

        io.emit('ticketsActualizados');
        
        // Notificar al creador del ticket si no es quien lo cerró
        if (ticketInfo.length > 0 && ticketInfo[0].SolicitanteId !== CerradoPor) {
            const notifTicketCompleted = {
                type: 'ticket_completed',
                title: 'Your Ticket Has Been Completed',
                message: `Ticket #${id} has been marked as COMPLETE`,
                ticketId: id,
                targetUserId: ticketInfo[0].SolicitanteId,
                solicitanteId: ticketInfo[0].SolicitanteId,
                userIds: [ticketInfo[0].SolicitanteId],
                timestamp: getHermosilloDateTime()
            };
            io.emit('notification', notifTicketCompleted);
            saveNotification({ ...notifTicketCompleted, referenciaTipo: 'ticket', referenciaId: id, emisorId: CerradoPor, targetUserId: ticketInfo[0].SolicitanteId });
        }

        res.json({
            success: true,
            message: 'Ticket closed successfully'
        });
    } catch (error) {
        console.error('Error al cerrar ticket:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// RESTAURAR TICKET DE PAPELERA
app.put('/ticketsRestaurar/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `UPDATE tickets 
             SET Activo = 1, FechaEliminacion = NULL
             WHERE IdTicket = ? AND Activo = 0`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ticket not found in trash' });
        }

        // Historial: ticket restaurado
        const restauradoPor = req.body?.UsuarioId ?? null;
        await pool.query(
            `INSERT INTO ordenes_estados_historial
             (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
             VALUES (?, NULL, ?, ?, ?, ?)`,
            [id, getHermosilloDateTime(), restauradoPor, 'Ticket restaurado de papelera', 'restaurar']
        );

        io.emit('ticketsActualizados');
        io.emit('ticketEstadoActualizado', { ticketId: id });

        res.json({
            success: true,
            message: 'Ticket restored successfully'
        });
    } catch (error) {
        console.error('Error al restaurar ticket:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET TICKET BY ID
app.get('/ticketsSelect/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Obtener el ticket con el nombre de la prioridad
        const [tickets] = await pool.query(
            `SELECT 
                t.IdTicket,
                t.SolicitanteId,
                t.FechaSolicitacion,
                t.FechaDeseada,
                t.FechaEstimada,
                t.FechaEntrega,
                t.PrioridadId,
                p.Prioridad as PrioridadNombre,
                t.Descripcion,
                u.Nombre as SolicitanteNombre,
                DATE_FORMAT(t.FechaSolicitacion, '%d/%m/%Y') as FechaSolicitacionFormateada,
                DATE_FORMAT(t.FechaDeseada, '%d/%m/%Y') as FechaDeseadaFormateada,
                DATE_FORMAT(t.FechaEstimada, '%d/%m/%Y') as FechaEstimadaFormateada,
                DATE_FORMAT(t.FechaEntrega, '%d/%m/%Y') as FechaEntregaFormateada
            FROM tickets t
            LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
            LEFT JOIN prioridades p ON t.PrioridadId = p.IdPrioridad
            WHERE t.IdTicket = ?`,
            [id]
        );

        if (tickets.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // 2. Obtener los detalles del ticket
        const [detalles] = await pool.query(
            `SELECT
                td.IdTicketDetail,
                td.BloqueId,
                td.Cantidad,
                b.NoParte,
                tc.TipoConector,
                (SELECT COALESCE(SUM(ap.Cantidad), 0) FROM bloque_apartados ap
                 WHERE ap.TicketId = td.TicketId AND ap.BloqueId = td.BloqueId) AS Apartado
            FROM tickets_details td
            LEFT JOIN bloques b ON td.BloqueId = b.NoParte
            LEFT JOIN tipo_conector tc ON b.TipoConectorId = tc.IdTipoConector
            WHERE td.TicketId = ?`,
            [id]
        );

        const ticketWithDetails = {
            ...tickets[0],
            Detalles: detalles || []
        };

        res.json(ticketWithDetails);
    } catch (error) {
        console.error('Error al obtener ticket:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*Mover a  papelera*/
app.put('/ticketsDeleteSoft/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const now = new Date();
        const hermosilloTime = new Date(now.getTime() - (7 * 60 * 60 * 1000));
        const fechaEliminacion = hermosilloTime.toISOString().slice(0, 19).replace('T', ' ');

        const [result] = await pool.query(
            `UPDATE tickets
             SET Activo = 0, FechaEliminacion = ?
             WHERE IdTicket = ?`,
            [fechaEliminacion, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Historial: ticket movido a papelera (FIX: CerradoPor no existía en este scope)
        const eliminadoPor = req.body?.UsuarioId ?? null;
        await pool.query(
            `INSERT INTO ordenes_estados_historial
             (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
             VALUES (?, NULL, ?, ?, ?, ?)`,
            [id, fechaEliminacion, eliminadoPor, 'Ticket movido a papelera', 'papelera']
        );

        // Inventario blocks: liberar lo apartado (vuelve a disponible)
        await liberarApartadosTicket((sql, params) => pool.query(sql, params), id, eliminadoPor);

        io.emit('ticketsActualizados');
        io.emit('ticketEstadoActualizado', { ticketId: id });
        const solicitanteTrash = await getTicketSolicitante(id);
        const notifTicketTrashed = {
            type: 'ticket_trashed',
            title: 'Ticket to Trash',
            message: `Ticket #${id} moved to trash`,
            ticketId: id,
            solicitanteId: solicitanteTrash,
            userIds: solicitanteTrash ? [solicitanteTrash] : [],
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifTicketTrashed);
        saveNotification({ ...notifTicketTrashed, referenciaTipo: 'ticket', referenciaId: id, emisorId: eliminadoPor, targetUserId: eliminadoPor });

        res.json({
            success: true,
            message: 'Ticket moved to trash successfully'
        });
    } catch (error) {
        console.error('Error al mover ticket a papelera:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/*!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!DELETES!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/
/*---------------------------------------------------BLOCKSDELETE---------------------------------------------------*/
app.delete('/blocksDelete/:NoParte', async (req, res) => {
    const { NoParte } = req.params;

    if (!NoParte) {
        return res.status(400).json({ error: 'Invalid block ID' });
    }

    try {
        const [existingBLock] = await pool.query(
            'SELECT NoParte FROM bloques WHERE NoParte = ?',
            [NoParte]
        );
        if (existingBLock.length === 0) {
            return res.status(404).json({ error: 'Block not found' });
        }

        const [result] = await pool.query(
            'DELETE FROM bloques WHERE NoParte = ?',
            [NoParte]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Block not found' });
        }

        io.emit("bloquesActualizados");
        const bloqueDuenosDel = await getBlockUserIds(NoParte);
        const notifBlockDeleted = {
            type: 'block_deleted',
            title: 'Block Deleted',
            message: `Block ${NoParte} deleted`,
            noParte: NoParte,
            userIds: bloqueDuenosDel,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifBlockDeleted);
        saveNotification({ ...notifBlockDeleted, referenciaTipo: 'bloque', referenciaId: NoParte, emisorId: req.body?.UsuarioId || null, targetUserId: req.body?.UsuarioId || null });

        res.json({
            success: true,
            message: 'Block deleted successfully',
            NoParte: NoParte
        });
    } catch (error) {
        console.error('Error al eliminar bloque:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/*---------------------------------------------------DIBUJOS---------------------------------------------------*/
app.delete('/dibujosDelete/:IdDibujo', async (req, res) => {
    const { IdDibujo } = req.params;

    if (!IdDibujo) {
        return res.status(400).json({ error: 'Invalid drawing ID' });
    }

    try {
        const [existingDrawing] = await pool.query(
            'SELECT IdDibujo, BloqueId FROM dibujos_bloques WHERE IdDibujo = ?',
            [IdDibujo]
        );
        if (existingDrawing.length === 0) {
            return res.status(404).json({ error: 'Drawing not found' });
        }
        const bloqueDelDibujo = existingDrawing[0].BloqueId;

        // VALIDACIÓN: Verificar si el dibujo tiene programas asociados
        const [programas] = await pool.query(
            'SELECT COUNT(*) as total FROM programas WHERE DibujoId = ?',
            [IdDibujo]
        );

        if (programas[0].total > 0) {
            return res.status(400).json({ 
                error: `Cannot delete drawing. It has ${programas[0].total} associated program(s). Delete the programs first.`
            });
        }

        const [result] = await pool.query(
            'DELETE FROM dibujos_bloques WHERE IdDibujo = ?',
            [IdDibujo]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Drawing not found' });
        }

        io.emit('dibujosActualizados');
        const dibujoDuenos = await getBlockUserIds(bloqueDelDibujo);
        const notifDrawingDeleted = {
            type: 'drawing_deleted',
            title: 'Drawing Deleted',
            message: `Drawing deleted`,
            dibujoId: IdDibujo,
            bloqueId: bloqueDelDibujo,
            userIds: dibujoDuenos,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifDrawingDeleted);
        saveNotification({ ...notifDrawingDeleted, referenciaTipo: 'dibujo', referenciaId: IdDibujo, emisorId: req.body?.UsuarioId || null, targetUserId: req.body?.UsuarioId || null });

        res.json({
            success: true,
            message: 'Drawing deleted successfully',
            IdDibujo: IdDibujo
        });
    } catch (error) {
        console.error('Error al eliminar dibujo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/*---------------------------------------------------PROGRAMAS---------------------------------------------------*/
app.delete('/programasDelete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            'SELECT RutaPrograma, DibujoId FROM programas WHERE IdPrograma = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Program not found' });
        }
        const bloqueDelPrograma = await getDibujoBloque(rows[0].DibujoId);

        // Eliminar archivo físico
        if (rows[0].RutaPrograma) {
            const filePath = path.join(__dirname, 'uploads/programas/', rows[0].RutaPrograma);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await pool.query('DELETE FROM programas WHERE IdPrograma = ?', [id]);

        io.emit('programasActualizados');
        const programaDuenos = await getBlockUserIds(bloqueDelPrograma);
        const notifProgramDeleted = {
            type: 'program_deleted',
            title: 'Program Deleted',
            message: `Program deleted`,
            programaId: id,
            bloqueId: bloqueDelPrograma,
            userIds: programaDuenos,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifProgramDeleted);
        saveNotification({ ...notifProgramDeleted, referenciaTipo: 'programa', referenciaId: id, emisorId: req.body?.UsuarioId || null, targetUserId: req.body?.UsuarioId || null });

        res.json({
            success: true,
            message: 'Program deleted successfully'
        });
    } catch (error) {
        console.error('Error al eliminar programa:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/*---------------------------------------------------ENSAMBLES---------------------------------------------------*/
app.delete('/ensamblesDelete/:id', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
        const { id } = req.params;

        // Obtener info del ensemble antes de borrar
        const [rows] = await connection.query(
            'SELECT RutaEnsamble, BloqueId FROM ensambles WHERE IdEnsamble = ?',
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Ensemble not found' });
        }

        const { RutaEnsamble, BloqueId } = rows[0];

        // Eliminar archivo físico
        if (RutaEnsamble) {
            const filePath = path.join(__dirname, 'uploads/ensambles/', RutaEnsamble);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Eliminar de BD
        await connection.query('DELETE FROM ensambles WHERE IdEnsamble = ?', [id]);

        // Verificar si quedan ensambles para este bloque
        const [remaining] = await connection.query(
            'SELECT COUNT(*) as total FROM ensambles WHERE BloqueId = ?',
            [BloqueId]
        );

        // Si no quedan, actualizar EnsambleCompleto = 0
        if (remaining[0].total === 0) {
            await connection.query(
                `UPDATE bloques SET EnsambleCompleto = 0, FechaEnsambleCompleto = NULL WHERE NoParte = ?`,
                [BloqueId]
            );
            io.emit('bloqueStatusActualizado', { noParte: BloqueId, campo: 'EnsambleCompleto', valor: false });
        }

        await connection.commit();
        connection.release();

        io.emit('ensamblesActualizados');
        const ensembleDuenos = await getBlockUserIds(BloqueId);
        const notifEnsembleDeleted = {
            type: 'ensemble_deleted',
            title: 'Ensemble Deleted',
            message: `Ensemble deleted`,
            ensembleId: id,
            bloqueId: BloqueId,
            userIds: ensembleDuenos,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifEnsembleDeleted);
        saveNotification({ ...notifEnsembleDeleted, referenciaTipo: 'ensamble', referenciaId: id, emisorId: req.body?.UsuarioId || null });

        res.json({
            success: true,
            message: 'Ensemble deleted successfully'
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error al eliminar ensemble:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------DESCARGAR PROGRAMA---------------------------------------------------*/
app.get('/programasDownload/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener el programa de la base de datos
        const [rows] = await pool.query(
            'SELECT RutaPrograma, NumeroOperacion FROM programas WHERE IdPrograma = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Program not found' });
        }

        const programa = rows[0];
        const filePath = path.join(__dirname, 'uploads/programas/', programa.RutaPrograma);

        // Verificar si el archivo existe
        try {
            await fsp.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: 'File not found' });
        }

        // ✅ Obtener la extensión del archivo original
        const extension = path.extname(programa.RutaPrograma || '');

        // ✅ Crear el nombre de descarga con la extensión
        const nombreBase = programa.NumeroOperacion || 'programa';
        const nombreDescarga = nombreBase + extension;

        console.log('📥 Descargando como:', nombreDescarga);
        console.log('📁 Archivo original:', programa.RutaPrograma);

        // ✅ Descargar con el nombre que incluye la extensión
        res.download(filePath, nombreDescarga, (err) => {
            if (err) {
                console.error('Error al descargar programa:', err);
                res.status(500).json({ error: 'Error downloading program' });
            }
        });

    } catch (error) {
        console.error('Error al descargar programa:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/*---------------------------------------------------DESCARGAR PROGRAMA---------------------------------------------------*/
app.delete('/ticketsDeletePermanente/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Solicitante antes de borrar (para avisarle al dueño)
            const solicitanteDel = await getTicketSolicitante(id);

            // Eliminar detalles
            await connection.query('DELETE FROM tickets_details WHERE TicketId = ?', [id]);

            // Eliminar apartados (el kardex de movimientos se conserva como auditoría)
            await connection.query('DELETE FROM bloque_apartados WHERE TicketId = ?', [id]);

            // Eliminar historial (evita filas huérfanas)
            await connection.query('DELETE FROM ordenes_estados_historial WHERE TicketId = ?', [id]);

            // Eliminar ticket
            const [result] = await connection.query('DELETE FROM tickets WHERE IdTicket = ?', [id]);

            if (result.affectedRows === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Ticket not found' });
            }

await connection.commit();
            connection.release();

            io.emit('ticketsActualizados');
            const eliminadoPor = req.body?.UsuarioId ?? null;
            const notifTicketDeleted = {
                type: 'ticket_deleted',
                title: 'Ticket Permanently Deleted',
                message: `Ticket #${id} permanently deleted`,
                ticketId: id,
                solicitanteId: solicitanteDel,
                userIds: solicitanteDel ? [solicitanteDel] : [],
                timestamp: getHermosilloDateTime()
            };
            io.emit('notification', notifTicketDeleted);
            saveNotification({ ...notifTicketDeleted, referenciaTipo: 'ticket', referenciaId: id, emisorId: eliminadoPor, targetUserId: eliminadoPor });

            res.json({
                success: true,
                message: 'Ticket permanently deleted'
            });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('Error al eliminar ticket:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
/*---------------------------------------------------DESCARGAR ENSAMBLE---------------------------------------------------*/

// DOWNLOAD ENSAMBLE
app.get('/ensamblesDownload/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            'SELECT RutaEnsamble, NombreEnsamble FROM ensambles WHERE IdEnsamble = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Ensemble not found' });
        }

        const ensemble = rows[0];
        const filePath = path.join(__dirname, 'uploads/ensambles/', ensemble.RutaEnsamble);

        try {
            await fsp.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: 'File not found' });
        }

        const extension = path.extname(ensemble.RutaEnsamble || '');
        const nombreBase = ensemble.NombreEnsamble || 'ensemble';
        const nombreDescarga = nombreBase + extension;

        res.download(filePath, nombreDescarga, (err) => {
            if (err) {
                console.error('Error al descargar ensemble:', err);
                res.status(500).json({ error: 'Error downloading ensemble' });
            }
        });

    } catch (error) {
        console.error('Error al descargar ensemble:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
// =============================================
// VER ARCHIVO EN EL NAVEGADOR (previsualización)
// Sirve imágenes/PDF inline y archivos de texto/código como text/plain.
// Solo carpetas permitidas y nombre sanitizado (anti path-traversal).
// =============================================
app.get('/archivosVer/:tipo/:archivo', async (req, res) => {
    try {
        const { tipo, archivo } = req.params;

        const carpetas = {
            dibujos: 'uploads/dibujos',
            programas: 'uploads/programas',
            ensambles: 'uploads/ensambles',
            bloques: 'uploads/bloques'
        };

        if (!carpetas[tipo]) {
            return res.status(404).json({ error: 'Invalid file type' });
        }

        const nombre = path.basename(String(archivo || ''));
        if (!nombre || nombre.startsWith('.')) {
            return res.status(400).json({ error: 'Invalid file name' });
        }

        const filePath = path.join(__dirname, carpetas[tipo], nombre);

        try {
            await fsp.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: 'File not found' });
        }

        const ext = path.extname(nombre).toLowerCase();
        const comoTexto = ['.txt', '.nc', '.cnc', '.mcam', '.tap', '.mpf', '.cnc'];
        if (comoTexto.includes(ext)) {
            res.type('text/plain; charset=utf-8');
        }

        res.sendFile(filePath);
    } catch (error) {
        console.error('Error al servir archivo:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// =============================================
// METRICS ENDPOINTS PARA DASHBOARD
// =============================================

// Tickets terminados por mes
app.get('/metrics/ticketsCompletedByMonth', async (req, res) => {
    try {
        const { areaId, year } = req.query;
        
        let query = `
            SELECT 
                MONTH(t.FechaCierre) as mes,
                MONTHNAME(t.FechaCierre) as mesNombre,
                COUNT(*) as total
            FROM tickets t
            LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
            WHERE t.Activo = 1 
            AND t.FechaCierre IS NOT NULL
            AND YEAR(t.FechaCierre) = COALESCE(?, YEAR(NOW()))
        `;
        const params = [year || null];

        if (areaId) {
            query += ` AND u.AreaId = ?`;
            params.push(areaId);
        }

        query += ` GROUP BY MONTH(t.FechaCierre), MONTHNAME(t.FechaCierre) ORDER BY mes`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error en ticketsCompletedByMonth:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Tickets terminados por semana (últimas 12 semanas)
app.get('/metrics/ticketsCompletedByWeek', async (req, res) => {
    try {
        const { areaId } = req.query;
        
        let query = `
            SELECT 
                YEARWEEK(t.FechaCierre, 1) as semana,
                CONCAT('Semana ', WEEK(t.FechaCierre, 1)) as semanaNombre,
                COUNT(*) as total
            FROM tickets t
            LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
            WHERE t.Activo = 1 
            AND t.FechaCierre IS NOT NULL
            AND t.FechaCierre >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
        `;
        const params = [];

        if (areaId) {
            query += ` AND u.AreaId = ?`;
            params.push(areaId);
        }

        query += ` GROUP BY YEARWEEK(t.FechaCierre, 1), WEEK(t.FechaCierre, 1) ORDER BY semana DESC LIMIT 12`;

        const [rows] = await pool.query(query, params);
        res.json(rows.reverse());
    } catch (error) {
        console.error('Error en ticketsCompletedByWeek:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Tickets en proceso (no COMPLETO ni ENTREGADO)
app.get('/metrics/ticketsInProgress', async (req, res) => {
    try {
        const { areaId } = req.query;
        
        let query = `
            SELECT 
                t.IdTicket,
                t.Descripcion,
                t.FechaSolicitacion,
                t.FechaDeseada,
                t.PrioridadId,
                p.Prioridad as PrioridadNombre,
                t.EstadoId,
                e.NombreEstado,
                e.Orden,
                u.Nombre as SolicitanteNombre,
                u.AreaId,
                a.NombreArea,
                DATEDIFF(t.FechaDeseada, NOW()) as diasRestantes
            FROM tickets t
            LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
            LEFT JOIN prioridades p ON t.PrioridadId = p.IdPrioridad
            LEFT JOIN areas a ON u.AreaId = a.IdArea
            LEFT JOIN estados e ON t.EstadoId = e.IdEstado
            WHERE t.Activo = 1 
            AND e.NombreEstado NOT IN ('COMPLETO', 'ENTREGADO')
        `;
        const params = [];

        if (areaId) {
            query += ` AND u.AreaId = ?`;
            params.push(areaId);
        }

        query += ` ORDER BY t.FechaDeseada ASC`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error en ticketsInProgress:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Resumen de tickets por estado
app.get('/metrics/ticketsByStatus', async (req, res) => {
    try {
        const { areaId } = req.query;
        
        let query = `
            SELECT 
                e.NombreEstado,
                e.Orden,
                COUNT(*) as total
            FROM tickets t
            LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
            LEFT JOIN estados e ON t.EstadoId = e.IdEstado
            WHERE t.Activo = 1
        `;
        const params = [];

        if (areaId) {
            query += ` AND u.AreaId = ?`;
            params.push(areaId);
        }

        query += ` GROUP BY e.NombreEstado, e.Orden ORDER BY e.Orden`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error en ticketsByStatus:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Tickets por prioridad
app.get('/metrics/ticketsByPriority', async (req, res) => {
    try {
        const { areaId } = req.query;
        
        let query = `
            SELECT 
                p.Prioridad as PrioridadNombre,
                COUNT(*) as total
            FROM tickets t
            LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
            LEFT JOIN prioridades p ON t.PrioridadId = p.IdPrioridad
            WHERE t.Activo = 1
        `;
        const params = [];

        if (areaId) {
            query += ` AND u.AreaId = ?`;
            params.push(areaId);
        }

        query += ` GROUP BY p.Prioridad ORDER BY p.IdPrioridad`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error en ticketsByPriority:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Áreas para filtro
app.get('/metrics/areas', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT IdArea, NombreArea FROM areas ORDER BY NombreArea');
        res.json(rows);
    } catch (error) {
        console.error('Error en metrics/areas:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Tickets con retraso (fecha deseada pasada y no completados)
app.get('/metrics/ticketsDelayed', async (req, res) => {
    try {
        const { areaId } = req.query;
        
        let query = `
            SELECT 
                t.IdTicket,
                t.Descripcion,
                t.FechaDeseada,
                t.PrioridadId,
                p.Prioridad as PrioridadNombre,
                t.EstadoId,
                e.NombreEstado,
                u.Nombre as SolicitanteNombre,
                u.AreaId,
                a.NombreArea,
                DATEDIFF(NOW(), t.FechaDeseada) as diasRetraso
            FROM tickets t
            LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
            LEFT JOIN prioridades p ON t.PrioridadId = p.IdPrioridad
            LEFT JOIN areas a ON u.AreaId = a.IdArea
            LEFT JOIN estados e ON t.EstadoId = e.IdEstado
            WHERE t.Activo = 1 
            AND e.NombreEstado NOT IN ('COMPLETO', 'ENTREGADO')
            AND t.FechaDeseada < NOW()
        `;
        const params = [];

        if (areaId) {
            query += ` AND u.AreaId = ?`;
            params.push(areaId);
        }

        query += ` ORDER BY diasRetraso DESC`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error en ticketsDelayed:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Promedio de días para completar tickets por área
app.get('/metrics/avgCompletionDays', async (req, res) => {
    try {
        const { year } = req.query;
        
        let query = `
            SELECT 
                a.NombreArea,
                AVG(DATEDIFF(t.FechaCierre, t.FechaSolicitacion)) as promedioDias,
                COUNT(*) as totalTickets
            FROM tickets t
            LEFT JOIN usuarios u ON t.SolicitanteId = u.NoEmpleado
            LEFT JOIN areas a ON u.AreaId = a.IdArea
            WHERE t.Activo = 1 
            AND t.FechaCierre IS NOT NULL
            AND YEAR(t.FechaCierre) = COALESCE(?, YEAR(NOW()))
        `;
        const params = [year || null];

        query += ` GROUP BY a.NombreArea ORDER BY promedioDias`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error en avgCompletionDays:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// =============================================
// NOTIFICACIONES - HISTORIAL
// =============================================

// Helpers de direccionamiento: quiénes deben recibir un evento.
// - Tickets: su solicitante.
// - Bloques/dibujos/programas/ensambles: solicitantes de los tickets (activos o no)
//   que contienen el bloque, para que cada usuario vea lo de SUS tickets.
const getTicketSolicitante = async (ticketId) => {
    try {
        if (!ticketId) return null;
        const [r] = await pool.query('SELECT SolicitanteId FROM tickets WHERE IdTicket = ?', [ticketId]);
        return r.length > 0 ? r[0].SolicitanteId : null;
    } catch {
        return null;
    }
};

const getBlockUserIds = async (noParte) => {
    try {
        if (!noParte) return [];
        const [r] = await pool.query(
            `SELECT DISTINCT t.SolicitanteId AS id FROM tickets_details td
             JOIN tickets t ON t.IdTicket = td.TicketId
             WHERE td.BloqueId = ? AND t.SolicitanteId IS NOT NULL`,
            [noParte]
        );
        return r.map(x => x.id);
    } catch {
        return [];
    }
};

const getDibujoBloque = async (dibujoId) => {
    try {
        if (!dibujoId) return null;
        const [r] = await pool.query('SELECT BloqueId FROM dibujos_bloques WHERE IdDibujo = ?', [dibujoId]);
        return r.length > 0 ? r[0].BloqueId : null;
    } catch {
        return null;
    }
};

const getProgramaBloque = async (programaId) => {
    try {
        if (!programaId) return null;
        const [r] = await pool.query(
            `SELECT d.BloqueId FROM programas p
             JOIN dibujos_bloques d ON d.IdDibujo = p.DibujoId
             WHERE p.IdPrograma = ?`,
            [programaId]
        );
        return r.length > 0 ? r[0].BloqueId : null;
    } catch {
        return null;
    }
};

// Cache de admins (se refresca cada minuto) para el fan-out del historial
let adminIdsCache = null;
let adminIdsCacheAt = 0;
const getAdminIds = async () => {
    try {
        if (adminIdsCache && Date.now() - adminIdsCacheAt < 60000) return adminIdsCache;
        const [r] = await pool.query('SELECT NoEmpleado FROM usuarios WHERE RolId = 1');
        adminIdsCache = r.map(x => x.NoEmpleado);
        adminIdsCacheAt = Date.now();
        return adminIdsCache;
    } catch {
        return adminIdsCache || [];
    }
};

// Función helper para guardar notificación en BD
// Si no hay usuario destino (eventos broadcast como deletes sin UsuarioId),
// no se guarda fila y se evita el error "Column 'UsuarioId' cannot be null".
// El evento en tiempo real ya se emitió con io.emit antes de llamar aquí.
// Fan-out: se guarda una fila por cada destinatario (target + userIds + TODOS
// los admins) para que el historial de cada admin muestre todo y el de cada
// user solo lo de sus tickets.
const saveNotification = async (notification) => {
    const baseId = notification?.targetUserId ?? notification?.UsuarioId ?? null;
    const extras = Array.isArray(notification?.userIds) ? notification.userIds : [];
    const admins = await getAdminIds();
    const targets = [...new Set([baseId, ...extras, ...admins].filter(v => v !== null && v !== undefined && v !== ''))];
    if (targets.length === 0) return;
    try {
        for (const targetId of targets) {
            await pool.query(
                `INSERT INTO notificaciones_historial
                 (Tipo, Titulo, Mensaje, UsuarioId, UsuarioEmisorId, ReferenciaId, ReferenciaTipo)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    notification.type,
                    notification.title,
                    notification.message,
                    targetId,
                    notification.emisorId || notification.UsuarioEmisorId,
                    notification.referenciaId || notification.ReferenciaId,
                    notification.referenciaTipo || notification.ReferenciaTipo
                ]
            );
        }
    } catch (error) {
        console.error('Error guardando notificación en BD:', error);
    }
};

// GET /notificaciones/historial - Obtener historial de notificaciones del usuario
app.get('/notificaciones/historial', async (req, res) => {
    try {
        const { usuarioId, leida, limite, offset } = req.query;
        
        if (!usuarioId) {
            return res.status(400).json({ error: 'usuarioId is required' });
        }

        let query = `
            SELECT 
                nh.IdNotificacion,
                nh.Tipo,
                nh.Titulo,
                nh.Mensaje,
                nh.UsuarioId,
                nh.UsuarioEmisorId,
                nh.ReferenciaId,
                nh.ReferenciaTipo,
                nh.Leida,
                nh.FechaCreacion,
                nh.FechaLectura,
                ue.Nombre as EmisorNombre
            FROM notificaciones_historial nh
            LEFT JOIN usuarios ue ON nh.UsuarioEmisorId = ue.NoEmpleado
            WHERE nh.UsuarioId = ?
        `;
        const params = [usuarioId];

        if (leida !== undefined) {
            query += ` AND nh.Leida = ?`;
            params.push(leida === 'true' ? 1 : 0);
        }

        query += ` ORDER BY nh.FechaCreacion DESC`;

        if (limite) {
            query += ` LIMIT ?`;
            params.push(parseInt(limite));
        }
        if (offset) {
            query += ` OFFSET ?`;
            params.push(parseInt(offset));
        }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo historial de notificaciones:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /notificaciones/no-leidas - Contar notificaciones no leídas
app.get('/notificaciones/no-leidas', async (req, res) => {
    try {
        const { usuarioId } = req.query;
        
        if (!usuarioId) {
            return res.status(400).json({ error: 'usuarioId is required' });
        }

        const [rows] = await pool.query(
            `SELECT COUNT(*) as total FROM notificaciones_historial WHERE UsuarioId = ? AND Leida = 0`,
            [usuarioId]
        );
        res.json({ total: rows[0].total });
    } catch (error) {
        console.error('Error contando notificaciones no leídas:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /notificaciones/marcar-leida/:id - Marcar notificación como leída
app.put('/notificaciones/marcar-leida/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { usuarioId } = req.body;

        if (!usuarioId) {
            return res.status(400).json({ error: 'usuarioId is required' });
        }

        const [result] = await pool.query(
            `UPDATE notificaciones_historial 
             SET Leida = 1, FechaLectura = ? 
             WHERE IdNotificacion = ? AND UsuarioId = ?`,
            [getHermosilloDateTime(), id, usuarioId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        io.emit('notificacionLeida', { id, usuarioId });
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marcando notificación como leída:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /notificaciones/marcar-todas-leidas - Marcar todas como leídas
app.put('/notificaciones/marcar-todas-leidas', async (req, res) => {
    try {
        const { usuarioId } = req.body;

        if (!usuarioId) {
            return res.status(400).json({ error: 'usuarioId is required' });
        }

        await pool.query(
            `UPDATE notificaciones_historial 
             SET Leida = 1, FechaLectura = ? 
             WHERE UsuarioId = ? AND Leida = 0`,
            [getHermosilloDateTime(), usuarioId]
        );

        io.emit('notificacionesTodasLeidas', { usuarioId });
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marcando todas como leídas:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /notificaciones/limpiar-leidas - Eliminar notificaciones leídas antiguas (opcional)
app.delete('/notificaciones/limpiar-leidas', async (req, res) => {
    try {
        const { usuarioId, diasAntiguedad } = req.query;
        
        if (!usuarioId) {
            return res.status(400).json({ error: 'usuarioId is required' });
        }

        const dias = parseInt(diasAntiguedad) || 30;
        
        const [result] = await pool.query(
            `DELETE FROM notificaciones_historial 
             WHERE UsuarioId = ? AND Leida = 1 AND FechaLectura < DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [usuarioId, dias]
        );

        res.json({ success: true, eliminadas: result.affectedRows });
    } catch (error) {
        console.error('Error limpiando notificaciones:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!INVENTARIO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/
// Helper: validar admin por UsuarioId (convención del proyecto)
const checkAdminInventario = async (UsuarioId) => {
    if (!UsuarioId) return false;
    const [rows] = await pool.query('SELECT RolId FROM usuarios WHERE NoEmpleado = ?', [UsuarioId]);
    return rows.length > 0 && Number(rows[0].RolId) === 1;
};

/*---------------------------------------------------TIPOS---------------------------------------------------*/
app.get('/tiposMaterialSelect', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT IdTipoMaterial, TipoMaterial FROM tipo_materiales ORDER BY TipoMaterial');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener tipos de material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/tiposMaterialInsert', async (req, res) => {
    try {
        const { TipoMaterial, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!TipoMaterial || !String(TipoMaterial).trim()) {
            return res.status(400).json({ error: 'TipoMaterial es requerido' });
        }
        const [result] = await pool.query(
            'INSERT INTO tipo_materiales (TipoMaterial) VALUES (?)',
            [String(TipoMaterial).trim()]
        );
        io.emit('inventarioActualizado');
        res.status(201).json({ message: 'Tipo de material creado', id: result.insertId });
    } catch (error) {
        console.error('Error al crear tipo de material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/tiposMaterialDelete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { UsuarioId } = req.body || {};
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        const [uso] = await pool.query('SELECT COUNT(*) AS total FROM materiales WHERE TipoMaterialId = ?', [id]);
        if (uso[0].total > 0) {
            return res.status(400).json({ error: `No se puede eliminar: ${uso[0].total} material(es) usan este tipo` });
        }
        const [result] = await pool.query('DELETE FROM tipo_materiales WHERE IdTipoMaterial = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Tipo no encontrado' });
        }
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Tipo eliminado' });
    } catch (error) {
        console.error('Error al eliminar tipo de material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/tiposHerramientaSelect', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT IdTipoHerramienta, TipoHerramienta FROM tipo_herramienta ORDER BY TipoHerramienta');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener tipos de herramienta:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/tiposHerramientaInsert', async (req, res) => {
    try {
        const { TipoHerramienta, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!TipoHerramienta || !String(TipoHerramienta).trim()) {
            return res.status(400).json({ error: 'TipoHerramienta es requerido' });
        }
        const [result] = await pool.query(
            'INSERT INTO tipo_herramienta (TipoHerramienta) VALUES (?)',
            [String(TipoHerramienta).trim()]
        );
        io.emit('inventarioActualizado');
        res.status(201).json({ message: 'Tipo de herramienta creado', id: result.insertId });
    } catch (error) {
        console.error('Error al crear tipo de herramienta:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/tiposHerramientaDelete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { UsuarioId } = req.body || {};
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        const [uso] = await pool.query('SELECT COUNT(*) AS total FROM herramientas WHERE TipoHerramientaId = ?', [id]);
        if (uso[0].total > 0) {
            return res.status(400).json({ error: `No se puede eliminar: ${uso[0].total} herramienta(s) usan este tipo` });
        }
        const [result] = await pool.query('DELETE FROM tipo_herramienta WHERE IdTipoHerramienta = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Tipo no encontrado' });
        }
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Tipo eliminado' });
    } catch (error) {
        console.error('Error al eliminar tipo de herramienta:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------MATERIALES---------------------------------------------------*/
app.get('/materialesSelect', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT m.IdMateriales, m.Material, m.Descripcion, m.Largo, m.Ancho, m.Alto,
                    m.Cant, m.StockMinimo, m.LargoDisponible,
                    m.TipoMaterialId, tm.TipoMaterial, COALESCE(tm.EsBarra, 0) AS EsBarra,
                    m.SubtipoMaterialId, sm.SubtipoMaterial
             FROM materiales m
             LEFT JOIN tipo_materiales tm ON tm.IdTipoMaterial = m.TipoMaterialId
             LEFT JOIN subtipo_material sm ON sm.IdSubtipoMaterial = m.SubtipoMaterialId
             ORDER BY m.Material`
        );
        res.json(rows.map(r => ({
            ...r,
            EsBarra: Number(r.EsBarra) === 1,
            LargoDisponible: r.LargoDisponible !== null ? Number(r.LargoDisponible) : null
        })));
    } catch (error) {
        console.error('Error al obtener materiales:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/materialesInsert', async (req, res) => {
    try {
        const { Material, Descripcion, Largo, Ancho, Alto, Cant, StockMinimo, TipoMaterialId, SubtipoMaterialId, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!Material || !String(Material).trim()) {
            return res.status(400).json({ error: 'Material es requerido' });
        }
        if (!TipoMaterialId) {
            return res.status(400).json({ error: 'TipoMaterialId es requerido' });
        }
        const cantidad = parseInt(Cant, 10);
        const minimo = parseInt(StockMinimo, 10);
        if (isNaN(cantidad) || cantidad < 0 || isNaN(minimo) || minimo < 0) {
            return res.status(400).json({ error: 'Cant y StockMinimo deben ser números >= 0' });
        }
        let subtipoId = null;
        if (SubtipoMaterialId !== undefined && SubtipoMaterialId !== null && SubtipoMaterialId !== '') {
            const [sub] = await pool.query(
                'SELECT IdSubtipoMaterial FROM subtipo_material WHERE IdSubtipoMaterial = ? AND TipoMaterialId = ?',
                [SubtipoMaterialId, TipoMaterialId]
            );
            if (sub.length === 0) {
                return res.status(400).json({ error: 'El subtipo no pertenece al tipo seleccionado' });
            }
            subtipoId = SubtipoMaterialId;
        }
        const [tipoRow] = await pool.query('SELECT COALESCE(EsBarra, 0) AS EsBarra FROM tipo_materiales WHERE IdTipoMaterial = ?', [TipoMaterialId]);
        const esBarraNuevo = tipoRow.length > 0 && Number(tipoRow[0].EsBarra) === 1;
        const [result] = await pool.query(
            `INSERT INTO materiales (Material, Descripcion, Largo, Ancho, Alto, Cant, StockMinimo, TipoMaterialId, SubtipoMaterialId, LargoDisponible)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [String(Material).trim(), Descripcion || null, Largo || null, Ancho || null, Alto || null, cantidad, minimo, TipoMaterialId, subtipoId,
             esBarraNuevo ? cantidad * 48 : null]
        );
        io.emit('inventarioActualizado');
        res.status(201).json({ message: 'Material creado', id: result.insertId });
    } catch (error) {
        console.error('Error al crear material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/materialesUpdate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Material, Descripcion, Largo, Ancho, Alto, StockMinimo, TipoMaterialId, SubtipoMaterialId, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (SubtipoMaterialId !== undefined && SubtipoMaterialId !== null && SubtipoMaterialId !== '') {
            const tipoRef = TipoMaterialId !== undefined && TipoMaterialId !== ''
                ? TipoMaterialId
                : (await pool.query('SELECT TipoMaterialId FROM materiales WHERE IdMateriales = ?', [id]))[0][0]?.TipoMaterialId;
            const [sub] = await pool.query(
                'SELECT IdSubtipoMaterial FROM subtipo_material WHERE IdSubtipoMaterial = ? AND TipoMaterialId = ?',
                [SubtipoMaterialId, tipoRef]
            );
            if (sub.length === 0) {
                return res.status(400).json({ error: 'El subtipo no pertenece al tipo seleccionado' });
            }
        }
        // Nota: Cant NO se edita aquí; solo vía movimientos (entradas/salidas)
        const updates = [];
        const values = [];
        if (Material !== undefined) { updates.push('Material = ?'); values.push(String(Material).trim()); }
        if (Descripcion !== undefined) { updates.push('Descripcion = ?'); values.push(Descripcion || null); }
        if (Largo !== undefined) { updates.push('Largo = ?'); values.push(Largo || null); }
        if (Ancho !== undefined) { updates.push('Ancho = ?'); values.push(Ancho || null); }
        if (Alto !== undefined) { updates.push('Alto = ?'); values.push(Alto || null); }
        if (StockMinimo !== undefined) {
            const minimo = parseInt(StockMinimo, 10);
            if (isNaN(minimo) || minimo < 0) {
                return res.status(400).json({ error: 'StockMinimo debe ser número >= 0' });
            }
            updates.push('StockMinimo = ?'); values.push(minimo);
        }
        if (TipoMaterialId !== undefined && TipoMaterialId !== '') { updates.push('TipoMaterialId = ?'); values.push(TipoMaterialId); }
        if (SubtipoMaterialId !== undefined) {
            updates.push('SubtipoMaterialId = ?');
            values.push(SubtipoMaterialId === '' || SubtipoMaterialId === null ? null : SubtipoMaterialId);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        values.push(id);
        const [result] = await pool.query(`UPDATE materiales SET ${updates.join(', ')} WHERE IdMateriales = ?`, values);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Material no encontrado' });
        }
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Material actualizado' });
    } catch (error) {
        console.error('Error al actualizar material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/materialesDelete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { UsuarioId } = req.body || {};
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        const [uso] = await pool.query(
            "SELECT COUNT(*) AS total FROM inventario_movimientos WHERE TipoItem = 'material' AND ReferenciaId = ?",
            [id]
        );
        if (uso[0].total > 0) {
            return res.status(400).json({ error: 'No se puede eliminar: tiene movimientos registrados' });
        }
        const [result] = await pool.query('DELETE FROM materiales WHERE IdMateriales = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Material no encontrado' });
        }
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Material eliminado' });
    } catch (error) {
        console.error('Error al eliminar material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------HERRAMIENTAS---------------------------------------------------*/
app.get('/herramientasSelect', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT h.IdHerramienta, h.Herramienta, h.TipoHerramientaId, th.TipoHerramienta,
                    h.Cant, h.Size, h.MaterialHerramienta
             FROM herramientas h
             LEFT JOIN tipo_herramienta th ON th.IdTipoHerramienta = h.TipoHerramientaId
             ORDER BY h.Herramienta`
        );
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener herramientas:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/herramientasInsert', async (req, res) => {
    try {
        const { Herramienta, TipoHerramientaId, Cant, Size, MaterialHerramienta, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!Herramienta || !String(Herramienta).trim()) {
            return res.status(400).json({ error: 'Herramienta es requerida' });
        }
        if (!TipoHerramientaId) {
            return res.status(400).json({ error: 'TipoHerramientaId es requerido' });
        }
        const cantidad = Cant === undefined || Cant === null || Cant === '' ? 0 : parseInt(Cant, 10);
        if (isNaN(cantidad) || cantidad < 0) {
            return res.status(400).json({ error: 'Cant debe ser número >= 0' });
        }
        const [result] = await pool.query(
            `INSERT INTO herramientas (Herramienta, TipoHerramientaId, Cant, Size, MaterialHerramienta)
             VALUES (?, ?, ?, ?, ?)`,
            [String(Herramienta).trim(), TipoHerramientaId, cantidad, Size || null, MaterialHerramienta || null]
        );
        io.emit('inventarioActualizado');
        res.status(201).json({ message: 'Herramienta creada', id: result.insertId });
    } catch (error) {
        console.error('Error al crear herramienta:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/herramientasUpdate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Herramienta, TipoHerramientaId, Size, MaterialHerramienta, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        // Nota: Cant NO se edita aquí; solo vía movimientos (entradas/salidas)
        const updates = [];
        const values = [];
        if (Herramienta !== undefined) { updates.push('Herramienta = ?'); values.push(String(Herramienta).trim()); }
        if (TipoHerramientaId !== undefined && TipoHerramientaId !== '') { updates.push('TipoHerramientaId = ?'); values.push(TipoHerramientaId); }
        if (Size !== undefined) { updates.push('Size = ?'); values.push(Size || null); }
        if (MaterialHerramienta !== undefined) { updates.push('MaterialHerramienta = ?'); values.push(MaterialHerramienta || null); }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        values.push(id);
        const [result] = await pool.query(`UPDATE herramientas SET ${updates.join(', ')} WHERE IdHerramienta = ?`, values);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Herramienta no encontrada' });
        }
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Herramienta actualizada' });
    } catch (error) {
        console.error('Error al actualizar herramienta:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/herramientasDelete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { UsuarioId } = req.body || {};
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        const [uso] = await pool.query(
            "SELECT COUNT(*) AS total FROM inventario_movimientos WHERE TipoItem = 'herramienta' AND ReferenciaId = ?",
            [id]
        );
        if (uso[0].total > 0) {
            return res.status(400).json({ error: 'No se puede eliminar: tiene movimientos registrados' });
        }
        const [result] = await pool.query('DELETE FROM herramientas WHERE IdHerramienta = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Herramienta no encontrada' });
        }
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Herramienta eliminada' });
    } catch (error) {
        console.error('Error al eliminar herramienta:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------MOVIMIENTOS (entradas/salidas)---------------------------------------------------*/
app.post('/inventarioMovimiento', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { TipoItem, ReferenciaId, TipoMov, Cantidad, UsuarioId, Comentario } = req.body;

        if (!(await checkAdminInventario(UsuarioId))) {
            await connection.rollback();
            connection.release();
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!['material', 'herramienta'].includes(TipoItem)) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: "TipoItem debe ser 'material' o 'herramienta'" });
        }
        if (!['entrada', 'salida'].includes(TipoMov)) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: "TipoMov debe ser 'entrada' o 'salida'" });
        }
        const cantidad = parseInt(Cantidad, 10);
        if (isNaN(cantidad) || cantidad <= 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'Cantidad debe ser un número mayor a 0' });
        }

        const tabla = TipoItem === 'material' ? 'materiales' : 'herramientas';
        const idCol = TipoItem === 'material' ? 'IdMateriales' : 'IdHerramienta';
        const [actual] = await connection.query(
            TipoItem === 'material'
                ? `SELECT m.Cant, m.LargoDisponible, COALESCE(t.EsBarra, 0) AS EsBarra
                   FROM materiales m LEFT JOIN tipo_materiales t ON t.IdTipoMaterial = m.TipoMaterialId
                   WHERE m.IdMateriales = ?`
                : `SELECT Cant, NULL AS LargoDisponible, 0 AS EsBarra FROM ${tabla} WHERE ${idCol} = ?`,
            [ReferenciaId]
        );
        if (actual.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Artículo no encontrado' });
        }
        const esBarra = Number(actual[0].EsBarra) === 1;
        const PULG_BARRA = 48;
        let nuevaCant, nuevoLargo;
        if (!esBarra) {
            const existencia = Number(actual[0].Cant) || 0;
            if (TipoMov === 'salida' && existencia < cantidad) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: `Stock insuficiente. Existencia: ${existencia}` });
            }
            nuevaCant = TipoMov === 'entrada' ? existencia + cantidad : existencia - cantidad;
            await connection.query(
                `UPDATE ${tabla} SET Cant = ? WHERE ${idCol} = ?`,
                [nuevaCant, ReferenciaId]
            );
        } else {
            // Barras: se mueven pulgadas; las barras se derivan (cada 48" = 1 barra)
            const largoActual = Number(actual[0].LargoDisponible) || 0;
            if (TipoMov === 'salida' && largoActual < cantidad * PULG_BARRA) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: `Pulgadas insuficientes. Disponible: ${largoActual}"` });
            }
            nuevoLargo = TipoMov === 'entrada' ? largoActual + cantidad * PULG_BARRA : largoActual - cantidad * PULG_BARRA;
            nuevaCant = Math.ceil(nuevoLargo / PULG_BARRA);
            await connection.query(
                'UPDATE materiales SET Cant = ?, LargoDisponible = ? WHERE IdMateriales = ?',
                [nuevaCant, nuevoLargo, ReferenciaId]
            );
        }
        await connection.query(
            `INSERT INTO inventario_movimientos (TipoItem, ReferenciaId, TipoMov, Cantidad, Fecha, UsuarioId, Comentario)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [TipoItem, ReferenciaId, TipoMov, cantidad, getHermosilloDateTime(), UsuarioId, Comentario || null]
        );

        await connection.commit();
        connection.release();

        io.emit('inventarioActualizado');

        res.status(201).json({
            success: true,
            message: 'Movimiento registrado',
            nuevaExistencia: nuevaCant,
            ...(esBarra ? { largoDisponible: nuevoLargo } : {})
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error al registrar movimiento:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Borrar un movimiento revirtiendo su efecto en stock (para poder eliminar
// el material después). Si revertirlo dejaría stock negativo, se rechaza.
app.delete('/inventarioMovimiento/:id', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { id } = req.params;
        const { UsuarioId } = req.body || {};
        if (!(await checkAdminInventario(UsuarioId))) {
            await connection.rollback();
            connection.release();
            return res.status(403).json({ error: 'Only administrators' });
        }
        const [rows] = await connection.query(
            'SELECT * FROM inventario_movimientos WHERE IdMovimiento = ?',
            [id]
        );
        if (rows.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        const mov = rows[0];
        if (mov.TipoItem === 'material') {
            const [mats] = await connection.query(
                `SELECT m.Cant, m.LargoDisponible, COALESCE(t.EsBarra, 0) AS EsBarra
                 FROM materiales m LEFT JOIN tipo_materiales t ON t.IdTipoMaterial = m.TipoMaterialId
                 WHERE m.IdMateriales = ?`,
                [mov.ReferenciaId]
            );
            if (mats.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'El material ya no existe' });
            }
            const esBarra = Number(mats[0].EsBarra) === 1;
            if (esBarra) {
                // Revertir pulgadas según el tipo original del movimiento
                let delta = 0;
                if (mov.TipoMov === 'entrada') delta = -(Number(mov.Cantidad) * 48);
                else if (mov.TipoMov === 'salida') delta = Number(mov.Cantidad) * 48;
                else if (mov.TipoMov === 'consumo') delta = Number(mov.Largo) || 0;
                else delta = 0;
                const nuevoLargo = Math.round(((Number(mats[0].LargoDisponible) || 0) + delta) * 100) / 100;
                if (nuevoLargo < 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({ error: 'No se puede borrar: dejaría las pulgadas en negativo' });
                }
                await connection.query(
                    'UPDATE materiales SET Cant = ?, LargoDisponible = ? WHERE IdMateriales = ?',
                    [Math.ceil(nuevoLargo / 48), nuevoLargo, mov.ReferenciaId]
                );
            } else {
                const c = Number(mov.Cantidad) || 0;
                const actual = Number(mats[0].Cant) || 0;
                const nuevo = mov.TipoMov === 'entrada' ? actual - c : actual + c;
                if (nuevo < 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({ error: 'No se puede borrar: dejaría la existencia en negativo' });
                }
                await connection.query('UPDATE materiales SET Cant = ? WHERE IdMateriales = ?', [nuevo, mov.ReferenciaId]);
            }
        } else if (mov.TipoItem === 'herramienta') {
            const [herr] = await connection.query('SELECT Cant FROM herramientas WHERE IdHerramienta = ?', [mov.ReferenciaId]);
            if (herr.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'La herramienta ya no existe' });
            }
            const c = Number(mov.Cantidad) || 0;
            const actual = Number(herr[0].Cant) || 0;
            const nuevo = mov.TipoMov === 'entrada' ? actual - c : actual + c;
            if (nuevo < 0) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: 'No se puede borrar: dejaría la existencia en negativo' });
            }
            await connection.query('UPDATE herramientas SET Cant = ? WHERE IdHerramienta = ?', [nuevo, mov.ReferenciaId]);
        } else if (mov.TipoItem === 'bloque') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'Los movimientos de blocks no se pueden borrar (usan su propio kardex)' });
        } else {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'Tipo de movimiento no soportado para borrado' });
        }
        await connection.query('DELETE FROM inventario_movimientos WHERE IdMovimiento = ?', [id]);
        await connection.commit();
        connection.release();
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Movimiento eliminado y stock revertido' });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error al eliminar movimiento:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/inventarioMovimientos', async (req, res) => {
    try {
        const { tipoItem, referenciaId, limite } = req.query;
        let query = `
            SELECT m.IdMovimiento, m.TipoItem, m.ReferenciaId, m.TipoMov, m.Cantidad,
                   m.Largo, m.Ancho, m.Alto,
                   m.Fecha, DATE_FORMAT(m.Fecha, '%d/%m/%Y %H:%i') AS FechaFormateada,
                   m.UsuarioId, m.Comentario, u.Nombre AS UsuarioNombre
            FROM inventario_movimientos m
            LEFT JOIN usuarios u ON u.NoEmpleado = m.UsuarioId
            WHERE 1=1
        `;
        const params = [];
        if (tipoItem && ['material', 'herramienta'].includes(tipoItem)) {
            query += ' AND m.TipoItem = ?';
            params.push(tipoItem);
        }
        if (referenciaId) {
            query += ' AND m.ReferenciaId = ?';
            params.push(referenciaId);
        }
        query += ' ORDER BY m.Fecha DESC, m.IdMovimiento DESC';
        const lim = parseInt(limite, 10);
        if (!isNaN(lim) && lim > 0 && lim <= 500) {
            // lim ya validado como entero 1..500: interpolar directo (placeholders no aplican a LIMIT)
            query += ` LIMIT ${lim}`;
        }
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------SUBTIPOS DE MATERIAL---------------------------------------------------*/
app.get('/subtiposMaterialSelect', async (req, res) => {
    try {
        const { tipoId } = req.query;
        let query = 'SELECT IdSubtipoMaterial, TipoMaterialId, SubtipoMaterial FROM subtipo_material';
        const params = [];
        if (tipoId) {
            query += ' WHERE TipoMaterialId = ?';
            params.push(tipoId);
        }
        query += ' ORDER BY SubtipoMaterial';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener subtipos de material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/subtiposMaterialInsert', async (req, res) => {
    try {
        const { TipoMaterialId, SubtipoMaterial, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!TipoMaterialId) {
            return res.status(400).json({ error: 'TipoMaterialId es requerido' });
        }
        if (!SubtipoMaterial || !String(SubtipoMaterial).trim()) {
            return res.status(400).json({ error: 'SubtipoMaterial es requerido' });
        }
        const [result] = await pool.query(
            'INSERT INTO subtipo_material (TipoMaterialId, SubtipoMaterial) VALUES (?, ?)',
            [TipoMaterialId, String(SubtipoMaterial).trim()]
        );
        io.emit('inventarioActualizado');
        res.status(201).json({ message: 'Subtipo creado', id: result.insertId });
    } catch (error) {
        console.error('Error al crear subtipo de material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/subtiposMaterialDelete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { UsuarioId } = req.body || {};
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        const [uso] = await pool.query('SELECT COUNT(*) AS total FROM materiales WHERE SubtipoMaterialId = ?', [id]);
        if (uso[0].total > 0) {
            return res.status(400).json({ error: `No se puede eliminar: ${uso[0].total} material(es) usan este subtipo` });
        }
        const [result] = await pool.query('DELETE FROM subtipo_material WHERE IdSubtipoMaterial = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Subtipo no encontrado' });
        }
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Subtipo eliminado' });
    } catch (error) {
        console.error('Error al eliminar subtipo de material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------EDITAR TIPOS/SUBTIPOS---------------------------------------------------*/
app.put('/tiposMaterialUpdate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { TipoMaterial, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!TipoMaterial || !String(TipoMaterial).trim()) {
            return res.status(400).json({ error: 'TipoMaterial es requerido' });
        }
        const [result] = await pool.query(
            'UPDATE tipo_materiales SET TipoMaterial = ? WHERE IdTipoMaterial = ?',
            [String(TipoMaterial).trim(), id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Tipo no encontrado' });
        }
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Tipo actualizado' });
    } catch (error) {
        console.error('Error al actualizar tipo de material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/tiposHerramientaUpdate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { TipoHerramienta, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!TipoHerramienta || !String(TipoHerramienta).trim()) {
            return res.status(400).json({ error: 'TipoHerramienta es requerido' });
        }
        const [result] = await pool.query(
            'UPDATE tipo_herramienta SET TipoHerramienta = ? WHERE IdTipoHerramienta = ?',
            [String(TipoHerramienta).trim(), id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Tipo no encontrado' });
        }
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Tipo actualizado' });
    } catch (error) {
        console.error('Error al actualizar tipo de herramienta:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/subtiposMaterialUpdate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { SubtipoMaterial, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!SubtipoMaterial || !String(SubtipoMaterial).trim()) {
            return res.status(400).json({ error: 'SubtipoMaterial es requerido' });
        }
        const [result] = await pool.query(
            'UPDATE subtipo_material SET SubtipoMaterial = ? WHERE IdSubtipoMaterial = ?',
            [String(SubtipoMaterial).trim(), id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Subtipo no encontrado' });
        }
        io.emit('inventarioActualizado');
        res.json({ success: true, message: 'Subtipo actualizado' });
    } catch (error) {
        console.error('Error al actualizar subtipo de material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------BLOQUES: INVENTARIO (existencias y apartados)---------------------------------------------------*/
// Helpers de apartados. q() es pool.query o connection.query según haya transacción.
// - liberar: papelera → los apartados vuelven a disponible (kardex 'liberacion').
// - consumir: entrega → las piezas salen físicamente (kardex 'consumo').
const liberarApartadosTicket = async (q, ticketId, usuarioId) => {
    const [aps] = await q(
        'SELECT BloqueId, Cantidad FROM bloque_apartados WHERE TicketId = ?',
        [ticketId]
    );
    if (aps.length === 0) return 0;
    const fecha = getHermosilloDateTime();
    for (const a of aps) {
        await q(
            `INSERT INTO bloque_movimientos (BloqueNoParte, TipoMov, Cantidad, TicketId, Fecha, UsuarioId, Comentario)
             VALUES (?, 'liberacion', ?, ?, ?, ?, ?)`,
            [a.BloqueId, a.Cantidad, ticketId, fecha, usuarioId, 'Apartado liberado (papelera)']
        );
    }
    await q('DELETE FROM bloque_apartados WHERE TicketId = ?', [ticketId]);
    return aps.length;
};

const consumirApartadosTicket = async (q, ticketId, usuarioId) => {
    const [aps] = await q(
        'SELECT BloqueId, Cantidad FROM bloque_apartados WHERE TicketId = ?',
        [ticketId]
    );
    if (aps.length === 0) return 0;
    const fecha = getHermosilloDateTime();
    for (const a of aps) {
        await q(
            `INSERT INTO bloque_movimientos (BloqueNoParte, TipoMov, Cantidad, TicketId, Fecha, UsuarioId, Comentario)
             VALUES (?, 'consumo', ?, ?, ?, ?, ?)`,
            [a.BloqueId, a.Cantidad, ticketId, fecha, usuarioId, 'Consumo por entrega del ticket']
        );
    }
    await q('DELETE FROM bloque_apartados WHERE TicketId = ?', [ticketId]);
    return aps.length;
};

// Disponibilidad de un bloque: Existencia menos lo ya apartado (tickets activos)
const disponibleBloque = async (q, noParte) => {
    const [b] = await q('SELECT Existencia FROM bloques WHERE NoParte = ?', [noParte]);
    if (b.length === 0) return { existe: false, existencia: 0, apartado: 0, disponible: 0 };
    const [a] = await q(
        `SELECT COALESCE(SUM(ap.Cantidad), 0) AS apartado
         FROM bloque_apartados ap
         JOIN tickets t ON t.IdTicket = ap.TicketId
         WHERE ap.BloqueId = ? AND t.Activo = 1`,
        [noParte]
    );
    const existencia = Number(b[0].Existencia) || 0;
    const apartado = Number(a[0].apartado) || 0;
    return { existe: true, existencia, apartado, disponible: existencia - apartado };
};

// Reparte el disponible de un bloque entre tickets activos elegibles,
// por prioridad (CRITICA > ALTA > MEDIA > BAJA) y fecha deseada.
// Devuelve { apartados, tickets } con los tickets cubiertos.
const repartirBloque = async (q, noParte, usuarioId, fecha) => {
    const [tickets] = await q(
        `SELECT t.IdTicket, td.Cantidad,
                (SELECT COALESCE(SUM(ap2.Cantidad), 0) FROM bloque_apartados ap2
                 WHERE ap2.TicketId = t.IdTicket AND ap2.BloqueId = td.BloqueId) AS ya
         FROM tickets_details td
         JOIN tickets t ON t.IdTicket = td.TicketId
         LEFT JOIN estados e ON e.IdEstado = t.EstadoId
         LEFT JOIN prioridades p ON p.IdPrioridad = t.PrioridadId
         WHERE td.BloqueId = ? AND t.Activo = 1
           AND (e.NombreEstado IS NULL OR e.NombreEstado NOT IN ('COMPLETO', 'ENTREGADO'))
         ORDER BY p.IdPrioridad DESC, t.FechaDeseada ASC`,
        [noParte]
    );
    let apartados = 0;
    const ticketsTocados = new Set();
    for (const tk of tickets) {
        const faltante = Number(tk.Cantidad) - Number(tk.ya);
        if (faltante <= 0) continue;
        const disp = await disponibleBloque(q, noParte);
        if (!disp.existe || disp.disponible <= 0) break;
        const qty = Math.min(faltante, disp.disponible);
        const [existeAp] = await q(
            'SELECT IdApartado FROM bloque_apartados WHERE TicketId = ? AND BloqueId = ? LIMIT 1',
            [tk.IdTicket, noParte]
        );
        if (existeAp.length > 0) {
            await q('UPDATE bloque_apartados SET Cantidad = Cantidad + ? WHERE IdApartado = ?',
                [qty, existeAp[0].IdApartado]);
        } else {
            await q('INSERT INTO bloque_apartados (TicketId, BloqueId, Cantidad) VALUES (?, ?, ?)',
                [tk.IdTicket, noParte, qty]);
        }
        await q(
            `INSERT INTO bloque_movimientos (BloqueNoParte, TipoMov, Cantidad, TicketId, Fecha, UsuarioId, Comentario)
             VALUES (?, 'apartado', ?, ?, ?, ?, ?)`,
            [noParte, qty, tk.IdTicket, fecha, usuarioId, `Apartado automático para ticket #${tk.IdTicket}`]
        );
        apartados += qty;
        ticketsTocados.add(tk.IdTicket);
    }
    return { apartados, tickets: [...ticketsTocados] };
};

// Puerta de entrada al inventario + descuento al dar de alta N blocks.
// Pines/piezas descuentan Cantidad; barras solo mueven LARGO.
// Si no alcanza: descuenta lo disponible y avisa (no bloquea).
const validarBloqueListoParaAlta = async (q, noParte) => {
    const faltantes = [];
    const [b] = await q('SELECT DibujosCompleto, ProgramasCompleto, EnsambleCompleto FROM bloques WHERE NoParte = ?', [noParte]);
    if (b.length === 0) return { ok: false, faltantes: ['el bloque no existe'] };
    if (Number(b[0].DibujosCompleto) !== 1) faltantes.push(`dibujos sin marcar completos`);
    if (Number(b[0].ProgramasCompleto) !== 1) faltantes.push(`programas sin marcar completos`);
    if (Number(b[0].EnsambleCompleto) !== 1) faltantes.push(`ensamble sin completar`);
    const [progs] = await q(
        `SELECT p.IdPrograma FROM programas p` +
        ` LEFT JOIN dibujos_bloques d ON d.IdDibujo = p.DibujoId` +
        ` WHERE p.BloqueId = ? OR d.BloqueId = ?`,
        [noParte, noParte]
    );
    if (progs.length === 0) {
        faltantes.push('sin programas dados de alta');
    } else {
        let sinReceta = 0;
        for (const pr of progs) {
            const [c] = await q('SELECT COUNT(*) AS n FROM programa_materiales WHERE ProgramaId = ?', [pr.IdPrograma]);
            if (!c[0].n) sinReceta++;
        }
        if (sinReceta > 0) faltantes.push(`${sinReceta} programa(s) sin material asignado`);
    }
    return { ok: faltantes.length === 0, faltantes };
};

// Descuento al dar de alta N blocks: receta x N (pines descuentan Cantidad,
// barras solo mueven LARGO). Si no alcanza: descuenta lo disponible y avisa.
const consumirRecetasBloque = async (q, noParte, qtyBlocks, usuarioId, fecha) => {
    const [recetas] = await q(
        `SELECT pm.ProgramaId, pm.MaterialId, pm.Cantidad, pm.Largo,` +
        ` m.Material, m.Cant AS existencia, m.LargoDisponible,` +
        ` COALESCE(t.EsBarra, 0) AS EsBarra` +
        ` FROM programa_materiales pm` +
        ` JOIN programas p ON p.IdPrograma = pm.ProgramaId` +
        ` LEFT JOIN dibujos_bloques d ON d.IdDibujo = p.DibujoId` +
        ` LEFT JOIN materiales m ON m.IdMateriales = pm.MaterialId` +
        ` LEFT JOIN tipo_materiales t ON t.IdTipoMaterial = m.TipoMaterialId` +
        ` WHERE p.BloqueId = ? OR d.BloqueId = ?`,
        [noParte, noParte]
    );
    const r2 = (n) => Math.round(Number(n) * 100) / 100;
    const avisos = [];
    let consumos = 0;
    for (const r of recetas) {
        const need = Number(r.Cantidad) * qtyBlocks;
        const esBarra = Number(r.EsBarra) === 1;
        if (esBarra) {
            const needPulg = r2((Number(r.Largo) || 0) * qtyBlocks);
            const dispPulg = Number(r.LargoDisponible) || 0;
            const usaPulg = Math.min(needPulg, dispPulg);
            const nuevoLargo = r2(dispPulg - usaPulg);
            await q('UPDATE materiales SET Cant = ?, LargoDisponible = ? WHERE IdMateriales = ?',
                [Math.ceil(nuevoLargo / 48), nuevoLargo, r.MaterialId]);
            await q(
                `INSERT INTO inventario_movimientos (TipoItem, ReferenciaId, TipoMov, Cantidad, Largo, Ancho, Alto, Fecha, UsuarioId, Comentario, BloqueNoParte, ProgramaId) VALUES ('material', ?, 'consumo', 0, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
                [r.MaterialId, usaPulg, fecha, usuarioId,
                 `Consumo alta ${qtyBlocks}x ${noParte}: largo ${usaPulg} de ${needPulg} (receta prog. #${r.ProgramaId})${usaPulg < needPulg ? ' · parcial: sin stock' : ''}`,
                 noParte, r.ProgramaId]
            );
            consumos++;
            if (usaPulg < needPulg) avisos.push(`${r.Material || 'Material #' + r.MaterialId}: receta pide ${needPulg} pulg y había ${dispPulg} pulg`);
        } else {
            const avail = Number(r.existencia) || 0;
            const usa = Math.min(need, avail);
            if (usa > 0) {
                await q('UPDATE materiales SET Cant = Cant - ? WHERE IdMateriales = ?', [usa, r.MaterialId]);
            }
            await q(
                `INSERT INTO inventario_movimientos (TipoItem, ReferenciaId, TipoMov, Cantidad, Largo, Ancho, Alto, Fecha, UsuarioId, Comentario, BloqueNoParte, ProgramaId) VALUES ('material', ?, 'consumo', ?, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
                [r.MaterialId, usa, fecha, usuarioId,
                 `Consumo alta ${qtyBlocks}x ${noParte} (receta prog. #${r.ProgramaId})${usa < need ? ' · parcial: sin stock' : ''}`,
                 noParte, r.ProgramaId]
            );
            consumos++;
            if (usa < need) avisos.push(`${r.Material || 'Material #' + r.MaterialId}: receta pide ${need}, había ${avail}`);
        }
    }
    return { consumos, avisos };
};


// Entrada manual a stock (piezas maquinadas/armadas listas)
app.post('/bloquesEntrada', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { BloqueNoParte, Cantidad, UsuarioId, Comentario } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            await connection.rollback();
            connection.release();
            return res.status(403).json({ error: 'Only administrators' });
        }
        const cantidad = parseInt(Cantidad, 10);
        if (!BloqueNoParte || isNaN(cantidad) || cantidad <= 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'BloqueNoParte y Cantidad > 0 son requeridos' });
        }
        const [b] = await connection.query('SELECT NoParte FROM bloques WHERE NoParte = ?', [BloqueNoParte]);
        if (b.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Block not found' });
        }
        // Puerta de entrada: solo blocks listos (dibujos+programa+ensamble y material en programa)
        const listo = await validarBloqueListoParaAlta((sql, params) => connection.query(sql, params), BloqueNoParte);
        if (!listo.ok) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'No se puede dar de alta: le falta ' + listo.faltantes.join(', ') });
        }

        await connection.query(
            'UPDATE bloques SET Existencia = Existencia + ? WHERE NoParte = ?',
            [cantidad, BloqueNoParte]
        );
        const fechaEnt = getHermosilloDateTime();
        await connection.query(
            `INSERT INTO bloque_movimientos (BloqueNoParte, TipoMov, Cantidad, TicketId, Fecha, UsuarioId, Comentario)
             VALUES (?, 'entrada', ?, NULL, ?, ?, ?)`,
            [BloqueNoParte, cantidad, fechaEnt, UsuarioId, Comentario || 'Entrada manual a stock']
        );
        // Descuento de material: receta x blocks dados de alta en este momento
        const resConsumoEnt = await consumirRecetasBloque((sql, params) => connection.query(sql, params), BloqueNoParte, cantidad, UsuarioId, fechaEnt);
                // Auto-apartado: asignar lo que entró a tickets pendientes por prioridad
        const qConn = (sql, params) => connection.query(sql, params);
        const auto = await repartirBloque(qConn, BloqueNoParte, UsuarioId, fechaEnt);
        await connection.commit();
        connection.release();
        io.emit('bloqueInventarioActualizado', { noParte: BloqueNoParte });
        io.emit('inventarioActualizado');
        io.emit('ticketsActualizados');
        auto.tickets.forEach(ticketId => io.emit('ticketEstadoActualizado', { ticketId }));
        const partesMsgEnt = [
            `Entrada registrada (${cantidad}x ${BloqueNoParte})`,
        ];
        if (resConsumoEnt.consumos > 0) partesMsgEnt.push(`material descontado en ${resConsumoEnt.consumos} receta(s)`);
        if (auto.apartados > 0) partesMsgEnt.push(`${auto.apartados} pieza(s) apartadas`);
        res.status(201).json({
            success: true,
            message: partesMsgEnt.join(` · `),
            apartados: auto.apartados,
            consumos: resConsumoEnt.consumos,
            warning: resConsumoEnt.avisos.length > 0 ? 'Sin stock suficiente: ' + resConsumoEnt.avisos.join(' · ') : null
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error en entrada de bloque:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Salida manual (merma, venta, ajuste)
app.post('/bloquesSalida', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { BloqueNoParte, Cantidad, UsuarioId, Comentario } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            await connection.rollback();
            connection.release();
            return res.status(403).json({ error: 'Only administrators' });
        }
        const cantidad = parseInt(Cantidad, 10);
        if (!BloqueNoParte || isNaN(cantidad) || cantidad <= 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'BloqueNoParte y Cantidad > 0 son requeridos' });
        }
        const disp = await disponibleBloque(connection.query.bind(connection), BloqueNoParte);
        if (!disp.existe) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Block not found' });
        }
        if (disp.disponible < cantidad) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: `Stock disponible insuficiente. Disponible: ${disp.disponible}` });
        }
        await connection.query(
            'UPDATE bloques SET Existencia = Existencia - ? WHERE NoParte = ?',
            [cantidad, BloqueNoParte]
        );
        await connection.query(
            `INSERT INTO bloque_movimientos (BloqueNoParte, TipoMov, Cantidad, TicketId, Fecha, UsuarioId, Comentario)
             VALUES (?, 'salida', ?, NULL, ?, ?, ?)`,
            [BloqueNoParte, cantidad, getHermosilloDateTime(), UsuarioId, Comentario || 'Salida manual']
        );
        await connection.commit();
        connection.release();
        io.emit('bloqueInventarioActualizado', { noParte: BloqueNoParte });
        io.emit('inventarioActualizado');
        res.status(201).json({ success: true, message: 'Salida registrada' });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error en salida de bloque:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Devolver piezas apartadas al inventario (vuelven a disponible).
// Body: { TicketId, BloqueNoParte, Cantidad, UsuarioId, Comentario }
app.post('/bloquesDevolver', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { TicketId, BloqueNoParte, Cantidad, UsuarioId, Comentario } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            await connection.rollback();
            connection.release();
            return res.status(403).json({ error: 'Only administrators' });
        }
        const cantidad = parseInt(Cantidad, 10);
        if (!TicketId || !BloqueNoParte || isNaN(cantidad) || cantidad <= 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'TicketId, BloqueNoParte y Cantidad > 0 son requeridos' });
        }
        const [aps] = await connection.query(
            'SELECT IdApartado, Cantidad FROM bloque_apartados WHERE TicketId = ? AND BloqueId = ? LIMIT 1',
            [TicketId, BloqueNoParte]
        );
        if (aps.length === 0 || Number(aps[0].Cantidad) < cantidad) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                error: `Apartado insuficiente. Apartado actual: ${aps.length > 0 ? aps[0].Cantidad : 0}`
            });
        }
        const restante = Number(aps[0].Cantidad) - cantidad;
        if (restante === 0) {
            await connection.query('DELETE FROM bloque_apartados WHERE IdApartado = ?', [aps[0].IdApartado]);
        } else {
            await connection.query('UPDATE bloque_apartados SET Cantidad = ? WHERE IdApartado = ?', [restante, aps[0].IdApartado]);
        }
        await connection.query(
            `INSERT INTO bloque_movimientos (BloqueNoParte, TipoMov, Cantidad, TicketId, Fecha, UsuarioId, Comentario)
             VALUES (?, 'liberacion', ?, ?, ?, ?, ?)`,
            [BloqueNoParte, cantidad, TicketId, getHermosilloDateTime(), UsuarioId, Comentario || `Devolución manual del ticket #${TicketId}`]
        );
        await connection.commit();
        connection.release();
        io.emit('bloqueInventarioActualizado', { noParte: BloqueNoParte });
        io.emit('ticketsActualizados');
        io.emit('ticketEstadoActualizado', { ticketId: TicketId });
        res.json({ success: true, message: `Se devolvieron ${cantidad} pieza(s) al inventario` });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error al devolver bloques:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Distribución de apartados de un bloque por ticket (para la UI de devolución)
app.get('/bloqueApartados', async (req, res) => {
    try {
        const { noParte } = req.query;
        if (!noParte) {
            return res.status(400).json({ error: 'noParte es requerido' });
        }
        const [rows] = await pool.query(
            `SELECT ap.TicketId, ap.BloqueId, ap.Cantidad AS Apartado,
                    td.Cantidad AS Requerido,
                    t.SolicitanteId, u.Nombre AS SolicitanteNombre,
                    p.Prioridad AS PrioridadNombre, p.IdPrioridad,
                    e.NombreEstado
             FROM bloque_apartados ap
             JOIN tickets t ON t.IdTicket = ap.TicketId
             LEFT JOIN tickets_details td ON td.TicketId = ap.TicketId AND td.BloqueId = ap.BloqueId
             LEFT JOIN usuarios u ON u.NoEmpleado = t.SolicitanteId
             LEFT JOIN prioridades p ON p.IdPrioridad = t.PrioridadId
             LEFT JOIN estados e ON e.IdEstado = t.EstadoId
             WHERE ap.BloqueId = ? AND t.Activo = 1
             ORDER BY p.IdPrioridad DESC, t.FechaDeseada ASC`,
            [noParte]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener apartados:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Apartar piezas para tickets, repartiendo por prioridad:
// CRITICA (4) > ALTA (3) > MEDIA (2) > BAJA (1), luego fecha deseada.
// Si se pasa TicketId, solo se cubre ese ticket (sin quitar lo ya apartado).
app.post('/bloquesApartar', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { TicketId, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            await connection.rollback();
            connection.release();
            return res.status(403).json({ error: 'Only administrators' });
        }
        let tickets;
        if (TicketId) {
            const [t] = await connection.query(
                `SELECT t.IdTicket FROM tickets t
                 LEFT JOIN estados e ON e.IdEstado = t.EstadoId
                 WHERE t.IdTicket = ? AND t.Activo = 1
                 AND (e.NombreEstado IS NULL OR e.NombreEstado NOT IN ('COMPLETO', 'ENTREGADO'))`,
                [TicketId]
            );
            if (t.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Ticket no elegible para apartado' });
            }
            tickets = t;
        } else {
            const [t] = await connection.query(
                `SELECT t.IdTicket FROM tickets t
                 LEFT JOIN estados e ON e.IdEstado = t.EstadoId
                 LEFT JOIN prioridades p ON p.IdPrioridad = t.PrioridadId
                 WHERE t.Activo = 1
                 AND (e.NombreEstado IS NULL OR e.NombreEstado NOT IN ('COMPLETO', 'ENTREGADO'))
                 ORDER BY p.IdPrioridad DESC, t.FechaDeseada ASC`
            );
            tickets = t;
        }
        const fecha = getHermosilloDateTime();
        let apartados = 0;
        const bloquesTocados = new Set();
        for (const tk of tickets) {
            const [dets] = await connection.query(
                'SELECT BloqueId, Cantidad FROM tickets_details WHERE TicketId = ?',
                [tk.IdTicket]
            );
            for (const d of dets) {
                const [ya] = await connection.query(
                    'SELECT COALESCE(SUM(Cantidad), 0) AS s FROM bloque_apartados WHERE TicketId = ? AND BloqueId = ?',
                    [tk.IdTicket, d.BloqueId]
                );
                const faltante = Number(d.Cantidad) - Number(ya[0].s);
                if (faltante <= 0) continue;
                const disp = await disponibleBloque(connection.query.bind(connection), d.BloqueId);
                if (!disp.existe || disp.disponible <= 0) continue;
                const qty = Math.min(faltante, disp.disponible);
                const [existeAp] = await connection.query(
                    'SELECT IdApartado FROM bloque_apartados WHERE TicketId = ? AND BloqueId = ? LIMIT 1',
                    [tk.IdTicket, d.BloqueId]
                );
                if (existeAp.length > 0) {
                    await connection.query(
                        'UPDATE bloque_apartados SET Cantidad = Cantidad + ? WHERE IdApartado = ?',
                        [qty, existeAp[0].IdApartado]
                    );
                } else {
                    await connection.query(
                        'INSERT INTO bloque_apartados (TicketId, BloqueId, Cantidad) VALUES (?, ?, ?)',
                        [tk.IdTicket, d.BloqueId, qty]
                    );
                }
                await connection.query(
                    `INSERT INTO bloque_movimientos (BloqueNoParte, TipoMov, Cantidad, TicketId, Fecha, UsuarioId, Comentario)
                     VALUES (?, 'apartado', ?, ?, ?, ?, ?)`,
                    [d.BloqueId, qty, tk.IdTicket, fecha, UsuarioId, `Apartado para ticket #${tk.IdTicket}`]
                );
                apartados += qty;
                bloquesTocados.add(d.BloqueId);
            }
        }
        await connection.commit();
        connection.release();
        bloquesTocados.forEach(noParte => io.emit('bloqueInventarioActualizado', { noParte }));
        io.emit('ticketsActualizados');
        io.emit('inventarioActualizado');
        res.json({ success: true, message: apartados > 0 ? `Se apartaron ${apartados} pieza(s)` : 'Sin disponibilidad para apartar', apartados });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error al apartar bloques:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Estado de inventario por bloque: Existencia, Apartado, Disponible, Requerido, Faltante
app.get('/bloquesInventario', async (req, res) => {
    try {
        const { noParte } = req.query;
        let bloques;
        if (noParte) {
            const [b] = await pool.query('SELECT NoParte, Existencia FROM bloques WHERE NoParte = ?', [noParte]);
            bloques = b;
        } else {
            const [b] = await pool.query('SELECT NoParte, Existencia FROM bloques ORDER BY NoParte');
            bloques = b;
        }
        const out = [];
        for (const bl of bloques) {
            const [ap] = await pool.query(
                `SELECT COALESCE(SUM(ap.Cantidad), 0) AS apartado
                 FROM bloque_apartados ap
                 JOIN tickets t ON t.IdTicket = ap.TicketId
                 WHERE ap.BloqueId = ? AND t.Activo = 1`,
                [bl.NoParte]
            );
            const [req2] = await pool.query(
                `SELECT COALESCE(SUM(td.Cantidad), 0) AS requerido
                 FROM tickets_details td
                 JOIN tickets t ON t.IdTicket = td.TicketId
                 LEFT JOIN estados e ON e.IdEstado = t.EstadoId
                 WHERE td.BloqueId = ? AND t.Activo = 1
                 AND (e.NombreEstado IS NULL OR e.NombreEstado NOT IN ('COMPLETO', 'ENTREGADO'))`,
                [bl.NoParte]
            );
            const existencia = Number(bl.Existencia) || 0;
            const apartado = Number(ap[0].apartado) || 0;
            const requerido = Number(req2[0].requerido) || 0;
            out.push({
                NoParte: bl.NoParte,
                Existencia: existencia,
                Apartado: apartado,
                Disponible: existencia - apartado,
                Requerido: requerido,
                Faltante: Math.max(0, requerido - apartado)
            });
        }
        res.json(noParte ? (out[0] || null) : out);
    } catch (error) {
        console.error('Error al obtener inventario de bloques:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Kardex de un bloque
app.get('/bloqueMovimientos', async (req, res) => {
    try {
        const { noParte, limite } = req.query;
        if (!noParte) {
            return res.status(400).json({ error: 'noParte es requerido' });
        }
        let query = `
            SELECT m.IdMovimiento, m.BloqueNoParte, m.TipoMov, m.Cantidad, m.TicketId,
                   m.Fecha, DATE_FORMAT(m.Fecha, '%d/%m/%Y %H:%i') AS FechaFormateada,
                   m.UsuarioId, m.Comentario, u.Nombre AS UsuarioNombre
            FROM bloque_movimientos m
            LEFT JOIN usuarios u ON u.NoEmpleado = m.UsuarioId
            WHERE m.BloqueNoParte = ?
            ORDER BY m.Fecha DESC, m.IdMovimiento DESC`;
        const lim = parseInt(limite, 10);
        if (!isNaN(lim) && lim > 0 && lim <= 500) {
            query += ` LIMIT ${lim}`;
        }
        const [rows] = await pool.query(query, [noParte]);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener movimientos de bloque:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*---------------------------------------------------DEMANDA DE BLOCKS (solo lectura, agregada)---------------------------------------------------*/
app.get('/inventarioDemandaBlocks', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT td.BloqueId AS NoParte,
                    SUM(td.Cantidad) AS Requerido,
                    COUNT(DISTINCT td.TicketId) AS Tickets,
                    MAX(b.DibujosCompleto) AS DibujosCompleto,
                    MAX(b.ProgramasCompleto) AS ProgramasCompleto,
                    MAX(b.EnsambleCompleto) AS EnsambleCompleto,
                    COALESCE(MAX(b.Existencia), 0) AS Existencia,
                    COALESCE((
                        SELECT SUM(ap.Cantidad) FROM bloque_apartados ap
                        JOIN tickets t2 ON t2.IdTicket = ap.TicketId
                        WHERE ap.BloqueId = td.BloqueId AND t2.Activo = 1
                    ), 0) AS Apartado
             FROM tickets_details td
             JOIN tickets t ON t.IdTicket = td.TicketId
             LEFT JOIN estados e ON e.IdEstado = t.EstadoId
             LEFT JOIN bloques b ON b.NoParte = td.BloqueId
             WHERE t.Activo = 1
               AND (e.NombreEstado IS NULL OR e.NombreEstado NOT IN ('COMPLETO', 'ENTREGADO'))
             GROUP BY td.BloqueId
             ORDER BY Requerido DESC`
        );
        res.json(rows.map(r => {
            const requerido = Number(r.Requerido);
            const apartado = Number(r.Apartado);
            const existencia = Number(r.Existencia);
            return {
                ...r,
                Requerido: requerido,
                Tickets: Number(r.Tickets),
                Existencia: existencia,
                Apartado: apartado,
                Disponible: existencia - apartado,
                Faltante: Math.max(0, requerido - apartado)
            };
        }));
    } catch (error) {
        console.error('Error al obtener demanda de blocks:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!PROGRAMA-MATERIAL / PIN-FUNDA!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/
// Receta informativa programa → materiales (NO descuenta stock; el descuento
// solo ocurre en la Entrada del block). Si no hay stock, avisa sin bloquear.

app.get('/programaMateriales', async (req, res) => {
    try {
        const { programaId } = req.query;
        if (!programaId) {
            return res.status(400).json({ error: 'programaId es requerido' });
        }
        const [rows] = await pool.query(
            `SELECT pm.IdProgMat, pm.ProgramaId, pm.MaterialId, pm.Cantidad,
                    pm.Largo, pm.Ancho, pm.Alto,
                    m.Material, m.Cant AS Existencia, m.LargoDisponible,
                    COALESCE(t.EsBarra, 0) AS EsBarra,
                    COALESCE(p.MaterialesCompleto, 0) AS ProgramaMaterialOk
             FROM programa_materiales pm
             LEFT JOIN materiales m ON m.IdMateriales = pm.MaterialId
             LEFT JOIN tipo_materiales t ON t.IdTipoMaterial = m.TipoMaterialId
             LEFT JOIN programas p ON p.IdPrograma = pm.ProgramaId
             WHERE pm.ProgramaId = ?
             ORDER BY pm.IdProgMat`,
            [programaId]
        );
        const [progFlag] = await pool.query(
            'SELECT COALESCE(MaterialesCompleto, 0) AS flag FROM programas WHERE IdPrograma = ?',
            [programaId]
        );
        res.json({
            materiales: rows,
            materialesCompletos: progFlag.length > 0 && Number(progFlag[0].flag) === 1
        });
    } catch (error) {
        console.error('Error al obtener materiales del programa:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

const validarDimsReceta = (obj) => {
    const dims = {};
    for (const k of ['Largo', 'Ancho', 'Alto']) {
        const v = obj?.[k];
        if (v === undefined || v === null || v === '') {
            dims[k] = null;
        } else {
            const n = Number(v);
            if (isNaN(n) || n < 0) return { error: `${k} debe ser un número >= 0` };
            dims[k] = n;
        }
    }
    return { dims };
};

app.post('/programaMateriales', async (req, res) => {
    try {
        const { ProgramaId, MaterialId, Cantidad, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!ProgramaId || !MaterialId) {
            return res.status(400).json({ error: 'ProgramaId y MaterialId son requeridos' });
        }
        const cantidad = Number(Cantidad);
        const vd = validarDimsReceta(req.body);
        if (vd.error) {
            return res.status(400).json({ error: vd.error });
        }
        const [prog] = await pool.query('SELECT IdPrograma FROM programas WHERE IdPrograma = ?', [ProgramaId]);
        if (prog.length === 0) {
            return res.status(404).json({ error: 'Program not found' });
        }
        const [mat] = await pool.query(
            `SELECT m.IdMateriales, m.Material, m.Cant, COALESCE(t.EsBarra, 0) AS EsBarra
             FROM materiales m LEFT JOIN tipo_materiales t ON t.IdTipoMaterial = m.TipoMaterialId
             WHERE m.IdMateriales = ?`,
            [MaterialId]
        );
        if (mat.length === 0) {
            return res.status(404).json({ error: 'Material no encontrado' });
        }
        const esBarraUno = Number(mat[0].EsBarra) === 1;
        if (esBarraUno) {
            if (!vd.dims.Largo || vd.dims.Largo <= 0) {
                return res.status(400).json({ error: 'En barras solo indica el largo a usar' });
            }
        } else if (isNaN(cantidad) || cantidad <= 0) {
            return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
        }
        const [result] = await pool.query(
            'INSERT INTO programa_materiales (ProgramaId, MaterialId, Cantidad, Largo, Ancho, Alto) VALUES (?, ?, ?, ?, ?, ?)',
            [ProgramaId, MaterialId, esBarraUno ? 0 : cantidad, vd.dims.Largo, vd.dims.Ancho, vd.dims.Alto]
        );
        const existencia = Number(mat[0].Cant) || 0;
        io.emit('programaMaterialesActualizados', { programaId: ProgramaId });
        res.status(201).json({
            success: true,
            message: 'Material asignado al programa',
            id: result.insertId,
            warning: cantidad > existencia
                ? `Aviso: se requieren ${cantidad} pero solo hay ${existencia} en existencia`
                : null
        });
    } catch (error) {
        console.error('Error al asignar material:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Guardado en lote desde el checklist (una sola vuelta): [{MaterialId, Cantidad, Largo, Ancho, Alto}]
app.post('/programaMaterialesBatch', async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { ProgramaId, items, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            await connection.rollback();
            connection.release();
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!ProgramaId || !Array.isArray(items) || items.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'ProgramaId e items[] son requeridos' });
        }
        const [prog] = await connection.query('SELECT IdPrograma FROM programas WHERE IdPrograma = ?', [ProgramaId]);
        if (prog.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Program not found' });
        }
        const avisos = [];
        let guardados = 0;
        for (const it of items) {
            if (!it?.MaterialId) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: 'Cada item necesita MaterialId' });
            }
            const [mat] = await connection.query(
                `SELECT m.IdMateriales, m.Material, m.Cant, COALESCE(t.EsBarra, 0) AS EsBarra
                 FROM materiales m LEFT JOIN tipo_materiales t ON t.IdTipoMaterial = m.TipoMaterialId
                 WHERE m.IdMateriales = ?`,
                [it.MaterialId]
            );
            if (mat.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: `Material #${it.MaterialId} no encontrado` });
            }
            const esBarraItem = Number(mat[0].EsBarra) === 1;
            const cantidad = Number(it?.Cantidad);
            const vd = validarDimsReceta(it);
            if (vd.error) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: vd.error });
            }
            if (esBarraItem) {
                // Barras: no se pide cantidad, solo el largo a usar
                if (!vd.dims.Largo || vd.dims.Largo <= 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({ error: `En barras solo indica el largo a usar (${mat[0].Material})` });
                }
            } else if (isNaN(cantidad) || cantidad <= 0) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
            }
            await connection.query(
                'INSERT INTO programa_materiales (ProgramaId, MaterialId, Cantidad, Largo, Ancho, Alto) VALUES (?, ?, ?, ?, ?, ?)',
                [ProgramaId, it.MaterialId, esBarraItem ? 0 : cantidad, vd.dims.Largo, vd.dims.Ancho, vd.dims.Alto]
            );
            guardados++;
            if (!esBarraItem && cantidad > (Number(mat[0].Cant) || 0)) {
                avisos.push(`${mat[0].Material}: se piden ${cantidad}, hay ${mat[0].Cant ?? 0}`);
            }
        }
        await connection.commit();
        connection.release();
        io.emit('programaMaterialesActualizados', { programaId: ProgramaId });
        res.status(201).json({
            success: true,
            message: `Se asignaron ${guardados} material(es)`,
            guardados,
            warning: avisos.length > 0 ? 'Sin stock suficiente: ' + avisos.join(' · ') : null
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error en batch de materiales:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Marcar materiales completos de UN programa (declaración de que trae todo lo
// necesario). Solo se puede marcar si tiene ≥1 material asignado y hay stock
// suficiente (barras: pulgadas disponibles; demás: unidades). Solo admin.
app.put('/programasMarcarMateriales/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        const [prog] = await pool.query('SELECT IdPrograma, MaterialesCompleto FROM programas WHERE IdPrograma = ?', [id]);
        if (prog.length === 0) {
            return res.status(404).json({ error: 'Program not found' });
        }
        const nuevoValor = Number(prog[0].MaterialesCompleto) === 1 ? 0 : 1;
        if (nuevoValor === 1) {
            const [recetas] = await pool.query(
                `SELECT pm.Cantidad, pm.Largo,
                        m.Cant AS existencia, m.LargoDisponible,
                        COALESCE(t.EsBarra, 0) AS EsBarra
                 FROM programa_materiales pm
                 LEFT JOIN materiales m ON m.IdMateriales = pm.MaterialId
                 LEFT JOIN tipo_materiales t ON t.IdTipoMaterial = m.TipoMaterialId
                 WHERE pm.ProgramaId = ?`,
                [id]
            );
            if (recetas.length === 0) {
                return res.status(400).json({ error: 'Asigna al menos un material al programa primero' });
            }
            const faltantes = [];
            for (const r of recetas) {
                if (Number(r.EsBarra) === 1) {
                    if ((Number(r.LargoDisponible) || 0) < (Number(r.Largo) || 0)) {
                        faltantes.push('largo insuficiente en barras');
                    }
                } else if ((Number(r.existencia) || 0) < Number(r.Cantidad)) {
                    faltantes.push(`faltan ${Number(r.Cantidad) - (Number(r.existencia) || 0)} en stock`);
                }
            }
            if (faltantes.length > 0) {
                return res.status(400).json({ error: 'Sin stock suficiente: ' + faltantes.join(' · ') });
            }
        }
        await pool.query('UPDATE programas SET MaterialesCompleto = ? WHERE IdPrograma = ?', [nuevoValor, id]);
        io.emit('programaMaterialesActualizados', { programaId: Number(id) });
        res.json({
            success: true,
            MaterialesCompleto: nuevoValor === 1,
            message: nuevoValor === 1 ? 'Programa marcado con materiales completos' : 'Programa marcado con materiales incompletos'
        });
    } catch (error) {
        console.error('Error al marcar materiales del programa:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/programaMateriales/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { UsuarioId } = req.body || {};
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        const [prev] = await pool.query('SELECT ProgramaId FROM programa_materiales WHERE IdProgMat = ?', [id]);
        const [result] = await pool.query('DELETE FROM programa_materiales WHERE IdProgMat = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Asignación no encontrada' });
        }
        if (prev.length > 0) {
            io.emit('programaMaterialesActualizados', { programaId: prev[0].ProgramaId });
        }
        res.json({ success: true, message: 'Asignación eliminada (sin devolución: nunca descontó stock)' });
    } catch (error) {
        console.error('Error al eliminar asignación:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Configuración pin/funda por pin del bloque (informativo, no descuenta)
app.get('/bloquePinFunda', async (req, res) => {
    try {
        const { bloqueId } = req.query;
        if (!bloqueId) {
            return res.status(400).json({ error: 'bloqueId es requerido' });
        }
        const [rows] = await pool.query(
            `SELECT pf.IdPinFunda, pf.BloqueId, pf.NumPin, pf.PinMaterialId, pf.FundaMaterialId,
                    pf.Fecha, pf.UsuarioId,
                    mp.Material AS PinMaterial, mf.Material AS FundaMaterial
             FROM bloque_pin_funda pf
             LEFT JOIN materiales mp ON mp.IdMateriales = pf.PinMaterialId
             LEFT JOIN materiales mf ON mf.IdMateriales = pf.FundaMaterialId
             WHERE pf.BloqueId = ?
             ORDER BY pf.NumPin`,
            [bloqueId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener pin/funda:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/bloquePinFunda', async (req, res) => {
    try {
        const { BloqueId, NumPin, PinMaterialId, FundaMaterialId, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Only administrators' });
        }
        if (!BloqueId || !NumPin || Number(NumPin) < 1) {
            return res.status(400).json({ error: 'BloqueId y NumPin (>= 1) son requeridos' });
        }
        const [blq] = await pool.query('SELECT NoParte, CantidadPines FROM bloques WHERE NoParte = ?', [BloqueId]);
        if (blq.length === 0) {
            return res.status(404).json({ error: 'Block not found' });
        }
        if (Number(NumPin) > Number(blq[0].CantidadPines || 0)) {
            return res.status(400).json({ error: `El bloque solo tiene ${blq[0].CantidadPines || 0} pines` });
        }
        for (const [campo, valor, etiqueta] of [['PinMaterialId', PinMaterialId, 'pin'], ['FundaMaterialId', FundaMaterialId, 'funda']]) {
            if (valor !== undefined && valor !== null && valor !== '') {
                const [m] = await pool.query('SELECT IdMateriales FROM materiales WHERE IdMateriales = ?', [valor]);
                if (m.length === 0) {
                    return res.status(404).json({ error: `Material de ${etiqueta} no encontrado` });
                }
            }
        }
        const pinId = PinMaterialId === '' || PinMaterialId === undefined ? null : PinMaterialId;
        const fundaId = FundaMaterialId === '' || FundaMaterialId === undefined ? null : FundaMaterialId;
        const [existe] = await pool.query(
            'SELECT IdPinFunda FROM bloque_pin_funda WHERE BloqueId = ? AND NumPin = ? LIMIT 1',
            [BloqueId, NumPin]
        );
        if (existe.length > 0) {
            await pool.query(
                `UPDATE bloque_pin_funda
                 SET PinMaterialId = ?, FundaMaterialId = ?, Fecha = ?, UsuarioId = ?
                 WHERE IdPinFunda = ?`,
                [pinId, fundaId, getHermosilloDateTime(), UsuarioId, existe[0].IdPinFunda]
            );
        } else {
            await pool.query(
                `INSERT INTO bloque_pin_funda (BloqueId, NumPin, PinMaterialId, FundaMaterialId, Fecha, UsuarioId)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [BloqueId, NumPin, pinId, fundaId, getHermosilloDateTime(), UsuarioId]
            );
        }
        io.emit('bloquePinFundaActualizado', { bloqueId: BloqueId });
        res.json({ success: true, message: `Pin #${NumPin} configurado` });
    } catch (error) {
        console.error('Error al guardar pin/funda:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Historial de materiales de un bloque para la sección de ensamble:
// kardex etiquetado + lo planeado en sus programas (asignado vs. movido)
app.get('/ensambleHistorialMateriales', async (req, res) => {
    try {
        const { bloqueId } = req.query;
        if (!bloqueId) {
            return res.status(400).json({ error: 'bloqueId es requerido' });
        }
        const [movs] = await pool.query(
            `SELECT m.IdMovimiento, m.TipoMov, m.Cantidad, m.ProgramaId, m.Fecha,
                    DATE_FORMAT(m.Fecha, '%d/%m/%Y %H:%i') AS FechaFormateada,
                    m.UsuarioId, m.Comentario, u.Nombre AS UsuarioNombre
             FROM inventario_movimientos m
             LEFT JOIN usuarios u ON u.NoEmpleado = m.UsuarioId
             WHERE m.BloqueNoParte = ?
             ORDER BY m.Fecha DESC, m.IdMovimiento DESC
             LIMIT 100`,
            [bloqueId]
        );
        const [planeado] = await pool.query(
            `SELECT pm.IdProgMat, pm.ProgramaId, pm.MaterialId, pm.Cantidad,
                    pm.Largo, pm.Ancho, pm.Alto,
                    m.Material, m.Cant AS Existencia,
                    p.NumeroOperacion, p.NombrePrograma
             FROM programa_materiales pm
             JOIN programas p ON p.IdPrograma = pm.ProgramaId
             LEFT JOIN dibujos_bloques d ON d.IdDibujo = p.DibujoId
             LEFT JOIN materiales m ON m.IdMateriales = pm.MaterialId
             WHERE p.BloqueId = ? OR d.BloqueId = ?
             ORDER BY p.IdPrograma, pm.IdProgMat`,
            [bloqueId, bloqueId]
        );
        res.json({ movimientos: movs, planeado });
    } catch (error) {
        console.error('Error al obtener historial de materiales:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

server.listen(port, () => { console.log(`Servidor iniciado en el puerto ${port}`); });