"""API de la capa Oficinas Administrativas del Vicerrectorado (1) — Grupo 16, SIG INF442-SA.
Devuelve GeoJSON (RFC 7946, EPSG:4326)."""
import csv, io, json, os
from pathlib import Path

import psycopg
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from psycopg.rows import dict_row

DSN = os.getenv("DATABASE_URL", "postgresql://sig:sig@localhost:5432/sig")
WEB = Path(__file__).resolve().parent.parent / "web"

app = FastAPI(title="SIG UAGRM · Vicerrectorado (1)", version="0.1.0",
              description="Grupo 16 · Tema 4. Consultas espaciales y alfanuméricas.")

OFICINA_COLS = """o.id, o.codigo, o.nombre, o.sigla, o.tipo, o.funcion, o.tramites, o.piso,
  o.responsable, o.cargo_responsable, o.horario, o.telefono, o.email, o.web, o.foto,
  o.precision_m, o.metodo_captura, o.fecha_captura::text, o.verificado,
  d.nombre AS dependencia, d.sigla AS dependencia_sigla, d.alcance,
  e.codigo AS edificio_codigo, e.nombre AS edificio, ST_AsGeoJSON(o.geom)::json AS geometry"""
OFICINA_FROM = """FROM oficina o JOIN dependencia d ON d.id=o.dependencia_id
  LEFT JOIN edificio e ON e.id=o.edificio_id"""


def q(sql, params=()):
    with psycopg.connect(DSN, row_factory=dict_row) as c:
        return c.execute(sql, params).fetchall()


def fc(rows):
    feats = []
    for r in rows:
        r = dict(r)
        geom = r.pop("geometry")
        feats.append({"type": "Feature", "id": r.get("id"), "geometry": geom, "properties": r})
    return {"type": "FeatureCollection", "features": feats}


def punto(lat: float, lon: float):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(422, "Coordenadas fuera de rango")
    return lon, lat


@app.get("/api/oficinas", summary="RF-01/03/07: oficinas, con búsqueda por nombre/trámite y filtro por dependencia")
def oficinas(texto: str | None = None, dependencia: int | None = None):
    where, p = [], []
    if texto:
        where.append("(o.nombre ILIKE %s OR o.sigla ILIKE %s OR o.tramites ILIKE %s OR o.funcion ILIKE %s)")
        p += [f"%{texto}%"] * 4
    if dependencia:
        where.append("(d.id=%s OR d.padre_id=%s)")
        p += [dependencia, dependencia]
    sql = f"SELECT {OFICINA_COLS} {OFICINA_FROM} {'WHERE ' + ' AND '.join(where) if where else ''} ORDER BY o.codigo"
    return fc(q(sql, p))


@app.get("/api/oficinas/{oid}", summary="RF-02: ficha de una oficina")
def oficina(oid: int):
    r = q(f"SELECT {OFICINA_COLS} {OFICINA_FROM} WHERE o.id=%s", (oid,))
    if not r:
        raise HTTPException(404, "Oficina no encontrada")
    return fc(r)["features"][0]


@app.get("/api/edificios", summary="RF-01/08: edificios con superficie (m²)")
def edificios():
    return fc(q("""SELECT e.id, e.codigo, e.nombre, e.sede, e.area_m2::float, e.fuente,
        (SELECT count(*) FROM oficina o WHERE o.edificio_id=e.id) AS nro_oficinas,
        ST_AsGeoJSON(e.geom)::json AS geometry FROM edificio e ORDER BY e.codigo"""))


@app.get("/api/edificios/{eid}/oficinas", summary="RF-04: oficinas dentro de un edificio (ST_Contains)")
def oficinas_en_edificio(eid: int):
    return fc(q(f"""SELECT {OFICINA_COLS} {OFICINA_FROM}
        JOIN edificio b ON ST_Contains(b.geom, o.geom) WHERE b.id=%s""", (eid,)))


@app.get("/api/cercana", summary="RF-05: oficina más cercana a un punto (KNN)")
def cercana(lat: float, lon: float, n: int = Query(1, ge=1, le=20)):
    x, y = punto(lat, lon)
    return fc(q(f"""SELECT {OFICINA_COLS},
        round(ST_Distance(o.geom::geography, ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography)::numeric,1)::float AS distancia_m
        {OFICINA_FROM} ORDER BY o.geom <-> ST_SetSRID(ST_MakePoint(%s,%s),4326) LIMIT %s""", (x, y, x, y, n)))


@app.get("/api/radio", summary="RF-06: oficinas a menos de X metros (ST_DWithin)")
def radio(lat: float, lon: float, metros: float = Query(200, gt=0, le=50000)):
    x, y = punto(lat, lon)
    return fc(q(f"""SELECT {OFICINA_COLS},
        round(ST_Distance(o.geom::geography, ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography)::numeric,1)::float AS distancia_m
        {OFICINA_FROM} WHERE ST_DWithin(o.geom::geography, ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography, %s)
        ORDER BY distancia_m""", (x, y, x, y, metros)))


@app.get("/api/distancia", summary="RF-09: distancia entre dos oficinas (m)")
def distancia(a: int, b: int):
    r = q("""SELECT round(ST_Distance(x.geom::geography, y.geom::geography)::numeric,1)::float AS metros
        FROM oficina x, oficina y WHERE x.id=%s AND y.id=%s""", (a, b))
    if not r:
        raise HTTPException(404, "Oficina no encontrada")
    return {"a": a, "b": b, **r[0]}


@app.get("/api/dependencias", summary="Árbol de dependencias del Vicerrectorado")
def dependencias():
    return q("SELECT id, nombre, sigla, nivel, padre_id, alcance FROM dependencia ORDER BY id")


@app.get("/api/infraestructura.csv", summary="RF-11: tabla de infraestructura (CSV)")
def infraestructura_csv():
    rows = q("""SELECT o.codigo, o.nombre, o.sigla, d.nombre AS dependencia, o.tipo, e.codigo AS edificio,
        e.area_m2::float AS area_edificio_m2, o.piso, o.responsable, o.horario, o.telefono,
        round(ST_Y(o.geom)::numeric,7) AS lat, round(ST_X(o.geom)::numeric,7) AS lon,
        o.precision_m, o.metodo_captura, o.verificado
        FROM oficina o JOIN dependencia d ON d.id=o.dependencia_id LEFT JOIN edificio e ON e.id=o.edificio_id
        ORDER BY o.codigo""")
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()) if rows else ["codigo"])
    w.writeheader(); w.writerows(rows)
    return StreamingResponse(iter(["﻿" + buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=infraestructura_vicerrectorado1.csv"})


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(WEB / "index.html")


app.mount("/static", StaticFiles(directory=WEB), name="static")
