// ===== Firebase (Compat) =====
const a = window.auth;
const d = window.db;

// ===== Estado =====
let MAP_READY = false;
let map, marker, watchId = null;
let LISTENERS_WIRED = false;
let GEO_WIRED = false;

// ===== Helpers =====
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ===== Auth =====
a.onAuthStateChanged(user => {
  if (!user) { location.href = 'index.html'; return; }
  $('#fecha').textContent = new Date().toLocaleDateString();
  $('#user-name').textContent = user.displayName || 'Usuario';
  $('#user-email').textContent = user.email;

  if (!LISTENERS_WIRED) wireUI();
  loadIniciadas(user.email);
  loadCompletadas(user.email);
});

// ===== UI =====
function wireUI(){
  LISTENERS_WIRED = true;

  const sideMenu = $('#side-menu');
  const menuBtn  = $('#menu-btn');
  const scrim    = $('#menuScrim');

  // Abrir: quita hidden antes de animar
  menuBtn.addEventListener('click', () => {
    sideMenu.hidden = false;
    scrim.hidden = false;

    sideMenu.classList.add('active');
    scrim.classList.add('active');

    menuBtn.setAttribute('aria-expanded','true');
    sideMenu.setAttribute('aria-hidden','false');
    scrim.setAttribute('aria-hidden','false');
  });

  // Cerrar con click en scrim
  const closeMenu = () => {
    sideMenu.classList.remove('active');
    scrim.classList.remove('active');
    menuBtn.setAttribute('aria-expanded','false');
    sideMenu.setAttribute('aria-hidden','true');
    scrim.setAttribute('aria-hidden','true');
    // Espera transición y vuelve a ocultar del flujo
    setTimeout(() => {
      sideMenu.hidden = true;
      scrim.hidden = true;
    }, 280);
  };
  scrim.addEventListener('click', closeMenu);

  // Tabs
  const tabButtons = $$('.tab-btn');
  const tabContents = $$('.tab-content');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');

      if (btn.dataset.tab === 'pendientes' && MAP_READY) {
        setTimeout(() => google.maps.event.trigger(map, 'resize'), 120);
      }
    });
  });

  // Logout
  $('#logout-btn').addEventListener('click', async () => {
    try { await a.signOut(); location.href = 'index.html'; }
    catch { alert('Error al cerrar sesión'); }
  });

  // Modal “tipo”
  const modal = $('#type-modal');
  const openModal = () => { modal.hidden = false; modal.classList.add('active'); modal.setAttribute('aria-hidden','false'); };
  const closeModal = () => { modal.classList.remove('active'); modal.setAttribute('aria-hidden','true'); setTimeout(()=> modal.hidden=true, 150); };
  $('#add-fab').addEventListener('click', openModal);
  $('#type-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  $('#type-go').addEventListener('click', () => {
    const v = $('#tipo-destino').value;
    if (!v) { alert('Selecciona una opción'); return; }
    closeModal();
    if (v === 'CAJEROS') location.href = 'formulariocaj.html';
    else location.href = 'formularioof.html';
  });

  // Arrancar mapa si ya está el script
  if (window.google && window.google.maps && !MAP_READY) initMap();

  // Habilitar GPS con gesto del usuario
  $('#gps-btn').addEventListener('click', startGeoOnce, { once:true });
  document.addEventListener('pointerdown', startGeoOnce, { once:true });
}

// ===== Datos dummy =====
function loadCompletadas(userEmail){
  const cont = $('#completados-container');
  cont.innerHTML = '';
  d.collection('tareas')
    .where('userEmail','==',userEmail).where('estado','==','completado')
    .get()
    .then(q=>{
      if (q.empty){ cont.innerHTML = '<p>No hay tareas completadas.</p>'; return; }
      q.forEach(doc => cont.appendChild(cardCompletada({ id:doc.id, ...doc.data() })));
    })
    .catch(err => console.error('Completados:', err));
}
function cardCompletada(t){
  const div = document.createElement('div');
  div.className = 'tarea-card';
  div.innerHTML = `
    <div class="tarea-info">
      <h4>${t.clienteId || '-'}</h4>
      <p>${t.tipoTarea || ''}</p>
      <p>${t.distrito || ''} - ${t.fecha || ''}</p>
    </div>
    <div class="tarea-actions">
      <button class="btn-check" title="Ver">🔍</button>
    </div>`;
  return div;
}
function loadIniciadas(userEmail){
  const cont = $('#iniciados');
  cont.innerHTML = '<h2>Tareas Iniciadas</h2>';
  d.collection('tareas')
    .where('userEmail','==',userEmail).where('estado','==','pendiente')
    .get()
    .then(q=>{
      if (q.empty){ cont.insertAdjacentHTML('beforeend','<p>No hay tareas iniciadas.</p>'); return; }
      q.forEach(doc => cont.appendChild(cardPendiente({ id:doc.id, ...doc.data() })));
    })
    .catch(err => console.error('Iniciadas:', err));
}
function cardPendiente(t){
  const div = document.createElement('div');
  div.className = 'tarea-card';
  div.innerHTML = `
    <div class="tarea-info">
      <h4>${t.clienteId || '-'}</h4>
      <p>${t.tipoTarea || ''}</p>
      <p>${t.distrito || ''} - ${t.fecha || ''}</p>
    </div>
    <div class="tarea-actions">
      <button class="btn-check" title="Marcar como completado">✔</button>
      <button class="btn-location" title="Ver ubicación">📍</button>
    </div>`;
  div.querySelector('.btn-check').addEventListener('click', async () => {
    try{
      await d.collection('tareas').doc(t.id).update({ estado:'completado' });
      div.remove();
      $('#completados-container').appendChild(cardCompletada(t));
    }catch(e){ console.error(e); alert('No se pudo completar la tarea.'); }
  });
  div.querySelector('.btn-location').addEventListener('click', () => {
    alert(`Ubicación: Lat ${t.latitudCliente}, Lng ${t.longitudCliente}`);
  });
  return div;
}

// ===== Google Maps =====
function initMap(){
  if (MAP_READY) return;
  MAP_READY = true;
  const initialPosition = { lat: -12.0453, lng: -77.0311 };
  map = new google.maps.Map(document.getElementById('map'), { center: initialPosition, zoom: 15 });
  marker = new google.maps.Marker({ position: initialPosition, map, title:'Tu ubicación' });
  setTimeout(() => google.maps.event.trigger(map, 'resize'), 150);
}
window.initMap = initMap;

// Geolocalización solo tras gesto
function startGeoOnce(){
  if (GEO_WIRED) return;
  GEO_WIRED = true;
  if (!('geolocation' in navigator)) return alert('Tu navegador no soporta geolocalización.');
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(
    p => {
      const pos = { lat:p.coords.latitude, lng:p.coords.longitude };
      if (!marker) return;
      marker.setPosition(pos);
      map.setCenter(pos);
    },
    err => console.warn('GPS:', err.message),
    { enableHighAccuracy:true, maximumAge:0, timeout:10000 }
  );
}

// Limpieza
window.addEventListener('beforeunload', () => {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
});
