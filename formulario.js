const a = window.auth;
const d = window.db;

let ubicacionMapa, userMarker, clienteMarker, clienteCircle;
let currentPosition = null;
let watchId = null;

// Tipo de tarea desde el modal del menú
function cargarTipoDeTarea(){
  const v = localStorage.getItem('tipoDeTarea');
  const el = document.getElementById('tipoTarea');
  if (v && el) el.value = v;
}

// Auth guard + encabezado
a.onAuthStateChanged(user=>{
  if(!user){ window.location.href='index.html'; return; }
  document.getElementById('fecha').innerText = new Date().toLocaleDateString();
  document.getElementById('user-name').innerText = user.displayName || 'Usuario';
  document.getElementById('user-email').innerText = user.email;
});

// ===== Menú lateral + overlay =====
const menuBtn = document.getElementById('menu-btn');
const sideMenu = document.getElementById('side-menu');
const globalOverlay = document.getElementById('globalOverlay');

menuBtn.addEventListener('click', ()=>{ sideMenu.classList.toggle('active'); globalOverlay.classList.toggle('active'); });
globalOverlay.addEventListener('click', ()=>{ sideMenu.classList.remove('active'); globalOverlay.classList.remove('active'); });

// ===== Mapa y geolocalización =====
function initUbicacionesMapa(){
  const cont = document.getElementById('ubicaciones-mapa');
  if(!cont){ console.error('Contenedor de mapa no existe'); return; }

  if (ubicacionMapa){
    google.maps.event.clearInstanceListeners(ubicacionMapa);
    [userMarker, clienteMarker].forEach(m=> m && m.setMap(null));
    if (clienteCircle) clienteCircle.setMap(null);
  }

  const initialPosition = { lat: -12.0453, lng: -77.0311 };
  ubicacionMapa = new google.maps.Map(cont,{ center:initialPosition, zoom:15 });

  userMarker = new google.maps.Marker({ map:ubicacionMapa, title:'Tu ubicación', icon:'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' });
  clienteMarker = new google.maps.Marker({ map:ubicacionMapa, title:'Ubicación del Cliente', icon:'http://maps.google.com/mapfiles/ms/icons/red-dot.png' });
  clienteCircle = new google.maps.Circle({ map:ubicacionMapa, radius:50, fillColor:'#FF0000', fillOpacity:.25, strokeColor:'#FF0000', strokeOpacity:.8, strokeWeight:2, clickable:false });

  trackUserLocation(pos=>{ currentPosition = pos; userMarker.setPosition(pos); ubicacionMapa.setCenter(pos); verificarDistancia(); });
}
window.initMap = initUbicacionesMapa; // callback del script de Maps

