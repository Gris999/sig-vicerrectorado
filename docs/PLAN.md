# Plan del proyecto — Grupo 16 · Tema 4: Oficinas Administrativas del Vicerrectorado (1)

**Materia:** Sistemas de Información Geográfica (INF442-SA), 2-2026, UAGRM. Docente: Ing. Franklin Calderón.
**Versión del plan:** 1.0 (19/11/2026) · **Entrega estimada:** semana del 07/12/2026 (fecha exacta por confirmar).

---

## 1. Qué hay que entregar (requisitos del docente)

Fuentes: enunciado PDF, transcripción de la clase del 23/10, chat del curso.

| # | Exigencia del docente | Cómo la cumplimos |
|---|---|---|
| D1 | Plano geográfico + **aplicación web** | App web con mapa (Leaflet) |
| D2 | Todo en **WGS 84** | Almacenamiento en EPSG:4326 |
| D3 | Solo **datos vectoriales**: puntos, líneas, polígonos | Oficinas = puntos · edificios = polígonos · accesos/senderos = líneas |
| D4 | **Base de datos alfanumérica** completa (quién dirige, qué hace…) | PostgreSQL + PostGIS con fichas por oficina |
| D5 | **Consultas espaciales y alfanuméricas**; la respuesta en texto **y** en el mapa | 8 consultas definidas (sección 6) |
| D6 | Operaciones: digitalización, edición de atributos, **cálculo de superficies**, **clasificación de ambientes** | QGIS + `ST_Area` + campo `tipo` |
| D7 | **Leyenda** y **tabla de infraestructura** | Leyenda en el mapa + tabla exportable CSV |
| D8 | Precisión de 1–2 m es suficiente; se puede digitalizar con clic sobre una base | Digitalización sobre OSM/satélite con ubicación que da el grupo |
| D9 | Ideal: mismo stack que los demás grupos para integrar | Formato estándar GeoJSON + Shapefile (abre en ArcMap) |

---

## 2. Alcance

**Incluye (12 unidades, según el árbol oficial de uagrm.edu.bo):**
Vicerrectorado (oficina de la Vicerrectora), DEDTE, DUBS, Admisión Estudiantil, Escalafón Docente, Evaluación y Acreditación, Registro y Trámites, Títulos, Orientación Vocacional — **seguras** —
y Posgrado, DICAA, DICIT — **condicionales** (se cruzan con los temas 8, 11 y 12; se incluyen salvo que el docente diga lo contrario).

**Además:** polígonos de los edificios/módulos que las contienen, entradas de esos edificios (puntos) y vías de acceso (líneas) para cumplir D3.

**No incluye:** temas 21 (realidad aumentada) y 22 (rutas), planos interiores por piso.

---

## 3. Equipo y forma de trabajo

**Ejecución técnica:** Pedro + Claude (base de datos, app, documentación).
**Resto del grupo:** aporta ubicaciones/verificación y estudia su parte para la defensa.

Roles nominales (para el informe y la defensa; cada uno debe dominar su parte):

| Integrante | Rol en el informe | Parte que defiende |
|---|---|---|
| Otsubo Alurralde Carlos Diego | Líder / Product Owner | Problema, objetivos, requisitos, metodología |
| Alaca Pedro | Desarrollador full-stack / DevOps | Arquitectura, API, despliegue, demo |
| Quenta Callejas Yohan Sebastian | Analista de datos geográficos | Captura, digitalización, WGS 84, calidad del dato |
| Fernandez Jose Alberto | Administrador de base de datos | Modelo de datos, PostGIS, consultas espaciales |
| Corrales Ferrel Brad Alexander | Desarrollador frontend / QA | Interfaz, leyenda, pruebas y usabilidad |

> Se puede cambiar la asignación. **No se inventan reuniones ni avances**: el registro de avance (`docs/avance.md` y los commits) refleja lo que realmente se hizo.

**Metodología:** Scrum ligero (Kanban en GitHub Projects), sprints de 1 semana, Conventional Commits, una rama por funcionalidad y PR a `main`.

---

## 4. Estándares aplicados

