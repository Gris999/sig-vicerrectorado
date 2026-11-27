"""Genera la versión estática de la app (GitHub Pages) en ./site a partir de la API local.
Uso: python3 -I scripts/publicar_estatico.py [http://localhost:8042]"""
import json, re, shutil, sys, urllib.request
from pathlib import Path

API = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8042").rstrip("/")
RAIZ = Path(__file__).resolve().parent.parent
SITE = RAIZ / "site"
CAPAS = ["oficinas", "edificios", "zonas", "vias", "puntos"]
SHP = {"oficinas": "VR1_oficinas", "edificios": "VR1_edificios", "zonas": "VR1_zonas", "vias": "VR1_vias", "puntos": "VR1_puntos"}


def bajar(ruta):
    with urllib.request.urlopen(API + ruta, timeout=60) as r:
        return r.read()


shutil.rmtree(SITE, ignore_errors=True)
(SITE / "datos").mkdir(parents=True)
(SITE / "descargas").mkdir()
shutil.copytree(RAIZ / "web", SITE / "static", ignore=shutil.ignore_patterns("index.html"))

for n in CAPAS + ["dependencias", "clasificaciones", "infraestructura"]:
    (SITE / "datos" / f"{n}.json").write_bytes(bajar(f"/api/{n}"))
for n in CAPAS:
    (SITE / "descargas" / f"infraestructura_{n}.csv").write_bytes(bajar(f"/api/infraestructura.csv?tabla={n}"))
    (SITE / "descargas" / f"{n}.geojson").write_bytes(bajar(f"/api/export/{n}.geojson"))
    (SITE / "descargas" / f"{SHP[n]}.zip").write_bytes(bajar(f"/api/export/{n}.zip"))

html = (RAIZ / "web" / "index.html").read_text(encoding="utf-8")
html = html.replace('"/static/', '"static/')
html = re.sub(r'/api/infraestructura\.csv\?tabla=(\w+)', r'descargas/infraestructura_\1.csv', html)
html = re.sub(r'/api/export/(\w+)\.geojson', r'descargas/\1.geojson', html)
html = re.sub(r'/api/export/(\w+)\.zip', lambda m: f'descargas/{SHP[m.group(1)]}.zip', html)
html = html.replace('<script src="static/app.js', '<script src="static/estatico.js"></script>\n<script src="static/app.js', 1)
(SITE / "index.html").write_text(html, encoding="utf-8")
(SITE / ".nojekyll").write_text("")
ofs = json.loads((SITE / "datos" / "oficinas.json").read_text())["features"]
print(f"Sitio generado en {SITE} · {len(ofs)} oficinas")
