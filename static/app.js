// ¿Dónde queda? · Oficinas del Vicerrectorado (1) — Grupo 16 · SIG INF442-SA
'use strict';

// ---------------------------------------------------------------- simbología (una sola fuente para mapa y leyenda)
const SIM = {
  oficina:  { DESPACHO: ['#f2b84b', 'Autoridad (Vicerrectorado)'], DIRECCION: ['#ff5c7c', 'Dirección / departamento'], ATENCION: ['#e9edf7', 'Atención al público (trámites)'] },
  punto:    { entrada: ['#8a9bc4', 'Entrada / portón'], extintor: ['#ff5c7c', 'Extintor'], servicio: ['#c9d3ea', 'Servicio: baño, comida, salud…'] },
  via:      { via_interna: ['#6f86c0', 'Vía interna', 2.2], sendero: ['#4b5d8a', 'Sendero peatonal', 1.1], escalera: ['#8a9bc4', 'Escalera', 2] },
  edificio: { ADMINISTRATIVO: ['#5c1428', 'Edificio con oficinas del Vicerrectorado'], SERVICIO: ['#1f2a48', 'Edificio de servicios'], ACADEMICO: ['#151d33', 'Otros edificios / módulos'] },
  zona:     { campus: ['#ff5c7c', 'Límite de la Ciudad Universitaria'], cancha: ['#1c3a33', 'Cancha'], jardin: ['#16302b', 'Jardín / área verde'], parqueo: ['#141b2e', 'Parqueo'] },
};
const etiqueta = p => p.sigla || p.nombre.replace(/^(Departamento|Dirección|Oficina)( General)? de /, '').replace(/ \(.*\)$/, '').split(',')[0].slice(0, 24);
const color = (grupo, k) => (SIM[grupo][k] || ['#888'])[0];
const corto = p => (p.sigla || p.nombre.replace(/\s*\(.*\)\s*/g, '').replace(/^(Departamento|Dirección|Oficina)( General)? de /, '').split(/[ ,]+/).filter(w => w.length > 2).map(w => w[0]).join('')).slice(0, 5).toUpperCase();
const MARCAS = {};
const MOVIL = () => innerWidth <= 640;
const SIN_MOV = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Espacio que tapa la interfaz, para encuadrar el mapa en la parte visible
function margenes() {
  if (MOVIL()) return { tl: [16, 76], br: [16, $('panel').getBoundingClientRect().height + 16] };
  const t = document.getElementById('tablero'), der = t && getComputedStyle(t).display !== 'none' ? innerWidth - t.getBoundingClientRect().left + 16 : 24;
  return { tl: [$('panel').getBoundingClientRect().right + 24, 24], br: [der, 24] };
}
function irA(latlng, zoom) { SIN_MOV ? mapa.setView(latlng, zoom) : mapa.flyTo(latlng, zoom, { duration: .6 }); }
// Centra un punto en la parte del mapa que no tapa el panel
function centrar(latlng, metros = 140) {
  const m = margenes(), b = L.latLng(latlng).toBounds(metros);
  SIN_MOV ? mapa.fitBounds(b, { paddingTopLeft: m.tl, paddingBottomRight: m.br, maxZoom: 18 })
          : mapa.flyToBounds(b, { paddingTopLeft: m.tl, paddingBottomRight: m.br, maxZoom: 18, duration: .6 });
}
// Emoji por tipo de servicio (lenguaje visual universal)
const EMOJI = { 'Baños': '🚻', 'Comedor / restaurante': '🍽️', 'Patio de comidas': '🍽️', 'Kiosco': '🥤', 'Consultorio médico': '🩺',
  'Biblioteca': '📚', 'Guardería': '🧸', 'Teatro / auditorio': '🎭', 'Fotocopiadora': '🖨️', 'Parqueo de bicicletas': '🚲',
  'Parqueo de motos': '🏍️', 'Veterinaria': '🐾', 'Estudio (Canal/radio)': '📺' };