| Área | Estándar |
|---|---|
| Referencia espacial | WGS 84 / **EPSG:4326** (almacenar) · UTM 20S **EPSG:32720** (áreas y distancias) |
| Geometría | OGC Simple Features / ISO 19125 |
| Intercambio | **GeoJSON RFC 7946** · Shapefile (compatibilidad con ArcMap) |
| Calidad del dato | **ISO 19157** |
| Metadatos | **ISO 19115** (perfil mínimo) |
| Requisitos | ISO/IEC/IEEE 29148 |
| Calidad del software | ISO/IEC 25010 |
| Código | Conventional Commits, SemVer (v1.0.0 en la entrega) |
| Datos base | © OpenStreetMap contributors (ODbL), citados en el mapa |

---

## 5. Arquitectura y stack

```
[Ubicaciones del grupo] + [OSM módulos] ─► QGIS / scripts ─► PostgreSQL 16 + PostGIS 3
                                                              │
                                              API REST (Python FastAPI) ─► GeoJSON
                                                              │
                                      Frontend web (HTML + Leaflet, responsive)
                                                              │
                         Docker Compose (local)  ·  despliegue demo público (Render/Railway)
```

- **Por qué FastAPI:** documentación automática de la API (Swagger) que se puede mostrar en la defensa y pocas líneas de código.
- **Por qué Leaflet:** liviano, parecido a Google Maps, sin API key.
- **Exportación:** script que genera `.geojson`, `.shp` y `.csv` para integrar con otros grupos y abrir en ArcMap.

**Estructura del repositorio:**
```
db/       esquema.sql, datos.sql, consultas.sql
data/     raw/ (OSM), procesado/ (GeoJSON, SHP)
api/      FastAPI
web/      Leaflet
docs/     plan, requisitos, diccionario de datos, metadatos, informe, manual, slides
docker-compose.yml
```

---

## 6. Requisitos

### Funcionales
| ID | Requisito | Tipo de consulta | Prioridad |
|---|---|---|---|
| RF-01 | Mapa con capas: oficinas, edificios, entradas, vías; activar/desactivar | — | Alta |
| RF-02 | Clic en oficina → ficha (nombre, sigla, dependencia, función, trámites, responsable, horario, contacto, edificio, foto) | Alfanumérica | Alta |
| RF-03 | Buscador por nombre o trámite ("¿dónde saco mi título?") → texto + resalta en el mapa | Alfanumérica | Alta |
| RF-04 | Oficinas dentro de un edificio seleccionado | Espacial (`ST_Contains`) | Alta |
| RF-05 | Oficina más cercana a mi ubicación (GPS del celular) | Espacial (KNN `<->`) | Alta |
| RF-06 | Oficinas a menos de X metros de un punto | Espacial (`ST_DWithin`) | Media |
| RF-07 | Filtrar por dependencia/tipo (clasificación de ambientes, p. ej. todo lo de DICAA) | Alfanumérica | Media |
| RF-08 | Superficie de cada edificio (m²) | Espacial (`ST_Area`) | Media |
| RF-09 | Distancia entre dos oficinas | Espacial (`ST_Distance`) | Baja |
| RF-10 | Leyenda, escala, norte y fuente de datos | — | Alta |
| RF-11 | Tabla de infraestructura exportable a CSV | Alfanumérica | Alta |
| RF-12 | Exportar la capa a GeoJSON/Shapefile | — | Media |

### No funcionales
| ID | Requisito | Métrica / meta |
|---|---|---|
| RNF-01 | Funciona en el celular | Usable a 360 px de ancho |
| RNF-02 | Rápido | Consultas < 1 s · carga inicial < 3 s |
| RNF-03 | Exactitud posicional | ≤ 5 m (meta 2 m) |
| RNF-04 | Interoperable | GeoJSON EPSG:4326 válido; SHP abre en ArcMap |
| RNF-05 | Reproducible | `docker compose up` levanta todo |
| RNF-06 | Usable | SUS ≥ 70 con 5 usuarios |

---

## 7. Modelo de datos

```
dependencia (id, nombre, sigla, nivel, padre_id → dependencia)      -- árbol del Vicerrectorado
edificio    (id, codigo, nombre, sede, nro_pisos, area_m2, fuente, geom Polygon 4326)
oficina     (id, codigo 'VR1-001', nombre, sigla, tipo, funcion, tramites,
             dependencia_id, edificio_id, piso, responsable, cargo_responsable,
             horario, telefono, email, web, foto,
             precision_m, metodo_captura, fecha_captura, verificado BOOL,
             capa DEFAULT 'VICERRECTORADO_1', geom Point 4326)
entrada     (id, nombre, edificio_id, geom Point 4326)
via_acceso  (id, nombre, tipo, longitud_m, geom LineString 4326)
```

