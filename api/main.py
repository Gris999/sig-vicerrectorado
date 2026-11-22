"""API de la capa Oficinas Administrativas del Vicerrectorado (1) — Grupo 16, SIG INF442-SA (UAGRM).

Toda la información geográfica en WGS 84 (EPSG:4326) y se entrega como GeoJSON (RFC 7946).
Capas (según el enunciado):
  Puntos:    oficinas · entradas · extintores · servicios
  Líneas:    senderos · vías internas
  Polígonos: edificios · canchas · jardines · parqueos · límite del campus
"""
import csv, io, os, secrets
from pathlib import Path
from typing import Literal

import psycopg
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from api.shapefile_export import a_zip

DSN = os.getenv("DATABASE_URL", "postgresql://sig:sig@localhost:5432/sig")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
WEB = Path(__file__).resolve().parent.parent / "web"

app = FastAPI(title="SIG UAGRM · Oficinas del Vicerrectorado (1)", version="0.2.0",
              description="Grupo 16 · Tema 4 · SIG INF442-SA. Consultas espaciales y alfanuméricas sobre datos en WGS 84.")


# ----------------------------------------------------------------------------- utilidades
def q(sql, params=(), commit=False):
    with psycopg.connect(DSN, row_factory=dict_row) as c:
        cur = c.execute(sql, params)
        rows = cur.fetchall() if cur.description else []
        if commit:
            c.commit()
        return rows


def fc(rows):
    feats = []
    for r in rows:
        r = dict(r)
        geom = r.pop("geometry")
        feats.append({"type": "Feature", "id": r.get("id"), "geometry": geom, "properties": r})
    return {"type": "FeatureCollection", "features": feats}


def pt(lat: float, lon: float):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(422, "Coordenadas fuera de rango")
    return lon, lat


def admin(x_admin_token: str = Header(default="")):
    if not ADMIN_TOKEN or not secrets.compare_digest(x_admin_token, ADMIN_TOKEN):
        raise HTTPException(401, "Token de edición inválido")


