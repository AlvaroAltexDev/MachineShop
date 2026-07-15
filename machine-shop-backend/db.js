import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit:0,
    dateStrings: true,
});

pool.getConnection((err,connection) => {
    if  (err) {
        console.error('Error de conexion: ' + err.stack);
        return;
    } console.log(
        'Conexion exitosa a la base de datos con el ID' + connection.thread.Id
    );
    connection.realease();
});
export default pool;