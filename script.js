// Utilidad corta
const $ = (s) => document.querySelector(s);

// Footer
document.addEventListener('DOMContentLoaded', ()=>{
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
});

// Overlay helpers
function showOverlay(msg='Procesando…'){
  const o = $('#overlay'); if (!o) return;
  $('#overlay-msg').textContent = msg;
  o.classList.add('active');
  o.setAttribute('aria-hidden', 'false');
}
function hideOverlay(){
  const o = $('#overlay'); if (!o) return;
  o.classList.remove('active');
  o.setAttribute('aria-hidden', 'true');
}

// Banner de conectividad (opcional)
(function netBanner(){
  let banner;
  const ensure = ()=>{
    if (banner) return banner;
    banner = document.createElement('div');
    banner.className = 'net-banner';
    banner.innerHTML = '<div class="msg">Conexión restablecida</div>';
    document.body.appendChild(banner);
    return banner;
  };
  const show = (txt, off=false)=>{
    const b = ensure();
    const msg = b.querySelector('.msg');
    msg.textContent = txt;
    msg.classList.toggle('off', off);
    b.classList.add('show');
    setTimeout(()=> b.classList.remove('show'), 2500);
  };
  window.addEventListener('online',  ()=> show('Conexión restablecida'));
  window.addEventListener('offline', ()=> show('Sin conexión. Trabajando en modo offline', true));
})();

// Si ya hay sesión previa, podrías redirigir
if (window.auth){
  auth.onAuthStateChanged((user)=>{
    if (user){
      // window.location.href = 'menu.html';
      console.log('Sesión existente:', user.email);
    }
  });
}

// Iniciar sesión
$('#login-btn').addEventListener('click', async ()=>{
  const email = $('#username').value.trim();
  const password = $('#password').value.trim();

  if (!email || !password){
    alert('Por favor, completa todos los campos.');
    return;
  }

  // Primer login requiere conexión
  if (!navigator.onLine && (!auth || !auth.currentUser)){
    alert('No hay conexión. El primer inicio de sesión requiere internet.');
    return;
  }

  showOverlay('Validando credenciales…');

  try{
    // Asegura persistencia local (solo la primera vez)
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    const cred = await auth.signInWithEmailAndPassword(email, password);
    hideOverlay();
    if (cred.user){
      showOverlay('Cargando tu cuenta…');
      window.location.href = 'menu.html';
    }
  }catch(error){
    hideOverlay();

    // Mensaje más claro para network-request-failed
    if (error.code === 'auth/network-request-failed'){
      alert(
        'Error al iniciar sesión:\n' +
        'No se pudo llegar a Firebase.\n\n' +
        'Revisa:\n' +
        '• Firebase Console → Authentication → Authorized domains: agrega "localhost" y "127.0.0.1".\n' +
        '• Authentication → Sign-in method: habilita Email/Password.\n' +
        '• Conexión a internet (primer login requiere red).'
      );
      return;
    }

    switch(error.code){
      case 'auth/user-not-found':    alert('Usuario no encontrado.'); break;
      case 'auth/wrong-password':    alert('Contraseña incorrecta.'); break;
      case 'auth/too-many-requests': alert('Demasiados intentos. Intenta luego.'); break;
      default:                       alert('Error al iniciar sesión: ' + error.message); break;
    }
  }
});

// Recuperar contraseña
const fp = document.getElementById('forgot-password');
if (fp){
  fp.addEventListener('click', async ()=>{
    const email = $('#username').value.trim();
    if(!email){ alert('Ingresa tu correo para enviarte el enlace.'); return; }
    try{
      showOverlay('Enviando enlace…');
      await auth.sendPasswordResetEmail(email);
      hideOverlay();
      alert('Enlace enviado a tu correo.');
    }catch(e){
      hideOverlay();
      alert('No se pudo enviar: ' + e.message);
    }
  });
}
