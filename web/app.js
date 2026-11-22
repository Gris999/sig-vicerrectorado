// ¿Dónde queda? · Oficinas del Vicerrectorado (1) — Grupo 16 · SIG INF442-SA
'use strict';

// ---------------------------------------------------------------- simbología (una sola fuente para mapa y leyenda)
const SIM = {
  oficina:  { DESPACHO: ['#d68910', 'Autoridad (Vicerrectorado)'], DIRECCION: ['#1d4f91', 'Dirección / departamento'], ATENCION: ['#c0392b', 'Atención al público (trámites)'] },
  punto:    { entrada: ['#2c3e50', 'Entrada / portón'], extintor: ['#e74c3c', 'Extintor'], servicio: ['#16a085', 'Servicio: baño, comida, salud…'] },
  via:      { via_interna: ['#7f8c8d', 'Vía interna', 4], sendero: ['#c39b77', 'Sendero peatonal', 2], escalera: ['#8e44ad', 'Escalera', 3] },
  edificio: { ADMINISTRATIVO: ['#f5b041', 'Edificio con oficinas del Vicerrectorado'], SERVICIO: ['#76d7c4', 'Edificio de servicios'], ACADEMICO: ['#d5d8dc', 'Otros edificios / módulos'] },
  zona:     { campus: ['#1d4f91', 'Límite de la Ciudad Universitaria'], cancha: ['#58d68d', 'Cancha'], jardin: ['#a9dfbf', 'Jardín / área verde'], parqueo: ['#d6dbdf', 'Parqueo'] },
};
const etiqueta = p => p.sigla || p.nombre.replace(/^(Departamento|Dirección|Oficina)( General)? de /, '').replace(/ \(.*\)$/, '').split(',')[0].slice(0, 24);
const color = (grupo, k) => (SIM[grupo][k] || ['#888'])[0];

// ---------------------------------------------------------------- mapa base
const mapa = L.map('mapa', { zoomSnap: 0.5 }).setView([-17.7765, -63.1945], 16);
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(mapa);
const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 19, attribution: 'Imágenes © Esri' });
L.control.scale({ imperial: false, maxWidth: 150 }).addTo(mapa);
const norte = L.control({ position: 'topleft' });
norte.onAdd = () => Object.assign(L.DomUtil.create('div', 'norte'), { innerHTML: '↑<small>N</small>', title: 'Norte' });
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
    onEachFeature: (f, l) => l.bindTooltip(nombrePunto(f.properties)),
  }),
  oficinas: L.geoJSON(null, {
    pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 10, color: '#fff', weight: 2.5, fillColor: color('oficina', f.properties.clasificacion), fillOpacity: 1 }),
    onEachFeature: (f, l) => { l.bindTooltip(etiqueta(f.properties), { permanent: true, direction: 'right', className: 'lbl' }); l.on('click', () => verOficina(f.properties.id)); },
  }),
};
const resaltado = L.layerGroup().addTo(mapa);
Object.values(capas).forEach(c => c.addTo(mapa));
L.control.layers({ 'Mapa': osm, 'Satélite': sat }, {
  'Oficinas del Vicerrectorado': capas.oficinas, 'Entradas, extintores y servicios': capas.puntos,
  'Senderos y vías internas': capas.vias, 'Edificios': capas.edificios, 'Campus, canchas, jardines y parqueos': capas.zonas,
}, { collapsed: true }).addTo(mapa);

const leyenda = L.control({ position: 'bottomright' });
leyenda.onAdd = () => {
  const d = L.DomUtil.create('div', 'leyenda');
  const items = (g, cls) => Object.values(SIM[g]).map(([c, t]) => `<div><span class="sim ${cls}" style="${cls === 'ln' ? 'border-color' : 'background'}:${c}"></span>${t}</div>`).join('');
  d.innerHTML = `<details ${innerWidth > 1100 ? 'open' : ''}><summary><b style="display:inline">LEYENDA</b></summary><b>Oficinas</b>${items('oficina', 'pt')}<b>Puntos de interés</b>${items('punto', 'pt')}<b>Caminos</b>${items('via', 'ln')}<b>Áreas</b>${items('edificio', 'pg')}${items('zona', 'pg')}<div style="margin-top:4px;color:#666">WGS 84 · EPSG:4326</div></details>`;
  L.DomEvent.disableScrollPropagation(d); L.DomEvent.disableClickPropagation(d);
  return d;
};
leyenda.addTo(mapa);

