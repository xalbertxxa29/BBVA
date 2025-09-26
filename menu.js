// ===== Firebase (Compat) expuesto por firebase-config.js =====
const a = window.auth;
const d = window.db;

// ===== Guards globales para evitar dobles inits =====
let MAP_READY = false;
let map, marker, watchId = null;
let LISTENERS_WIRED = false;

// ===== Helpers =====
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ===== Auth guard y carga inicial =====
a.onAuthStateChanged(user => {
  if (!user) { window.location.href = 'index.html'; return; }
  // Header
  $('#fecha').textContent = new Date().toLocaleDateString();
  $('#user-name').textContent = user.displayName || 'Usuario';
  $('#user-email').textContent = user.email;

  // Evitar volver a cablear listeners si el SDK re-emite el estado
  if (!LISTENERS_WIRED) wireUI();
  loadIniciadas(user.email);
  loadCompletadas(user.email);
});

// ===== UI wiring (solo una vez) =====
function wireUI(){
  LISTENERS_WIRED = true;

  // Menú lateral
  const sideMenu = $('#side-menu');
  const menuBtn = $('#menu-btn');
  const menuScrim = $('#menuScrim');

  menuBtn.addEventListener('click', () => {
    sideMenu.classList.add('active');
    menuScrim.classList.add('active');
  }, { once:false });

  menuScrim.addEventListener('click', () => {
    sideMenu.classList.remove('active');
    menuScrim.classList.remove('active');
  }, { once:false });

  // Tabs
  const tabButtons = $$('.tab-btn');
  const tabContents = $$('.tab-content');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');

      // Si se cambia hacia la pestaña con mapa, forzar resize
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

  // FAB → modal de tipo (Cajeros/Oficinas)
  const typeModal = $('#type-modal');
  $('#add-fab').addEventListener('click', openTypeModal);
  $('#type-cancel').addEventListener('click', closeTypeModal);
  typeModal.addEventListener('click', e => { if (e.target === typeModal) closeTypeModal(); });
  $('#type-go').addEventListener('click', () => {
    const v = $('#tipo-destino').value;
    if (!v) { alert('Selecciona una opción'); return; }
    if (v === 'CAJEROS') window.location.href = 'formulariocaj.html';
    else window.location.href = 'formularioof.html';
  });

  // Arranca el mapa si el script ya cargó
  if (window.google && window.google.maps && !MAP_READY) initMap();
}

// Modal helpers
function openTypeModal(){
  $('#tipo-destino').value = '';
  const m = $('#type-modal');
  m.classList.add('active');
  m.setAttribute('aria-hidden','false');
}
function closeTypeModal(){
  const m = $('#type-modal');
  m.classList.remove('active');
  m.setAttribute('aria-hidden','true');
}

// ===== Carga de tareas (sin recargar la página) =====
function loadCompletadas(userEmail){
  const cont = $('#completados-container');
  cont.innerHTML = '';
  d.collection('tareas')
    .where('userEmail','==',userEmail)
    .where('estado','==','completado')
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
    .where('userEmail','==',userEmail)
    .where('estado','==','pendiente')
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

  // Completar SIN reload
  div.querySelector('.btn-check').addEventListener('click', async () => {
    try{
      await d.collection('tareas').doc(t.id).update({ estado:'completado' });
      // mueve la tarjeta a Completados
      div.remove();
      $('#completados-container').appendChild(cardCompletada(t));
    }catch(e){ console.error(e); alert('No se pudo completar la tarea.'); }
  });

  // Ubicación simple
  div.querySelector('.btn-location').addEventListener('click', () => {
    alert(`Ubicación: Lat ${t.latitudCliente}, Lng ${t.longitudCliente}`);
  });

  return div;
}

// ===== Google Maps (con guard para evitar múltiples inits) =====
function initMap(){
  if (MAP_READY) return;
  MAP_READY = true;

  const initialPosition = { lat: -12.0453, lng: -77.0311 };
  map = new google.maps.Map(document.getElementById('map'), { center: initialPosition, zoom: 15 });
  marker = new google.maps.Marker({ position: initialPosition, map, title:'Tu ubicación' });

  // Forzar resize una vez pintado
  setTimeout(() => google.maps.event.trigger(map, 'resize'), 150);

  // Geolocalización con watch único
  if ('geolocation' in navigator){
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(
      p => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        marker.setPosition(pos);
        map.setCenter(pos);
      },
      err => console.warn('GPS:', err.message),
      { enableHighAccuracy:true, maximumAge:0, timeout:10000 }
    );
  }else{
    alert('Tu navegador no soporta geolocalización.');
  }
}
window.initMap = initMap; // callback del script de Google

// Limpieza al salir
window.addEventListener('beforeunload', () => {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
});
