-- Oficinas ubicadas hasta ahora. Punto = interior del edificio OSM (ST_PointOnSurface).
-- verificado=false hasta que el grupo confirme la ubicación.
INSERT INTO oficina (codigo,nombre,sigla,tipo,funcion,tramites,dependencia_id,edificio_id,precision_m,metodo_captura,web,geom)
SELECT 'VR1-004','Dirección Universitaria de Bienestar Social','DUBS','Dirección',
  'Bienestar social, salud, acompañamiento y desarrollo integral de la comunidad universitaria.',
  'Becas; seguro y atención de salud universitaria; apoyo social',
  4, e.id, 10, 'OSM', 'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_PointOnSurface(e.geom)
FROM edificio e WHERE e.fuente='OSM way 250692659';

INSERT INTO oficina (codigo,nombre,sigla,tipo,funcion,tramites,dependencia_id,edificio_id,precision_m,metodo_captura,web,geom)
SELECT 'VR1-006','Admisión Estudiantil','AE','Unidad de servicio',
  'Procesos de admisión de nuevos estudiantes (PAB, PSA y otras modalidades).',
  'Inscripción a la Prueba de Suficiencia Académica (PSA); Programa de Admisión (PAB); consultas de ingreso',
  6, e.id, 10, 'OSM', 'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_PointOnSurface(e.geom)
FROM edificio e WHERE e.fuente='OSM way 314806596';

INSERT INTO oficina (codigo,nombre,sigla,tipo,funcion,tramites,dependencia_id,edificio_id,precision_m,metodo_captura,web,geom)
SELECT 'VR1-009','Registro y Trámites',NULL,'Unidad de servicio',
  'Registro académico de estudiantes y trámites administrativos.',
  'Kardex / historial académico; certificados de notas; inscripciones; cambios y traspasos',
  9, e.id, 10, 'OSM', 'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_PointOnSurface(e.geom)
FROM edificio e WHERE e.fuente='OSM way 310140675';