// ---------------------------------------------------------------- utilidades
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const m2 = v => v == null ? '—' : Math.round(v).toLocaleString('es-BO') + ' m²';
const mts = v => v == null ? '—' : (v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(v) + ' m');
const aPie = m => m == null ? '' : ` · ~${Math.max(1, Math.round(m / 80))} min a pie`;
const sinTilde = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nombrePunto = p => `${p.nombre || p.tipo}${p.subtipo && p.subtipo !== p.nombre ? ' (' + p.subtipo + ')' : ''}`;
let TOKEN = '', OFICINAS = [], PUNTOS = [];
try { TOKEN = sessionStorage.getItem('token') || ''; } catch (_) {}
async function api(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.status);
  return r.json();
}
const resultado = $('resultado');
function mostrar(html) {
  mostrarTab('inicio');
  $('portada').hidden = true;
  resultado.innerHTML = `<button class="volver" type="button">← Volver</button>` + html;
  resultado.querySelector('.volver').onclick = inicio;
  resultado.querySelectorAll('[data-oficina]').forEach(el => el.onclick = () => verOficina(+el.dataset.oficina));
  $('panel').scrollTop = 0;
}
function inicio() {
  resultado.innerHTML = ''; $('portada').hidden = false; resaltado.clearLayers();
  history.replaceState(null, '', location.pathname);
}
function etiquetaZona(p) { return `${SIM.zona[p.tipo]?.[1] || p.tipo}${p.nombre ? ': ' + p.nombre : ''}${p.detalle ? ' (' + p.detalle + ')' : ''} · ${m2(p.area_m2)}`; }
function marcar(lls, opts = {}) {
  resaltado.clearLayers();
  lls.forEach(ll => L.circleMarker(ll, { radius: 17, color: '#e74c3c', weight: 3, fill: false }).addTo(resaltado));
  if (lls.length && !opts.noZoom) mapa.fitBounds(L.latLngBounds(lls).pad(.6), { maxZoom: 18 });
}
const ll = f => [f.geometry.coordinates[1], f.geometry.coordinates[0]];

