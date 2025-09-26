// menu.js — FAB dinámico + modal con despegable

const auth = window.auth;
const $ = s => document.querySelector(s);

// ===== Menú lateral =====
(function sideMenu(){
  const menuBtn = $('#menu-btn'), scrim = $('#scrim'), aside = $('#side-menu');
  const open = ()=>{ aside.classList.add('active'); scrim.classList.add('active'); aside.setAttribute('aria-hidden','false'); };
  const close= ()=>{ aside.classList.remove('active'); scrim.classList.remove('active'); aside.setAttribute('aria-hidden','true'); };
  menuBtn.addEventListener('click', open);
  scrim.addEventListener('click', close);
})();

// ===== Tabs =====
(function tabs(){
  const btns = document.querySelectorAll('.tab-btn');
  btns.forEach(b=>{
    b.addEventListener('click', ()=>{
      btns.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const id = b.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      $('#tab-' + id).classList.add('active');
    });
  });
})();

document.addEventListener('DOMContentLoaded', ()=>{
  $('#today').textContent = new Date().toLocaleDateString();
  auth.onAuthStateChanged(user=>{
    if (!user) { location.href='index.html'; return; }
    $('#user-email').textContent = user.email || 'Usuario';
  });

  // ===== FAB
  const wrap = $('#fab');
  const more = $('#fab-more');
  const plus = $('#fab-plus');
  const opt  = $('#fab-options');

  const toggle = ()=>{
    const isOpen = wrap.classList.toggle('open');
    more.setAttribute('aria-expanded', String(isOpen));
    opt.style.display = isOpen ? 'flex' : 'none';
  };
  more.addEventListener('click', toggle);

  // Abrir modal directamente desde +
  plus.addEventListener('click', (e)=>{
    e.preventDefault();
    wrap.classList.remove('open');
    more.setAttribute('aria-expanded','false');
    opt.style.display = 'none';
    openNewModal();
  });

  // ===== Modal
  const overlay = $('#new-overlay');
  const select  = $('#new-type');
  const btnOk   = $('#new-continue');
  const btnCancel = $('#new-cancel');

  function openNewModal(){
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden','false');
    // foco al select para UX
    setTimeout(()=> select.focus(), 50);
  }
  window.openNewModal = openNewModal; // por si se llama desde otros lugares

  function closeNewModal(){
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden','true');
  }

  btnCancel.addEventListener('click', closeNewModal);
  // cerrar tocando fuera de la tarjeta
  overlay.addEventListener('click', (ev)=>{
    if (ev.target === overlay) closeNewModal();
  });
  // cerrar con ESC
  document.addEventListener('keydown', (ev)=>{
    if (overlay.classList.contains('active') && ev.key === 'Escape') closeNewModal();
  });

  btnOk.addEventListener('click', ()=>{
    const v = select.value;
    if (!v){ alert('Elige una opción.'); return; }
    closeNewModal();
    if (v === 'ofi') location.href = 'formularioof.html';
    if (v === 'caj') location.href = 'formulariocaj.html';
  });

  // ===== MAPA + GPS (simple, sin bloquear UI)
  let map, meMarker, watchId=null, lastUserPos=null;
  window.initMap = function initMap(){
    const initial = { lat:-12.05, lng:-77.05 };
    map = new google.maps.Map(document.getElementById('map'), { center: initial, zoom: 13 });
    setTimeout(()=> google.maps.event.trigger(map,'resize'), 150);
  };

  function watchLocation(){
    if (!('geolocation' in navigator)) return;
    if (watchId!==null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(
      p=>{
        lastUserPos = { lat:p.coords.latitude, lng:p.coords.longitude };
        if (!window.google || !map) return;
        if (!meMarker){
          meMarker = new google.maps.Marker({
            map, position:lastUserPos, title:'Tu ubicación',
            icon:'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          });
        }else meMarker.setPosition(lastUserPos);
        map.setCenter(lastUserPos);
      },
      e=>console.warn('GPS:', e.message),
      { enableHighAccuracy:true, maximumAge:0, timeout:12000 }
    );
  }
  // iniciar siempre y reintentar al primer gesto
  try{ watchLocation(); }catch{}
  document.addEventListener('pointerdown', function once(){
    if (!lastUserPos) watchLocation();
    document.removeEventListener('pointerdown', once);
  }, { once:true });

  // ===== Logout
  $('#logout').addEventListener('click', async ()=>{
    try{ await auth.signOut(); }catch(e){ console.error(e); }
    location.href = 'index.html';
  });
});
