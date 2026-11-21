// Mapa de Oficinas Administrativas del Vicerrectorado (1) — Grupo 16 · SIG INF442-SA
'use strict';

// ---------------------------------------------------------------- simbología (una sola fuente para mapa y leyenda)
const SIM = {
  oficina:  { DESPACHO: ['#d68910', 'Despacho de autoridad'], DIRECCION: ['#1d4f91', 'Dirección'], ATENCION: ['#c0392b', 'Atención al público'] },
  punto:    { entrada: ['#2c3e50', 'Entrada / portón'], extintor: ['#e74c3c', 'Extintor'], servicio: ['#16a085', 'Servicio (baño, comida, salud…)'] },
  via:      { via_interna: ['#7f8c8d', 'Vía interna', 4], sendero: ['#c39b77', 'Sendero', 2], escalera: ['#8e44ad', 'Escalera', 3] },
  edificio: { ADMINISTRATIVO: ['#f5b041', 'Edificio administrativo (con oficinas VR)'], SERVICIO: ['#76d7c4', 'Edificio de servicio'], ACADEMICO: ['#d5d8dc', 'Edificio académico / otro'] },
  zona:     { campus: ['#1d4f91', 'Límite del campus'], cancha: ['#58d68d', 'Cancha'], jardin: ['#a9dfbf', 'Jardín / área verde'], parqueo: ['#d6dbdf', 'Parqueo'] },
};
const etiqueta = p => p.sigla || p.nombre.replace(/^(Departamento|Dirección)( General)? de /, '').replace(/ \(.*\)$/, '').split(',')[0].slice(0, 24);
const color = (grupo, k) => (SIM[grupo][k] || ['#888'])[0];

// ---------------------------------------------------------------- mapa base
const mapa = L.map('mapa', { zoomSnap: 0.5 }).setView([-17.7765, -63.1945], 16);
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(mapa);
const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 19, attribution: 'Imágenes © Esri' });
L.control.scale({ imperial: false, maxWidth: 150 }).addTo(mapa);
const norte = L.control({ position: 'topleft' });
norte.onAdd = () => Object.assign(L.DomUtil.create('div', 'norte'), { innerHTML: '↑<small>N</small>' });
norte.addTo(mapa);
['load', 'resize'].forEach(ev => window.addEventListener(ev, () => mapa.invalidateSize()));

mapa.createPane('zonas').style.zIndex = 380;
mapa.createPane('edificios').style.zIndex = 390;
mapa.createPane('vias').style.zIndex = 395;

const capas = {
  zonas: L.geoJSON(null, {
    pane: 'zonas',
    style: f => f.properties.tipo === 'campus'
      ? { color: color('zona', 'campus'), weight: 2.5, dashArray: '8 5', fill: false }
      : { color: '#0003', weight: 1, fillColor: color('zona', f.properties.tipo), fillOpacity: .65 },
    onEachFeature: (f, l) => { if (f.properties.tipo !== 'campus') { l.bindTooltip(etiquetaZona(f.properties)); l.on('click', () => verContenido('zona', f)); } },
  }),
  edificios: L.geoJSON(null, {
    pane: 'edificios',
    style: f => ({ color: '#555', weight: 1, fillColor: color('edificio', f.properties.uso), fillOpacity: .8 }),
    onEachFeature: (f, l) => { l.bindTooltip(f.properties.nombre); l.on('click', () => verContenido('edificio', f)); },
  }),
  vias: L.geoJSON(null, {
    pane: 'vias',
    style: f => { const [c, , w] = SIM.via[f.properties.tipo] || ['#999', '', 2]; return { color: c, weight: w, opacity: .9, dashArray: f.properties.tipo === 'sendero' ? '4 3' : null }; },
    onEachFeature: (f, l) => l.bindTooltip(`${SIM.via[f.properties.tipo]?.[1] || 'Vía'}${f.properties.nombre ? ': ' + f.properties.nombre : ''} · ${Math.round(f.properties.longitud_m)} m`),
  }),
  puntos: L.geoJSON(null, {
    pointToLayer: (f, ll) => L.circleMarker(ll, { radius: f.properties.tipo === 'entrada' ? 4 : 6, color: '#fff', weight: 1.5, fillColor: color('punto', f.properties.tipo), fillOpacity: 1 }),
    onEachFeature: (f, l) => l.bindTooltip(`${f.properties.nombre || f.properties.tipo}${f.properties.subtipo && f.properties.subtipo !== f.properties.nombre ? ' (' + f.properties.subtipo + ')' : ''}`),
  }),
  oficinas: L.geoJSON(null, {
    pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 10, color: '#fff', weight: 2.5, fillColor: color('oficina', f.properties.clasificacion), fillOpacity: 1 }),
    onEachFeature: (f, l) => { l.bindTooltip(etiqueta(f.properties), { permanent: true, direction: 'right', className: 'lbl' }); l.on('click', () => verOficina(f.properties.id)); },
  }),
};
const resaltado = L.layerGroup().addTo(mapa);
Object.values(capas).forEach(c => c.addTo(mapa));
L.control.layers({ 'Mapa': osm, 'Satélite': sat }, {
  'Oficinas del Vicerrectorado': capas.oficinas, 'Entradas · extintores · servicios': capas.puntos,
  'Senderos y vías internas': capas.vias, 'Edificios': capas.edificios, 'Campus · canchas · jardines · parqueos': capas.zonas,
}, { collapsed: true }).addTo(mapa);