function trackUserLocation(cb){
  if (!navigator.geolocation){ alert('Tu navegador no soporta geolocalización.'); return; }
  if (watchId!==null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(
    p=> cb({ lat:p.coords.latitude, lng:p.coords.longitude }),
    e=> { console.warn('GPS error:', e.message); if(e.code===1) alert('Permiso de ubicación denegado.'); },
    { enableHighAccuracy:true, maximumAge:0, timeout:20000 }
  );
}

function solicitarPermisosGPS(){
  if (!navigator.geolocation){ alert('Tu navegador no soporta geolocalización.'); return; }
  navigator.geolocation.getCurrentPosition(()=>{},()=>{}, { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
}

function calcularDistancia(lat1,lng1,lat2,lng2){
  const R = 6371e3; const toRad=v=>v*Math.PI/180;
  const dLat = toRad(lat2-lat1); const dLng = toRad(lng2-lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function actualizarEstadoBoton(boton,deshabilitado,mensaje=''){
  boton.disabled = deshabilitado; boton.title = mensaje; boton.style.opacity = deshabilitado? '.5':'1';
}

function verificarDistancia(){
  const enviarBtn = document.getElementById('enviar');
  const clienteLat = parseFloat(document.getElementById('latitud').value);
  const clienteLng = parseFloat(document.getElementById('longitud').value);
  if (!currentPosition || isNaN(clienteLat) || isNaN(clienteLng)){
    actualizarEstadoBoton(enviarBtn,true,'Datos incompletos o ubicación no disponible.');
    return;
  }
  const d = calcularDistancia(currentPosition.lat,currentPosition.lng,clienteLat,clienteLng);
  if (d>50){ actualizarEstadoBoton(enviarBtn,true,`Distancia mayor a 50 m (${Math.round(d)}m).`); }
  else { actualizarEstadoBoton(enviarBtn,false,''); }
}

function actualizarClienteMapa(lat,lng){
  if (isNaN(lat)||isNaN(lng)) return;
  const pos = { lat:parseFloat(lat), lng:parseFloat(lng) };
  clienteMarker.setPosition(pos); ubicacionMapa.setCenter(pos); clienteCircle.setCenter(pos); verificarDistancia();
}

// ===== Dropdowns (Firestore) =====
async function populateDropdowns(){
  const clienteDropdown = document.getElementById('buscarCliente');
  const unidadDropdown  = document.getElementById('buscarUnidad');
  clienteDropdown.innerHTML = "<option value=''>Seleccionar cliente</option>";
  unidadDropdown.innerHTML  = "<option value=''>Seleccionar unidad</option>";
  try{
    const clientes = await d.collection('clientes').get();
    clientes.forEach(doc=>{
      const op=document.createElement('option'); op.value=doc.id; op.textContent=doc.id; clienteDropdown.appendChild(op);
    });
    clienteDropdown.addEventListener('change', async ()=>{
      const id = clienteDropdown.value; unidadDropdown.innerHTML = "<option value=''>Seleccionar unidad</option>";
      if (!id) return;
      const unidades = await d.collection(`clientes/${id}/unidades`).get();
      unidades.forEach(u=>{ const op=document.createElement('option'); op.value=u.id; op.textContent=u.id; unidadDropdown.appendChild(op); });
    });
  }catch(e){ console.error('Error al llenar desplegables:', e.message); }
}

// on change de unidad -> llenar campos + mapa
document.addEventListener('change', async (ev)=>{
  if (ev.target && ev.target.id==='buscarUnidad'){
    const clienteId = document.getElementById('buscarCliente').value;
    const unidadId  = document.getElementById('buscarUnidad').value;
    if (!clienteId || !unidadId) return;
    const doc = await d.doc(`clientes/${clienteId}/unidades/${unidadId}`).get();
    if (!doc.exists) return;
    const x = doc.data();
    document.getElementById('dniRuc').value = x.ruc || '';
    document.getElementById('departamento').value = x.departamento || '';
    document.getElementById('distrito').value = x.distrito || '';
    document.getElementById('direccion').value = x.direccion || '';
    document.getElementById('latitud').value = x.latitud || '';
    document.getElementById('longitud').value = x.longitud || '';
    actualizarClienteMapa(x.latitud, x.longitud);
  }
});

// Botones
document.getElementById('cancelar').addEventListener('click', ()=> window.location.href='menu.html');
document.getElementById('logout-btn').addEventListener('click', async ()=>{
  try{ await a.signOut(); location.href='index.html'; }catch(e){ alert('Error al cerrar sesión'); }
});

// Enviar tarea
document.getElementById('enviar').addEventListener('click', async ()=>{
  const user = a.currentUser; if(!user){ alert('No estás autenticado.'); return; }
  const clienteId = document.getElementById('buscarCliente').value;
  const unidadId  = document.getElementById('buscarUnidad').value;
  const dniRuc = document.getElementById('dniRuc').value;
  const departamento = document.getElementById('departamento').value;
  const distrito = document.getElementById('distrito').value;
  const direccion = document.getElementById('direccion').value;
  const latitudCliente = document.getElementById('latitud').value;
  const longitudCliente = document.getElementById('longitud').value;
  const tipoTarea = document.getElementById('tipoTarea').value;

  if (!clienteId || !unidadId || !tipoTarea || !latitudCliente || !longitudCliente){
    alert('Completa todos los campos antes de enviar.'); return;
  }

  const now = new Date();
  const tarea = {
    clienteId, unidadId, dniRuc, departamento, distrito, direccion,
    userId: user.uid, userEmail: user.email, tipoTarea,
    latitudCliente: parseFloat(latitudCliente), longitudCliente: parseFloat(longitudCliente),
    estado:'pendiente', fecha: now.toLocaleDateString(), hora: now.toLocaleTimeString()
  };

  try{
    const r = await d.collection('tareas').add(tarea); // offline: se encola si no hay red
    alert(`Tarea creada con éxito. ID: ${r.id}`);
    window.location.href = 'menu.html';
  }catch(e){ console.error(e); alert('Ocurrió un error al guardar la tarea.'); }
});

// Emergencia / recarga
document.getElementById('emergency-btn').addEventListener('click', ()=>{
  alert('Recargando información...');
  solicitarPermisosGPS(); initUbicacionesMapa(); populateDropdowns(); cargarTipoDeTarea();
  alert('Datos recargados.');
});

// Init
document.addEventListener('DOMContentLoaded', ()=>{
  cargarTipoDeTarea(); initUbicacionesMapa(); populateDropdowns();
});
