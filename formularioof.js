// Firebase (Compat)
const a = window.auth;
const d = window.db;

// Utils
const $  = s => document.querySelector(s);
const normU = t => (t||'').toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toUpperCase();

// Overlay
function showOverlay(msg='Cargando…', sub=''){
  const m = $('#overlay-msg'), s = $('#overlay-sub');
  if (m) m.textContent = msg;
  if (s) s.textContent = sub || '';
  $('#overlay').classList.add('active');
}
function hideOverlay(){ $('#overlay').classList.remove('active'); }

// Estado
let OFFICES = [];
let map, meMarker, ofiMarker, geocoder, watchId = null;

// ===== Inicio =====
document.addEventListener('DOMContentLoaded', async () => {
  $('#fecha').textContent = new Date().toLocaleDateString();

  await new Promise(res => a.onAuthStateChanged(u => { if(!u) location.href='index.html'; else res(); }));

  showOverlay('Cargando oficinas…','Leyendo colección OFICINAS');
  await loadOffices(); hideOverlay();

  wireSearch(); wireCamera();

  showOverlay('Cargando categorías…','Leyendo colección CATEGORIA');
  await loadCategorias(); hideOverlay();

  // listeners de selects
  $('#sel-cat').addEventListener('change', onCategoriaChange);
  $('#sel-motivo').addEventListener('change', onMotivoChange);
  $('#sel-nov').addEventListener('change', onNovedadChange);
});

// =================== OFICINAS ===================
async function loadOffices(){
  try{
    const snap = await d.collection('OFICINAS').get();
    OFFICES = snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
  }catch(e){ console.error('OFICINAS:', e); alert('No se pudieron cargar las oficinas.'); }
}

function wireSearch(){
  const input = $('#of-search'), sug = $('#of-suggest');
  const render = items => {
    if (!items.length){ sug.classList.remove('show'); sug.innerHTML=''; return; }
    sug.innerHTML = items.slice(0,12).map(it=>{
      const dd = it.data||{}; const sub = [dd.DIRECCION, dd.DISTRITO].filter(Boolean).join(' · ');
      return `<div class="suggest-item" role="option" data-id="${it.id}">
        <div class="suggest-title">${it.id}</div><div class="suggest-sub">${sub||'&nbsp;'}</div></div>`;
    }).join('');
    sug.classList.add('show');
  };
  input.addEventListener('input', ()=>{
    const q = normU(input.value);
    if (!q){ render([]); return; }
    render(OFFICES.filter(o=>{
      const dd = o.data||{};
      return normU(o.id).includes(q) || normU(dd.DIRECCION).includes(q) || normU(dd.DISTRITO).includes(q);
    }));
  });
  input.addEventListener('focus', ()=>{ if (input.value.trim()) input.dispatchEvent(new Event('input')); });
  document.addEventListener('click', e=>{ if (!sug.contains(e.target) && e.target!==input) sug.classList.remove('show'); });
  sug.addEventListener('click', e=>{
    const it = e.target.closest('.suggest-item'); if(!it) return;
    const f = OFFICES.find(x=>x.id===it.dataset.id); if (f) applyOffice(f);
    sug.classList.remove('show');
  });
}

function applyOffice(ofi){
  const dta = ofi.data||{};
  // SIEMPRE llenar los campos
  $('#of-search').value  = ofi.id;
  $('#of-name').value    = ofi.id || '';
  $('#of-codigo').value  = dta.CODIGO || '';
  $('#of-direccion').value = dta.DIRECCION || '';
  $('#of-distrito').value  = dta.DISTRITO || '';
  $('#of-site').value      = dta.SITE || '';
  $('#of-consola').value   = dta.CONSOLA || '';
  $('#of-moto-save').value = dta['MOTO SAVE'] || '';
  $('#of-motorizado').value= dta['MOTORIZADO'] || '';
  $('#of-turbina').value   = dta['TURBINA'] || '';
  $('#of-status').value    = dta['STATUS DE FUNCIONAMIENTO'] || '';

  // Geocodificar solo si Google Maps ya cargó
  if (typeof google !== 'undefined' && google.maps) {
    const addr = [dta.DIRECCION, dta.DISTRITO, 'Perú'].filter(Boolean).join(', ');
    geocoder.geocode({ address: addr }, (results, status)=>{
      if (status==='OK' && results && results[0]){
        const g = results[0].geometry.location;
        setOfficeMarker({ lat:g.lat(), lng:g.lng() });
      }else if (dta.LATITUD && dta.LONGITUD){
        setOfficeMarker({ lat:+dta.LATITUD, lng:+dta.LONGITUD });
      }
    });
  }
}

