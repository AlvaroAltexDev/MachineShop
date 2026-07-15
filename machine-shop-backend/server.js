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

const app = express();
dotenv.config();
const port = process.env.PORT || 3002;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
    }
});

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
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

app.use('/uploads', express.static('uploads'));
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    moment.tz.setDefault("America/Hermosillo");

    const horaActual = moment().format('YYYY-MM-DD HH:mm:ss');
    console.log(`🕐 Hora en Nogales (${horaActual}) - UTC: ${new Date().toUTCString()}`);
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
    const { NoEmpleado, Nombre, Contraseña, Correo, RolId } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(Contraseña, 10);
        const [result] = await pool.query(
            'INSERT INTO usuarios (NoEmpleado, Nombre, Contraseña, Correo, RolId) VALUES (?, ?, ?, ?, ?)',
            [NoEmpleado, Nombre, hashedPassword, Correo, RolId]
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
        const { NoParte, CantidadPines, TipoConectorId, TipoTerminalId, Candado, FechaAlta, Creador } = req.body;
        const Imagen = req.file ? req.file.filename : null;

        if (!NoParte) {
            return res.status(400).json({ error: 'NoParte es requerido' });
        }

        // Si no se envía FechaAlta, usar la fecha/hora actual
        const ahora = new Date();
        const horaNogales = new Date(ahora.getTime() - (7 * 60 * 60 * 1000));
        const fechaHora = horaNogales.toISOString().slice(0, 19).replace('T', ' ');

        console.log(`📍 Hora UTC: ${ahora.toISOString()}`);
        console.log(`📍 Hora Nogales: ${fechaHora}`);

        const [result] = await pool.query(
            'INSERT INTO bloques (NoParte, Imagen, CantidadPines, TipoConectorId, TipoTerminalId, Candado FechaAlta, Creador) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [NoParte, Imagen, CantidadPines, TipoConectorId, TipoTerminalId, Candado, fechaHora, Creador]
        );

        io.emit('bloquesActualizados');
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
/*---------------------------------------------------ENSAMBLES---------------------------------------------------*/
app.post('/ensamblesInsert', async (req, res) => {
    const { Archivo } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO ensambles (Archivo) VALUES (?)',
            [Archivo]
        );
        io.emit('ensamblesActualizados');
        res.status(201).json({ message: 'Ensamble creado', id: result.insertId });
    } catch (error) {
        console.error('Error al insertar ensamble:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!UPDATES!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/
/*---------------------------------------------------USUARIOS---------------------------------------------------*/
app.put('/usuariosUpdate', async (req, res) => {
    const { NoEmpleado, Nombre, Correo, RolId } = req.body;

    try {
        const [rows] = await pool.query(
            'UPDATE usuarios SET Nombre = ?, Correo = ?, RolId = ? WHERE NoEmpleado = ?',
            [Nombre, Correo, RolId, NoEmpleado]
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
        const { NoParte, NoParteOriginal, CantidadPines, TipoConectorId, TipoTerminalId, Candado, ImagenUrl } = req.body;

        if (!NoParteOriginal) {
            return res.status(400).json({ error: 'NoParteOriginal es requerido' });
        }

        // Si se subió una nueva imagen, usarla; si no, mantener la existente
        const Imagen = req.file ? req.file.filename : (ImagenUrl || null);

        // Usar NoParteOriginal para identificar el registro
        // El ON UPDATE CASCADE actualizará automáticamente las tablas relacionadas
        const [rows] = await pool.query(
            'UPDATE bloques SET NoParte = ?, Imagen = ?, CantidadPines = ?, TipoConectorId = ?, TipoTerminalId = ?, Candado = ? WHERE NoParte = ?',
            [NoParte, Imagen, CantidadPines, TipoConectorId, TipoTerminalId, Candado, NoParteOriginal]
        );

        io.emit("bloquesActualizados");

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

/*!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!SELECT!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!*/
/*---------------------------------------------------USUARIOS---------------------------------------------------*/
app.get('/usuariosSelectAll', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT u.*, r.Rol FROM usuarios u LEFT JOIN roles r ON u.RolId = r.IdRol;');
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

/*---------------------------------------------------BLOQUES---------------------------------------------------*/
app.get('/bloquesSelect', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT 
                b.NoParte, 
                b.Imagen, 
                b.CantidadPines,
                b.TipoConectorId,
                b.TipoTerminalId,
                b.Candado,
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
server.listen(port, () => { console.log(`Servidor iniciado en el puerto ${port}`); });