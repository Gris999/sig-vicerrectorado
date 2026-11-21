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

-- Ubicaciones tomadas de fichas de Google Maps (21/11/2026). Precisión estimada 15 m; verificado=false hasta confirmar en campo.
INSERT INTO oficina (codigo,nombre,sigla,clasificacion,funcion,tramites,dependencia_id,responsable,cargo_responsable,telefono,precision_m,metodo_captura,web,geom) VALUES
 ('VR1-001','Vicerrectorado','VR','DESPACHO',
  'Instancia académica que articula la gestión y proyección académica, la investigación científica y la extensión universitaria.',
  'Audiencias con la Vicerrectora; correspondencia académica',
  1,'MSc. Juana Borja Saavedra','Vicerrectora','3 3365533',15,'Google Maps (Edificio Roma, C. Venezuela 40)',
  'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_SetSRID(ST_MakePoint(-63.191454,-17.7783048),4326)),
 ('VR1-002','Departamento de Educación a Distancia y Tecnología Educativa','DEDTE','DIRECCION',
  'Educación virtual, tecnologías educativas, soporte y capacitación.',
  'Soporte de aulas virtuales (Moodle); capacitación docente en TIC',
  2,NULL,NULL,'75321718',15,'Google Maps',
  'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_SetSRID(ST_MakePoint(-63.1906568,-17.7790762),4326)),
 ('VR1-005','Dirección de Calidad Académica y Acreditación','DICAA','DIRECCION',
  'Evaluación, autoevaluación y acreditación académica.',
  'Procesos de autoevaluación y acreditación de carreras',
  5,NULL,NULL,NULL,15,'Google Maps',
  'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_SetSRID(ST_MakePoint(-63.191491,-17.7782242),4326)),
 ('VR1-007','Departamento de Escalafón Docente',NULL,'ATENCION',
  'Registro y control de la carrera docente (categorías y antigüedad).',
  'Ascenso de categoría docente; certificados de escalafón',
  7,NULL,NULL,'3365454',15,'Google Maps',
  'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_SetSRID(ST_MakePoint(-63.1916317,-17.7777181),4326)),
 ('VR1-008','Departamento de Evaluación y Acreditación',NULL,'ATENCION',
  'Evaluación y acreditación académica.',
  NULL,
  8,NULL,NULL,NULL,15,'Google Maps (Av. 26 de Febrero)',
  'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_SetSRID(ST_MakePoint(-63.1925255,-17.7745711),4326)),
 ('VR1-010','Departamento de Trámite, Registro y Títulos',NULL,'ATENCION',
  'Emisión y legalización de títulos y diplomas académicos.',
  'Diploma académico; título en provisión nacional; legalizaciones',
  10,NULL,NULL,NULL,15,'Google Maps (Campus Universitario UAGRM)',
  'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_SetSRID(ST_MakePoint(-63.1903922,-17.777656),4326)),
 ('VR1-011','Dirección de Investigación Científica e Innovación Tecnológica','DICIT','DIRECCION',
  'Investigación científica, innovación, tecnología y transferencia de conocimiento.',
  'Registro de proyectos de investigación; semilleros de investigación',
  11,NULL,NULL,NULL,15,'Google Maps',
  'https://www.uagrm.edu.bo/unidades-administrativas/dicit', ST_SetSRID(ST_MakePoint(-63.1908557,-17.7761731),4326)),
 ('VR1-012','Departamento de Orientación Vocacional',NULL,'ATENCION',
  'Orientación vocacional a postulantes y estudiantes.',
  'Test vocacional; orientación sobre carreras',
  12,NULL,NULL,NULL,25,'Google Maps (fuera de la Ciudad Universitaria, por verificar)',
  'https://www.uagrm.edu.bo/unidades-administrativas/vicerrectorado', ST_SetSRID(ST_MakePoint(-63.1654578,-17.7777863),4326));

-- Registro y Trámites figura en Google Maps junto con Títulos en el mismo departamento (~30 m del punto OSM).
UPDATE oficina SET nombre='Registro y Trámites (Departamento de Trámite, Registro y Títulos)' WHERE codigo='VR1-009';
UPDATE edificio SET uso='ADMINISTRATIVO' WHERE id IN (SELECT edificio_id FROM oficina WHERE edificio_id IS NOT NULL) AND uso<>'SERVICIO';