function iconoPunto(p, dest = false) {
  if (p.tipo === 'entrada' && !dest) return L.divIcon({ className: '', iconSize: [12, 12], html: `<div class="ic-serv mini" style="--c:${color('punto', 'entrada')}"></div>` });
  const e = p.tipo === 'extintor' ? '🧯' : p.tipo === 'entrada' ? '🚪' : (EMOJI[p.subtipo] || '📍');
  return L.divIcon({ className: '', iconSize: [26, 26], html: `<div class="ic-serv${dest ? ' dest' : ''}" style="--c:${color('punto', p.tipo)}">${e}</div>` });
}
function iconoPin(p, sel = false) {
  const c = color('oficina', p.clasificacion);
  return L.divIcon({ className: '', iconSize: [34, 42], iconAnchor: [17, 41], tooltipAnchor: [14, -26],
    html: `<div class="pin-of${sel ? ' sel' : ''}" style="--c:${c}"><i class="haz"></i><i class="base"></i><svg viewBox="0 0 34 42"><path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.7 1.5 28 17 40.5 17 40.5s15.5-12.5 15.5-23.8C32.5 8.3 25.6 1.5 17 1.5z" fill="${c}" stroke="#fff" stroke-width="2"/></svg><span class="${corto(p).length > 4 ? 'xs ' : ''}${p.clasificacion === 'DIRECCION' ? '' : 'osc'}">${esc(corto(p))}</span></div>` });
}
let SELECCION = null;
function seleccionar(id) {
  if (SELECCION && MARCAS[SELECCION]) MARCAS[SELECCION].setIcon(iconoPin(MARCAS[SELECCION].feature.properties));
  SELECCION = id;
  if (id && MARCAS[id]) { MARCAS[id].setIcon(iconoPin(MARCAS[id].feature.properties, true)); MARCAS[id].setZIndexOffset(1000); }
}