Reglas: índices GiST, `ST_IsValid` en todas las geometrías, oficina dentro de su edificio, `codigo` único con prefijo para integrar con las demás capas. Se entrega **diccionario de datos** y **ficha de metadatos ISO 19115**.

---

## 8. Datos: captura y calidad

**Método (sin salida obligatoria):**
1. Polígonos de módulos: descargados de OpenStreetMap ✅
2. Ubicación de cada oficina: el grupo indica módulo/edificio o envía enlace de Google Maps → digitalizo el punto en la puerta/acceso del edificio.
3. Atributos: web oficial (nombre, función, trámites, autoridades) + lo que el grupo pueda confirmar (horario, teléfono).
4. Opcional: si alguien pasa por el campus, foto + punto GPS para mejorar la exactitud.

**Métricas de calidad (ISO 19157):**
| Elemento | Métrica | Meta |
|---|---|---|
| Completitud | unidades ubicadas / unidades del inventario | 100 % de las seguras |
| Exactitud posicional | error estimado por punto (campo `precision_m`) | ≤ 5 m |
| Consistencia lógica | geometrías válidas y oficina dentro de su edificio | 100 % |
| Exactitud temática | atributos con fuente verificable | ≥ 90 % |
| Temporal | fecha de captura registrada | 100 % |

---

## 9. Cronograma

| Sprint | Fechas | Entregables | Depende de |
|---|---|---|---|
| **1 — Base** | 19–25/11 | Docker + PostGIS, esquema, carga de módulos OSM y 3 oficinas conocidas, API con RF-01/02/03, mapa básico | Nada |
| **2 — Datos + consultas** | 26/11–02/12 | Carga de las ubicaciones que pasa el grupo, atributos, RF-04 a RF-09, leyenda, tabla CSV, exportación SHP | **Ubicaciones del grupo (antes del 28/11)** |
| **3 — Calidad y demo** | 03–07/12 | Pruebas, control de calidad, despliegue público, metadatos, diccionario de datos | — |
| **4 — Defensa** | 07/12 → entrega | Informe, manual, diapositivas, guion de defensa por integrante, ensayo | Fecha del docente |

**Hitos:** prototipo navegable 25/11 · datos completos 02/12 · *code freeze* 06/12.

---

## 10. Pruebas

- **API:** pruebas automáticas (pytest) por endpoint, con casos conocidos (p. ej. "Títulos está dentro del edificio X").
- **Datos:** script de QA que verifica geometrías, SRID, campos obligatorios y oficina-dentro-de-edificio.
- **Aceptación:** un caso *Dado/Cuando/Entonces* por RF.
- **Usabilidad:** 5 personas buscan 3 oficinas; tiempo y cuestionario SUS.

---

## 11. Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| No se consiguen ubicaciones de algunas oficinas | Media | Alto | Priorizar las 6 seguras; Google Maps; llamar a la UAGRM; marcar `verificado=false` |
| El docente cambia el alcance (Posgrado, DICAA, DICIT) | Media | Bajo | Campo `capa`; se activan/desactivan sin tocar código |
| Fecha de entrega antes de lo previsto | Media | Alto | Prototipo usable desde el sprint 1 |
| Integrantes no dominan su parte en la defensa | Alta | Alto | Guion de defensa corto por persona + ensayo |
| Choque con el grupo Vicerrectorado (2) | Media | Bajo | Hacemos las 12 completas; se documenta |
| Despliegue público falla el día de la defensa | Baja | Alto | Demo local con Docker como respaldo + video corto |

---

## 12. Entregables finales

1. App web desplegada + código en GitHub (v1.0.0)
2. Base de datos PostGIS (scripts reproducibles) + diccionario de datos
3. Capa en GeoJSON, Shapefile y CSV (tabla de infraestructura)
4. Plano digital (PDF) con leyenda, escala, norte y sistema de referencia
5. Ficha de metadatos ISO 19115 y reporte de calidad ISO 19157
6. Informe técnico, manual de usuario, diapositivas y guion de defensa

---

## 13. Lo que necesito del grupo

| Qué | Para cuándo |
|---|---|
| Ubicación (módulo/edificio o enlace de Maps) de las 9 oficinas faltantes | 28/11 |
| Confirmar con el docente si Posgrado, DICAA y DICIT entran en la capa | 28/11 |
| Confirmar o cambiar la asignación de roles | 25/11 |
| Fecha exacta de entrega y defensa | Cuando se sepa |
