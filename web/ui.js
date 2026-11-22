// ¿Dónde queda? · Interacción avanzada (v0.5)
// Hoja inferior arrastrable, sugerencias mientras se escribe, categorías del mapa,
// ficha de lugares del campus y botón "Mi ubicación". Usa las funciones globales de app.js.
'use strict';

// ---------------------------------------------------------------- hoja inferior arrastrable (celular)
const hoja = $('panel');
const PARADAS = () => [150, Math.round(innerHeight * .45), Math.round(innerHeight * .88)];
function altoHoja(px, animar = true) {
  hoja.classList.toggle('arrastrando', !animar);
  document.documentElement.style.setProperty('--alto-hoja', px + 'px');
  clearTimeout(altoHoja.t);
  altoHoja.t = setTimeout(() => mapa.invalidateSize(), animar ? 300 : 0);
}
function abrirHoja(nivel = 1) {
  if (!MOVIL()) return;
  const h = hoja.getBoundingClientRect().height, p = PARADAS()[nivel];
  if (h < p) altoHoja(p);
}
(() => {
  const asa = $('asa');
  let y0 = 0, h0 = 0, movido = false;
  asa.addEventListener('pointerdown', e => {
    if (!MOVIL()) return;
    y0 = e.clientY; h0 = hoja.getBoundingClientRect().height; movido = false;
    asa.setPointerCapture(e.pointerId);
  });
  asa.addEventListener('pointermove', e => {
    if (!asa.hasPointerCapture(e.pointerId)) return;
    const dy = y0 - e.clientY;
    if (Math.abs(dy) > 4) movido = true;
    altoHoja(Math.max(120, Math.min(innerHeight * .92, h0 + dy)), false);
  });
  asa.addEventListener('pointerup', e => {
    if (!asa.hasPointerCapture(e.pointerId)) return;
    asa.releasePointerCapture(e.pointerId);
    const h = hoja.getBoundingClientRect().height, p = PARADAS();
    if (!movido) {                                   // un toque: pasa a la siguiente posición
      const i = p.findIndex(x => Math.abs(x - h) < 40);
      return altoHoja(p[(i + 1) % p.length]);
    }
    altoHoja(p.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a));   // arrastre: posición más cercana
  });
  asa.addEventListener('keydown', e => {             // accesible con teclado
    if (e.key === 'ArrowUp') altoHoja(PARADAS()[2]);
    if (e.key === 'ArrowDown') altoHoja(PARADAS()[0]);
  });
})();
mapa.on('dragstart', () => { if (MOVIL() && hoja.getBoundingClientRect().height > innerHeight * .6) altoHoja(PARADAS()[1]); });

// En celular las pestañas van dentro de la hoja; en pantallas grandes, en la cabecera
function acomodar() {
  const seg = document.querySelector('.segmentos');
  if (MOVIL() && seg.parentElement !== hoja) hoja.insertBefore(seg, $('cuerpo'));
  if (!MOVIL() && seg.parentElement === hoja) document.querySelector('.cabecera').appendChild(seg);
  if (!MOVIL()) document.documentElement.style.removeProperty('--alto-hoja');
  mapa.invalidateSize();
}
addEventListener('resize', acomodar);
acomodar();

// ---------------------------------------------------------------- sugerencias mientras se escribe
let SUG = [], sugIdx = -1;
const resaltar = (txt, q) => {
  const i = sinTilde(txt).indexOf(sinTilde(q));
  return i < 0 ? esc(txt) : esc(txt.slice(0, i)) + '<mark>' + esc(txt.slice(i, i + q.length)) + '</mark>' + esc(txt.slice(i + q.length));
};
const emojiPunto = p => p.tipo === 'extintor' ? '🧯' : p.tipo === 'entrada' ? '🚪' : (EMOJI[p.subtipo] || '📍');
function cerrarSugerencias() { $('sugerencias').hidden = true; $('texto').setAttribute('aria-expanded', 'false'); }
function sugerir() {
  const q = $('texto').value.trim(), ul = $('sugerencias');
  clearTimeout(sugerir.t);
  if (q.length < 2) return cerrarSugerencias();
  sugerir.t = setTimeout(async () => {
    const r = await api('/api/oficinas?texto=' + encodeURIComponent(q));
    SUG = r.features.slice(0, 7).map(f => ({ t: 'o', f }));
    sugIdx = -1;
    ul.innerHTML = SUG.length ? SUG.map((s, i) => {
      const p = s.f.properties;
      return s.t === 'o'
        ? `<li role="option" id="sug-${i}" data-i="${i}"><span class="s-ic" style="background:${color('oficina', p.clasificacion)};color:${p.clasificacion === 'DIRECCION' ? '#fff' : '#0a1022'}">${esc(corto(p))}</span>
           <span class="s-t"><b>${resaltar(p.nombre, q)}</b><small>${esc(p.tramites?.split(';')[0] || p.dependencia)}</small></span></li>`
        : `<li role="option" id="sug-${i}" data-i="${i}"><span class="s-ic" style="background:var(--fondo);font-size:15px">${emojiPunto(p)}</span>
           <span class="s-t"><b>${resaltar(p.nombre || p.subtipo, q)}</b><small>Lugar del campus</small></span></li>`;
    }).join('') : '<li class="s-vacio">No encontramos esa oficina. Prueba con "título", "kardex", "becas" o "posgrado".</li>';
    ul.hidden = false;
    $('texto').setAttribute('aria-expanded', 'true');
    ul.querySelectorAll('[data-i]').forEach(li => li.onmousedown = e => { e.preventDefault(); elegir(+li.dataset.i); });
  }, 150);
}
function elegir(i) {
  const s = SUG[i];
  if (!s) return;
  cerrarSugerencias();
  if (s.t === 'o') { $('texto').value = s.f.properties.nombre; verOficina(s.f.properties.id); }
  else verPunto(s.f);
  $('texto').blur();
}
$('texto').addEventListener('keydown', e => {
  const ul = $('sugerencias');
  if (ul.hidden || !SUG.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + SUG.length) % SUG.length;
    ul.querySelectorAll('[data-i]').forEach(li => li.setAttribute('aria-selected', +li.dataset.i === sugIdx));
    $('texto').setAttribute('aria-activedescendant', 'sug-' + sugIdx);
  } else if (e.key === 'Enter' && sugIdx >= 0) { e.preventDefault(); elegir(sugIdx); }
  else if (e.key === 'Escape') cerrarSugerencias();
});
$('texto').addEventListener('blur', () => setTimeout(cerrarSugerencias, 120));
$('buscar').addEventListener('submit', cerrarSugerencias);

