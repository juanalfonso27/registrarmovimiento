import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

// Configuracion de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDjFqNeLUSVv0LkZ8QlC6H5G_ApPg1GT4Y",
    authDomain: "gabriel-bca01.firebaseapp.com",
    projectId: "gabriel-bca01",
    storageBucket: "gabriel-bca01.firebasestorage.app",
    messagingSenderId: "1680436733",
    appId: "1:1680436733:web:136f95ce654f66f1adfd94",
    measurementId: "G-CEKEMFPWPD"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function setStatus(message, type = 'info') {
    const el = document.getElementById('authMessage');
    if (!el) return;
    el.textContent = message;
    el.className = `status-message show ${type}`;
}

function clearStatus() {
    const el = document.getElementById('authMessage');
    if (!el) return;
    el.textContent = '';
    el.className = 'status-message';
}

function cleanUsername(username) {
    return (username || '').trim();
}

async function upsertUserProfile(user, extra = {}) {
    if (!user) return;

    const fallbackUsername = user.email ? user.email.split('@')[0] : 'usuario';
    const profile = {
        username: extra.username || user.displayName || fallbackUsername,
        email: user.email || '',
        provider: extra.provider || (user.providerData?.[0]?.providerId ?? 'password'),
        createdAt: extra.createdAt || user.metadata?.creationTime || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
    } catch (error) {
        console.error('No se pudo guardar el perfil del usuario', error);
    }
}

// Registrar usuarios con email/usuario
async function registerUser(username, password) {
    const trimmedUsername = cleanUsername(username);
    if (!trimmedUsername) {
        setStatus('Ingresa un nombre de usuario', 'error');
        return;
    }
    if (!password || password.length < 6) {
        setStatus('La contrasena debe tener al menos 6 caracteres', 'error');
        return;
    }

    try {
        const email = `${trimmedUsername}@domain.com`;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await upsertUserProfile(userCredential.user, {
            username: trimmedUsername,
            provider: 'password'
        });
        setStatus('Cuenta creada, redirigiendo...', 'success');
        window.location.href = 'app.html';
    } catch (error) {
        const message = friendlyAuthError(error, { username: trimmedUsername, stage: 'register' });
        setStatus(message, 'error');
    }
}

// Iniciar sesion con email/usuario
async function loginUser(username, password) {
    const trimmedUsername = cleanUsername(username);
    if (!trimmedUsername || !password) {
        setStatus('Completa usuario y contrasena', 'error');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, `${trimmedUsername}@domain.com`, password);
        setStatus('Accediendo...', 'success');
        window.location.href = 'app.html';
    } catch (error) {
        const message = friendlyAuthError(error, { username: trimmedUsername, stage: 'login' });
        setStatus(message, 'error');
    }
}

function friendlyAuthError(error, context = {}) {
    const code = error?.code || '';
    const name = context.username ? ` "${context.username}"` : '';
    const map = {
        'auth/invalid-credential': 'Usuario o contrasena incorrecta.',
        'auth/wrong-password': 'Contrasena incorrecta. Revisa mayusculas y vuelve a intentar.',
        'auth/user-not-found': `No encontramos la cuenta${name}. Revisa el usuario o registrate.`,
        'auth/too-many-requests': 'Demasiados intentos. Intenta nuevamente en unos minutos.',
        'auth/network-request-failed': 'Problema de conexion. Revisa tu red e intenta otra vez.',
        'auth/email-already-in-use': `Ese usuario${name} ya esta en uso. Inicia sesion o elige otro.`,
        'auth/invalid-email': 'El usuario ingresado no es valido. Intenta de nuevo.',
        'auth/internal-error': 'No pudimos completar la accion. Intenta de nuevo.',
    };
    const fallback = context.stage === 'register'
        ? 'No pudimos crear tu cuenta. Intenta de nuevo.'
        : 'No pudimos iniciar sesion. Intenta de nuevo.';
    return map[code] || fallback;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            clearStatus();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            loginUser(username, password);
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            clearStatus();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                setStatus('Las contrasenas no coinciden', 'error');
                return;
            }
            registerUser(username, password);
        });
    }
});
