// Requiere que antes se carguen en el HTML:
//   https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js
//   https://www.gstatic.com/firebasejs/10.9.0/firebase-auth-compat.js
//   https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore-compat.js
//   https://www.gstatic.com/firebasejs/10.9.0/firebase-storage-compat.js

// Config de tu proyecto (corrigiendo storageBucket -> appspot.com)
const firebaseConfig = {
  apiKey: "AIzaSyC6V--xlNwoe5iB9QD8Y2s2SQ4M0yR0MmQ",
  authDomain: "bbva-37617.firebaseapp.com",
  projectId: "bbva-37617",
  storageBucket: "bbva-37617.appspot.com",
  messagingSenderId: "923249356091",
  appId: "1:923249356091:web:e2e8a77bb33a55c37e9b1e"
};

// Inicializa una sola vez
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

// Instancias globales para el resto de tu app
window.auth    = firebase.auth();
window.db      = firebase.firestore();
window.storage = firebase.storage();

// Habilitar modo offline de Firestore (cache + cola de escrituras)
firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch((err)=>{
  console.warn("Firestore persistence no disponible:", err && err.code);
});

// (Opcional) si la red de tu empresa/proxy bloquea WebSockets, habilita long-polling
try {
  firebase.firestore().settings({ experimentalAutoDetectLongPolling: true });
} catch (e) {
  /* no-op en versiones que no lo soporten */
}
