-- Tabla para historial de notificaciones
-- Ejecutar una sola vez en la base de datos

CREATE TABLE IF NOT EXISTS `notificaciones_historial` (
    `IdNotificacion` INT AUTO_INCREMENT PRIMARY KEY,
    `Tipo` VARCHAR(50) NOT NULL COMMENT 'tipo: ticket_created, ticket_updated, ticket_completed, ticket_trashed, ticket_deleted, block_created, block_updated, block_deleted, drawing_created, program_created, ensemble_created, etc.',
    `Titulo` VARCHAR(255) NOT NULL,
    `Mensaje` TEXT NOT NULL,
    `UsuarioId` INT NOT NULL COMMENT 'Usuario que recibe la notificación (FK a usuarios.NoEmpleado)',
    `UsuarioEmisorId` INT NULL COMMENT 'Usuario que generó la acción (FK a usuarios.NoEmpleado)',
    `ReferenciaId` INT NULL COMMENT 'ID de la entidad relacionada (ticketId, noParte, etc.)',
    `ReferenciaTipo` VARCHAR(50) NULL COMMENT 'tipo de referencia: ticket, bloque, dibujo, programa, ensamble',
    `Leida` BOOLEAN DEFAULT FALSE,
    `FechaCreacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `FechaLectura` DATETIME NULL,
    INDEX `idx_usuario_fecha` (`UsuarioId`, `FechaCreacion`),
    INDEX `idx_leida` (`Leida`),
    INDEX `idx_referencia` (`ReferenciaTipo`, `ReferenciaId`),
    FOREIGN KEY (`UsuarioId`) REFERENCES `usuarios`(`NoEmpleado`) ON DELETE CASCADE,
    FOREIGN KEY (`UsuarioEmisorId`) REFERENCES `usuarios`(`NoEmpleado`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificar que se creó correctamente
-- SELECT * FROM notificaciones_historial LIMIT 10;