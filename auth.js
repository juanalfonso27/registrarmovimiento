import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup
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
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const LAST_PROVIDER_KEY = 'agro-last-provider';

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

function rememberProvider(provider) {
    try {
        localStorage.setItem(LAST_PROVIDER_KEY, provider);
    } catch (e) {
        console.warn('No se pudo guardar el proveedor usado', e);
    }
}

function applyLastProviderPreference() {
    const last = (() => {
        try { return localStorage.getItem(LAST_PROVIDER_KEY); } catch (e) { return null; }
    })();
    const googleButtons = [document.getElementById('googleLoginBtn'), document.getElementById('googleRegisterBtn')].filter(Boolean);
    const notice = document.getElementById('googleNotice');
    if (last === 'google') {
        googleButtons.forEach(btn => btn.classList.add('hidden'));
        if (notice) notice.classList.remove('hidden');
    } else {
        googleButtons.forEach(btn => btn.classList.remove('hidden'));
        if (notice) notice.classList.add('hidden');
    }
}

function enableShowGoogleAgain() {
    const trigger = document.getElementById('showGoogleAgain');
    if (!trigger) return;
    trigger.addEventListener('click', () => {
        try { localStorage.removeItem(LAST_PROVIDER_KEY); } catch (e) { /* ignore */ }
        applyLastProviderPreference();
    });
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
        rememberProvider('password');
        setStatus('Cuenta creada, redirigiendo...', 'success');
        window.location.href = 'app.html';
    } catch (error) {
        const message = friendlyAuthError(error);
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
        rememberProvider('password');
        setStatus('Accediendo...', 'success');
        window.location.href = 'app.html';
    } catch (error) {
        const message = friendlyAuthError(error);
        setStatus(message, 'error');
    }
}

// Iniciar sesion/registro con Google
async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await upsertUserProfile(result.user, { provider: 'google' });
        rememberProvider('google');
        setStatus('Accediendo con Google...', 'success');
        window.location.href = 'app.html';
    } catch (error) {
        console.error('Error con Google:', error);
        const message = friendlyAuthError(error);
        setStatus(message, 'error');
    }
}

function friendlyAuthError(error) {
    const code = error?.code || '';
    const map = {
        'auth/invalid-credential': 'Usuario o contrasena incorrecta.',
        'auth/wrong-password': 'Contrasena incorrecta.',
        'auth/user-not-found': 'No encontramos esa cuenta.',
        'auth/too-many-requests': 'Demasiados intentos. Intenta nuevamente en unos minutos.',
        'auth/popup-blocked': 'El navegador bloqueo la ventana de Google. Permite el popup y reintenta.',
        'auth/popup-closed-by-user': 'Cerraste el popup de Google. Intenta de nuevo.',
        'auth/network-request-failed': 'Problema de conexion. Revisa tu red e intenta otra vez.',
        'auth/unauthorized-domain': 'Dominio no autorizado en Firebase. Verifica la configuracion.',
    };
    return map[code] || 'No pudimos completar la accion. Intenta de nuevo.';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const googleRegisterBtn = document.getElementById('googleRegisterBtn');

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

    [googleLoginBtn, googleRegisterBtn].forEach((btn) => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                clearStatus();
                loginWithGoogle();
            });
        }
    });

    applyLastProviderPreference();
    enableShowGoogleAgain();
});