// =================== CATEGORÍAS / MOTIVOS / NOVEDADES ===================

// Mapeo explícito de subcolecciones conocidas
const SUB_MAP = {
  "ATM'S":        ['RONDA_ATM','RONDA_ATMS'],
  'OFICINAS':     ['RONDA_OF','RONDA_OFI','RONDA_OFICINAS'],
  'RESIDENCIAS':  ['RONDA_RS','RONDA_RES','RONDA_RESIDENCIAS'],
  'COMISION':     ['RONDA_CM','RONDA_CO','RONDA_COMISION'],
  'LOGISTICO':    ['RONDA_LO','RONDA_LG','RONDA_LOGISTICO'],
  'OPEN OF SERVICE': ['RONDA_OS','RONDA_OOS'],
  'SERVICE CLOSURE': ['RONDA_SC'],
  'TACTICO':      ['RONDA_TA','RONDA_TC','RONDA_TK'],
  'VEHICULO':     ['RONDA_VE','RONDA_VH','RONDA_VEH']
};

function buildCandidates(cat){
  const up = normU(cat);
  const words = up.replace(/[^A-Z0-9 ]/g,' ').trim().split(/\s+/).filter(Boolean);
  const cand = new Set();
  cand.add(words.join('_'));
  words.forEach(w => { cand.add(w); cand.add(w.slice(0,3)); cand.add(w.slice(0,2)); });
  const first = words[0] || ''; const lastW = words[words.length-1] || '';
  const pair1 = (first[0]||'') + (lastW[0]||'');     // OPEN OF SERVICE -> OS
  const pair2 = (first[0]||'') + (first.slice(-1)||''); // RESIDENCIAS -> RS
  if (pair1) cand.add(pair1); if (pair2) cand.add(pair2);
  const out = new Set(); cand.forEach(t => out.add(`RONDA_${t}`));
  const F = (first[0]||'R'); for (let i=65;i<=90;i++) out.add(`RONDA_${F}${String.fromCharCode(i)}`);
  (SUB_MAP[up]||[]).forEach(x => out.add(x));
  return Array.from(out);
}

async function loadCategorias(){
  const sel = $('#sel-cat');
  sel.innerHTML = '<option value="">Seleccionar…</option>';
  try{
    const snap = await d.collection('CATEGORIA').get();
    snap.forEach(doc => { if(!doc.id.startsWith('__')) sel.insertAdjacentHTML('beforeend', `<option value="${doc.id}">${doc.id}</option>`); });
  }catch(e){ console.error('CATEGORIA:', e); }
}

async function getMotivosForCategoria(cat){
  // 1) Si hay índice opcional: CATEGORIA/{cat}/__index__/subcollections { names:[...] }
  try{
    const idx = await d.doc(`CATEGORIA/${cat}/__index__/subcollections`).get();
    if (idx.exists){
      const names = (idx.data().names||[]).filter(Boolean);
      if (names.length) return names;
    }
  }catch{}

  // 2) Probar candidatos consultando .limit(1)
  const candidates = buildCandidates(cat);
  const found = [];
  for (const name of [...new Set(candidates)].slice(0,40)){
    try{
      const snap = await d.collection(`CATEGORIA/${cat}/${name}`).limit(1).get();
      if (!snap.empty) found.push(name);
    }catch{}
  }
  return [...new Set(found)];
}

async function onCategoriaChange(){
  const cat = $('#sel-cat').value;
  const selMotivo = $('#sel-motivo'), selNovedad = $('#sel-nov'), selDetalle = $('#sel-detalle');
  selMotivo.innerHTML = '<option value="">Cargando…</option>';
  selNovedad.innerHTML = '<option value="">Seleccionar…</option>';
  selDetalle.innerHTML = '<option value="">Seleccionar…</option>';
  if (!cat){ selMotivo.innerHTML = '<option value="">Seleccionar…</option>'; return; }

  showOverlay('Cargando motivos…', `Buscando subcolecciones de ${cat}`);
  const motivos = await getMotivosForCategoria(cat);
  hideOverlay();

  if (!motivos.length){
    selMotivo.innerHTML = '<option value="">No hay subcolecciones detectadas</option>';
    return;
  }
  selMotivo.innerHTML = '<option value="">Seleccionar…</option>';
  motivos.forEach(m => selMotivo.insertAdjacentHTML('beforeend', `<option value="${m}">${m}</option>`));
}