const leyenda = L.control({ position: 'bottomright' });
leyenda.onAdd = () => {
  const d = L.DomUtil.create('div', 'leyenda');
  const items = (g, cls) => Object.values(SIM[g]).map(([c, t]) => `<div><span class="sim ${cls}" style="${cls === 'ln' ? 'border-color' : 'background'}:${c}"></span>${t}</div>`).join('');
  d.innerHTML = `<details ${innerWidth > 1100 ? 'open' : ''}><summary><b style="display:inline">LEYENDA</b></summary><b>Puntos</b>${items('oficina', 'pt')}${items('punto', 'pt')}<b>Líneas</b>${items('via', 'ln')}<b>Polígonos</b>${items('edificio', 'pg')}${items('zona', 'pg')}<div style="margin-top:4px;color:#666">WGS 84 · EPSG:4326</div></details>`;
  L.DomEvent.disableScrollPropagation(d); L.DomEvent.disableClickPropagation(d);
  return d;
};
leyenda.addTo(mapa);

// ---------------------------------------------------------------- utilidades
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const m2 = v => v == null ? '—' : Math.round(v).toLocaleString('es-BO') + ' m²';
const mts = v => v == null ? '—' : (v >= 1000 ? (v / 1000).toFixed(2) + ' km' : Math.round(v) + ' m');
let TOKEN = '';
try { TOKEN = sessionStorage.getItem('token') || ''; } catch (_) {}
async function api(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.status);
  return r.json();
}
const resultado = $('resultado');
function aviso(html) { resultado.innerHTML = html; }
function etiquetaZona(p) { return `${SIM.zona[p.tipo]?.[1] || p.tipo}${p.nombre ? ': ' + p.nombre : ''}${p.detalle ? ' (' + p.detalle + ')' : ''} · ${m2(p.area_m2)}`; }
function marcar(lls, opts = {}) {
  resaltado.clearLayers();
  lls.forEach(ll => L.circleMarker(ll, { radius: 17, color: '#e74c3c', weight: 3, fill: false }).addTo(resaltado));
  if (lls.length && !opts.noZoom) mapa.fitBounds(L.latLngBounds(lls).pad(.6), { maxZoom: 18 });
}
const ll = f => [f.geometry.coordinates[1], f.geometry.coordinates[0]];