// ---------------------------------------------------------------- iconos
const IC = {
  volver: 'M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z',
  chev: 'M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z',
  reloj: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7z',
  persona: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z',
  tel: 'M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  correo: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z',
  web: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.9a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.4 1.1-2.8 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16zM8 8H5.1a8 8 0 0 1 4.3-3.6C8.8 5.5 8.3 6.7 8 8zm4 12c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.4-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6zm1.8-5.6a16.5 16.5 0 0 0 0-4h3.4a8 8 0 0 1 0 4z',
  caminar: 'M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5 5 0 0 1-4.3-2.4l-1-1.6a2 2 0 0 0-1.7-1c-.3 0-.5.1-.8.1L6 8.3V13h2V9.6z',
  compartir: 'M18 16a3 3 0 0 0-2.4 1.2l-7-4a3 3 0 0 0 0-2.4l7-4A3 3 0 1 0 15 5c0 .2 0 .4.1.6l-7 4a3 3 0 1 0 0 4.8l7 4c-.1.2-.1.4-.1.6a3 3 0 1 0 3-3z',
  edificio: 'M12 7V3H2v18h20V7zM6 19H4v-2h2zm0-4H4v-2h2zm0-4H4V9h2zm0-4H4V5h2zm4 12H8v-2h2zm0-4H8v-2h2zm0-4H8V9h2zm0-4H8V5h2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8zm-2-8h-2v2h2zm0 4h-2v2h2z',
};
const svg = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>`;
const toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.add('ver'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('ver'), 2200); };

// ---------------------------------------------------------------- mapa base
const mapa = L.map('mapa', { zoomSnap: 0.5, zoomControl: false }).setView([-17.7765, -63.1945], 16);
L.control.zoom({ position: 'topleft', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(mapa);
// Mapa base OSM atenuado con CSS para que resalten nuestras capas (sin claves de API)
const claro = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, className: 'base-suave', attribution: '© OpenStreetMap contributors' }).addTo(mapa);
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap contributors' });
const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 19, attribution: 'Imágenes © Esri' });
L.control.scale({ imperial: false, maxWidth: 150 }).addTo(mapa);
const norte = L.control({ position: 'topleft' });
norte.onAdd = () => Object.assign(L.DomUtil.create('div', 'norte'), { innerHTML: '<div><svg viewBox="0 0 24 24"><path d="M12 2 5 20l7-4 7 4z"/></svg>N</div>', title: 'Norte' });
norte.addTo(mapa);
['load', 'resize'].forEach(ev => window.addEventListener(ev, () => mapa.invalidateSize()));

mapa.createPane('zonas').style.zIndex = 380;
mapa.createPane('edificios').style.zIndex = 390;
mapa.createPane('vias').style.zIndex = 395;

const capas = {
  zonas: L.geoJSON(null, {
    pane: 'zonas',
    style: f => f.properties.tipo === 'campus'
      ? { color: color('zona', 'campus'), weight: 2, dashArray: '6 6', fill: false, className: 'brillo-campus' }
      : { color: color('zona', f.properties.tipo), weight: .8, opacity: .8, fillColor: color('zona', f.properties.tipo), fillOpacity: .45 },
    onEachFeature: (f, l) => { if (f.properties.tipo !== 'campus') { l.bindTooltip(etiquetaZona(f.properties)); l.on('click', () => verContenido('zona', f)); } },
  }),
  edificios: L.geoJSON(null, {
    pane: 'edificios',
    style: f => ({ color: f.properties.uso === 'ADMINISTRATIVO' ? '#ff5c7c' : '#7e96c8', weight: .8, opacity: f.properties.uso === 'ACADEMICO' ? .35 : .9, fillColor: color('edificio', f.properties.uso), fillOpacity: .7, className: f.properties.uso === 'ADMINISTRATIVO' ? 'brillo-edif' : '' }),
    onEachFeature: (f, l) => { l.bindTooltip(f.properties.nombre); l.on('click', () => verContenido('edificio', f)); },
  }),
  vias: L.geoJSON(null, {
    pane: 'vias',
    style: f => { const [c, , w] = SIM.via[f.properties.tipo] || ['#999', '', 2]; return { color: c, weight: w, opacity: f.properties.tipo === 'sendero' ? .35 : .75, dashArray: f.properties.tipo === 'sendero' ? '2 4' : null, className: f.properties.tipo === 'via_interna' ? 'neon' : '' }; },
    onEachFeature: (f, l) => l.bindTooltip(`${SIM.via[f.properties.tipo]?.[1] || 'Vía'}${f.properties.nombre ? ': ' + f.properties.nombre : ''} · ${Math.round(f.properties.longitud_m)} m`),
  }),
  puntos: L.geoJSON(null, {
    pointToLayer: (f, ll) => L.marker(ll, { icon: iconoPunto(f.properties), title: nombrePunto(f.properties), keyboard: false }),
    onEachFeature: (f, l) => { l.bindTooltip(nombrePunto(f.properties), { direction: 'top', offset: [0, -12] }); l.on('click', () => verPunto(f)); },
  }),
  oficinas: L.geoJSON(null, {
    pointToLayer: (f, ll) => L.marker(ll, { icon: iconoPin(f.properties), riseOnHover: true, title: f.properties.nombre, keyboard: true }),
    onEachFeature: (f, l) => { l.bindTooltip(etiqueta(f.properties), { permanent: true, direction: 'right', className: 'lbl', offset: [2, 0] }); l.on('click', () => verOficina(f.properties.id)); MARCAS[f.properties.id] = l; },
  }),
};
const resaltado = L.layerGroup().addTo(mapa);
const etiquetasSegunZoom = () => {
  mapa.getContainer().classList.toggle('sin-etiquetas', mapa.getZoom() < 17);
  // Servicios y entradas son contexto: solo aparecen al acercarse, para que el mapa destaque las oficinas
  if (mapa.getZoom() >= 18) { if (!mapa.hasLayer(capas.puntos)) capas.puntos.addTo(mapa); }
  else if (mapa.hasLayer(capas.puntos)) mapa.removeLayer(capas.puntos);
};
mapa.on('zoomend', etiquetasSegunZoom);
Object.values(capas).forEach(c => c.addTo(mapa));
L.control.layers({ 'Mapa suave': claro, 'Mapa a color': osm, 'Satélite': sat }, {
  'Oficinas del Vicerrectorado': capas.oficinas, 'Entradas, extintores y servicios': capas.puntos,
  'Senderos y vías internas': capas.vias, 'Edificios': capas.edificios, 'Campus, canchas, jardines y parqueos': capas.zonas,
}, { collapsed: true }).addTo(mapa);

const leyenda = L.control({ position: 'bottomright' });
leyenda.onAdd = () => {
  const d = L.DomUtil.create('div', 'leyenda');
  const items = (g, cls) => Object.values(SIM[g]).map(([c, t]) => `<div><span class="sim ${cls}" style="${cls === 'ln' ? 'border-color' : 'background'}:${c}"></span>${t}</div>`).join('');
  d.innerHTML = `<details><summary>Leyenda</summary><div class="items"><b>Oficinas</b>${items('oficina', 'pt')}<b>Puntos de interés</b>${items('punto', 'pt')}<b>Caminos</b>${items('via', 'ln')}<b>Áreas</b>${items('edificio', 'pg')}${items('zona', 'pg')}<div style="margin-top:6px;color:#9ca3af">WGS 84 · EPSG:4326</div></div></details>`;
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
  resultado.innerHTML = `<button class="volver" type="button">${svg('volver')}Volver</button>` + html;
  abrirHoja();
  resultado.querySelector('.volver').onclick = inicio;
  resultado.querySelectorAll('[data-oficina]').forEach(el => el.onclick = () => verOficina(+el.dataset.oficina));
  $('cuerpo').scrollTop = 0;
}
function inicio() {
  resultado.innerHTML = ''; $('portada').hidden = false; resaltado.clearLayers(); seleccionar(null);
  history.replaceState(null, '', location.pathname);
}
function etiquetaZona(p) { return `${SIM.zona[p.tipo]?.[1] || p.tipo}${p.nombre ? ': ' + p.nombre : ''}${p.detalle ? ' (' + p.detalle + ')' : ''} · ${m2(p.area_m2)}`; }
function marcar(lls, opts = {}) {
  resaltado.clearLayers();
  lls.forEach(ll => L.circleMarker(ll, { radius: 7, color: '#fff', weight: 0, fillColor: '#960018', fillOpacity: .2, interactive: false }).addTo(resaltado));
  if (lls.length && !opts.noZoom) { const m = margenes(); mapa.fitBounds(L.latLngBounds(lls).pad(.2), { maxZoom: 18, paddingTopLeft: m.tl, paddingBottomRight: m.br }); }
}
const ll = f => [f.geometry.coordinates[1], f.geometry.coordinates[0]];

// Tarjeta corta (listas) y ficha completa (detalle)
function tarjeta(p) {
  const sub = p.tramites ? p.tramites.split(';')[0] : (p.funcion || '');
  return `<button class="tarjeta" type="button" data-oficina="${p.id}">
    <span class="pin" style="background:${color('oficina', p.clasificacion)};color:${p.clasificacion === 'DIRECCION' ? '#fff' : '#0a1022'}">${esc(corto(p))}</span>
    <span class="txt"><b>${esc(p.nombre)}</b><small>${esc(sub)}</small></span>
    ${p.distancia_m != null ? `<span class="dist">${mts(p.distancia_m)}</span>` : svg('chev', 'chev')}</button>`;
}
function ficha(p, cercanos = '') {
  const dato = (ic, k, v) => `<li>${svg(ic)}<span><span class="k">${k}</span><span class="v">${v || '<span class="falta">Sin dato aún</span>'}</span></span></li>`;
  const tramites = p.tramites ? `<div class="seccion-f"><h3>¿Qué trámites hago aquí?</h3><div class="tramites">${p.tramites.split(';').map(t => `<span class="tramite">${esc(t.trim())}</span>`).join('')}</div></div>` : '';
  const dir = p.metodo_captura?.match(/\((.*)\)/)?.[1];
  const donde = [p.edificio || (dir ? dir.replace(/,? ?\d+\.º piso$/, '') : ''), p.piso].filter(Boolean).map(esc).join(' · ');
  const ruta = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=walking`;
  const tipoC = color('oficina', p.clasificacion);
  return `<article class="ficha">
    <h2>${esc(p.nombre)}${p.sigla ? ` <small>${esc(p.sigla)}</small>` : ''}</h2>
    <p class="ruta">${esc(p.depende_de ? p.depende_de + ' › ' : '')}${esc(p.dependencia)}</p>
    ${p.nombre_alterno ? `<p class="alias">También figura como: ${esc(p.nombre_alterno)}</p>` : ''}
    <div class="etiquetas"><span class="etq"><i style="background:${tipoC}"></i>${esc(SIM.oficina[p.clasificacion]?.[1] || p.clasificacion_nombre)}</span>
      ${p.verificado ? '<span class="etq ok">✓ Verificada en campo</span>' : '<span class="etq pend">Ubicación por confirmar</span>'}</div>
    <div class="acciones">
      <a class="accion principal" href="${ruta}" target="_blank" rel="noopener">${svg('caminar')}Cómo llegar</a>
      <a class="accion" ${p.telefono ? `href="tel:${esc(p.telefono.replace(/\s/g, ''))}"` : 'aria-disabled="true"'}>${svg('tel')}Llamar</a>
      <button type="button" class="accion" id="btn-compartir">${svg('compartir')}Compartir</button>
    </div>
    ${p.funcion ? `<p class="desc">${esc(p.funcion)}</p>` : ''}
    <ul class="datos">
      ${dato('pin', 'Dónde', donde)}${dato('reloj', 'Horario de atención', esc(p.horario))}
      ${dato('persona', 'Responsable', esc([p.responsable, p.cargo_responsable].filter(Boolean).join(' · ')))}
      ${p.telefono ? dato('tel', 'Teléfono', `<a href="tel:${esc(p.telefono.replace(/\s/g, ''))}">${esc(p.telefono)}</a>`) : ''}
      ${p.email ? dato('correo', 'Correo', `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`) : ''}
      ${p.web ? dato('web', 'Sitio web', `<a href="${esc(p.web)}" target="_blank" rel="noopener">uagrm.edu.bo</a>`) : ''}
    </ul>
    ${tramites}${cercanos}
    <div class="seccion-f"><details class="tec"><summary>Datos técnicos (SIG)</summary><dl>
      <dt>Código</dt><dd>${esc(p.codigo)}</dd><dt>Clasificación</dt><dd>${esc(p.clasificacion_nombre)}</dd>
      <dt>Coordenadas</dt><dd>${p.lat}, ${p.lon} (WGS 84)</dd><dt>Precisión</dt><dd>±${p.precision_m ?? '?'} m</dd>
      <dt>Fuente</dt><dd>${esc(p.metodo_captura)}</dd><dt>Fecha</dt><dd>${esc(p.fecha_captura)}</dd>
      ${p.alcance === 'condicional' ? '<dt>Alcance</dt><dd>A confirmar con el docente</dd>' : ''}</dl></details></div>
  </article>`;
}