// Tarjeta corta (listas) y ficha completa (detalle)
function tarjeta(p) {
  return `<button class="tarjeta" type="button" data-oficina="${p.id}">
    <span class="punto" style="background:${color('oficina', p.clasificacion)}"></span>
    <span><b>${esc(p.nombre)}</b>${p.sigla ? ` <small>(${esc(p.sigla)})</small>` : ''}<br>
    <small>${esc(p.tramites ? p.tramites.split(';')[0] : p.funcion || '')}${p.distancia_m != null ? ' · ' + mts(p.distancia_m) : ''}</small></span></button>`;
}
function ficha(p, cercanos = '') {
  const fila = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  const tramites = p.tramites ? '<ul>' + p.tramites.split(';').map(t => `<li>${esc(t.trim())}</li>`).join('') + '</ul>' : '';
  const donde = [p.edificio, p.piso].filter(Boolean).map(esc).join(' · ') || (p.metodo_captura?.match(/\((.*)\)/)?.[1] ? esc(p.metodo_captura.match(/\((.*)\)/)[1]) : 'Ver en el mapa');
  const ruta = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=walking`;
  return `<article class="ficha">
    <p class="sub">${esc(p.depende_de ? p.depende_de + ' › ' : '')}${esc(p.dependencia)}</p>
    <h2>${esc(p.nombre)}${p.sigla ? ' <small>(' + esc(p.sigla) + ')</small>' : ''}</h2>
    ${p.verificado ? '<span class="badge ok">✔ Ubicación verificada</span>' : '<span class="badge">Ubicación por confirmar en campo</span>'}
    ${p.funcion ? `<p>${esc(p.funcion)}</p>` : ''}
    ${tramites ? `<h3>¿Qué trámites hago aquí?</h3>${tramites}` : ''}
    <dl>${fila('📍 Dónde', donde)}${fila('🕒 Horario', esc(p.horario) || '<span class="falta">Sin dato aún</span>')}
    ${fila('👤 Responsable', esc([p.responsable, p.cargo_responsable].filter(Boolean).join(', ')) || '<span class="falta">Sin dato aún</span>')}
    ${fila('📞 Teléfono', p.telefono ? `<a href="tel:${esc(p.telefono.replace(/\s/g, ''))}">${esc(p.telefono)}</a>` : '')}
    ${fila('✉️ Correo', p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '')}
    ${fila('🌐 Web', p.web ? `<a href="${esc(p.web)}" target="_blank" rel="noopener">uagrm.edu.bo</a>` : '')}</dl>
    <div class="acciones-ficha">
      <a class="boton" href="${ruta}" target="_blank" rel="noopener">🚶 Cómo llegar</a>
      <button type="button" class="boton secundario" id="btn-compartir">🔗 Compartir</button>
    </div>
    ${cercanos}
    <details class="tec"><summary>Datos técnicos (SIG)</summary><dl>
      ${fila('Código', esc(p.codigo))}${fila('Clasificación', esc(p.clasificacion_nombre))}
      ${fila('Coordenadas', `${p.lat}, ${p.lon} (WGS 84)`)}${fila('Precisión', `±${p.precision_m ?? '?'} m`)}
      ${fila('Fuente', esc(p.metodo_captura))}${fila('Fecha', esc(p.fecha_captura))}
      ${p.alcance === 'condicional' ? fila('Alcance', 'A confirmar con el docente (cruce con otro tema)') : ''}</dl></details>
  </article>`;
}

// ---------------------------------------------------------------- consultas
async function verOficina(id) {
  if (modoEdicion) return editarOficina(id);
  const [f, cerca] = await Promise.all([api(`/api/oficinas/${id}`), api(`/api/oficinas/${id}/servicios-cercanos?n=30`)]);
  const primero = t => cerca.features.find(x => x.properties.tipo === t || x.properties.subtipo === t);
  const items = [['entrada', '🚪 Entrada más cercana'], ['Baños', '🚻 Baño más cercano'], ['extintor', '🧯 Extintor más cercano']].map(([t, n]) => {
    const x = primero(t);
    return `<li>${n}: ${x ? `<b>${esc(x.properties.nombre)}</b> a ${mts(x.properties.distancia_m)}` : '<span class="falta">sin registro aún</span>'}</li>`;
  }).join('');
  mostrar(ficha(f.properties, `<h3>Cerca de esta oficina</h3><ul class="cerca">${items}</ul>`));
  $('btn-compartir').onclick = async () => {
    const url = `${location.origin}/?oficina=${id}`;
    try { await navigator.clipboard.writeText(url); $('btn-compartir').textContent = '✔ Enlace copiado'; } catch (_) { prompt('Copia este enlace:', url); }
  };
  history.replaceState(null, '', `?oficina=${id}`);
  marcar([ll(f)]);
  ['extintor', 'entrada', 'Baños'].map(primero).filter(Boolean).forEach(x =>
    L.polyline([ll(f), ll(x)], { color: '#e74c3c', weight: 2, dashArray: '4 4' }).addTo(resaltado));
}

function listaOficinas(feats, titulo, extra = '') {
  if (!feats.length && !extra) {
    mostrar(`<div class="respuesta">${esc(titulo)}: <b>no encontramos resultados</b>.<br><small>Prueba con otra palabra, por ejemplo "título", "becas" o el nombre de la oficina.</small></div>`);
    resaltado.clearLayers(); return;
  }
  mostrar(`<div class="respuesta">${esc(titulo)}${feats.length ? `: <b>${feats.length}</b>` : ''}</div>${extra}` + feats.map(f => tarjeta(f.properties)).join(''));
  if (feats.length) marcar(feats.map(ll));
}

async function verContenido(capa, f) {
  if (modoDig) return;
  const r = await api(`/api/contenido/${capa}/${f.properties.id}`);
  const p = r.poligono;
  const clase = capa === 'edificio' ? (SIM.edificio[p.clase]?.[1] || p.clase) : (SIM.zona[p.clase]?.[1] || p.clase);
  let html = `<div class="respuesta"><b>${esc(p.nombre || clase)}</b><br><small>${esc(clase)} · superficie ${m2(p.area_m2)}</small></div>`;
  html += r.oficinas.features.length ? '<h3>Oficinas del Vicerrectorado aquí</h3>' + r.oficinas.features.map(o => tarjeta(o.properties)).join('')
    : '<p class="ayuda">Aquí no hay oficinas del Vicerrectorado.</p>';
  if (r.puntos.features.length) html += `<h3>También aquí</h3><ul>${r.puntos.features.map(x => `<li>${esc(nombrePunto(x.properties))}</li>`).join('')}</ul>`;
  if (r.edificios.length) html += `<h3>Edificios dentro (${r.edificios.length})</h3><ul>${r.edificios.map(e => `<li>${esc(e.nombre)} · ${m2(e.area_m2)}</li>`).join('')}</ul>`;
  html += `<details class="tec"><summary>Consulta SIG</summary>Contenido del polígono con <code>ST_Contains</code> / <code>ST_Intersects</code>; superficie con <code>ST_Area</code> sobre <code>geography</code>.</details>`;
  mostrar(html);
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

async function buscar(t) {
  $('texto').value = t;
  const r = await api('/api/oficinas' + (t ? '?texto=' + encodeURIComponent(t) : ''));
  // También busca en baños, comedores, entradas, extintores…
  const q = sinTilde(t);
  const pts = q ? PUNTOS.filter(f => sinTilde(`${f.properties.nombre || ''} ${f.properties.subtipo || ''} ${f.properties.tipo}`).includes(q.replace(/s$/, ''))) : [];
  const extra = pts.length ? `<h3>Lugares del campus</h3><ul>${pts.slice(0, 12).map(f => `<li>${esc(nombrePunto(f.properties))}</li>`).join('')}</ul>` : '';
  listaOficinas(r.features, t ? `Resultados para "${t}"` : 'Todas las oficinas', extra);
  if (!r.features.length && pts.length) marcar(pts.slice(0, 12).map(ll));
}
$('buscar').onsubmit = e => { e.preventDefault(); buscar($('texto').value.trim()); };
document.querySelectorAll('.chip[data-q]').forEach(b => b.onclick = () => buscar(b.dataset.q));

$('btn-cercana').onclick = async () => {
  const u = await miUbicacion();
  const r = await api(`/api/cercana?lat=${u.lat}&lon=${u.lng}&n=3`);
  const f = r.features[0];
  listaOficinas(r.features, `Las más cercanas ${u.aprox ? 'al centro del mapa' : 'a ti'}`,
    f ? `<p class="ayuda">La más cercana es <b>${esc(f.properties.nombre)}</b>, a ${mts(f.properties.distancia_m)}${aPie(f.properties.distancia_m)} (en línea recta).</p>` : '');
  L.marker(u).addTo(resaltado).bindTooltip(u.aprox ? 'Centro del mapa' : 'Estás aquí').openTooltip();
  if (f) L.polyline([[u.lat, u.lng], ll(f)], { color: '#1d4f91', dashArray: '6 4' }).addTo(resaltado);
};
document.querySelectorAll('#radios .chip').forEach(b => b.onclick = async () => {
  const u = await miUbicacion(), m = +b.dataset.m;
  const r = await api(`/api/radio?lat=${u.lat}&lon=${u.lng}&metros=${m}`);
  const cuenta = {};
  r.puntos.features.forEach(x => { const k = x.properties.subtipo || x.properties.tipo; cuenta[k] = (cuenta[k] || 0) + 1; });
  const otros = Object.keys(cuenta).length ? `<h3>Otros lugares</h3><ul>${Object.entries(cuenta).map(([k, v]) => `<li>${esc(k)}: ${v}</li>`).join('')}</ul>` : '';
  listaOficinas(r.oficinas.features, `A menos de ${mts(m)} ${u.aprox ? 'del centro del mapa' : 'de ti'}`, otros);
  L.circle([u.lat, u.lng], { radius: m, color: '#1d4f91', weight: 2, fillOpacity: .05 }).addTo(resaltado);
  mapa.fitBounds(L.latLng(u.lat, u.lng).toBounds(m * 2.4));
});
$('btn-dist').onclick = async () => {
  const a = $('dist-a').value, b = $('dist-b').value;
  if (!a || !b || a === b) return mostrar('<div class="respuesta">Elige dos oficinas distintas.</div>');
  const r = await api(`/api/distancia?a=${a}&b=${b}`);
  mostrar(`<div class="respuesta">De <b>${esc(r.desde)}</b> a <b>${esc(r.hasta)}</b> hay <b>${mts(r.metros)}</b> en línea recta${aPie(r.metros)}.</div>`);
  resaltado.clearLayers();
  const linea = L.geoJSON(r.linea, { style: { color: '#e74c3c', weight: 3, dashArray: '6 4' } }).addTo(resaltado);
  mapa.fitBounds(linea.getBounds().pad(.4));
};
async function filtrar() {
  const dep = $('filtro-dep').value, clas = $('filtro-clas').value, p = new URLSearchParams();
  if (dep) p.set('dependencia', dep); if (clas) p.set('clasificacion', clas);
  const r = await api('/api/oficinas?' + p);
  capas.oficinas.clearLayers().addData(r);
  listaOficinas(r.features, [dep && $('filtro-dep').selectedOptions[0].text, clas && $('filtro-clas').selectedOptions[0].text].filter(Boolean).join(' · ') || 'Todas las oficinas');
}
$('filtro-dep').onchange = filtrar;
$('filtro-clas').onchange = filtrar;

// ---------------------------------------------------------------- directorio
function pintarDirectorio(deps) {
  const grupos = deps.filter(d => d.nivel <= 1).map(d => {
    const hijos = new Set([d.id, ...deps.filter(x => x.padre_id === d.id && x.nivel === 2).map(x => x.id)]);
    const ofs = OFICINAS.filter(f => hijos.has(f.properties.dependencia_id));
    return ofs.length ? `<details ${d.nivel === 0 ? 'open' : ''}><summary>${esc(d.sigla ? d.sigla + ' · ' : '')}${esc(d.nombre)} <small>(${ofs.length})</small></summary>${ofs.map(f => tarjeta(f.properties)).join('')}</details>` : '';
  }).join('');
  $('directorio').innerHTML = grupos;
  $('directorio').querySelectorAll('[data-oficina]').forEach(el => el.onclick = () => verOficina(+el.dataset.oficina));
}

// ---------------------------------------------------------------- pestañas
function mostrarTab(t) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('activo', b.dataset.tab === t));
  document.querySelectorAll('.contenido').forEach(s => s.hidden = s.id !== 'tab-' + t);
  modoEdicion = t === 'equipo' && !!TOKEN && !$('editor').hidden;
  if (t === 'datos') cargarTabla();
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { if (b.dataset.tab === 'inicio') inicio(); mostrarTab(b.dataset.tab); });
$('link-equipo').onclick = e => { e.preventDefault(); mostrarTab('equipo'); };

// ---------------------------------------------------------------- tabla de infraestructura
async function cargarTabla() {
  const [inf, of] = await Promise.all([api('/api/infraestructura'), api('/api/oficinas')]);
  $('resumen').innerHTML = `<p class="ayuda">Unidades del Vicerrectorado ubicadas: <b>${inf.cobertura.ubicadas} de ${inf.cobertura.unidades}</b>.</p>
    <table><tr><th>Tipo</th><th>Capa</th><th>Cant.</th><th>Total</th></tr>${inf.resumen.map(r =>
      `<tr><td>${r.geometria}</td><td>${esc(r.capa)}</td><td class="num">${r.cantidad}</td><td class="num">${r.total == null ? '—' : Math.round(r.total).toLocaleString('es-BO') + ' ' + r.unidad}</td></tr>`).join('')}</table>`;
  $('tabla-oficinas').innerHTML = `<table><tr><th>Código</th><th>Oficina</th><th>Área</th><th>Edificio</th><th>Lat, Lon</th></tr>${of.features.map(({ properties: p }) =>
    `<tr data-oficina="${p.id}" class="fila-clic"><td>${p.codigo}</td><td>${esc(p.nombre)}</td><td>${esc(p.dependencia_sigla || p.dependencia)}</td><td>${esc(p.edificio || '—')}</td><td class="num">${p.lat}, ${p.lon}</td></tr>`).join('')}</table>`;
  $('tabla-oficinas').querySelectorAll('[data-oficina]').forEach(el => el.onclick = () => verOficina(+el.dataset.oficina));
}
$('btn-imprimir').onclick = () => {
  $('fecha-plano').textContent = new Date().toLocaleDateString('es-BO');
  mapa.fitBounds(capas.zonas.getBounds().isValid() ? capas.zonas.getBounds() : capas.edificios.getBounds());
  setTimeout(() => { mapa.invalidateSize(); window.print(); }, 800);
};

// ---------------------------------------------------------------- equipo: digitalización y edición
let modoEdicion = false, modoDig = false, DEPS = [], CLAS = [];
async function entrar(t, silencioso) {
  TOKEN = t;
  try { await api('/api/admin/check'); } catch (e) { TOKEN = ''; try { sessionStorage.removeItem('token'); } catch (_) {} if (!silencioso) alert('Token incorrecto'); return; }
  try { sessionStorage.setItem('token', t); } catch (_) {}
  $('login').hidden = true; $('editor').hidden = false; modoEdicion = !$('tab-equipo').hidden;
}
$('btn-login').onclick = () => entrar($('token').value.trim());
$('btn-salir').onclick = () => {
  TOKEN = ''; try { sessionStorage.removeItem('token'); } catch (_) {}
  $('login').hidden = false; $('editor').hidden = true; $('edit-form').hidden = true; modoEdicion = false; mostrarTab('inicio');
};
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
    <label><input type="checkbox" name="verificado" ${p.verificado ? 'checked' : ''}> Ubicación verificada en campo</label>
    <div class="fila"><button>Guardar</button><button type="button" id="btn-mover" class="secundario">Mover en el mapa</button></div>`;
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
        : `<label>Detalle<input id="dig-sub" style="width:100%" placeholder="${tipo === 'servicio' ? 'Baños, comedor, consultorio…' : tipo === 'entrada' ? 'puerta / portón' : 'PQS 6 kg'}"></label>`}
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
  OFICINAS = o.features; PUNTOS = p.features;
  const opts = '<option value="">Elige una oficina…</option>' + o.features.map(f => `<option value="${f.properties.id}">${esc(f.properties.sigla || f.properties.nombre)}</option>`).join('');
  $('dist-a').innerHTML = opts; $('dist-b').innerHTML = opts;
  if (DEPS.length) pintarDirectorio(DEPS);
  return { z, e, o };
}
(async () => {
  const [, deps, clas] = await Promise.all([recargar(), api('/api/dependencias'), api('/api/clasificaciones')]);
  DEPS = deps; CLAS = clas;
  pintarDirectorio(deps);
  deps.forEach(d => $('filtro-dep').add(new Option('  '.repeat(d.nivel) + d.nombre + (d.sigla ? ` (${d.sigla})` : ''), d.id)));
  clas.filter(c => ['DESPACHO', 'DIRECCION', 'ATENCION'].includes(c.codigo)).forEach(c => $('filtro-clas').add(new Option(c.nombre, c.codigo)));
  mapa.invalidateSize();
  const campus = capas.zonas.getLayers().filter(l => l.feature.properties.tipo === 'campus');
  mapa.fitBounds(campus.length ? L.featureGroup(campus).getBounds() : capas.edificios.getBounds(), { padding: [10, 10] });
  const params = new URLSearchParams(location.search);
  if (params.get('oficina')) verOficina(+params.get('oficina'));
  if (params.has('equipo')) mostrarTab('equipo');
  if (TOKEN) entrar(TOKEN, true);
})();