function fichaOficina(p, extra = '') {
  const fila = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  return `<div class="ficha clic" data-id="${p.id}">
    <h3>${esc(p.nombre)}${p.sigla ? ' (' + esc(p.sigla) + ')' : ''}</h3>
    <span class="badge info">${esc(p.codigo)}</span><span class="badge ${p.verificado ? 'ok' : ''}">${p.verificado ? 'Ubicación verificada' : 'Ubicación por verificar'}</span>${p.alcance === 'condicional' ? '<span class="badge">Alcance a confirmar</span>' : ''}
    <dl>${fila('Dependencia', p.dependencia)}${fila('Depende de', p.depende_de)}${fila('Clasificación', p.clasificacion_nombre)}
    ${fila('Función', p.funcion)}${fila('Trámites', p.tramites)}${fila('Responsable', [p.responsable, p.cargo_responsable].filter(Boolean).join(' · '))}
    ${fila('Edificio', p.edificio)}${fila('Piso', p.piso)}${fila('Horario', p.horario)}${fila('Teléfono', p.telefono)}${fila('Correo', p.email)}
    ${p.distancia_m != null ? fila('Distancia', mts(p.distancia_m)) : ''}
    ${fila('Coordenadas', `${p.lat}, ${p.lon} (±${p.precision_m ?? '?'} m, ${p.metodo_captura})`)}</dl>${extra}</div>`;
}
function listaOficinas(feats, titulo) {
  if (!feats.length) { aviso(`<div class="respuesta">${esc(titulo)}: <b>sin resultados</b>.</div>`); resaltado.clearLayers(); return; }
  aviso(`<div class="respuesta">${esc(titulo)}: <b>${feats.length}</b></div>` + feats.map(f => fichaOficina(f.properties)).join(''));
  resultado.querySelectorAll('.ficha').forEach(el => el.onclick = () => verOficina(+el.dataset.id));
  marcar(feats.map(ll));
}

// ---------------------------------------------------------------- consultas
async function verOficina(id) {
  if (modoEdicion) return editarOficina(id);
  const [f, cerca] = await Promise.all([api(`/api/oficinas/${id}`), api(`/api/oficinas/${id}/servicios-cercanos?n=30`)]);
  const primero = t => cerca.features.find(x => x.properties.tipo === t || x.properties.subtipo === t);
  const items = [['extintor', 'Extintor'], ['entrada', 'Entrada'], ['Baños', 'Baño']].map(([t, n]) => {
    const x = primero(t);
    return x ? `<li>${n} más cercano: <b>${esc(x.properties.nombre)}</b> a ${mts(x.properties.distancia_m)}</li>` : `<li>${n}: sin registro aún</li>`;
  }).join('');
  aviso(fichaOficina(f.properties, `<ul>${items}</ul>`));
  marcar([ll(f)]);
  ['extintor', 'entrada', 'Baños'].map(primero).filter(Boolean).forEach(x =>
    L.polyline([ll(f), ll(x)], { color: '#e74c3c', weight: 2, dashArray: '4 4' }).addTo(resaltado));
}

async function verContenido(capa, f) {
  if (modoDig) return;
  const r = await api(`/api/contenido/${capa}/${f.properties.id}`);
  const p = r.poligono;
  const clase = capa === 'edificio' ? (SIM.edificio[p.clase]?.[1] || p.clase) : (SIM.zona[p.clase]?.[1] || p.clase);
  let html = `<div class="respuesta"><b>${esc(p.nombre || clase)}</b><br>${esc(clase)} · superficie <b>${m2(p.area_m2)}</b></div>`;
  html += r.oficinas.features.length ? r.oficinas.features.map(o => fichaOficina(o.properties)).join('') : '<p class="ayuda">No contiene oficinas del Vicerrectorado registradas.</p>';
  if (r.puntos.features.length) html += `<div class="ficha"><h3>Puntos dentro (${r.puntos.features.length})</h3><ul>${r.puntos.features.map(x => `<li>${esc(x.properties.nombre || x.properties.tipo)}</li>`).join('')}</ul></div>`;
  if (r.edificios.length) html += `<div class="ficha"><h3>Edificios dentro (${r.edificios.length})</h3><ul>${r.edificios.map(e => `<li>${esc(e.nombre)} · ${m2(e.area_m2)}</li>`).join('')}</ul></div>`;
  aviso(html);
  resultado.querySelectorAll('.ficha.clic').forEach(el => el.onclick = () => verOficina(+el.dataset.id));
  resaltado.clearLayers();
  L.geoJSON(f, { style: { color: '#e74c3c', weight: 3, fill: false } }).addTo(resaltado);
}

function miUbicacion() {
  return new Promise(ok => {
    const centro = () => ok({ ...mapa.getCenter(), aprox: true });
    if (!navigator.geolocation) return centro();
    navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), centro, { enableHighAccuracy: true, timeout: 6000 });
  });
}

