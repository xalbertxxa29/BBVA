// Usa auth y db de firebase-config.js
const a = window.auth;
const d = window.db;

let map, marker;

// Guard de sesión + datos de usuario
a.onAuthStateChanged(user => {
  if (!user) { window.location.href = 'index.html'; return; }
  document.getElementById('fecha').innerText = new Date().toLocaleDateString();
  document.getElementById('user-name').innerText = user.displayName || 'Usuario';
  document.getElementById('user-email').innerText = user.email;
  cargarTareasIniciadas(user.email);
  cargarTareasCompletadas(user.email);
});

// ===== Carga de tareas =====
function cargarTareasCompletadas(userEmail){
  const cont = document.getElementById('completados-container');
  cont.innerHTML = '';
  d.collection('tareas')
    .where('userEmail','==',userEmail).where('estado','==','completado')
    .get()
    .then(q=>{
      if (q.empty){ cont.innerHTML = '<p>No hay tareas completadas.</p>'; return; }
      q.forEach(doc=>{
        const t = { id:doc.id, ...doc.data() };
        cont.appendChild(cardCompletada(t));
      });
    })
    .catch(err=> console.error('Completados:', err));
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

function cargarTareasIniciadas(userEmail){
  const cont = document.getElementById('iniciados');
  cont.innerHTML = '<h2>Tareas Iniciadas</h2>';
  d.collection('tareas')
    .where('userEmail','==',userEmail).where('estado','==','pendiente')
    .get()
    .then(q=>{
      if (q.empty){ cont.insertAdjacentHTML('beforeend','<p>No hay tareas iniciadas.</p>'); return; }
      q.forEach(doc=>{
        const t = { id:doc.id, ...doc.data() };
        cont.appendChild(cardPendiente(t));
      });
    })
    .catch(err=> console.error('Iniciadas:', err));
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
  div.querySelector('.btn-check').addEventListener('click',()=> marcarCompletada(t.id));
  div.querySelector('.btn-location').addEventListener('click',()=>{
    alert(`Ubicación: Lat ${t.latitudCliente}, Lng ${t.longitudCliente}`);
  });
  return div;
}

async function marcarCompletada(id){
  try{
    await d.collection('tareas').doc(id).update({ estado:'completado' });
    location.reload();
  }catch(e){ console.error(e); alert('No se pudo completar la tarea.'); }
}

// ===== Sesión =====
document.getElementById('logout-btn').addEventListener('click', async ()=>{
  try{ await a.signOut(); location.href='index.html'; }catch(e){ alert('Error al cerrar sesión'); }
});

// ===== Menú lateral + overlay =====
const menuBtn = document.getElementById('menu-btn');
const sideMenu = document.getElementById('side-menu');
const globalOverlay = document.getElementById('globalOverlay');

menuBtn.addEventListener('click', ()=>{
  sideMenu.classList.toggle('active');
  globalOverlay.classList.toggle('active');
});
globalOverlay.addEventListener('click', ()=>{
  sideMenu.classList.remove('active');
  globalOverlay.classList.remove('active');
  closeModal();
});

// ===== Tabs =====
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
tabButtons.forEach(btn=>{
  btn.addEventListener('click',()=>{
    tabButtons.forEach(b=>b.classList.remove('active'));
    tabContents.forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ===== FAB + Modal =====
const fabContainer = document.querySelector('.fab-container');
const mainFab = document.getElementById('main-fab');
const modal = document.getElementById('modal');
const addFab = document.getElementById('add-fab');
const closeModalBtn = document.getElementById('close-modal');

mainFab.addEventListener('click', ()=> fabContainer.classList.toggle('open'));
addFab.addEventListener('click', ()=> openModal());
closeModalBtn.addEventListener('click', ()=> closeModal());

function openModal(){ modal.classList.add('active'); modal.setAttribute('aria-hidden','false'); }
function closeModal(){ modal.classList.remove('active'); modal.setAttribute('aria-hidden','true'); }

// Ir a formulario con el tipo guardado
modal.querySelectorAll('[data-tipo]').forEach(b=>{
  b.addEventListener('click',()=>{
    const tipoDeTarea = b.getAttribute('data-tipo');
    localStorage.setItem('tipoDeTarea', tipoDeTarea);
    window.location.href = 'formulario.html';
  });
});

// ===== Google Maps (mapa principal) =====
function initMap(){
  const initialPosition = { lat: -12.0453, lng: -77.0311 };
  map = new google.maps.Map(document.getElementById('map'),{ center:initialPosition, zoom:15 });
  marker = new google.maps.Marker({ position:initialPosition, map, title:'Tu ubicación' });
  trackUserLocation(pos=>{ marker.setPosition(pos); map.setCenter(pos); });
}
window.initMap = initMap; // callback del script de Maps

function trackUserLocation(cb){
  if(!navigator.geolocation){ alert('Tu navegador no soporta geolocalización.'); return; }
  navigator.geolocation.watchPosition(
    p=> cb({ lat:p.coords.latitude, lng:p.coords.longitude }),
    e=> console.error(e),
    { enableHighAccuracy:true, maximumAge:0, timeout:10000 }
  );
}
