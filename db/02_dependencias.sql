-- Árbol oficial (uagrm.edu.bo/unidades-administrativas, verificado 15/11/2026)
INSERT INTO dependencia (id, nombre, sigla, nivel, padre_id, alcance) VALUES
 (1,'Vicerrectorado','VR',0,NULL,'seguro'),
 (2,'Departamento de Educación a Distancia y Tecnología Educativa','DEDTE',1,1,'seguro'),
 (3,'Dirección General de Posgrado','DGP',1,1,'condicional'),
 (4,'Dirección Universitaria de Bienestar Social','DUBS',1,1,'seguro'),
 (5,'Dirección de Calidad Académica y Acreditación','DICAA',1,1,'condicional'),
 (6,'Admisión Estudiantil','AE',2,5,'seguro'),
 (7,'Escalafón Docente',NULL,2,5,'seguro'),
 (8,'Evaluación y Acreditación',NULL,2,5,'seguro'),
 (9,'Registro y Trámites',NULL,2,5,'seguro'),
 (10,'Títulos',NULL,2,5,'seguro'),
 (11,'Dirección de Investigación, Ciencia, Innovación y Tecnología','DICIT',1,1,'condicional'),
 (12,'Orientación Vocacional',NULL,1,1,'seguro');
SELECT setval('dependencia_id_seq', 12);
