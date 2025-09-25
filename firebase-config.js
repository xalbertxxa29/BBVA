// ⚠️ Claves públicas de Firebase (visibles en el front por diseño de Firebase).
// Mantener aquí separado del HTML por orden y reutilización.
const firebaseConfig = {
  apiKey: "AIzaSyC6V--xlNwoe5iB9QD8Y2s2SQ4M0yR0MmQ",
  authDomain: "bbva-37617.firebaseapp.com",
  projectId: "bbva-37617",
  storageBucket: "bbva-37617.firebasestorage.app",
  messagingSenderId: "923249356091",
  appId: "1:923249356091:web:e2e8a77bb33a55c37e9b1e"
};

// Inicializar Firebase una sola vez
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }

// Instancias globales (compat)
window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();

// Habilitar funcionamiento offline para Firestore
// - Lee datos previamente sincronizados sin conexión
// - Encola escrituras para sincronizar al volver la red
firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch((err)=>{
  console.warn('Firestore persistence no disponible:', err && err.code);
});

// Nota: Firebase Auth conserva la sesión en el dispositivo; si el usuario
// ya inició sesión alguna vez, la sesión se mantiene incluso sin red.
