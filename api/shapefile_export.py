"""Exporta capas a Shapefile (ESRI) en WGS 84 para abrirlas en ArcMap/QGIS.
Genera .shp .shx .dbf .prj .cpg dentro de un ZIP. Nombres de campo DBF ≤ 10 caracteres."""
import io, zipfile
from datetime import date

import shapefile  # pyshp

PRJ_WGS84 = ('GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],'
             'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]')
TIPOS = {"Point": shapefile.POINT, "LineString": shapefile.POLYLINE, "Polygon": shapefile.POLYGON}


def _campo(nombre, usados):
    base = nombre[:10].upper()
    n, i = base, 1
    while n in usados:
        sufijo = str(i); n = base[:10 - len(sufijo)] + sufijo; i += 1
    usados.add(n)
    return n


def _tipo_dbf(valores):
    vs = [v for v in valores if v is not None]
    if vs and all(isinstance(v, bool) for v in vs):
        return ("L", 1, 0)
    if vs and all(isinstance(v, int) and not isinstance(v, bool) for v in vs):
        return ("N", 18, 0)
    if vs and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in vs):
        return ("N", 19, 7)
    largo = max([len(str(v).encode("utf-8")) for v in vs] + [1])
    return ("C", min(max(largo, 10), 254), 0)


def _area2(anillo):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(anillo, anillo[1:]))


def _orientar(anillos):
    """Shapefile: anillo exterior en sentido horario, huecos antihorario (al revés que GeoJSON)."""
    out = []
    for i, a in enumerate(anillos):
        horario = _area2(a) < 0
        out.append(a if horario == (i == 0) else a[::-1])
    return out


def _cortar(v, n):
    b = str(v).encode("utf-8")[:n]
    return b.decode("utf-8", errors="ignore")


def a_zip(nombre: str, geojson: dict) -> bytes:
    feats = [f for f in geojson["features"] if f.get("geometry")]
    gtipo = feats[0]["geometry"]["type"] if feats else "Point"
    props = list(feats[0]["properties"].keys()) if feats else ["id"]
    usados, campos = set(), []
    for p in props:
        valores = [f["properties"].get(p) for f in feats]
        if any(isinstance(v, (dict, list)) for v in valores):
            continue
        campos.append((p, _campo(p, usados), *_tipo_dbf(valores)))

    shp, shx, dbf = io.BytesIO(), io.BytesIO(), io.BytesIO()
    w = shapefile.Writer(shp=shp, shx=shx, dbf=dbf, shapeType=TIPOS[gtipo], encoding="utf-8")
    for _, n, t, l, d in campos:
        w.field(n, t, size=l, decimal=d)
    for f in feats:
        c = f["geometry"]["coordinates"]
        if gtipo == "Point":
            w.point(*c)
        elif gtipo == "LineString":
            w.line([c])
        else:
            w.poly(_orientar(c))
        fila = []
        for p, _, t, l, _ in campos:
            v = f["properties"].get(p)
            fila.append(None if v is None else (_cortar(v, l) if t == "C" else v))
        w.record(*fila)
    w.close()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{nombre}.shp", shp.getvalue()); z.writestr(f"{nombre}.shx", shx.getvalue())
        z.writestr(f"{nombre}.dbf", dbf.getvalue()); z.writestr(f"{nombre}.prj", PRJ_WGS84)
        z.writestr(f"{nombre}.cpg", "UTF-8")
        z.writestr(f"{nombre}_campos.txt", "\n".join(f"{n:<10} = {p}" for p, n, *_ in campos) +
                   f"\n\nSistema de referencia: WGS 84 (EPSG:4326). Exportado {date.today()} — Grupo 16, SIG INF442-SA.\n")
    return buf.getvalue()
