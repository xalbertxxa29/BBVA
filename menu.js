// menu.js — FAB dinámico + modal con despegable + mapa
(() => {
  const $ = s => document.querySelector(s);
  const auth = window.auth;

  // ===== Menú lateral =====
  (function sideMenu(){
    const menuBtn = $('#menu-btn'), scrim = $('#scrim'), aside = $('#side-menu');
    const open = ()=>{ aside.classList.add('active'); scrim.classList.add('active'); aside.setAttribute('aria-hidden','false'); };
    const close= ()=>{ aside.classList.remove('active'); scrim.classList.remove('active'); aside.setAttribute('aria-hidden','true'); };
    menuBtn?.addEventListener('click', open);
    scrim?.addEventListener('click', close);
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
        document.getElementById('tab-' + id)?.classList.add('active');
      });
    });
  })();

  // ===== Mapa (callback global para Google Maps) =====
  let map, meMarker, watchId=null, lastUserPos=null;
  function initMap(){
    const initial = { lat:-12.05, lng:-77.05 };
    map = new google.maps.Map(document.getElementById('map'), { center: initial, zoom: 13 });
    setTimeout(()=> google.maps.event.trigger(map,'resize'), 150);
  }
  window.initMap = initMap;

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

  document.addEventListener('DOMContentLoaded', ()=>{
    $('#today').textContent = new Date().toLocaleDateString();

    auth?.onAuthStateChanged(user=>{
      if (!user) { location.href='index.html'; return; }
      $('#user-email').textContent = user.email || 'Usuario';
    });

    // GPS siempre
    try{ watchLocation(); }catch{}
    document.addEventListener('pointerdown', function once(){
      if (!lastUserPos) watchLocation();
      document.removeEventListener('pointerdown', once);
    }, { once:true });

    // ===== FAB (⋮ abre/oculta +) =====
    const wrap = $('#fab');
    const more = $('#fab-more');
    const plus = $('#fab-plus');
    const opt  = $('#fab-options');

    const openFab = ()=>{
      wrap.classList.add('open');
      more.setAttribute('aria-expanded','true');
      opt.classList.add('open');
      // forzar visibilidad aunque el CSS no tenga la clase
      opt.style.display = 'flex';
    };
    const closeFab = ()=>{
      wrap.classList.remove('open');
      more.setAttribute('aria-expanded','false');
      opt.classList.remove('open');
      opt.style.display = 'none';
    };
    const toggleFab = ()=>{
      const isOpen = wrap.classList.contains('open');
      isOpen ? closeFab() : openFab();
    };

    more?.addEventListener('click', toggleFab);
    // soporte táctil si el webview filtra 'click'
    more?.addEventListener('touchend', (e)=>{ e.preventDefault(); toggleFab(); }, {passive:false});

    // ===== Modal Nueva Tarea =====
    const overlay = $('#new-overlay');
    const select  = $('#new-type');
    const btnOk   = $('#new-continue');
    const btnCancel = $('#new-cancel');

    function openNewModal(){
      overlay.classList.add('active'); overlay.setAttribute('aria-hidden','false');
      setTimeout(()=> select.focus(), 50);
    }
    function closeNewModal(){
      overlay.classList.remove('active'); overlay.setAttribute('aria-hidden','true');
    }

    // El + abre el modal
    plus?.addEventListener('click', (e)=>{
      e.preventDefault();
      closeFab();
      openNewModal();
    });
    plus?.addEventListener('touchend', (e)=>{ e.preventDefault(); closeFab(); openNewModal(); }, {passive:false});

    btnCancel?.addEventListener('click', closeNewModal);
    overlay?.addEventListener('click', (ev)=>{ if (ev.target===overlay) closeNewModal(); });
    document.addEventListener('keydown', (ev)=>{ if (overlay.classList.contains('active') && ev.key==='Escape') closeNewModal(); });

    btnOk?.addEventListener('click', ()=>{
      const v = select.value;
      if (!v){ alert('Elige una opción.'); return; }
      closeNewModal();
      if (v === 'ofi') location.href = 'formularioof.html';
      if (v === 'caj') location.href = 'formulariocaj.html';
    });

    // ===== Logout =====
    $('#logout')?.addEventListener('click', async ()=>{
      try{ await auth.signOut(); }catch(e){ console.error(e); }
      location.href = 'index.html';
    });
  });
})();
