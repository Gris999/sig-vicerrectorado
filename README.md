# SIG UAGRM — Grupo 16 · Tema 4: Oficinas Administrativas del Vicerrectorado (1)

Proyecto final de **Sistemas de Información Geográfica (INF442-SA), semestre 2-2026**, UAGRM.
Docente: Ing. Franklin Calderón.

## Grupo 16 (lista oficial: docs/referencia/grupos-proyecto-sig.pdf)
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
