"""Convierte los polígonos de módulos de OpenStreetMap a SQL (tabla edificio).
Uso: python3 -I scripts/osm_a_sql.py data/raw/osm_campus_modulos.json > db/03_edificios.sql"""
import json, re, sys

d = json.load(open(sys.argv[1], encoding="utf-8"))
print("-- Generado desde OpenStreetMap (© OpenStreetMap contributors, ODbL)")
vistos = set()
for e in d["elements"]:
    g = e.get("geometry") or []
    if len(g) < 4:
        continue
    pts = [(p["lon"], p["lat"]) for p in g]
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    nombre = e["tags"].get("name", "Sin nombre").replace("'", "''")
    m = re.search(r"(\d{3})", nombre)
    codigo = f"M-{m.group(1)}" if m else f"OSM-{e['id']}"
    if codigo in vistos:
        codigo = f"{codigo}-{e['id']}"
    vistos.add(codigo)
    wkt = "POLYGON((" + ",".join(f"{x:.7f} {y:.7f}" for x, y in pts) + "))"
    print(f"INSERT INTO edificio (codigo,nombre,fuente,geom) VALUES ('{codigo}','{nombre}','OSM way {e['id']}',"
          f"ST_GeomFromText('{wkt}',4326));")