// ---------------------------------------------------------------- consultas
async function verOficina(id) {
  if (modoEdicion) return editarOficina(id);
  const [f, cerca] = await Promise.all([api(`/api/oficinas/${id}`), api(`/api/oficinas/${id}/servicios-cercanos?n=30`)]);
  const primero = t => cerca.features.find(x => x.properties.tipo === t || x.properties.subtipo === t);
  const items = [['entrada', '🚪', 'Entrada'], ['Baños', '🚻', 'Baño'], ['extintor', '🧯', 'Extintor']].map(([t, e, n]) => {
    const x = primero(t);
    return `<li><span class="e">${e}</span><b>${x ? mts(x.properties.distancia_m) : '—'}</b>${n}${x ? '' : ' · sin dato'}</li>`;
  }).join('');
  mostrar(ficha(f.properties, `<div class="seccion-f"><h3>Lo más cercano a esta oficina</h3><ul class="cerca">${items}</ul></div>`));
  seleccionar(id);
  $('btn-compartir').onclick = async () => {
    const url = `${location.origin}${location.pathname}?oficina=${id}`;
    if (navigator.share) { try { await navigator.share({ title: f.properties.nombre, url }); return; } catch (_) {} }
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch (_) { prompt('Copia este enlace:', url); }
  };
  history.replaceState(null, '', `?oficina=${id}`);
  resaltado.clearLayers();
  if (!SIN_MOV) L.circleMarker(ll(f), { radius: 26, color: '#f2b84b', weight: 2, fillColor: '#f2b84b', fillOpacity: .15, className: 'halo', interactive: false }).addTo(resaltado);
  centrar(ll(f));
  ['extintor', 'entrada', 'Baños'].map(primero).filter(Boolean).forEach(x =>
    L.polyline([ll(f), ll(x)], { color: '#f2b84b', weight: 2.5, opacity: .9, dashArray: '2 6', lineCap: 'round', className: 'brillo' }).addTo(resaltado));
}

