# SIG UAGRM — Grupo 16 · Tema 4: Oficinas Administrativas del Vicerrectorado (1)

Proyecto final de **Sistemas de Información Geográfica (INF442-SA), semestre 2-2026**, UAGRM.
Docente: Ing. Franklin Calderón.

## Grupo 16
| Integrante | Rol |
|---|---|
| Otsubo Alurralde Carlos Diego | Líder / Product Owner / Analista |
| Alaca Pedro | Por asignar |
| Corrales Ferrel Brad Alexander | Por asignar |
| Fernandez Jose Alberto | Por asignar |
| Quenta Callejas Yohan Sebastian | Por asignar |

## Stack
PostgreSQL + PostGIS · API REST (GeoJSON, EPSG:4326) · Leaflet · Docker Compose · QGIS/QField para captura.

## Estructura
- `docs/` — plan, requisitos, referencia (enunciado, transcripciones)
- `db/` — scripts SQL (esquema, datos)
- `api/` — backend
- `web/` — frontend

## Cómo ejecutarlo
Requiere Docker Desktop.
```bash
docker compose up -d --build
```
- App: http://localhost:8042
- Documentación de la API (Swagger): http://localhost:8042/docs
- PostGIS: `localhost:5442` (usuario/clave/base: `sig`)

Para reiniciar la base desde cero (vuelve a cargar `db/*.sql`): `docker compose down -v && docker compose up -d --build`.

## Cumplimiento del enunciado
| Enunciado | Implementación |
|---|---|
| Puntos: entradas, extintores y servicios | Tabla `punto` (OSM + digitalización en la app) y `oficina` |
| Líneas: senderos y vías internas | Tabla `via` (OSM), con longitud calculada |
| Polígonos: edificios, canchas y jardines | Tablas `edificio` y `zona` (campus, canchas, jardines, parqueos) |
| Digitalización | Pestaña **Editar** → "Clic en el mapa" (oficinas, extintores, entradas, servicios) |
| Edición de atributos | Pestaña **Editar** → clic en una oficina |
| Cálculo de superficies | Triggers `ST_Area` (m²) y `ST_Length` (m) |
| Clasificación de ambientes | Tabla `clasificacion` (oficinas y edificios) |
| Plano digital con leyenda | Leyenda, escala, norte y cajetín; **Tabla → Imprimir plano (PDF)** |
| Tabla de infraestructura | Pestaña **Tabla** + CSV y GeoJSON por capa |

Edición protegida con `ADMIN_TOKEN` (archivo `.env`, no se sube a GitHub; ver `.env.example`).