async function onMotivoChange(){
  const cat = $('#sel-cat').value, mot = $('#sel-motivo').value;
  const selNovedad = $('#sel-nov'), selDetalle = $('#sel-detalle');
  selNovedad.innerHTML = '<option value="">Cargando…</option>';
  selDetalle.innerHTML = '<option value="">Seleccionar…</option>';
  if (!cat || !mot){ selNovedad.innerHTML = '<option value="">Seleccionar…</option>'; return; }

  showOverlay('Cargando novedades…', mot);
  try{
    const snap = await d.collection(`CATEGORIA/${cat}/${mot}`).get();
    if (snap.empty){ selNovedad.innerHTML = '<option value="">Sin documentos</option>'; }
    else{
      selNovedad.innerHTML = '<option value="">Seleccionar…</option>';
      snap.forEach(doc => selNovedad.insertAdjacentHTML('beforeend', `<option value="${doc.id}">${doc.id}</option>`));
    }
  }catch(e){ console.error(e); selNovedad.innerHTML = '<option value="">Error</option>'; }
  hideOverlay();
}

async function onNovedadChange(){
  const cat = $('#sel-cat').value, mot = $('#sel-motivo').value, nov = $('#sel-nov').value;
  const selDetalle = $('#sel-detalle'); selDetalle.innerHTML = '<option value="">Cargando…</option>';
  if (!cat || !mot || !nov){ selDetalle.innerHTML = '<option value="">Seleccionar…</option>'; return; }

  showOverlay('Cargando detalle…', nov);
  try{
    const doc = await d.doc(`CATEGORIA/${cat}/${mot}/${nov}`).get();
    if (doc.exists){
      const data = doc.data() || {}; const entries = Object.entries(data);
      selDetalle.innerHTML = '<option value="">Seleccionar…</option>';
      if (!entries.length) selDetalle.insertAdjacentHTML('beforeend','<option value="">Sin detalles</option>');
      else entries.forEach(([k,v])=>{
        const text = typeof v === 'string' ? v : k;
        const val  = typeof v === 'string' ? v : JSON.stringify(v);
        selDetalle.insertAdjacentHTML('beforeend', `<option value="${val}">${text}</option>`);
      });
    }else selDetalle.innerHTML = '<option value="">No existe documento</option>';
  }catch(e){ console.error(e); selDetalle.innerHTML = '<option value="">Error</option>'; }
  hideOverlay();
}

// =================== MAPAS ===================
function setOfficeMarker(pos){
  if (!ofiMarker){
    ofiMarker = new google.maps.Marker({ map, position: pos, title:'Oficina', icon:'http://maps.google.com/mapfiles/ms/icons/red-dot.png' });
  }else ofiMarker.setPosition(pos);
  const b = new google.maps.LatLngBounds(); if (pos) b.extend(pos);
  if (meMarker && meMarker.getPosition()) b.extend(meMarker.getPosition());
  if (!b.isEmpty()) map.fitBounds(b);
}
function initUserWatch(){
  if (!('geolocation' in navigator)) return;
  if (watchId!==null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(
    p=>{
      const pos = { lat:p.coords.latitude, lng:p.coords.longitude };
      if (!meMarker) meMarker = new google.maps.Marker({ map, position: pos, title:'Tu ubicación', icon:'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' });
      else meMarker.setPosition(pos);
    },
    e=>console.warn('GPS:', e.message), { enableHighAccuracy:true, maximumAge:0, timeout:12000 }
  );
}
function initMapInternal(){
  const initial = { lat:-12.0453, lng:-77.0311 };
  map = new google.maps.Map(document.getElementById('map-ofi'), { center: initial, zoom: 13 });
  geocoder = new google.maps.Geocoder();
  setTimeout(()=> google.maps.event.trigger(map, 'resize'), 150);
  initUserWatch();
}
function initMapOfi(){ initMapInternal(); }
window.initMapOfi = initMapOfi;

// =================== Cámara ===================
function wireCamera(){
  const btn = $('#btn-foto'), inp = $('#inp-foto'), preview = $('#foto-preview');
  btn.addEventListener('click', ()=> inp.click());
  inp.addEventListener('change', ()=>{
    preview.innerHTML='';  [...(inp.files||[])].forEach(f=>{
      const url = URL.createObjectURL(f); const img = new Image();
      img.onload = ()=> URL.revokeObjectURL(url); img.src = url; img.width=120; img.height=120;
      img.style.objectFit='cover'; img.style.borderRadius='12px'; img.style.border='1px solid var(--border)';
      preview.appendChild(img);
    });
  });
}