$('buscar').onsubmit = async e => {
  e.preventDefault();
  mostrarTab('consultar');
  const t = $('texto').value.trim();
  const r = await api('/api/oficinas' + (t ? '?texto=' + encodeURIComponent(t) : ''));
  listaOficinas(r.features, t ? `¿Dónde "${t}"?` : 'Todas las oficinas');
};
$('btn-cercana').onclick = async () => {
  const u = await miUbicacion();
  const r = await api(`/api/cercana?lat=${u.lat}&lon=${u.lng}`);
  listaOficinas(r.features, 'Oficina más cercana' + (u.aprox ? ' al centro del mapa' : ' a tu ubicación'));
  L.marker(u).addTo(resaltado).bindTooltip(u.aprox ? 'Centro del mapa' : 'Tú').openTooltip();
  if (r.features[0]) L.polyline([[u.lat, u.lng], ll(r.features[0])], { color: '#1d4f91', dashArray: '6 4' }).addTo(resaltado);
};
$('btn-radio').onclick = async () => {
  const u = await miUbicacion(), m = +$('radio-m').value || 200;
  const r = await api(`/api/radio?lat=${u.lat}&lon=${u.lng}&metros=${m}`);
  const cuenta = {};
  r.puntos.features.forEach(x => { const k = x.properties.subtipo || x.properties.tipo; cuenta[k] = (cuenta[k] || 0) + 1; });
  listaOficinas(r.oficinas.features, `Oficinas a menos de ${m} m`);
  resultado.insertAdjacentHTML('afterbegin', `<div class="ficha"><h3>Otros puntos a menos de ${m} m</h3><ul>${Object.entries(cuenta).map(([k, v]) => `<li>${esc(k)}: ${v}</li>`).join('') || '<li>Ninguno</li>'}</ul></div>`);
  L.circle([u.lat, u.lng], { radius: m, color: '#1d4f91', weight: 2, fillOpacity: .05 }).addTo(resaltado);
  mapa.fitBounds(L.latLng(u.lat, u.lng).toBounds(m * 2.4));
};
$('btn-dist').onclick = async () => {
  const a = $('dist-a').value, b = $('dist-b').value;
  if (!a || !b || a === b) return aviso('<div class="respuesta">Elige dos oficinas distintas.</div>');
  const r = await api(`/api/distancia?a=${a}&b=${b}`);
  aviso(`<div class="respuesta">Distancia en línea recta entre <b>${esc(r.desde)}</b> y <b>${esc(r.hasta)}</b>: <b>${mts(r.metros)}</b></div>`);
  resaltado.clearLayers();
  const linea = L.geoJSON(r.linea, { style: { color: '#e74c3c', weight: 3, dashArray: '6 4' } }).addTo(resaltado);
  mapa.fitBounds(linea.getBounds().pad(.4));
};
async function filtrar() {
  const dep = $('filtro-dep').value, clas = $('filtro-clas').value, p = new URLSearchParams();
  if (dep) p.set('dependencia', dep); if (clas) p.set('clasificacion', clas);
  const r = await api('/api/oficinas?' + p);
  capas.oficinas.clearLayers().addData(r);
  listaOficinas(r.features, [ $('filtro-dep').selectedOptions[0].text, $('filtro-clas').selectedOptions[0].text ].join(' · '));
}
$('filtro-dep').onchange = filtrar;
$('filtro-clas').onchange = filtrar;

// ---------------------------------------------------------------- pestañas
function mostrarTab(t) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('activo', b.dataset.tab === t));
  document.querySelectorAll('.contenido').forEach(s => s.hidden = s.id !== 'tab-' + t);
  modoEdicion = t === 'editar' && !!TOKEN && !$('editor').hidden;
  if (t === 'tabla') cargarTabla();
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => mostrarTab(b.dataset.tab));

