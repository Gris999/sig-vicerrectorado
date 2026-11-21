"""Convierte datos de OpenStreetMap (© OpenStreetMap contributors, ODbL) a SQL para PostGIS.

Uso:
  python3 -I scripts/osm_a_sql.py edificios data/raw/osm_campus_modulos.json > db/03_edificios.sql
  python3 -I scripts/osm_a_sql.py capas     data/raw/osm_campus_capas.json   > db/05_capas.sql
"""
import json, re, sys

CAMPUS_UAGRM = re.compile(r"Gabriel René Moreno|Ciudadela Universitaria UAGRM", re.I)
NOMBRES = {"toilets": "Baños", "parking": "Parqueo", "restaurant": "Comedor / restaurante", "food_court": "Patio de comidas",
           "doctors": "Consultorio médico", "library": "Biblioteca", "childcare": "Guardería", "theatre": "Teatro / auditorio",
           "bicycle_parking": "Parqueo de bicicletas", "motorcycle_parking": "Parqueo de motos", "copyshop": "Fotocopiadora",
           "kiosk": "Kiosco", "veterinary": "Veterinaria", "studio": "Estudio (Canal/radio)"}


def s(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"


def coords(e):
    return [(p["lon"], p["lat"]) for p in e.get("geometry") or []]


def poligono(e):
    pts = coords(e)
    if len(pts) < 4:
        return None
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    return "POLYGON((" + ",".join(f"{x:.7f} {y:.7f}" for x, y in pts) + "))"


def linea(e):
    pts = coords(e)
    return None if len(pts) < 2 else "LINESTRING(" + ",".join(f"{x:.7f} {y:.7f}" for x, y in pts) + ")"


def centro(e):
    if e["type"] == "node":
        return f"POINT({e['lon']:.7f} {e['lat']:.7f})"
    b = e.get("bounds")
    return f"POINT({(b['minlon'] + b['maxlon']) / 2:.7f} {(b['minlat'] + b['maxlat']) / 2:.7f})" if b else None


def insert_valido(tabla, cols, vals, wkt):
    return (f"INSERT INTO {tabla} ({','.join(cols)},geom) SELECT {','.join(vals)},g FROM "
            f"(SELECT ST_GeomFromText('{wkt}',4326) g) x WHERE ST_IsValid(g);")


def edificios(d):
    vistos = set()
    for e in d["elements"]:
        wkt = poligono(e)
        if not wkt:
            continue
        nombre = e["tags"].get("name", "Sin nombre")
        m = re.search(r"(\d{3})", nombre)
        codigo = f"M-{m.group(1)}" if m else f"OSM-{e['id']}"
        if codigo in vistos:
            codigo = f"{codigo}-{e['id']}"
        vistos.add(codigo)
        yield insert_valido("edificio", ["codigo", "nombre", "fuente"], [s(codigo), s(nombre), s(f"OSM way {e['id']}")], wkt)


def capas(d):
    vistos = set()
    for e in d["elements"]:
        key = (e["type"], e["id"])
        if key in vistos:
            continue
        vistos.add(key)
        t, fuente = e.get("tags", {}), s(f"OSM {e['type']} {e['id']}")
        hw, am = t.get("highway"), t.get("amenity") or t.get("shop")
        if am == "university":
            if e["type"] == "way" and CAMPUS_UAGRM.search(t.get("name", "")) and (wkt := poligono(e)):
                yield insert_valido("zona", ["tipo", "nombre", "fuente"], ["'campus'", s(t.get("name")), fuente], wkt)
        elif t.get("leisure") in ("pitch", "sports_centre", "track") and e["type"] == "way" and (wkt := poligono(e)):
            yield insert_valido("zona", ["tipo", "nombre", "detalle", "fuente"],
                                ["'cancha'", s(t.get("name")), s(t.get("sport")), fuente], wkt)
        elif (t.get("landuse") in ("grass", "recreation_ground") or t.get("leisure") in ("park", "garden")) \
                and e["type"] == "way" and (wkt := poligono(e)):
            yield insert_valido("zona", ["tipo", "nombre", "fuente"], ["'jardin'", s(t.get("name")), fuente], wkt)
        elif am == "parking" and e["type"] == "way" and (wkt := poligono(e)):
            yield insert_valido("zona", ["tipo", "nombre", "fuente"], ["'parqueo'", s(t.get("name")), fuente], wkt)
        elif hw and e["type"] == "way" and (wkt := linea(e)):
            tipo = "escalera" if hw == "steps" else "via_interna" if hw in ("service", "living_street", "track") else "sendero"
            yield insert_valido("via", ["tipo", "nombre", "superficie", "fuente"],
                                [s(tipo), s(t.get("name")), s(t.get("surface")), fuente], wkt)
        elif (t.get("entrance") or t.get("barrier") == "gate") and e["type"] == "node":
            sub = "porton" if t.get("barrier") == "gate" else "puerta"
            yield insert_valido("punto", ["tipo", "subtipo", "nombre", "fuente"],
                                ["'entrada'", s(sub), s(t.get("name") or ("Portón" if sub == "porton" else "Entrada")), fuente], centro(e))
        elif t.get("emergency") == "fire_extinguisher" and e["type"] == "node":
            yield insert_valido("punto", ["tipo", "nombre", "fuente"], ["'extintor'", "'Extintor'", fuente], centro(e))
        elif am and am != "parking" and (wkt := centro(e)):
            yield insert_valido("punto", ["tipo", "subtipo", "nombre", "descripcion", "fuente"],
                                ["'servicio'", s(NOMBRES.get(am, am)), s(t.get("name") or NOMBRES.get(am, am)),
                                 s(t.get("opening_hours")), fuente], wkt)
    # Solo lo que está dentro del campus de la UAGRM
    yield "DELETE FROM zona z WHERE z.tipo<>'campus' AND NOT EXISTS (SELECT 1 FROM zona c WHERE c.tipo='campus' AND ST_Intersects(c.geom, z.geom));"
    yield "DELETE FROM via v WHERE NOT EXISTS (SELECT 1 FROM zona c WHERE c.tipo='campus' AND ST_Intersects(c.geom, v.geom));"
    yield "DELETE FROM punto p WHERE NOT EXISTS (SELECT 1 FROM zona c WHERE c.tipo='campus' AND ST_DWithin(c.geom::geography, p.geom::geography, 15));"


if __name__ == "__main__":
    modo, ruta = sys.argv[1], sys.argv[2]
    datos = json.load(open(ruta, encoding="utf-8"))
    print("-- Generado desde OpenStreetMap (© OpenStreetMap contributors, ODbL) por scripts/osm_a_sql.py")
    for linea_sql in (edificios if modo == "edificios" else capas)(datos):
        print(linea_sql)