function listaOficinas(feats, titulo, extra = '') {
  if (!feats.length && !extra) {
    mostrar(`<div class="vacio"><span class="grande">🔍</span><b>Sin resultados</b><br>${esc(titulo)}<br><small>Prueba con "título", "becas", "kardex" o el nombre de la oficina.</small></div>`);
    resaltado.clearLayers(); return;
  }
  mostrar(`<div class="respuesta"><b>${esc(titulo)}</b>${feats.length ? ` · ${feats.length} oficina${feats.length > 1 ? 's' : ''}` : ''}</div>${extra}` + (feats.length ? `<div class="lista">${feats.map(f => tarjeta(f.properties)).join('')}</div>` : ''));
  seleccionar(null);
  if (feats.length) marcar(feats.map(ll));
}

async function verContenido(capa, f) {
  if (modoDig) return;
  const r = await api(`/api/contenido/${capa}/${f.properties.id}`);
  const p = r.poligono;
  const clase = capa === 'edificio' ? (SIM.edificio[p.clase]?.[1] || p.clase) : (SIM.zona[p.clase]?.[1] || p.clase);
  let html = `<div class="respuesta"><b>${esc(p.nombre || clase)}</b><br><small>${esc(clase)} · superficie ${m2(p.area_m2)}</small></div>`;
  html += r.oficinas.features.length ? '<h4 class="titulo-seccion">Oficinas del Vicerrectorado aquí</h4><div class="lista">' + r.oficinas.features.map(o => tarjeta(o.properties)).join('') + '</div>'
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
  $('texto').value = t; $('limpiar').hidden = !t;
  const r = await api('/api/oficinas' + (t ? '?texto=' + encodeURIComponent(t) : ''));
  listaOficinas(r.features, t ? `Resultados para "${t}"` : 'Todas las oficinas');
}
$('buscar').onsubmit = e => { e.preventDefault(); buscar($('texto').value.trim()); };
document.querySelectorAll('.acceso[data-q]').forEach(b => b.onclick = () => buscar(b.dataset.q));