// ---------------------------------------------------------------- tabla de infraestructura
async function cargarTabla() {
  const [inf, of] = await Promise.all([api('/api/infraestructura'), api('/api/oficinas')]);
  $('resumen').innerHTML = `<p class="ayuda">Cobertura: <b>${inf.cobertura.ubicadas}</b> de <b>${inf.cobertura.unidades}</b> unidades del Vicerrectorado ubicadas.</p>
    <table><tr><th>Geometría</th><th>Capa</th><th>Cant.</th><th>Total</th></tr>${inf.resumen.map(r =>
      `<tr><td>${r.geometria}</td><td>${esc(r.capa)}</td><td class="num">${r.cantidad}</td><td class="num">${r.total == null ? '—' : Math.round(r.total).toLocaleString('es-BO') + ' ' + r.unidad}</td></tr>`).join('')}</table>`;
  $('tabla-oficinas').innerHTML = `<table><tr><th>Código</th><th>Oficina</th><th>Dependencia</th><th>Edificio</th><th>Lat, Lon</th></tr>${of.features.map(({ properties: p }) =>
    `<tr><td>${p.codigo}</td><td>${esc(p.nombre)}</td><td>${esc(p.dependencia_sigla || p.dependencia)}</td><td>${esc(p.edificio || '—')}</td><td class="num">${p.lat}, ${p.lon}</td></tr>`).join('')}</table>`;
}
$('btn-imprimir').onclick = () => {
  $('fecha-plano').textContent = new Date().toLocaleDateString('es-BO');
  mapa.fitBounds(capas.zonas.getBounds().isValid() ? capas.zonas.getBounds() : capas.edificios.getBounds());
  setTimeout(() => { mapa.invalidateSize(); window.print(); }, 800);
};

// ---------------------------------------------------------------- edición y digitalización
let modoEdicion = false, modoDig = false, DEPS = [], CLAS = [];
async function entrar(t) {
  TOKEN = t;
  try { await api('/api/admin/check'); } catch (e) { TOKEN = ''; return alert('Token incorrecto'); }
  try { sessionStorage.setItem('token', t); } catch (_) {}
  $('login').hidden = true; $('editor').hidden = false; modoEdicion = !$('tab-editar').hidden;
}
$('btn-login').onclick = () => entrar($('token').value.trim());
const opciones = (arr, val, txt, sel) => arr.map(x => `<option value="${x[val]}" ${x[val] == sel ? 'selected' : ''}>${esc(txt(x))}</option>`).join('');

async function editarOficina(id) {
  const { properties: p } = await api(`/api/oficinas/${id}`);
  const campo = (k, label, tipo = 'text') => `<label>${label}<${tipo === 'area' ? 'textarea rows="2"' : `input type="${tipo}"`} name="${k}" ${tipo === 'area' ? '' : `value="${esc(p[k])}"`} style="width:100%">${tipo === 'area' ? esc(p[k]) + '</textarea>' : ''}</label>`;
  const f = $('edit-form');
  f.hidden = false;
  f.innerHTML = `<b>${esc(p.codigo)} · ${esc(p.nombre)}</b>
    ${campo('nombre', 'Nombre')}${campo('sigla', 'Sigla')}
    <label>Clasificación<select name="clasificacion" style="width:100%">${opciones(CLAS, 'codigo', x => x.nombre, p.clasificacion)}</select></label>
    <label>Dependencia<select name="dependencia_id" style="width:100%">${opciones(DEPS, 'id', x => x.nombre, p.dependencia_id)}</select></label>
    ${campo('funcion', 'Función', 'area')}${campo('tramites', 'Trámites (separados por ;)', 'area')}
    ${campo('responsable', 'Responsable')}${campo('cargo_responsable', 'Cargo')}${campo('piso', 'Piso')}
    ${campo('horario', 'Horario')}${campo('telefono', 'Teléfono')}${campo('email', 'Correo', 'email')}
    <label><input type="checkbox" name="verificado" ${p.verificado ? 'checked' : ''}> Ubicación verificada</label>
    <div class="fila"><button>Guardar</button><button type="button" id="btn-mover">Mover en el mapa</button></div>`;
  f.onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    d.verificado = f.verificado.checked; d.dependencia_id = +d.dependencia_id;
    Object.keys(d).forEach(k => { if (d[k] === '') d[k] = null; });
    await api(`/api/oficinas/${id}`, { method: 'PATCH', body: JSON.stringify(d) });
    await recargar(); alert('Guardado');
  };
  $('btn-mover').onclick = () => esperarClic(async ll => {
    await api(`/api/oficinas/${id}/ubicacion?lat=${ll.lat}&lon=${ll.lng}`, { method: 'PATCH' });
    await recargar();
  });
  marcar([[p.lat, p.lon]]);
}

