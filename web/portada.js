// ¿Dónde queda? · Portada e indicadores del tablero
'use strict';

const landing = $('landing');
const saltarPortada = ['oficina', 'mapa', 'equipo'].some(k => new URLSearchParams(location.search).has(k));
if (saltarPortada) landing.classList.add('oculta');
document.body.classList.toggle('en-portada', !saltarPortada);

function entrarAlMapa(q) {
  landing.classList.add('oculta');
  document.body.classList.remove('en-portada');
  setTimeout(() => {
    mapa.invalidateSize();
    if (q) return buscar(q);
    const campus = capas.zonas.getLayers().filter(l => l.feature.properties.tipo === 'campus');
    if (campus.length) { const m = margenes(); mapa.fitBounds(L.featureGroup(campus).getBounds(), { paddingTopLeft: m.tl, paddingBottomRight: m.br }); }
  }, SIN_MOV ? 0 : 320);
}
function volverAPortada() {
  landing.classList.remove('oculta');
  document.body.classList.add('en-portada');
  history.replaceState(null, '', location.pathname);
  $('l-texto').focus();
}
$('l-buscar').onsubmit = e => { e.preventDefault(); entrarAlMapa($('l-texto').value.trim()); };
landing.querySelectorAll('[data-q]').forEach(b => b.onclick = () => entrarAlMapa(b.dataset.q));
landing.querySelectorAll('[data-entrar]').forEach(b => b.onclick = () => entrarAlMapa());
$('ir-portada').onclick = volverAPortada;

// Indicadores reales desde la base de datos (portada y tablero)
document.addEventListener('datos-listos', () => {
  // Enlace directo al mapa (?mapa): encuadrar el campus una vez que todo está pintado
  if (saltarPortada && !new URLSearchParams(location.search).has('oficina')) setTimeout(() => {
    mapa.invalidateSize();
    const campus = capas.zonas.getLayers().filter(l => l.feature.properties.tipo === 'campus');
    if (campus.length) { const m = margenes(); mapa.fitBounds(L.featureGroup(campus).getBounds(), { paddingTopLeft: m.tl, paddingBottomRight: m.br }); }
  }, 150);
});
document.addEventListener('datos-listos', async e => {
  const inf = await api('/api/infraestructura');
  const tot = k => inf.resumen.filter(r => r.capa === k).reduce((a, r) => a + (r.total || 0), 0);
  const cnt = k => inf.resumen.filter(r => r.capa === k).reduce((a, r) => a + r.cantidad, 0);
  const km = (tot('Senderos') + tot('Vías internas') + tot('Escaleras')) / 1000;
  const vals = { oficinas: OFICINAS.length, unidades: inf.cobertura.unidades, edificios: cnt('Edificios'), km: km.toFixed(1).replace('.', ',') };
  document.querySelectorAll('#l-stats dd').forEach(dd => contar(dd, vals[dd.dataset.k]));

  // Tablero: anillo de cobertura
  const pct = Math.round(100 * inf.cobertura.ubicadas / inf.cobertura.unidades);
  $('t-cob').textContent = pct + '%';
  $('t-cob-txt').textContent = `${inf.cobertura.ubicadas} de ${inf.cobertura.unidades} unidades ubicadas`;
  requestAnimationFrame(() => $('t-arco').style.strokeDasharray = `${pct} 100`);
  $('t-km').textContent = vals.km;
  $('t-ha').textContent = Math.round(tot('Límite del campus') / 10000);

  // Tablero: oficinas por área (barras)
  const porArea = e.detail.deps.filter(d => d.nivel === 1 || d.nivel === 0).map(d => {
    const hijos = new Set([d.id, ...e.detail.deps.filter(x => x.padre_id === d.id && x.nivel === 2).map(x => x.id)]);
    return { n: d.sigla || d.nombre.split(' ').slice(-1)[0], v: OFICINAS.filter(f => hijos.has(f.properties.dependencia_id)).length };
  }).filter(x => x.v).sort((a, b) => b.v - a.v);
  const max = Math.max(...porArea.map(x => x.v));
  $('t-barras').innerHTML = porArea.map(x => `<div class="barra"><span>${esc(x.n)}</span><i style="--w:${100 * x.v / max}%"></i><b>${x.v}</b></div>`).join('');
});

// Conteo animado de cifras
function contar(el, fin) {
  const num = parseFloat(String(fin).replace(',', '.'));
  if (SIN_MOV || isNaN(num)) { el.textContent = fin; return; }
  const dec = String(fin).includes(',') ? 1 : 0, t0 = performance.now();
  const paso = t => {
    const k = Math.min(1, (t - t0) / 900), v = num * (1 - Math.pow(1 - k, 3));
    el.textContent = dec ? v.toFixed(1).replace('.', ',') : Math.round(v);
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
