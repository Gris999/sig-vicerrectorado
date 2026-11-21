-- Oficinas ubicadas hasta ahora. Punto = interior del edificio OSM. verificado=false hasta confirmación del grupo.
INSERT INTO oficina (codigo,nombre,sigla,clasificacion,funcion,tramites,dependencia_id,edificio_id,precision_m,metodo_captura,web,geom)
SELECT 'VR1-004','Dirección Universitaria de Bienestar Social','DUBS','DIRECCION',
  'Bienestar social, salud, acompañamiento y desarrollo integral de la comunidad universitaria.',
  'Becas; seguro y atención de salud universitaria; apoyo social',
  4, e.id, 10, 'OSM', 'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_PointOnSurface(e.geom)
FROM edificio e WHERE e.fuente='OSM way 250692659';

INSERT INTO oficina (codigo,nombre,sigla,clasificacion,funcion,tramites,dependencia_id,edificio_id,precision_m,metodo_captura,web,geom)
SELECT 'VR1-006','Admisión Estudiantil','AE','ATENCION',
  'Procesos de admisión de nuevos estudiantes (PAB, PSA y otras modalidades).',
  'Inscripción a la Prueba de Suficiencia Académica (PSA); Programa de Admisión (PAB); consultas de ingreso',
  6, e.id, 10, 'OSM', 'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_PointOnSurface(e.geom)
FROM edificio e WHERE e.fuente='OSM way 314806596';

INSERT INTO oficina (codigo,nombre,sigla,clasificacion,funcion,tramites,dependencia_id,edificio_id,precision_m,metodo_captura,web,geom)
SELECT 'VR1-009','Registro y Trámites',NULL,'ATENCION',
  'Registro académico de estudiantes y trámites administrativos.',
  'Kardex / historial académico; certificados de notas; inscripciones; cambios y traspasos',
  9, e.id, 10, 'OSM', 'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_PointOnSurface(e.geom)
FROM edificio e WHERE e.fuente='OSM way 310140675';

-- Clasificación de ambientes de los edificios según su contenido
UPDATE edificio SET uso='ADMINISTRATIVO' WHERE id IN (SELECT edificio_id FROM oficina WHERE edificio_id IS NOT NULL);
UPDATE edificio SET uso='SERVICIO' WHERE nombre ~* 'servicio|comedor|bienestar|seguro social';