function esperarClic(cb) {
  modoDig = true; document.body.classList.add('modo-dig');
  mapa.once('click', e => { modoDig = false; document.body.classList.remove('modo-dig'); cb(e.latlng); });
}
$('btn-digitalizar').onclick = () => {
  const tipo = $('dig-tipo').value;
  $('dig-form').innerHTML = '<p class="ayuda">Haz clic en el mapa donde está el elemento…</p>';
  esperarClic(ll => {
    const esOf = tipo === 'oficina';
    $('dig-form').innerHTML = `<p class="ayuda">Coordenada: ${ll.lat.toFixed(7)}, ${ll.lng.toFixed(7)}</p>
      <label>Nombre<input id="dig-nombre" style="width:100%" ${esOf ? 'required' : ''}></label>
      ${esOf ? `<label>Dependencia<select id="dig-dep" style="width:100%">${opciones(DEPS, 'id', x => x.nombre)}</select></label>
        <label>Clasificación<select id="dig-clas" style="width:100%">${opciones(CLAS.filter(c => ['DESPACHO', 'DIRECCION', 'ATENCION'].includes(c.codigo)), 'codigo', x => x.nombre, 'ATENCION')}</select></label>`
        : `<label>Subtipo / detalle<input id="dig-sub" style="width:100%" placeholder="${tipo === 'servicio' ? 'Baños, comedor, consultorio…' : tipo === 'entrada' ? 'puerta / portón' : 'PQS 6 kg'}"></label>`}
      <button id="dig-guardar" type="button">Guardar</button>`;
    const tmp = L.circleMarker(ll, { radius: 9, color: '#e74c3c' }).addTo(resaltado);
    $('dig-guardar').onclick = async () => {
      const nombre = $('dig-nombre').value.trim() || null;
      if (esOf) await api('/api/oficinas', { method: 'POST', body: JSON.stringify({ nombre, dependencia_id: +$('dig-dep').value, clasificacion: $('dig-clas').value, lat: ll.lat, lon: ll.lng }) });
      else await api('/api/puntos', { method: 'POST', body: JSON.stringify({ tipo, subtipo: $('dig-sub').value || null, nombre: nombre || (tipo === 'extintor' ? 'Extintor' : null), lat: ll.lat, lon: ll.lng }) });
      tmp.remove(); $('dig-form').innerHTML = '<p class="ayuda">✔ Guardado.</p>';
      await recargar();
    };
  });
};

// ---------------------------------------------------------------- carga inicial
async function recargar() {
  const [z, e, v, p, o] = await Promise.all(['zonas', 'edificios', 'vias', 'puntos', 'oficinas'].map(c => api('/api/' + c)));
  capas.zonas.clearLayers().addData(z); capas.edificios.clearLayers().addData(e); capas.vias.clearLayers().addData(v);
  capas.puntos.clearLayers().addData(p); capas.oficinas.clearLayers().addData(o);
  const opts = '<option value="">—</option>' + o.features.map(f => `<option value="${f.properties.id}">${esc(f.properties.sigla || f.properties.nombre)}</option>`).join('');
  $('dist-a').innerHTML = opts; $('dist-b').innerHTML = opts;
  return { z, e, o };
}
(async () => {
  const [{ z }, deps, clas] = await Promise.all([recargar(), api('/api/dependencias'), api('/api/clasificaciones')]);
  DEPS = deps; CLAS = clas;
  deps.forEach(d => $('filtro-dep').add(new Option('  '.repeat(d.nivel) + d.nombre + (d.sigla ? ` (${d.sigla})` : '') + (d.ubicadas ? '' : ' · sin ubicar'), d.id)));
  clas.filter(c => ['DESPACHO', 'DIRECCION', 'ATENCION'].includes(c.codigo)).forEach(c => $('filtro-clas').add(new Option(c.nombre, c.codigo)));
  mapa.invalidateSize();
  const campus = capas.zonas.getLayers().filter(l => l.feature.properties.tipo === 'campus');
  mapa.fitBounds(campus.length ? L.featureGroup(campus).getBounds() : capas.edificios.getBounds(), { padding: [10, 10] });
  aviso(`<div class="respuesta"><b>¿Cómo usar?</b><br>Busca una oficina o trámite arriba, haz clic en cualquier elemento del mapa o usa las consultas.</div>`);
  if (TOKEN) entrar(TOKEN);
})();
