-- Script para agregar campos de tracking de estado granular en bloques
-- Ejecutar una sola vez en la base de datos

ALTER TABLE `bloques` 
ADD COLUMN `DibujosCompleto` BOOLEAN DEFAULT FALSE AFTER `FechaCompletado`,
ADD COLUMN `ProgramasCompleto` BOOLEAN DEFAULT FALSE AFTER `DibujosCompleto`,
ADD COLUMN `EnsambleCompleto` BOOLEAN DEFAULT FALSE AFTER `ProgramasCompleto`,
ADD COLUMN `FechaDibujosCompleto` DATETIME NULL AFTER `EnsambleCompleto`,
ADD COLUMN `FechaProgramasCompleto` DATETIME NULL AFTER `FechaDibujosCompleto`,
ADD COLUMN `FechaEnsambleCompleto` DATETIME NULL AFTER `FechaProgramasCompleto`;

-- Verificar que se agregaron correctamente
-- SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'bloques' AND COLUMN_NAME IN ('DibujosCompleto', 'ProgramasCompleto', 'EnsambleCompleto', 'FechaDibujosCompleto', 'FechaProgramasCompleto', 'FechaEnsambleCompleto');