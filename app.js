// Inicializar Firebase Auth
const auth = firebase.auth();

// Función para registrar un nuevo usuario (opcional)
async function registrarUsuario(email, password) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        console.log(`Usuario registrado: ${userCredential.user.email}`);
        alert(`Usuario registrado exitosamente: ${userCredential.user.email}`);
    } catch (error) {
        console.error("Error al registrar usuario:", error.message);
        alert(`Error: ${error.message}`);
    }
}

// Escuchar cambios en el estado de autenticación
auth.onAuthStateChanged(user => {
    if (user) {
        console.log(`Usuario autenticado: ${user.email}`);
    } else {
        console.log('No hay usuario autenticado.');
    }
});

// Registrar el Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registrado con éxito:', registration);

                // Verificar actualizaciones del Service Worker
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // Nueva versión disponible
                                console.log('Nueva versión disponible. Recarga para actualizar.');
                                alert('Se ha instalado una nueva versión de la aplicación. Recarga para actualizar.');
                            } else {
                                // Contenido cacheado por primera vez
                                console.log('El contenido está disponible offline.');
                            }
                        }
                    };
                };
            })
            .catch(error => {
                console.error('Error al registrar el Service Worker:', error);
            });
    });
}

// Notificar al usuario sobre el estado de conexión
window.addEventListener('offline', () => {
    alert('Te has desconectado. Algunas funciones pueden no estar disponibles.');
});

window.addEventListener('online', () => {
    alert('Has recuperado la conexión. Todas las funciones están disponibles.');
});
