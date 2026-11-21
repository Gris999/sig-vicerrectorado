INSERT INTO clasificacion VALUES
 ('DESPACHO','Despacho de autoridad','Oficina de la máxima autoridad de la dependencia'),
 ('DIRECCION','Dirección','Dirección o departamento con jefatura propia'),
 ('ATENCION','Atención al público','Ventanilla o unidad que atiende trámites'),
 ('ADMINISTRATIVO','Edificio administrativo','Edificio con oficinas administrativas'),
 ('ACADEMICO','Edificio académico','Aulas, laboratorios y facultades'),
 ('SERVICIO','Edificio de servicio','Comedor, salud, bienestar u otros servicios');

-- Árbol oficial (uagrm.edu.bo/unidades-administrativas, verificado 15/11/2026)
INSERT INTO dependencia (id, nombre, sigla, nivel, padre_id, alcance, responsable, cargo) VALUES
 (1,'Vicerrectorado','VR',0,NULL,'seguro','MSc. Juana Borja Saavedra','Vicerrectora'),
 (2,'Departamento de Educación a Distancia y Tecnología Educativa','DEDTE',1,1,'seguro',NULL,NULL),
 (3,'Dirección General de Posgrado','DGP',1,1,'condicional',NULL,NULL),
 (4,'Dirección Universitaria de Bienestar Social','DUBS',1,1,'seguro',NULL,NULL),
 (5,'Dirección de Calidad Académica y Acreditación','DICAA',1,1,'condicional',NULL,NULL),
 (6,'Admisión Estudiantil','AE',2,5,'seguro',NULL,NULL),
 (7,'Escalafón Docente',NULL,2,5,'seguro',NULL,NULL),
 (8,'Evaluación y Acreditación',NULL,2,5,'seguro',NULL,NULL),
 (9,'Registro y Trámites',NULL,2,5,'seguro',NULL,NULL),
 (10,'Títulos',NULL,2,5,'seguro',NULL,NULL),
 (11,'Dirección de Investigación, Ciencia, Innovación y Tecnología','DICIT',1,1,'condicional',NULL,NULL),
 (12,'Orientación Vocacional',NULL,1,1,'seguro',NULL,NULL);
SELECT setval('dependencia_id_seq', 12);
