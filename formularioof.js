// formularioof.js — Cámara integrada (captura local) + subida diferida al Enviar
(() => {
  // Singletons ya expuestos por firebase-config.js
  const a = window.auth;
  const d = window.db;
  // ¡Evitar colisión: no uses "storage" como const global!
  const fbStorage = window.storage || firebase.storage();

  // Utils
  const $  = s => document.querySelector(s);
  const normU = t => (t||'').toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toUpperCase();

  // Overlay moderno
  function showOverlay(msg='Cargando…', sub=''){
    const m = $('#overlay-msg'), s = $('#overlay-sub');
    if (m) m.textContent = msg;
    if (s) s.textContent = sub || '';
    setProgress(0);
    $('#overlay').classList.add('active');
  }
  function hideOverlay(){ $('#overlay').classList.remove('active'); }
  function setProgress(f){ const el = $('#overlay-progress'); if (el) el.style.width = `${Math.max(0, Math.min(100, Math.round((f||0)*100)))}%`; }

  // ===== Estado general =====
  let OFFICES = [];
  let map, meMarker, ofiMarker, geocoder, watchId = null;
  let lastUserPos = null;

  // ===== FOTOS (local hasta Enviar) =====
  let PHOTOS = [];
  function addPhotoBlob(blob){
    const preview = URL.createObjectURL(blob);
    PHOTOS.push({ blob, preview });
    renderPreviews();
  }
  function clearPhotos(){
    try{ PHOTOS.forEach(p => p.preview && URL.revokeObjectURL(p.preview)); }catch{}
    PHOTOS = [];
    renderPreviews();
  }
  function renderPreviews(){
    const wrap = $('#foto-preview'); if (!wrap) return;
    wrap.innerHTML = '';
    PHOTOS.forEach((p, idx)=>{
      const box = document.createElement('div');
      box.className = 'thumb';
      box.innerHTML = `<button class="del" title="Eliminar">&times;</button>`;
      const img = new Image(); img.src = p.preview; box.appendChild(img);
      box.querySelector('.del').addEventListener('click', ()=>{
        try{ URL.revokeObjectURL(PHOTOS[idx].preview); }catch{}
        PHOTOS.splice(idx,1); renderPreviews();
      });
      wrap.appendChild(box);
    });
  }

  // ===== Cámara integrada =====
  let camStream = null;
  let camFacing = 'environment';
  const camEls = {};
  function camGrabEls(){
    camEls.wrap = $('#cam-overlay');
    camEls.video= $('#cam-video');
    camEls.hint = $('#cam-hint');
    camEls.close= $('#cam-close');
    camEls.flip = $('#cam-flip');
    camEls.shoot= $('#cam-shoot');
    camEls.fallbackWrap = $('#cam-fallback');
    camEls.fileBtn = $('#cam-file-btn');
    camEls.filePick= $('#cam-file');
  }
  async function camStart(){
    if (camStream) camStream.getTracks().forEach(t=>t.stop());
    try{
      camStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal: camFacing } }, audio:false });
      camEls.video.srcObject = camStream;
      await camEls.video.play();
      camEls.video.style.transform = (camFacing==='user') ? 'scaleX(-1)' : 'none';
      camEls.fallbackWrap.hidden = true;
    }catch(err){
      console.warn('getUserMedia falló -> fallback', err);
      camEls.fallbackWrap.hidden = false;
      camEls.hint.textContent = 'Si tu WebView bloquea la cámara, usa “Cámara nativa”.';
    }
  }
  function camOpen(){ camEls.wrap.classList.add('active'); camEls.wrap.setAttribute('aria-hidden','false'); camStart(); }
  function camClose(){ if (camStream) camStream.getTracks().forEach(t=>t.stop()); camEls.wrap.classList.remove('active'); camEls.wrap.setAttribute('aria-hidden','true'); }
  function camCaptureBlob(){
    const canvas = document.createElement('canvas');
    canvas.width  = camEls.video.videoWidth || 1280;
    canvas.height = camEls.video.videoHeight|| 720;
    const ctx = canvas.getContext('2d');
    if (camFacing==='user'){ ctx.translate(canvas.width,0); ctx.scale(-1,1); }
    ctx.drawImage(camEls.video, 0, 0, canvas.width, canvas.height);
    return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
  }
  async function camFromCamera(){
    try{
      const b = await camCaptureBlob();
      addPhotoBlob(b);         // solo local
      camClose();
    }catch(e){ alert('No se pudo capturar la foto.'); console.error(e); }
  }
  function camFromFiles(files){
    const arr = Array.from(files||[]);
    if (!arr.length) return;
    arr.forEach(f => addPhotoBlob(f));  // local
    camClose();
  }

  // ===== Inicio =====
  document.addEventListener('DOMContentLoaded', async () => {
    $('#fecha').textContent = new Date().toLocaleDateString();

    await new Promise(res => a.onAuthStateChanged(u => { if(!u) location.href='index.html'; else res(); }));

    showOverlay('Cargando oficinas…','Leyendo colección OFICINAS');
    await loadOffices(); hideOverlay();

    wireSearch(); camGrabEls(); wireCamera(); wireActions();

    showOverlay('Cargando categorías…','Leyendo colección CATEGORIA');
    await loadCategorias(); hideOverlay();

    startGeoAlways(); // GPS siempre
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

    // Geocodificación (Perú)
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
    const pair1 = (first[0]||'') + (lastW[0]||'');
    const pair2 = (first[0]||'') + (first.slice(-1)||'');
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
    try{
      const idx = await d.doc(`CATEGORIA/${cat}/__index__/subcollections`).get();
      if (idx.exists){
        const names = (idx.data().names||[]).filter(Boolean);
        if (names.length) return names;
      }
    }catch{}
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

  // =================== MAPAS & GPS ===================
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
        lastUserPos = { lat:p.coords.latitude, lng:p.coords.longitude };
        if (!meMarker) meMarker = new google.maps.Marker({ map, position: lastUserPos, title:'Tu ubicación', icon:'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' });
        else meMarker.setPosition(lastUserPos);
      },
      e=>console.warn('GPS:', e.message), { enableHighAccuracy:true, maximumAge:0, timeout:12000 }
    );
  }
  function startGeoAlways(){
    try{ initUserWatch(); }catch{}
    document.addEventListener('pointerdown', function once(){
      if (!lastUserPos) initUserWatch();
      document.removeEventListener('pointerdown', once);
    }, { once:true });
  }
  function initMapOfi(){
    const initial = { lat:-12.0453, lng:-77.0311 };
    map = new google.maps.Map(document.getElementById('map-ofi'), { center: initial, zoom: 13 });
    geocoder = new google.maps.Geocoder();
    setTimeout(()=> google.maps.event.trigger(map, 'resize'), 150);
  }
  // <- este nombre lo usa el &callback=initMapOfi del HTML
  window.initMapOfi = initMapOfi;

  // =================== Cámara: wiring ===================
  function wireCamera(){
    $('#btn-foto')?.addEventListener('click', camOpen);
    camEls.close?.addEventListener('click', camClose);
    camEls.shoot?.addEventListener('click', camFromCamera);
    camEls.flip?.addEventListener('click', async ()=>{
      camFacing = camFacing==='environment' ? 'user' : 'environment';
      await camStart();
    });
    camEls.fileBtn?.addEventListener('click', ()=> camEls.filePick.click());
    camEls.filePick?.addEventListener('change', ()=> camFromFiles(camEls.filePick.files));
  }

  // =================== Cancelar / Enviar ===================
  function wireActions(){
    $('#btn-cancelar')?.addEventListener('click', async ()=>{
      try{
        $('#of-search').value = '';
        ['of-name','of-codigo','of-direccion','of-distrito','of-site','of-consola','of-moto-save','of-motorizado','of-turbina','of-status'].forEach(id=> { const el=$( '#'+id ); if(el) el.value=''; });
        ['sel-cat','sel-motivo','sel-nov','sel-detalle','of-turno'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });
        $('#comentario').value = '';
        clearPhotos();
      }finally{
        window.location.href = 'menu.html';
      }
    });
    $('#btn-enviar')?.addEventListener('click', sendForm);
  }

  async function uploadAllPhotos(){
    if (!PHOTOS.length) return [];
    const uid = (a.currentUser && a.currentUser.uid) || 'anon';
    const urls = [];

    showOverlay('Subiendo fotos…', 'Preparando');
    for (let i=0; i<PHOTOS.length; i++){
      const p = PHOTOS[i];
      if (!p.remoteUrl){
        const ref = fbStorage.ref(`capturas/${uid}/${Date.now()}-${i}.jpg`);
        await ref.put(p.blob);
        p.remoteUrl = await ref.getDownloadURL();
      }
      urls.push(p.remoteUrl);
      setProgress((i+1)/PHOTOS.length);
      $('#overlay-sub').textContent = `Foto ${i+1} de ${PHOTOS.length}`;
    }
    return urls;
  }

  async function sendForm(){
    const user = a.currentUser;
    const ofName = $('#of-name').value.trim();
    const turno  = $('#of-turno').value;
    const cat    = $('#sel-cat').value;
    const mot    = $('#sel-motivo').value;
    const nov    = $('#sel-nov').value;
    const det    = $('#sel-detalle').value;
    const comment= $('#comentario').value.trim();

    if (!ofName){ alert('Selecciona una oficina.'); return; }
    if (!turno){ alert('Selecciona el turno.'); return; }
    if (!cat || !mot || !nov){ alert('Completa la clasificación (Categoría, Motivo y Novedad).'); return; }

    if (!lastUserPos && navigator.geolocation){
      try{
        const p = await new Promise((res,rej)=> navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
        lastUserPos = { lat:p.coords.latitude, lng:p.coords.longitude };
      }catch{}
    }

    const ofPos = ofiMarker && ofiMarker.getPosition() ? { lat: ofiMarker.getPosition().lat(), lng: ofiMarker.getPosition().lng() } : null;

    // 1) Subir fotos (si hubiera)
    const fotoURLs = await uploadAllPhotos();

    // 2) Guardar reporte
    const payload = {
      tipo: 'OFICINA',
      oficina: {
        id: ofName,
        codigo: $('#of-codigo').value,
        direccion: $('#of-direccion').value,
        distrito: $('#of-distrito').value,
        site: $('#of-site').value,
        consola: $('#of-consola').value,
        moto_save: $('#of-moto-save').value,
        motorizado: $('#of-motorizado').value,
        turbina: $('#of-turbina').value,
        status_funcionamiento: $('#of-status').value,
        turno
      },
      clasificacion: { categoria:cat, motivo:mot, novedad:nov, detalle:det },
      comentario: comment,
      fotos: fotoURLs,
      geo: { usuario: lastUserPos || null, oficina: ofPos || null },
      user: user ? { uid:user.uid, email:user.email || null } : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try{
      showOverlay('Enviando reporte…','Guardando en Firestore'); setProgress(1);
      await d.collection('reportes_oficinas').add(payload);
      hideOverlay();
      alert('Reporte enviado correctamente.');
      clearPhotos();
      window.location.href = 'menu.html';
    }catch(e){
      hideOverlay();
      console.error(e);
      alert('No se pudo enviar el reporte.');
    }
  }

  // Eventos de selects
  $('#sel-cat')?.addEventListener('change', onCategoriaChange);
  $('#sel-motivo')?.addEventListener('change', onMotivoChange);
  $('#sel-nov')?.addEventListener('change', onNovedadChange);
})();
