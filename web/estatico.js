// ¿Dónde queda? · Modo estático (GitHub Pages)
// Sin servidor ni base de datos: responde en el navegador las mismas rutas /api/... que FastAPI + PostGIS,
// a partir de los GeoJSON exportados en ./datos/. Distancias geodésicas (haversine) y punto-en-polígono.
'use strict';
(() => {
  const BASE = './datos/';
  const cache = {};
  const cargar = n => cache[n] || (cache[n] = window.__fetchOriginal(BASE + n + '.json').then(r => r.json()));

  const R = 6371008.8, rad = d => d * Math.PI / 180;
  const dist = ([lon1, lat1], [lon2, lat2]) => {
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  const r1 = m => Math.round(m * 10) / 10;
  const dentro = ([x, y], anillos) => {               // punto en polígono (par-impar, con huecos)
    let c = false;
    for (const ring of anillos) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const centroide = anillos => { const r = anillos[0]; let x = 0, y = 0; r.forEach(p => { x += p[0]; y += p[1]; }); return [x / r.length, y / r.length]; };
  const sinTilde = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const fc = feats => ({ type: 'FeatureCollection', features: feats });
  const conDist = (f, d) => ({ ...f, properties: { ...f.properties, distancia_m: r1(d) } });

  async function ruta(url) {
    const u = new URL(url, location.href), p = u.pathname.replace(/^.*\/api\//, ''), q = u.searchParams;
    const [of, deps] = await Promise.all([cargar('oficinas'), cargar('dependencias')]);
    const padre = Object.fromEntries(deps.map(d => [d.id, d.padre_id]));
    let m;

    if (p === 'oficinas') {
      let fs = of.features;
      const t = sinTilde(q.get('texto') || '').trim();
      if (t) {
        const campos = f => ['nombre', 'nombre_alterno', 'sigla', 'tramites', 'funcion', 'responsable', 'dependencia', 'dependencia_sigla'].map(k => sinTilde(f.properties[k]));
        fs = fs.filter(f => campos(f).some(c => c.includes(t)));
        const peso = f => (sinTilde(f.properties.nombre).includes(t) || sinTilde(f.properties.sigla).includes(t) ? 2 : 0) + (sinTilde(f.properties.tramites).includes(t) ? 1 : 0);
        fs = [...fs].sort((a, b) => peso(b) - peso(a) || a.properties.codigo.localeCompare(b.properties.codigo));
      }
      if (q.get('dependencia')) { const d = +q.get('dependencia'); fs = fs.filter(f => f.properties.dependencia_id === d || padre[f.properties.dependencia_id] === d); }
      if (q.get('clasificacion')) fs = fs.filter(f => f.properties.clasificacion === q.get('clasificacion'));
      return fc(fs);
    }
    if ((m = p.match(/^oficinas\/(\d+)$/))) return of.features.find(f => f.properties.id === +m[1]) || null;
    if ((m = p.match(/^oficinas\/(\d+)\/servicios-cercanos$/))) {
      const o = of.features.find(f => f.properties.id === +m[1]), pts = await cargar('puntos'), tipo = q.get('tipo');
      return fc(pts.features.filter(f => !tipo || f.properties.tipo === tipo)
        .map(f => conDist(f, dist(f.geometry.coordinates, o.geometry.coordinates)))
        .sort((a, b) => a.properties.distancia_m - b.properties.distancia_m).slice(0, +(q.get('n') || 5)));
    }
    if (p === 'cercana' || p === 'radio') {
      const c = [+q.get('lon'), +q.get('lat')];
      const ofs = of.features.map(f => conDist(f, dist(f.geometry.coordinates, c))).sort((a, b) => a.properties.distancia_m - b.properties.distancia_m);
      if (p === 'cercana') return fc(ofs.slice(0, +(q.get('n') || 1)));
      const r = +(q.get('metros') || 200), pts = await cargar('puntos');
      return {
        oficinas: fc(ofs.filter(f => f.properties.distancia_m <= r)),
        puntos: fc(pts.features.map(f => conDist(f, dist(f.geometry.coordinates, c))).filter(f => f.properties.distancia_m <= r)
          .sort((a, b) => a.properties.distancia_m - b.properties.distancia_m)),
      };
    }
    if (p === 'distancia') {
      const a = of.features.find(f => f.properties.id === +q.get('a')), b = of.features.find(f => f.properties.id === +q.get('b'));
      return { desde: a.properties.nombre, hasta: b.properties.nombre, metros: r1(dist(a.geometry.coordinates, b.geometry.coordinates)),
        linea: { type: 'LineString', coordinates: [a.geometry.coordinates, b.geometry.coordinates] } };
    }
    if ((m = p.match(/^contenido\/(edificio|zona)\/(\d+)$/))) {
      const capa = await cargar(m[1] === 'edificio' ? 'edificios' : 'zonas'), pts = await cargar('puntos');
      const pol = capa.features.find(f => f.properties.id === +m[2]), an = pol.geometry.coordinates;
      const edis = m[1] === 'zona' ? (await cargar('edificios')).features.filter(e => dentro(centroide(e.geometry.coordinates), an))
        .map(e => ({ id: e.properties.id, nombre: e.properties.nombre, area_m2: e.properties.area_m2 })) : [];
      return {
        poligono: { id: pol.properties.id, nombre: pol.properties.nombre, area_m2: pol.properties.area_m2, clase: pol.properties.uso || pol.properties.tipo },
        oficinas: fc(of.features.filter(f => dentro(f.geometry.coordinates, an))),
        puntos: fc(pts.features.filter(f => dentro(f.geometry.coordinates, an))),
        edificios: edis,
      };
    }
    if (['edificios', 'zonas', 'vias', 'puntos', 'dependencias', 'clasificaciones', 'infraestructura'].includes(p)) {
      const d = await cargar(p), tipo = q.get('tipo');
      return tipo && d.features ? fc(d.features.filter(f => f.properties.tipo === tipo)) : d;
    }
    if (p.startsWith('admin')) throw { status: 401, detail: 'La edición no está disponible en la versión publicada' };
    throw { status: 404, detail: 'Ruta no disponible en la versión estática' };
  }

  // Intercepta solo las llamadas a /api/; el resto (mapas, fuentes) pasa normal
  window.__fetchOriginal = window.fetch.bind(window);
  window.fetch = async (url, opt = {}) => {
    const s = String(url);
    if (!s.includes('/api/')) return window.__fetchOriginal(url, opt);
    if (opt.method && opt.method !== 'GET') return new Response(JSON.stringify({ detail: 'La edición no está disponible en la versión publicada' }), { status: 403 });
    try { return new Response(JSON.stringify(await ruta(s)), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
    catch (e) { return new Response(JSON.stringify({ detail: e.detail || String(e) }), { status: e.status || 500 }); }
  };
  document.documentElement.classList.add('estatico');
})();