$('btn-cercana').onclick = async () => {
  const u = await miUbicacion();
  const r = await api(`/api/cercana?lat=${u.lat}&lon=${u.lng}&n=3`);
  const f = r.features[0];
  listaOficinas(r.features, `Las más cercanas ${u.aprox ? 'al centro del mapa' : 'a ti'}`,
    f ? `<p class="ayuda">La más cercana es <b>${esc(f.properties.nombre)}</b>, a ${mts(f.properties.distancia_m)}${aPie(f.properties.distancia_m)} (en línea recta).</p>` : '');
  L.marker(u).addTo(resaltado).bindTooltip(u.aprox ? 'Centro del mapa' : 'Estás aquí').openTooltip();
  if (f) L.polyline([[u.lat, u.lng], ll(f)], { color: '#1d4f91', dashArray: '6 4' }).addTo(resaltado);
};
document.querySelectorAll('#radios .pastilla').forEach(b => b.onclick = async () => {
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
  const linea = L.geoJSON(r.linea, { style: { color: '#960018', weight: 3.5, dashArray: '2 7', lineCap: 'round', className: 'brillo' } }).addTo(resaltado);
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
    return ofs.length ? `<div class="grupo-dir"><h4>${esc(d.nombre)} <small>${ofs.length}</small></h4><div class="lista">${ofs.map(f => tarjeta(f.properties)).join('')}</div></div>` : '';
  }).join('');
  $('cuenta').textContent = OFICINAS.length;
  $('directorio').innerHTML = grupos;
  $('directorio').querySelectorAll('[data-oficina]').forEach(el => el.onclick = () => verOficina(+el.dataset.oficina));
}