// ---------------------------------------------------------------- ficha de un lugar del campus
function verPunto(f) {
  const p = f.properties, [lat, lon] = ll(f);
  const tipo = p.tipo === 'servicio' ? 'Servicio del campus' : p.tipo === 'entrada' ? 'Acceso' : 'Seguridad';
  mostrar(`<article class="ficha">
    <h2>${esc(p.nombre || p.subtipo || p.tipo)}</h2><p class="ruta">${tipo}</p>
    <div class="etiquetas">${p.subtipo && p.subtipo !== p.nombre ? `<span class="etq">${esc(p.subtipo)}</span>` : ''}</div>
    <div class="acciones"><a class="accion principal" target="_blank" rel="noopener"
      href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking">${svg('caminar')}Cómo llegar</a></div>
    <ul class="datos">
      ${p.edificio ? `<li>${svg('edificio')}<span><span class="k">Edificio</span><span class="v">${esc(p.edificio)}</span></span></li>` : ''}
      ${p.descripcion ? `<li>${svg('reloj')}<span><span class="k">Horario</span><span class="v">${esc(p.descripcion)}</span></span></li>` : ''}
    </ul>
    <div class="seccion-f"><details class="tec"><summary>Datos técnicos (SIG)</summary><dl>
      <dt>Tipo</dt><dd>${esc(p.tipo)}</dd><dt>Coordenadas</dt><dd>${lat.toFixed(6)}, ${lon.toFixed(6)} (WGS 84)</dd>
      <dt>Fuente</dt><dd>${esc(p.fuente)}</dd></dl></details></div></article>`);
  resaltado.clearLayers();
  L.marker([lat, lon], { icon: iconoPunto(p, true), interactive: false }).addTo(resaltado);
  centrar([lat, lon]);
}

// ---------------------------------------------------------------- botón "Mi ubicación"
let yo = null;
const ctlUbic = L.control({ position: 'topright' });
ctlUbic.onAdd = () => {
  const b = L.DomUtil.create('button', 'btn-ubic');
  b.type = 'button';
  b.title = 'Mi ubicación';
  b.setAttribute('aria-label', 'Mostrar mi ubicación');
  b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.9 3A9 9 0 0 0 13 3.1V1h-2v2.1A9 9 0 0 0 3.1 11H1v2h2.1a9 9 0 0 0 7.9 7.9V23h2v-2.1a9 9 0 0 0 7.9-7.9H23v-2zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"/></svg>';
  L.DomEvent.disableClickPropagation(b);
  b.onclick = () => {
    if (!navigator.geolocation) return toast('Tu navegador no permite ubicación');
    b.classList.add('buscando');
    navigator.geolocation.getCurrentPosition(pos => {
      b.classList.remove('buscando');
      const c = [pos.coords.latitude, pos.coords.longitude];
      if (yo) yo.remove();
      yo = L.layerGroup([
        L.circle(c, { radius: pos.coords.accuracy, color: '#1a73e8', weight: 1, fillOpacity: .1, interactive: false }),
        L.marker(c, { icon: L.divIcon({ className: '', iconSize: [18, 18], html: '<div class="yo"></div>' }), interactive: false, title: 'Estás aquí' }),
      ]).addTo(mapa);
      centrar(c, 200);
    }, () => { b.classList.remove('buscando'); toast('No se pudo obtener tu ubicación'); }, { enableHighAccuracy: true, timeout: 8000 });
  };
  return b;
};
ctlUbic.addTo(mapa);
