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
        cb(new Error('Solo se permiten imágenes'), false);
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
            message: 'Ingrese usuario y contraseña'
        });
    }
    try {
        const [rows] = await pool.query(
            `SELECT * FROM usuarios WHERE NoEmpleado = ?`, [NoEmpleado]);
        const user = rows[0];
        if (!user) { return res.status(401).json({ error: 'Credenciales incorrectas' }); }
        const match = await bcrypt.compare(Contraseña, user.Contraseña);
        if (!match) { return res.status(401).json({ error: 'Credenciales incorrectas' }); }
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
            message: 'Login exitoso',
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
            error: 'Error interno del servidor'
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

        res.status(201).json({ message: 'Usuario creado', id: result.insertId });
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
            return res.status(400).json({ error: 'NoParte es requerido' });
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
            title: 'Nuevo Block Creado',
            message: `Block ${NoParte} creado`,
            noParte: NoParte,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifBlockCreated);
        saveNotification({ ...notifBlockCreated, referenciaTipo: 'bloque', referenciaId: NoParte, emisorId: Creador, targetUserId: Creador });
        res.status(201).json({
            message: 'Bloque creado',
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
                error: 'Faltan campos requeridos: BloqueId, TipoDibujoId, UsuarioId'
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
                error: 'Debe proporcionar un archivo o una URL'
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

        res.status(201).json({
            message: 'Dibujo creado correctamente',
            id: result.insertId,
            rutaDibujo: rutaDibujo,
            fechaSubida: fechaSubida
        });

    } catch (error) {
        console.error('Error al insertar dibujo:', error);
        res.status(500).json({
            error: 'Error al guardar el dibujo en la base de datos',
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
                error: 'Faltan campos requeridos: DibujoId, UsuarioId'
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
                error: 'Debe proporcionar un archivo'
            });
        }

        console.log('📁 Archivo original:', nombrePrograma);
        console.log('📁 Archivo guardado:', rutaPrograma);

        // Insertar programa
        const [result] = await pool.query(
            `INSERT INTO programas 
            (DibujoId, NumeroOperacion, NombrePrograma, RutaPrograma, FechaSubida, SubidoPor) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
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

        res.status(201).json({
            message: 'Programa creado correctamente',
            id: result.insertId,
            nombrePrograma: nombrePrograma,
            rutaPrograma: rutaPrograma,
            fechaSubida: fechaSubida
        });

    } catch (error) {
        console.error('❌ Error al insertar programa:', error);

        res.status(500).json({
            error: 'Error al guardar el programa en la base de datos',
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
                error: 'Faltan campos requeridos: BloqueId, NombreEnsamble, UsuarioId'
            });
        }

        if (!req.file) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                error: 'Debe proporcionar un archivo'
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

        res.status(201).json({
            message: 'Ensemble creado correctamente',
            id: result.insertId,
            RutaEnsamble: RutaEnsamble,
            fechaSubida: fechaSubida
        });

    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error al insertar ensemble:', error);
        res.status(500).json({
            error: 'Error al guardar el ensemble en la base de datos',
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
                return res.status(400).json({ error: 'Usuario no encontrado' });
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
                    error: 'Ya existe un ticket CRÍTICO activo en tu área. No se pueden crear múltiples tickets críticos por área.'
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
                    throw new Error(`BloqueId y Cantidad son requeridos para cada detalle`);
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

            await connection.commit();
            connection.release();

            // Emitir eventos
            io.emit('ticketsActualizados');
            const notifTicketCreated = {
                type: 'ticket_created',
                title: 'Nuevo Ticket Creado',
                message: `Ticket #${ticketId} creado por ${SolicitanteId}`,
                ticketId,
                prioridad: PrioridadId,
                timestamp: getHermosilloDateTime()
            };
            io.emit('notification', notifTicketCreated);
            saveNotification({ ...notifTicketCreated, referenciaTipo: 'ticket', referenciaId: ticketId, emisorId: SolicitanteId, targetUserId: SolicitanteId });

            res.status(201).json({
                message: 'Ticket creado correctamente',
                ticketId: ticketId,
                estadoId: 1, // <-- Indicar que se asignó el estado RECIBIDO
                fechaSolicitacion: fechaSolicitacion,
                fechaEstimada: fechaEstimadaStr
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error al insertar ticket:', error);
        res.status(500).json({
            error: 'Error al guardar el ticket',
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

        res.json({ message: 'Usuario actualizado correctamente', data: rows });
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

        res.json({ message: 'Contraseña actualizada correctamente' });
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
            return res.status(400).json({ error: 'NoParteOriginal es requerido' });
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
        const notifBlockUpdated = {
            type: 'block_updated',
            title: 'Block Actualizado',
            message: `Block ${NoParte} ha sido actualizado`,
            noParte: NoParte,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifBlockUpdated);
        saveNotification({ ...notifBlockUpdated, referenciaTipo: 'bloque', referenciaId: NoParte, emisorId: Creador, targetUserId: Creador });

        res.json({
            message: 'Bloque actualizado correctamente',
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
                error: 'Faltan campos requeridos: BloqueId, TipoDibujoId, UsuarioId'
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
                error: 'Debe proporcionar un archivo o una URL'
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
            message: 'Dibujo creado correctamente',
            id: result.insertId,
            rutaDibujo: rutaDibujo,
            nombreDibujo: nombreDibujo,
            fechaSubida: fechaSubida
        });

    } catch (error) {
        console.error('Error al insertar dibujo:', error);
        res.status(500).json({
            error: 'Error al guardar el dibujo en la base de datos',
            details: error.message
        });
    }
});

app.put('/dibujosUpdate', uploadDibujo.single('RutaDibujo'), async (req, res) => {
    try {
        const { IdDibujo, BloqueId, TipoDibujoId, FechaSubida, RutaDibujoUrl } = req.body;

        console.log('📝 Actualizando dibujo:', { IdDibujo, BloqueId, TipoDibujoId, FechaSubida });

        if (!IdDibujo) {
            return res.status(400).json({ error: 'IdDibujo es requerido' });
        }

        // Obtener el dibujo actual
        const [current] = await pool.query(
            'SELECT RutaDibujo, NombreDibujo FROM dibujos_bloques WHERE IdDibujo = ?',
            [IdDibujo]
        );

        if (current.length === 0) {
            return res.status(404).json({ error: 'Dibujo no encontrado' });
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
            message: 'Dibujo actualizado correctamente',
            data: result,
            rutaDibujo: rutaDibujo,
            nombreDibujo: nombreDibujo,
            fechaSubida: fechaSubidaFinal
        });

    } catch (error) {
        console.error('Error al actualizar dibujo:', error);
        res.status(500).json({
            error: 'Error al actualizar el dibujo',
            details: error.message
        });
    }
});
/*---------------------------------------------------ENSAMBLES---------------------------------------------------*/
app.put('/ensamblesUpdate', uploadEnsemble.single('RutaEnsamble'), async (req, res) => {
    try {
        const { IdEnsamble, BloqueId, NombreEnsamble, RutaEnsambleUrl } = req.body;

        if (!IdEnsamble) {
            return res.status(400).json({ error: 'IdEnsamble es requerido' });
        }

        const [current] = await pool.query(
            'SELECT RutaEnsamble FROM ensambles WHERE IdEnsamble = ?',
            [IdEnsamble]
        );

        if (current.length === 0) {
            return res.status(404).json({ error: 'Ensemble no encontrado' });
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
            message: 'Ensemble actualizado correctamente',
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
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        const ticket = ticketActual[0];

        // ✅ Si el ticket está en papelera, no se puede actualizar
        if (ticket.Activo === 0) {
            return res.status(400).json({ error: 'No se puede actualizar un ticket en papelera' });
        }

        // 🔒 Candado ENTREGADO: un ticket entregado ya no admite actualizaciones
        const [estadoEntregadoCheck] = await pool.query(
            'SELECT IdEstado FROM estados WHERE NombreEstado = ?',
            ['ENTREGADO']
        );
        if (estadoEntregadoCheck.length > 0 && ticket.EstadoId === estadoEntregadoCheck[0].IdEstado) {
            return res.status(400).json({ error: 'No se puede actualizar un ticket ENTREGADO' });
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
                return res.status(400).json({ error: 'Usuario no encontrado' });
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
                    error: 'Ya existe un ticket CRÍTICO activo en tu área. No se pueden tener múltiples tickets críticos por área.'
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
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        query += updates.join(', ');
        query += ' WHERE IdTicket = ? AND Activo = 1';
        values.push(id);

        const [result] = await pool.query(query, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ticket no encontrado o no activo' });
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
        const notifTicketUpdated = {
            type: 'ticket_updated',
            title: 'Ticket Actualizado',
            message: `Ticket #${id} ha sido actualizado`,
            ticketId: id,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifTicketUpdated);
        saveNotification({ ...notifTicketUpdated, referenciaTipo: 'ticket', referenciaId: id, emisorId: SolicitanteId, targetUserId: SolicitanteId });

        res.json({
            message: 'Ticket actualizado correctamente',
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
            return res.status(404).json({ error: 'Bloque no encontrado' });
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
            return res.status(404).json({ error: 'Ticket no encontrado' });
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
            return res.status(400).json({ error: 'Estado no válido' });
        }

        // Verificar que el estado sea manual
        if (estadoCheck[0].EsAutomatico === 1) {
            return res.status(400).json({
                error: 'Este estado es automático y no puede ser asignado manualmente'
            });
        }

        // Verificar que el estado no esté antes que el actual
        const [estadoActual] = await pool.query(
            'SELECT EstadoId FROM tickets WHERE IdTicket = ?',
            [ticketId]
        );

        const [ordenActual] = await pool.query(
            'SELECT Orden FROM estados WHERE IdEstado = ?',
            [estadoActual[0].EstadoId]
        );

        const [nuevoOrden] = await pool.query(
            'SELECT Orden FROM estados WHERE IdEstado = ?',
            [EstadoId]
        );

        if (nuevoOrden[0].Orden < ordenActual[0].Orden) {
            return res.status(400).json({
                error: 'No se puede retroceder a un estado anterior'
            });
        }

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
                    error: 'El ticket no tiene bloques asociados' 
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
                        error: `El bloque ${bloque.BloqueId} no existe` 
                    });
                }
                
                if (!bloqueStatus[0].EnsambleCompleto) {
                    return res.status(400).json({ 
                        error: `El bloque ${bloque.BloqueId} no tiene Ensamble completo. Debe subir el ensamble antes de entregar.` 
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

        // Si el nuevo estado es COMPLETO, notificar al solicitante
        if (estadoCheck[0].NombreEstado === 'COMPLETO') {
            const [ticketInfo] = await pool.query(
                'SELECT SolicitanteId FROM tickets WHERE IdTicket = ?',
                [ticketId]
            );
            
            if (ticketInfo.length > 0 && ticketInfo[0].SolicitanteId !== UsuarioId) {
                const notifTicketCompleted = {
                    type: 'ticket_completed',
                    title: 'Tu Ticket ha sido Completado',
                    message: `El ticket #${ticketId} ha sido marcado como COMPLETO`,
                    ticketId,
                    targetUserId: ticketInfo[0].SolicitanteId,
                    timestamp: getHermosilloDateTime()
                };
                io.emit('notification', notifTicketCompleted);
                saveNotification({ ...notifTicketCompleted, referenciaTipo: 'ticket', referenciaId: ticketId, emisorId: UsuarioId, targetUserId: ticketInfo[0].SolicitanteId });
            }
        }

        io.emit('ticketEstadoActualizado', { ticketId, nuevoEstadoId: EstadoId });

        res.json({
            success: true,
            message: `Estado actualizado a: ${estadoCheck[0].NombreEstado}`,
            nuevoEstado: estadoCheck[0].NombreEstado,
            fechaCambio
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
 
        res.json({
            noParte,
            DibujosCompleto: bloque[0]?.DibujosCompleto || false,
            ProgramasCompleto: bloque[0]?.ProgramasCompleto || false,
            EnsambleCompleto: bloque[0]?.EnsambleCompleto || false,
            dibujosCount: dibujos.length,
            programasCount: totalProgramas,
            ensamblesCount: ensambles[0].total,
            drawingsWithoutPrograms
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
            return res.status(403).json({ error: 'Solo administradores pueden marcar dibujos como completos' });
        }
 
        // Validar que existan dibujos
        const [dibujos] = await pool.query('SELECT COUNT(*) as total FROM dibujos_bloques WHERE BloqueId = ?', [noParte]);
        if (dibujos[0].total === 0) {
            return res.status(400).json({ error: 'No hay dibujos subidos para este bloque' });
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
                 `Bloque ${noParte}: dibujos marcados ${nuevoValor ? 'COMPLETOS' : 'INCOMPLETOS'}`,
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

        res.json({ success: true, DibujosCompleto: nuevoValor, message: nuevoValor ? 'Dibujos marcados como completos' : 'Dibujos marcados como incompletos' });
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
            return res.status(403).json({ error: 'Solo administradores pueden marcar programas como completos' });
        }
 
        // Validar que existan dibujos
        const [dibujos] = await pool.query('SELECT IdDibujo, NombreDibujo FROM dibujos_bloques WHERE BloqueId = ?', [noParte]);
        if (dibujos.length === 0) {
            return res.status(400).json({ error: 'Primero debe haber dibujos subidos' });
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
                error: `Los siguientes dibujos no tienen programas: ${sinProgramas.join(', ')}` 
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
                 `Bloque ${noParte}: programas marcados ${nuevoValor ? 'COMPLETOS' : 'INCOMPLETOS'}`,
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

        res.json({ success: true, ProgramasCompleto: nuevoValor, message: nuevoValor ? 'Programas marcados como completos' : 'Programas marcados como incompletos' });
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
            return res.status(403).json({ error: 'Solo administradores pueden marcar bloques como completos' });
        }

        // Verificar si el bloque existe
        const [bloqueCheck] = await pool.query(
            'SELECT NoParte FROM bloques WHERE NoParte = ?',
            [noParte]
        );

        if (bloqueCheck.length === 0) {
            return res.status(404).json({ error: 'Bloque no encontrado' });
        }

        // Marcar el bloque como completo (podrías agregar un campo "Completo" en la tabla bloques)
        await pool.query(
            'UPDATE bloques SET Completo = 1, FechaCompletado = NOW() WHERE NoParte = ?',
            [noParte]
        );

        io.emit('bloqueCompletado', { noParte });

        res.json({
            success: true,
            message: 'Bloque marcado como completo'
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
                DATE_FORMAT(t.FechaSolicitacion, '%d/%m/%Y %H:%i') as FechaSolicitacionFormateada,
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
                        tc.TipoConector
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
                        tc.TipoConector
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
            return res.status(403).json({ error: 'No tienes permisos para cerrar tickets' });
        }

        // VALIDACIÓN: Verificar que todos los bloques del ticket tengan EnsambleCompleto
        const [bloquesTicket] = await pool.query(
            'SELECT BloqueId FROM tickets_details WHERE TicketId = ?',
            [id]
        );
        
        if (bloquesTicket.length === 0) {
            return res.status(400).json({ 
                error: 'El ticket no tiene bloques asociados' 
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
                    error: `El bloque ${bloque.BloqueId} no existe` 
                });
            }
            
            if (!bloqueStatus[0].EnsambleCompleto) {
                return res.status(400).json({ 
                    error: `El bloque ${bloque.BloqueId} no tiene Ensamble completo. Debe subir el ensamble antes de cerrar.` 
                });
            }
        }

        // Obtener el ID del estado "COMPLETO"
        const [estadoCompleto] = await pool.query(
            'SELECT IdEstado FROM estados WHERE NombreEstado = ?',
            ['COMPLETO']
        );

        if (estadoCompleto.length === 0) {
            return res.status(500).json({ error: 'Estado "COMPLETO" no encontrado' });
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
            return res.status(404).json({ error: 'Ticket no encontrado' });
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
                title: 'Tu Ticket ha sido Completado',
                message: `El ticket #${id} ha sido marcado como COMPLETO`,
                ticketId: id,
                targetUserId: ticketInfo[0].SolicitanteId,
                timestamp: getHermosilloDateTime()
            };
            io.emit('notification', notifTicketCompleted);
            saveNotification({ ...notifTicketCompleted, referenciaTipo: 'ticket', referenciaId: id, emisorId: CerradoPor, targetUserId: ticketInfo[0].SolicitanteId });
        }

        res.json({
            success: true,
            message: 'Ticket cerrado correctamente'
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
            return res.status(404).json({ error: 'Ticket no encontrado en papelera' });
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
            message: 'Ticket restaurado correctamente'
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
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        // 2. Obtener los detalles del ticket
        const [detalles] = await pool.query(
            `SELECT 
                td.IdTicketDetail,
                td.BloqueId,
                td.Cantidad,
                b.NoParte,
                tc.TipoConector
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

        // 🔒 Candado ENTREGADO: un ticket entregado no se puede mandar a papelera
        const [ticketEstado] = await pool.query(
            `SELECT t.EstadoId FROM tickets t WHERE t.IdTicket = ?`,
            [id]
        );
        if (ticketEstado.length > 0) {
            const [entregado] = await pool.query(
                'SELECT IdEstado FROM estados WHERE NombreEstado = ?',
                ['ENTREGADO']
            );
            if (entregado.length > 0 && ticketEstado[0].EstadoId === entregado[0].IdEstado) {
                return res.status(400).json({ error: 'No se puede mover a papelera un ticket ENTREGADO' });
            }
        }

        const [result] = await pool.query(
            `UPDATE tickets
             SET Activo = 0, FechaEliminacion = ?
             WHERE IdTicket = ?`,
            [fechaEliminacion, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        // Historial: ticket movido a papelera (FIX: CerradoPor no existía en este scope)
        const eliminadoPor = req.body?.UsuarioId ?? null;
        await pool.query(
            `INSERT INTO ordenes_estados_historial
             (TicketId, EstadoId, FechaCambio, UsuarioId, Comentario, TipoEvento)
             VALUES (?, NULL, ?, ?, ?, ?)`,
            [id, fechaEliminacion, eliminadoPor, 'Ticket movido a papelera', 'papelera']
        );

        io.emit('ticketsActualizados');
        io.emit('ticketEstadoActualizado', { ticketId: id });
        const notifTicketTrashed = {
            type: 'ticket_trashed',
            title: 'Ticket a Papelera',
            message: `Ticket #${id} movido a papelera`,
            ticketId: id,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifTicketTrashed);
        saveNotification({ ...notifTicketTrashed, referenciaTipo: 'ticket', referenciaId: id, emisorId: eliminadoPor, targetUserId: eliminadoPor });

        res.json({
            success: true,
            message: 'Ticket movido a papelera correctamente'
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
        return res.status(400).json({ error: 'ID de bloque invalido' });
    }

    try {
        const [existingBLock] = await pool.query(
            'SELECT NoParte FROM bloques WHERE NoParte = ?',
            [NoParte]
        );
        if (existingBLock.length === 0) {
            return res.status(404).json({ error: 'bloque no encontrado' });
        }

        const [result] = await pool.query(
            'DELETE FROM bloques WHERE NoParte = ?',
            [NoParte]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'bloque no encontrado' });
        }

        io.emit("bloquesActualizados");
        const notifBlockDeleted = {
            type: 'block_deleted',
            title: 'Block Eliminado',
            message: `Block ${NoParte} eliminado`,
            noParte: NoParte,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifBlockDeleted);
        saveNotification({ ...notifBlockDeleted, referenciaTipo: 'bloque', referenciaId: NoParte, emisorId: req.body.UsuarioId, targetUserId: req.body.UsuarioId });

        res.json({
            success: true,
            message: 'Bloque eliminado correctamente',
            NoParte: NoParte
        });
    } catch (error) {
        console.error('Error al eliminar bloque:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
/*---------------------------------------------------DIBUJOS---------------------------------------------------*/
app.delete('/dibujosDelete/:IdDibujo', async (req, res) => {
    const { IdDibujo } = req.params;

    if (!IdDibujo) {
        return res.status(400).json({ error: 'ID de dibujo inválido' });
    }

    try {
        const [existingDrawing] = await pool.query(
            'SELECT IdDibujo FROM dibujos_bloques WHERE IdDibujo = ?',
            [IdDibujo]
        );
        if (existingDrawing.length === 0) {
            return res.status(404).json({ error: 'Dibujo no encontrado' });
        }

        // VALIDACIÓN: Verificar si el dibujo tiene programas asociados
        const [programas] = await pool.query(
            'SELECT COUNT(*) as total FROM programas WHERE DibujoId = ?',
            [IdDibujo]
        );

        if (programas[0].total > 0) {
            return res.status(400).json({ 
                error: `No se puede eliminar el dibujo. Tiene ${programas[0].total} programa(s) asociado(s). Elimine primero los programas.`
            });
        }

        const [result] = await pool.query(
            'DELETE FROM dibujos_bloques WHERE IdDibujo = ?',
            [IdDibujo]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Dibujo no encontrado' });
        }

        io.emit('dibujosActualizados');
        const notifDrawingDeleted = {
            type: 'drawing_deleted',
            title: 'Dibujo Eliminado',
            message: `Dibujo eliminado`,
            dibujoId: IdDibujo,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifDrawingDeleted);
        saveNotification({ ...notifDrawingDeleted, referenciaTipo: 'dibujo', referenciaId: IdDibujo, emisorId: req.body?.UsuarioId || null, targetUserId: req.body?.UsuarioId || null });

        res.json({
            success: true,
            message: 'Dibujo eliminado correctamente',
            IdDibujo: IdDibujo
        });
    } catch (error) {
        console.error('Error al eliminar dibujo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
/*---------------------------------------------------PROGRAMAS---------------------------------------------------*/
app.delete('/programasDelete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            'SELECT RutaPrograma FROM programas WHERE IdPrograma = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Programa no encontrado' });
        }

        // Eliminar archivo físico
        if (rows[0].RutaPrograma) {
            const filePath = path.join(__dirname, 'uploads/programas/', rows[0].RutaPrograma);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await pool.query('DELETE FROM programas WHERE IdPrograma = ?', [id]);

        io.emit('programasActualizados');
        const notifProgramDeleted = {
            type: 'program_deleted',
            title: 'Programa Eliminado',
            message: `Programa eliminado`,
            programaId: id,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifProgramDeleted);
        saveNotification({ ...notifProgramDeleted, referenciaTipo: 'programa', referenciaId: id, emisorId: req.body?.UsuarioId || null, targetUserId: req.body?.UsuarioId || null });

        res.json({
            success: true,
            message: 'Programa eliminado correctamente'
        });
    } catch (error) {
        console.error('Error al eliminar programa:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
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
            return res.status(404).json({ error: 'Ensemble no encontrado' });
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
        const notifEnsembleDeleted = {
            type: 'ensemble_deleted',
            title: 'Ensemble Eliminado',
            message: `Ensemble eliminado`,
            ensembleId: id,
            timestamp: getHermosilloDateTime()
        };
        io.emit('notification', notifEnsembleDeleted);
        saveNotification({ ...notifEnsembleDeleted, referenciaTipo: 'ensamble', referenciaId: id, emisorId: req.body.UsuarioId || null });

        res.json({
            success: true,
            message: 'Ensemble eliminado correctamente'
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
            return res.status(404).json({ error: 'Programa no encontrado' });
        }

        const programa = rows[0];
        const filePath = path.join(__dirname, 'uploads/programas/', programa.RutaPrograma);

        // Verificar si el archivo existe
        try {
            await fsp.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
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
                res.status(500).json({ error: 'Error al descargar el programa' });
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
            // Eliminar detalles
            await connection.query('DELETE FROM tickets_details WHERE TicketId = ?', [id]);

            // Eliminar historial (evita filas huérfanas)
            await connection.query('DELETE FROM ordenes_estados_historial WHERE TicketId = ?', [id]);

            // Eliminar ticket
            const [result] = await connection.query('DELETE FROM tickets WHERE IdTicket = ?', [id]);

            if (result.affectedRows === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Ticket no encontrado' });
            }

await connection.commit();
            connection.release();

            io.emit('ticketsActualizados');
            const eliminadoPor = req.body?.UsuarioId ?? null;
            const notifTicketDeleted = {
                type: 'ticket_deleted',
                title: 'Ticket Eliminado Permanentemente',
                message: `Ticket #${id} eliminado permanentemente`,
                ticketId: id,
                timestamp: getHermosilloDateTime()
            };
            io.emit('notification', notifTicketDeleted);
            saveNotification({ ...notifTicketDeleted, referenciaTipo: 'ticket', referenciaId: id, emisorId: eliminadoPor, targetUserId: eliminadoPor });

            res.json({
                success: true,
                message: 'Ticket eliminado permanentemente'
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
            return res.status(404).json({ error: 'Ensemble no encontrado' });
        }

        const ensemble = rows[0];
        const filePath = path.join(__dirname, 'uploads/ensambles/', ensemble.RutaEnsamble);

        try {
            await fsp.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        const extension = path.extname(ensemble.RutaEnsamble || '');
        const nombreBase = ensemble.NombreEnsamble || 'ensemble';
        const nombreDescarga = nombreBase + extension;

        res.download(filePath, nombreDescarga, (err) => {
            if (err) {
                console.error('Error al descargar ensemble:', err);
                res.status(500).json({ error: 'Error al descargar el ensemble' });
            }
        });

    } catch (error) {
        console.error('Error al descargar ensemble:', error);
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

// Función helper para guardar notificación en BD
// Si no hay usuario destino (eventos broadcast como deletes sin UsuarioId),
// no se guarda fila y se evita el error "Column 'UsuarioId' cannot be null".
// El evento en tiempo real ya se emitió con io.emit antes de llamar aquí.
const saveNotification = async (notification) => {
    const targetId = notification?.targetUserId ?? notification?.UsuarioId ?? null;
    if (targetId === null || targetId === undefined || targetId === '') return;
    try {
        await pool.query(
            `INSERT INTO notificaciones_historial 
             (Tipo, Titulo, Mensaje, UsuarioId, UsuarioEmisorId, ReferenciaId, ReferenciaTipo) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                notification.type,
                notification.title,
                notification.message,
                notification.targetUserId || notification.UsuarioId,
                notification.emisorId || notification.UsuarioEmisorId,
                notification.referenciaId || notification.ReferenciaId,
                notification.referenciaTipo || notification.ReferenciaTipo
            ]
        );
    } catch (error) {
        console.error('Error guardando notificación en BD:', error);
    }
};

// GET /notificaciones/historial - Obtener historial de notificaciones del usuario
app.get('/notificaciones/historial', async (req, res) => {
    try {
        const { usuarioId, leida, limite, offset } = req.query;
        
        if (!usuarioId) {
            return res.status(400).json({ error: 'usuarioId es requerido' });
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
            return res.status(400).json({ error: 'usuarioId es requerido' });
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
            return res.status(400).json({ error: 'usuarioId es requerido' });
        }

        const [result] = await pool.query(
            `UPDATE notificaciones_historial 
             SET Leida = 1, FechaLectura = ? 
             WHERE IdNotificacion = ? AND UsuarioId = ?`,
            [getHermosilloDateTime(), id, usuarioId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }

        io.emit('notificacionLeida', { id, usuarioId });
        res.json({ success: true, message: 'Notificación marcada como leída' });
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
            return res.status(400).json({ error: 'usuarioId es requerido' });
        }

        await pool.query(
            `UPDATE notificaciones_historial 
             SET Leida = 1, FechaLectura = ? 
             WHERE UsuarioId = ? AND Leida = 0`,
            [getHermosilloDateTime(), usuarioId]
        );

        io.emit('notificacionesTodasLeidas', { usuarioId });
        res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
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
            return res.status(400).json({ error: 'usuarioId es requerido' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            `SELECT m.IdMateriales, m.Material, m.Descripcion, m.Largo, m.Ancho,
                    m.Cant, m.StockMinimo, m.TipoMaterialId, tm.TipoMaterial,
                    m.SubtipoMaterialId, sm.SubtipoMaterial
             FROM materiales m
             LEFT JOIN tipo_materiales tm ON tm.IdTipoMaterial = m.TipoMaterialId
             LEFT JOIN subtipo_material sm ON sm.IdSubtipoMaterial = m.SubtipoMaterialId
             ORDER BY m.Material`
        );
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener materiales:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/materialesInsert', async (req, res) => {
    try {
        const { Material, Descripcion, Largo, Ancho, Cant, StockMinimo, TipoMaterialId, SubtipoMaterialId, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Solo administradores' });
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
        const [result] = await pool.query(
            `INSERT INTO materiales (Material, Descripcion, Largo, Ancho, Cant, StockMinimo, TipoMaterialId, SubtipoMaterialId)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [String(Material).trim(), Descripcion || null, Largo || null, Ancho || null, cantidad, minimo, TipoMaterialId, subtipoId]
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
        const { Material, Descripcion, Largo, Ancho, StockMinimo, TipoMaterialId, SubtipoMaterialId, UsuarioId } = req.body;
        if (!(await checkAdminInventario(UsuarioId))) {
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(400).json({ error: 'No hay campos para actualizar' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(403).json({ error: 'Solo administradores' });
        }
        // Nota: Cant NO se edita aquí; solo vía movimientos (entradas/salidas)
        const updates = [];
        const values = [];
        if (Herramienta !== undefined) { updates.push('Herramienta = ?'); values.push(String(Herramienta).trim()); }
        if (TipoHerramientaId !== undefined && TipoHerramientaId !== '') { updates.push('TipoHerramientaId = ?'); values.push(TipoHerramientaId); }
        if (Size !== undefined) { updates.push('Size = ?'); values.push(Size || null); }
        if (MaterialHerramienta !== undefined) { updates.push('MaterialHerramienta = ?'); values.push(MaterialHerramienta || null); }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            `SELECT Cant FROM ${tabla} WHERE ${idCol} = ?`,
            [ReferenciaId]
        );
        if (actual.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Artículo no encontrado' });
        }
        const existencia = Number(actual[0].Cant) || 0;
        if (TipoMov === 'salida' && existencia < cantidad) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: `Stock insuficiente. Existencia: ${existencia}` });
        }

        const nuevaCant = TipoMov === 'entrada' ? existencia + cantidad : existencia - cantidad;
        await connection.query(
            `UPDATE ${tabla} SET Cant = ? WHERE ${idCol} = ?`,
            [nuevaCant, ReferenciaId]
        );
        await connection.query(
            `INSERT INTO inventario_movimientos (TipoItem, ReferenciaId, TipoMov, Cantidad, Fecha, UsuarioId, Comentario)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [TipoItem, ReferenciaId, TipoMov, cantidad, getHermosilloDateTime(), UsuarioId, Comentario || null]
        );

        await connection.commit();
        connection.release();

        io.emit('inventarioActualizado');

        res.status(201).json({ success: true, message: 'Movimiento registrado', nuevaExistencia: nuevaCant });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error al registrar movimiento:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/inventarioMovimientos', async (req, res) => {
    try {
        const { tipoItem, referenciaId, limite } = req.query;
        let query = `
            SELECT m.IdMovimiento, m.TipoItem, m.ReferenciaId, m.TipoMov, m.Cantidad,
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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
            return res.status(403).json({ error: 'Solo administradores' });
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

/*---------------------------------------------------DEMANDA DE BLOCKS (solo lectura, agregada)---------------------------------------------------*/
app.get('/inventarioDemandaBlocks', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT td.BloqueId AS NoParte,
                    SUM(td.Cantidad) AS Requerido,
                    COUNT(DISTINCT td.TicketId) AS Tickets,
                    MAX(b.DibujosCompleto) AS DibujosCompleto,
                    MAX(b.ProgramasCompleto) AS ProgramasCompleto,
                    MAX(b.EnsambleCompleto) AS EnsambleCompleto
             FROM tickets_details td
             JOIN tickets t ON t.IdTicket = td.TicketId
             LEFT JOIN estados e ON e.IdEstado = t.EstadoId
             LEFT JOIN bloques b ON b.NoParte = td.BloqueId
             WHERE t.Activo = 1
               AND (e.NombreEstado IS NULL OR e.NombreEstado NOT IN ('COMPLETO', 'ENTREGADO'))
             GROUP BY td.BloqueId
             ORDER BY Requerido DESC`
        );
        res.json(rows.map(r => ({
            ...r,
            Requerido: Number(r.Requerido),
            Tickets: Number(r.Tickets)
        })));
    } catch (error) {
        console.error('Error al obtener demanda de blocks:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

server.listen(port, () => { console.log(`Servidor iniciado en el puerto ${port}`); });