// (la hoja inferior arrastrable está en ui.js)
$('texto').addEventListener('input', () => { $('limpiar').hidden = !$('texto').value; sugerir(); });
$('limpiar').onclick = () => { $('texto').value = ''; $('limpiar').hidden = true; inicio(); $('texto').focus(); };
document.querySelectorAll('.pastilla').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.pastilla').forEach(x => x.classList.toggle('activa', x === b));
}));

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
  const verif = of.features.filter(f => f.properties.verificado).length;
  const tot = k => inf.resumen.filter(r => r.capa === k).reduce((a, r) => a + (r.total || 0), 0);
  $('kpis').innerHTML = `<div class="kpi"><b>${inf.cobertura.ubicadas}/${inf.cobertura.unidades}</b><span>unidades ubicadas</span></div>
    <div class="kpi"><b>${verif}/${of.features.length}</b><span>verificadas en campo</span></div>
    <div class="kpi"><b>${((tot('Senderos') + tot('Vías internas')) / 1000).toFixed(1).replace('.', ',')} km</b><span>de caminos</span></div>`;
  $('resumen').innerHTML = `
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
  try { await api('/api/admin/check'); } catch (e) { TOKEN = ''; try { sessionStorage.removeItem('token'); } catch (_) {} if (!silencioso) toast('Token incorrecto'); return; }
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
    <label class="check"><input type="checkbox" name="verificado" ${p.verificado ? 'checked' : ''}> Ubicación verificada en campo</label>
    <div class="fila"><button class="primario">Guardar</button><button type="button" id="btn-mover" class="secundario">Mover en el mapa</button></div>`;
  f.onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    d.verificado = f.verificado.checked; d.dependencia_id = +d.dependencia_id;
    Object.keys(d).forEach(k => { if (d[k] === '') d[k] = null; });
    await api(`/api/oficinas/${id}`, { method: 'PATCH', body: JSON.stringify(d) });
    await recargar(); toast('Cambios guardados');
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
  $('dig-form').innerHTML = '<p class="nota">Toca el mapa donde está el elemento…</p>';
  esperarClic(ll => {
    const esOf = tipo === 'oficina';
    $('dig-form').innerHTML = `<p class="nota">Coordenada: ${ll.lat.toFixed(7)}, ${ll.lng.toFixed(7)}</p>
      <label>Nombre<input id="dig-nombre" style="width:100%" ${esOf ? 'required' : ''}></label>
      ${esOf ? `<label>Dependencia<select id="dig-dep" style="width:100%">${opciones(DEPS, 'id', x => x.nombre)}</select></label>
        <label>Clasificación<select id="dig-clas" style="width:100%">${opciones(CLAS.filter(c => ['DESPACHO', 'DIRECCION', 'ATENCION'].includes(c.codigo)), 'codigo', x => x.nombre, 'ATENCION')}</select></label>`
        : `<label>Detalle<input id="dig-sub" style="width:100%" placeholder="${tipo === 'servicio' ? 'Baños, comedor, consultorio…' : tipo === 'entrada' ? 'puerta / portón' : 'PQS 6 kg'}"></label>`}
      <button id="dig-guardar" type="button" class="primario">Guardar</button>`;
    const tmp = L.circleMarker(ll, { radius: 9, color: '#e74c3c' }).addTo(resaltado);
    $('dig-guardar').onclick = async () => {
      const nombre = $('dig-nombre').value.trim() || null;
      if (esOf) await api('/api/oficinas', { method: 'POST', body: JSON.stringify({ nombre, dependencia_id: +$('dig-dep').value, clasificacion: $('dig-clas').value, lat: ll.lat, lon: ll.lng }) });
      else await api('/api/puntos', { method: 'POST', body: JSON.stringify({ tipo, subtipo: $('dig-sub').value || null, nombre: nombre || (tipo === 'extintor' ? 'Extintor' : null), lat: ll.lat, lon: ll.lng }) });
      tmp.remove(); $('dig-form').innerHTML = ''; toast('Punto guardado');
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
  document.dispatchEvent(new CustomEvent('datos-listos', { detail: { deps } }));
  deps.forEach(d => $('filtro-dep').add(new Option('  '.repeat(d.nivel) + d.nombre + (d.sigla ? ` (${d.sigla})` : ''), d.id)));
  clas.filter(c => ['DESPACHO', 'DIRECCION', 'ATENCION'].includes(c.codigo)).forEach(c => $('filtro-clas').add(new Option(c.nombre, c.codigo)));
  mapa.invalidateSize();
  etiquetasSegunZoom();
  const campus = capas.zonas.getLayers().filter(l => l.feature.properties.tipo === 'campus');
  const mg = margenes();
  const marco = campus.length ? L.featureGroup(campus).getBounds() : capas.edificios.getBounds();
  OFICINAS.forEach(f => { const p = L.latLng(ll(f)); if (marco.pad(.5).contains(p)) marco.extend(p); });
  mapa.fitBounds(marco, { paddingTopLeft: mg.tl, paddingBottomRight: mg.br });
  const params = new URLSearchParams(location.search);
  if (params.get('oficina')) verOficina(+params.get('oficina'));
  if (params.has('equipo')) mostrarTab('equipo');
  if (TOKEN) entrar(TOKEN, true);
})();
