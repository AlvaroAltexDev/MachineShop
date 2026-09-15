-- Script para agregar columna SubidoPor a las tablas de archivos
-- Ejecutar una sola vez en la base de datos

-- 1. Tabla dibujos_bloques
ALTER TABLE `dibujos_bloques` 
ADD COLUMN `SubidoPor` INT NULL AFTER `FechaSubida`,
ADD FOREIGN KEY (`SubidoPor`) REFERENCES `usuarios`(`NoEmpleado`);

-- 2. Tabla programas
ALTER TABLE `programas` 
ADD COLUMN `SubidoPor` INT NULL AFTER `FechaSubida`,
ADD FOREIGN KEY (`SubidoPor`) REFERENCES `usuarios`(`NoEmpleado`);

-- 3. Tabla ensambles
ALTER TABLE `ensambles` 
ADD COLUMN `SubidoPor` INT NULL AFTER `FechaSubida`,
ADD FOREIGN KEY (`SubidoPor`) REFERENCES `usuarios`(`NoEmpleado`);

-- Verificar que se agregaron correctamente
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME IN ('dibujos_bloques', 'programas', 'ensambles') 
-- AND COLUMN_NAME = 'SubidoPor';