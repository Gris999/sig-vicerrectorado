// Mapa de Oficinas Administrativas del Vicerrectorado (1) — Grupo 16
const COLORES = { 'Dirección': '#1d4f91', 'Unidad de servicio': '#c0392b', 'Departamento': '#8e44ad', 'Despacho': '#d68910' };
const colorTipo = t => COLORES[t] || '#2e7d32';

const mapa = L.map('mapa').setView([-17.7765, -63.1945], 16);
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 20, attribution: '© OpenStreetMap contributors' }).addTo(mapa);
const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 20, attribution: 'Imágenes © Esri' });
L.control.scale({ imperial: false }).addTo(mapa);

const capaEdificios = L.geoJSON(null, {
  style: f => ({ color: '#555', weight: 1, fillColor: f.properties.nro_oficinas ? '#f5b041' : '#bdc3c7', fillOpacity: f.properties.nro_oficinas ? .6 : .3 }),
  onEachFeature: (f, l) => l.on('click', () => verEdificio(f))
}).addTo(mapa);
const capaOficinas = L.geoJSON(null, {
  pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 9, color: '#fff', weight: 2, fillColor: colorTipo(f.properties.tipo), fillOpacity: 1 }),
  onEachFeature: (f, l) => { l.bindTooltip(f.properties.sigla || f.properties.nombre); l.on('click', () => mostrar([f])); }
}).addTo(mapa);
const capaResaltado = L.layerGroup().addTo(mapa);

L.control.layers({ 'Mapa': osm, 'Satélite': sat }, { 'Oficinas': capaOficinas, 'Edificios': capaEdificios }).addTo(mapa);

// Leyenda + norte
const leyenda = L.control({ position: 'bottomright' });
leyenda.onAdd = () => {
  const d = L.DomUtil.create('div', 'leyenda');
  d.innerHTML = '<b>Leyenda</b> &nbsp;⬆ N<br>' +
    Object.entries(COLORES).map(([k, c]) => `<i style="background:${c}"></i>${k}`).join('<br>') +
    '<br><i class="pol" style="background:#f5b041"></i>Edificio con oficinas<br><i class="pol" style="background:#bdc3c7"></i>Otros módulos<br><small>WGS 84 · EPSG:4326</small>';
  return d;
};
leyenda.addTo(mapa);

const api = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const panel = document.getElementById('resultado');

function ficha(p) {
  const fila = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  return `<div class="ficha" data-id="${p.id}">
    <h3>${esc(p.nombre)} ${p.sigla ? '(' + esc(p.sigla) + ')' : ''}</h3>
    <span class="badge ${p.verificado ? 'ok' : ''}">${p.verificado ? 'Ubicación verificada' : 'Ubicación por verificar'}</span>
    <dl>${fila('Depende de', p.dependencia)}${fila('Tipo', p.tipo)}${fila('Función', p.funcion)}${fila('Trámites', p.tramites)}
    ${fila('Edificio', p.edificio)}${fila('Piso', p.piso)}${fila('Responsable', p.responsable)}${fila('Horario', p.horario)}
    ${fila('Teléfono', p.telefono)}${p.distancia_m != null ? fila('Distancia', p.distancia_m + ' m') : ''}</dl></div>`;
}

function mostrar(feats, titulo) {
  capaResaltado.clearLayers();
  if (!feats.length) { panel.innerHTML = `<p class="ayuda">${titulo ? esc(titulo) + ': ' : ''}sin resultados.</p>`; return; }
  panel.innerHTML = (titulo ? `<p><b>${esc(titulo)}</b> (${feats.length})</p>` : '') + feats.map(f => ficha(f.properties)).join('');
  const pts = feats.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
  pts.forEach(ll => L.circleMarker(ll, { radius: 16, color: '#e74c3c', weight: 3, fill: false }).addTo(capaResaltado));
  mapa.fitBounds(L.latLngBounds(pts).pad(0.5), { maxZoom: 18 });
  panel.querySelectorAll('.ficha').forEach((el, i) => el.onclick = () => mapa.setView(pts[i], 19));
}

async function verEdificio(f) {
  const r = await api(`/api/edificios/${f.properties.id}/oficinas`);
  const area = f.properties.area_m2 ? ` · ${Math.round(f.properties.area_m2)} m²` : '';
  mostrar(r.features, `Oficinas en ${f.properties.nombre}${area}`);
  if (!r.features.length) panel.innerHTML = `<p><b>${esc(f.properties.nombre)}</b>${area}</p><p class="ayuda">No hay oficinas del Vicerrectorado registradas en este edificio.</p>`;
}

function miUbicacion() {
  return new Promise((ok, no) => {
    if (!navigator.geolocation) return ok(mapa.getCenter());
    navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => ok(mapa.getCenter()), { enableHighAccuracy: true, timeout: 8000 });
  });
}

document.getElementById('buscar').onsubmit = async e => {
  e.preventDefault();
  const t = document.getElementById('texto').value.trim();
  const r = await api('/api/oficinas' + (t ? '?texto=' + encodeURIComponent(t) : ''));
  mostrar(r.features, t ? `Resultados para "${t}"` : 'Todas las oficinas');
};
document.getElementById('btn-cercana').onclick = async () => {
  const u = await miUbicacion();
  const r = await api(`/api/cercana?lat=${u.lat}&lon=${u.lng}`);
  mostrar(r.features, 'Oficina más cercana a tu ubicación');
  L.marker(u).addTo(capaResaltado).bindTooltip('Tú').openTooltip();
};
document.getElementById('btn-radio').onclick = async () => {
  const u = await miUbicacion(), m = +document.getElementById('radio-m').value || 300;
  const r = await api(`/api/radio?lat=${u.lat}&lon=${u.lng}&metros=${m}`);
  mostrar(r.features, `Oficinas a menos de ${m} m`);
  L.circle(u, { radius: m, color: '#1d4f91', fill: false, dashArray: '6' }).addTo(capaResaltado);
};
document.getElementById('filtro-dep').onchange = async e => {
  const v = e.target.value;
  const r = await api('/api/oficinas' + (v ? '?dependencia=' + v : ''));
  capaOficinas.clearLayers().addData(r);
  mostrar(r.features, e.target.selectedOptions[0].text);
};

(async () => {
  const [ed, of, deps] = await Promise.all([api('/api/edificios'), api('/api/oficinas'), api('/api/dependencias')]);
  capaEdificios.addData(ed);
  capaOficinas.addData(of);
  const sel = document.getElementById('filtro-dep');
  deps.forEach(d => sel.add(new Option('—'.repeat(d.nivel) + ' ' + d.nombre + (d.sigla ? ` (${d.sigla})` : ''), d.id)));
})();