def csv_resp(rows, nombre):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()) if rows else ["sin_datos"])
    w.writeheader(); w.writerows(rows)
    return StreamingResponse(iter(["﻿" + buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={nombre}.csv"})


OF_COLS = """o.id, o.codigo, o.nombre, o.sigla, o.clasificacion, c.nombre AS clasificacion_nombre, o.funcion, o.tramites,
  o.piso, coalesce(o.responsable, CASE WHEN d.nivel=0 THEN d.responsable END) AS responsable,
  coalesce(o.cargo_responsable, CASE WHEN d.nivel=0 THEN d.cargo END) AS cargo_responsable,
  o.horario, o.telefono, o.email, o.web, o.foto, o.precision_m::float, o.metodo_captura, o.fecha_captura::text, o.verificado,
  d.id AS dependencia_id, d.nombre AS dependencia, d.sigla AS dependencia_sigla, d.alcance,
  p.nombre AS depende_de, e.id AS edificio_id, e.codigo AS edificio_codigo, e.nombre AS edificio,
  round(ST_Y(o.geom)::numeric,7)::float AS lat, round(ST_X(o.geom)::numeric,7)::float AS lon,
  ST_AsGeoJSON(o.geom)::json AS geometry"""
OF_FROM = """FROM oficina o JOIN dependencia d ON d.id=o.dependencia_id LEFT JOIN dependencia p ON p.id=d.padre_id
  JOIN clasificacion c ON c.codigo=o.clasificacion LEFT JOIN edificio e ON e.id=o.edificio_id"""
DIST = "round(ST_Distance({a}::geography, {b}::geography)::numeric,1)::float"
MK = "ST_SetSRID(ST_MakePoint(%s,%s),4326)"


# ----------------------------------------------------------------------------- oficinas (capa principal)
@app.get("/api/oficinas", tags=["Oficinas"], summary="Oficinas · búsqueda alfanumérica por nombre/sigla/trámite/responsable y filtros")
def oficinas(texto: str | None = None, dependencia: int | None = None, clasificacion: str | None = None):
    where, p = [], []
    if texto:
        cols = ["o.nombre", "o.sigla", "o.tramites", "o.funcion", "o.responsable", "d.nombre", "d.responsable", "d.sigla"]
        where.append("(" + " OR ".join(f"unaccent(coalesce({c},'')) ILIKE unaccent(%s)" for c in cols) + ")")
        p += [f"%{texto.strip()}%"] * len(cols)
    if dependencia:
        where.append("(d.id=%s OR d.padre_id=%s)"); p += [dependencia, dependencia]
    if clasificacion:
        where.append("o.clasificacion=%s"); p.append(clasificacion)
    orden, po = "o.codigo", []
    if texto:  # relevancia: primero coincide el nombre/sigla, luego los trámites, luego el resto
        orden = ("(unaccent(o.nombre) ILIKE unaccent(%s) OR unaccent(coalesce(o.sigla,'')) ILIKE unaccent(%s)) DESC, "
                 "unaccent(coalesce(o.tramites,'')) ILIKE unaccent(%s) DESC, o.codigo")
        po = [f"%{texto.strip()}%"] * 3
    return fc(q(f"SELECT {OF_COLS} {OF_FROM} {'WHERE ' + ' AND '.join(where) if where else ''} ORDER BY {orden}", p + po))


@app.get("/api/oficinas/{oid}", tags=["Oficinas"], summary="Ficha completa de una oficina")
def oficina(oid: int):
    r = q(f"SELECT {OF_COLS} {OF_FROM} WHERE o.id=%s", (oid,))
    if not r:
        raise HTTPException(404, "Oficina no encontrada")
    return fc(r)["features"][0]


@app.get("/api/oficinas/{oid}/servicios-cercanos", tags=["Consultas espaciales"],
         summary="Entradas, extintores y servicios más cercanos a una oficina (KNN)")
def servicios_cercanos(oid: int, tipo: Literal["entrada", "extintor", "servicio"] | None = None, n: int = Query(5, ge=1, le=30)):
    return fc(q(f"""SELECT p.id, p.tipo, p.subtipo, p.nombre, {DIST.format(a='p.geom', b='o.geom')} AS distancia_m,
        ST_AsGeoJSON(p.geom)::json AS geometry FROM punto p, oficina o
        WHERE o.id=%s {'AND p.tipo=%s' if tipo else ''} ORDER BY p.geom <-> o.geom LIMIT %s""",
                (oid, tipo, n) if tipo else (oid, n)))


@app.get("/api/cercana", tags=["Consultas espaciales"], summary="Oficina(s) más cercana(s) a un punto (KNN <->)")
def cercana(lat: float, lon: float, n: int = Query(1, ge=1, le=20)):
    x, y = pt(lat, lon)
    return fc(q(f"""SELECT {OF_COLS}, {DIST.format(a='o.geom', b=MK)} AS distancia_m {OF_FROM}
        ORDER BY o.geom <-> {MK} LIMIT %s""", (x, y, x, y, n)))


@app.get("/api/radio", tags=["Consultas espaciales"], summary="Todo lo que hay a menos de X metros de un punto (ST_DWithin)")
def radio(lat: float, lon: float, metros: float = Query(200, gt=0, le=5000)):
    x, y = pt(lat, lon)
    ofi = q(f"""SELECT {OF_COLS}, {DIST.format(a='o.geom', b=MK)} AS distancia_m {OF_FROM}
        WHERE ST_DWithin(o.geom::geography, {MK}::geography, %s) ORDER BY distancia_m""", (x, y, x, y, metros))
    pts = q(f"""SELECT p.id, p.tipo, p.subtipo, p.nombre, {DIST.format(a='p.geom', b=MK)} AS distancia_m,
        ST_AsGeoJSON(p.geom)::json AS geometry FROM punto p
        WHERE ST_DWithin(p.geom::geography, {MK}::geography, %s) ORDER BY distancia_m""", (x, y, x, y, metros))
    return {"oficinas": fc(ofi), "puntos": fc(pts)}


@app.get("/api/distancia", tags=["Consultas espaciales"], summary="Distancia en metros entre dos oficinas (ST_Distance)")
def distancia(a: int, b: int):
    r = q(f"""SELECT x.nombre AS desde, y.nombre AS hasta, {DIST.format(a='x.geom', b='y.geom')} AS metros,
        ST_AsGeoJSON(ST_MakeLine(x.geom, y.geom))::json AS linea FROM oficina x, oficina y WHERE x.id=%s AND y.id=%s""", (a, b))
    if not r:
        raise HTTPException(404, "Oficina no encontrada")
    return r[0]


# ----------------------------------------------------------------------------- polígonos
@app.get("/api/edificios", tags=["Capas"], summary="Edificios (polígonos) con superficie y clasificación")
def edificios():
    return fc(q("""SELECT e.id, e.codigo, e.nombre, e.uso, c.nombre AS uso_nombre, e.sede, e.area_m2::float, e.fuente,
        (SELECT count(*) FROM oficina o WHERE o.edificio_id=e.id) AS nro_oficinas,
        ST_AsGeoJSON(e.geom)::json AS geometry FROM edificio e JOIN clasificacion c ON c.codigo=e.uso ORDER BY e.codigo"""))


@app.get("/api/zonas", tags=["Capas"], summary="Campus, canchas, jardines y parqueos (polígonos)")
def zonas(tipo: Literal["campus", "cancha", "jardin", "parqueo"] | None = None):
    return fc(q(f"""SELECT id, tipo, nombre, detalle, area_m2::float, fuente, ST_AsGeoJSON(geom)::json AS geometry
        FROM zona {'WHERE tipo=%s' if tipo else ''} ORDER BY tipo, id""", (tipo,) if tipo else ()))


@app.get("/api/contenido/{capa}/{pid}", tags=["Consultas espaciales"],
         summary="¿Qué hay dentro de este polígono? Oficinas, puntos y edificios contenidos (ST_Contains / ST_Intersects)")
def contenido(capa: Literal["edificio", "zona"], pid: int):
    pol = q(f"""SELECT id, nombre, area_m2::float, {'uso' if capa == 'edificio' else 'tipo'} AS clase
        FROM {capa} WHERE id=%s""", (pid,))
    if not pol:
        raise HTTPException(404, "Polígono no encontrado")
    ofi = q(f"SELECT {OF_COLS} {OF_FROM} JOIN {capa} b ON ST_Contains(b.geom, o.geom) WHERE b.id=%s", (pid,))
    pts = q(f"""SELECT p.id, p.tipo, p.subtipo, p.nombre, ST_AsGeoJSON(p.geom)::json AS geometry
        FROM punto p JOIN {capa} b ON ST_Contains(b.geom, p.geom) WHERE b.id=%s""", (pid,))
    edi = [] if capa == "edificio" else q("""SELECT e.id, e.nombre, e.area_m2::float FROM edificio e JOIN zona b
        ON ST_Intersects(b.geom, e.geom) WHERE b.id=%s ORDER BY e.nombre""", (pid,))
    return {"poligono": pol[0], "oficinas": fc(ofi), "puntos": fc(pts), "edificios": edi}


# ----------------------------------------------------------------------------- líneas y puntos
@app.get("/api/vias", tags=["Capas"], summary="Senderos y vías internas (líneas) con longitud")
def vias(tipo: Literal["sendero", "via_interna", "escalera"] | None = None):
    return fc(q(f"""SELECT id, tipo, nombre, superficie, longitud_m::float, ST_AsGeoJSON(geom)::json AS geometry
        FROM via {'WHERE tipo=%s' if tipo else ''}""", (tipo,) if tipo else ()))


@app.get("/api/puntos", tags=["Capas"], summary="Entradas, extintores y servicios (puntos)")
def puntos(tipo: Literal["entrada", "extintor", "servicio"] | None = None):
    return fc(q(f"""SELECT p.id, p.tipo, p.subtipo, p.nombre, p.descripcion, p.fuente, p.fecha::text, e.nombre AS edificio,
        ST_AsGeoJSON(p.geom)::json AS geometry FROM punto p LEFT JOIN edificio e ON e.id=p.edificio_id
        {'WHERE p.tipo=%s' if tipo else ''} ORDER BY p.tipo, p.id""", (tipo,) if tipo else ()))


@app.get("/api/dependencias", tags=["Alfanumérico"], summary="Árbol de dependencias del Vicerrectorado")
def dependencias():
    return q("""SELECT d.id, d.nombre, d.sigla, d.nivel, d.padre_id, d.alcance, d.responsable, d.cargo,
        (SELECT count(*) FROM oficina o WHERE o.dependencia_id=d.id) AS ubicadas FROM dependencia d ORDER BY d.id""")


@app.get("/api/clasificaciones", tags=["Alfanumérico"], summary="Clasificación de ambientes")
def clasificaciones():
    return q("SELECT * FROM clasificacion ORDER BY codigo")


# ----------------------------------------------------------------------------- tabla de infraestructura
TABLAS = {
    "oficinas": f"""SELECT o.codigo, o.nombre, o.sigla, d.nombre AS dependencia, c.nombre AS clasificacion,
        e.nombre AS edificio, o.piso, o.responsable, o.horario, o.telefono,
        round(ST_Y(o.geom)::numeric,7) AS lat, round(ST_X(o.geom)::numeric,7) AS lon,
        o.precision_m, o.metodo_captura, o.verificado {OF_FROM} ORDER BY o.codigo""",
    "edificios": """SELECT e.codigo, e.nombre, c.nombre AS clasificacion, e.area_m2,
        (SELECT count(*) FROM oficina o WHERE o.edificio_id=e.id) AS oficinas, e.fuente
        FROM edificio e JOIN clasificacion c ON c.codigo=e.uso ORDER BY e.codigo""",
    "zonas": "SELECT id, tipo, nombre, detalle, area_m2, fuente FROM zona ORDER BY tipo, id",
    "vias": "SELECT id, tipo, nombre, superficie, longitud_m, fuente FROM via ORDER BY tipo, id",
    "puntos": "SELECT id, tipo, subtipo, nombre, descripcion, fuente FROM punto ORDER BY tipo, id",
}


@app.get("/api/infraestructura", tags=["Alfanumérico"], summary="Tabla de infraestructura: resumen por capa (cantidades, superficies, longitudes)")
def infraestructura():
    resumen = q("""
      SELECT 'Punto' AS geometria, 'Oficinas del Vicerrectorado (1)' AS capa, count(*) AS cantidad, NULL::numeric AS total, NULL AS unidad FROM oficina
      UNION ALL SELECT 'Punto', t.nombre, count(p.id), NULL, NULL
                FROM (VALUES ('entrada','Entradas'),('extintor','Extintores'),('servicio','Servicios')) t(tipo,nombre)
                LEFT JOIN punto p ON p.tipo=t.tipo GROUP BY t.tipo, t.nombre
      UNION ALL SELECT 'Línea', CASE tipo WHEN 'via_interna' THEN 'Vías internas' WHEN 'sendero' THEN 'Senderos' ELSE 'Escaleras' END,
                count(*), round(sum(longitud_m)), 'm' FROM via GROUP BY tipo
      UNION ALL SELECT 'Polígono', 'Edificios', count(*), round(sum(area_m2)), 'm²' FROM edificio
      UNION ALL SELECT 'Polígono', CASE tipo WHEN 'campus' THEN 'Límite del campus' WHEN 'cancha' THEN 'Canchas'
                WHEN 'jardin' THEN 'Jardines y áreas verdes' ELSE 'Parqueos' END, count(*), round(sum(area_m2)), 'm²' FROM zona GROUP BY tipo""")
    deps = dependencias()
    return {"resumen": [dict(r, total=float(r["total"]) if r["total"] is not None else None) for r in resumen],
            "cobertura": {"unidades": len(deps), "ubicadas": sum(1 for d in deps if d["ubicadas"])}}


@app.get("/api/infraestructura.csv", tags=["Alfanumérico"], summary="Tabla de infraestructura en CSV")
def infraestructura_csv(tabla: Literal["oficinas", "edificios", "zonas", "vias", "puntos"] = "oficinas"):
    return csv_resp(q(TABLAS[tabla]), f"infraestructura_{tabla}")


@app.get("/api/export/{tabla}.geojson", tags=["Intercambio"], summary="Exportar una capa en GeoJSON (RFC 7946)")
def exportar(tabla: Literal["oficinas", "edificios", "zonas", "vias", "puntos"]):
    return {"oficinas": oficinas, "edificios": edificios, "zonas": zonas, "vias": vias, "puntos": puntos}[tabla]()


CAPAS_SHP = {"oficinas": "VR1_oficinas", "edificios": "VR1_edificios", "zonas": "VR1_zonas", "vias": "VR1_vias", "puntos": "VR1_puntos"}


@app.get("/api/export/{tabla}.zip", tags=["Intercambio"], summary="Exportar una capa en Shapefile (.shp/.dbf/.prj) para ArcMap")
def exportar_shp(tabla: Literal["oficinas", "edificios", "zonas", "vias", "puntos"]):
    nombre = CAPAS_SHP[tabla]
    return Response(a_zip(nombre, exportar(tabla)), media_type="application/zip",
                    headers={"Content-Disposition": f"attachment; filename={nombre}.zip"})


# ----------------------------------------------------------------------------- digitalización y edición de atributos
class NuevoPunto(BaseModel):
    tipo: Literal["entrada", "extintor", "servicio"]
    subtipo: str | None = None
    nombre: str | None = Field(None, max_length=120)
    descripcion: str | None = Field(None, max_length=500)
    lat: float
    lon: float


class NuevaOficina(BaseModel):
    nombre: str = Field(max_length=150)
    sigla: str | None = None
    clasificacion: str = "ATENCION"
    dependencia_id: int
    lat: float
    lon: float
    precision_m: float | None = 5
    metodo_captura: str = "Digitalización"


EDITABLES = {"nombre", "sigla", "clasificacion", "funcion", "tramites", "piso", "responsable", "cargo_responsable",
             "horario", "telefono", "email", "web", "foto", "precision_m", "verificado", "dependencia_id"}


@app.post("/api/puntos", tags=["Edición"], dependencies=[Depends(admin)], summary="Digitalizar un punto (entrada, extintor o servicio)")
def crear_punto(p: NuevoPunto):
    x, y = pt(p.lat, p.lon)
    r = q(f"""INSERT INTO punto (tipo, subtipo, nombre, descripcion, fuente, geom)
        VALUES (%s,%s,%s,%s,'Digitalización (app)',{MK}) RETURNING id""",
          (p.tipo, p.subtipo, p.nombre, p.descripcion, x, y), commit=True)
    return {"id": r[0]["id"]}


@app.delete("/api/puntos/{pid}", tags=["Edición"], dependencies=[Depends(admin)], summary="Eliminar un punto digitalizado")
def borrar_punto(pid: int):
    q("DELETE FROM punto WHERE id=%s", (pid,), commit=True)
    return {"ok": True}


@app.post("/api/oficinas", tags=["Edición"], dependencies=[Depends(admin)], summary="Digitalizar una oficina nueva")
def crear_oficina(o: NuevaOficina):
    x, y = pt(o.lat, o.lon)
    sig = q("SELECT coalesce(max(substring(codigo from 5)::int),0)+1 AS n FROM oficina")[0]["n"]
    r = q(f"""INSERT INTO oficina (codigo, nombre, sigla, clasificacion, dependencia_id, precision_m, metodo_captura, geom)
        VALUES (%s,%s,%s,%s,%s,%s,%s,{MK}) RETURNING id""",
          (f"VR1-{sig:03d}", o.nombre, o.sigla, o.clasificacion, o.dependencia_id, o.precision_m, o.metodo_captura, x, y), commit=True)
    return {"id": r[0]["id"]}


@app.patch("/api/oficinas/{oid}", tags=["Edición"], dependencies=[Depends(admin)], summary="Editar atributos de una oficina")
def editar_oficina(oid: int, cambios: dict):
    campos = {k: v for k, v in cambios.items() if k in EDITABLES}
    if not campos:
        raise HTTPException(422, f"Campos editables: {sorted(EDITABLES)}")
    sets = ", ".join(f"{k}=%s" for k in campos)  # nombres de columna validados contra EDITABLES
    q(f"UPDATE oficina SET {sets} WHERE id=%s", (*campos.values(), oid), commit=True)
    return oficina(oid)


@app.patch("/api/oficinas/{oid}/ubicacion", tags=["Edición"], dependencies=[Depends(admin)], summary="Mover una oficina (nueva coordenada)")
def mover_oficina(oid: int, lat: float, lon: float, precision_m: float | None = None):
    x, y = pt(lat, lon)
    q(f"""UPDATE oficina SET geom={MK}, edificio_id=NULL, precision_m=coalesce(%s, precision_m),
        metodo_captura='Digitalización', fecha_captura=CURRENT_DATE WHERE id=%s""", (x, y, precision_m, oid), commit=True)
    return oficina(oid)


@app.get("/api/admin/check", tags=["Edición"], dependencies=[Depends(admin)], include_in_schema=False)
def admin_check():
    return {"ok": True}


# ----------------------------------------------------------------------------- web
@app.get("/", include_in_schema=False)
def index():
    return FileResponse(WEB / "index.html")


app.mount("/static", StaticFiles(directory=WEB), name="static")
