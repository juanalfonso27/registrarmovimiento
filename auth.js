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
        alert('Ingresa un nombre de usuario');
        return;
    }
    if (!password || password.length < 6) {
        alert('La contrasena debe tener al menos 6 caracteres');
        return;
    }

    try {
        const email = `${trimmedUsername}@domain.com`;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await upsertUserProfile(userCredential.user, {
            username: trimmedUsername,
            provider: 'password'
        });
        window.location.href = 'app.html';
    } catch (error) {
        alert('Error al registrar: ' + error.message);
    }
}

// Iniciar sesion con email/usuario
async function loginUser(username, password) {
    const trimmedUsername = cleanUsername(username);
    if (!trimmedUsername || !password) {
        alert('Completa usuario y contrasena');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, `${trimmedUsername}@domain.com`, password);
        window.location.href = 'app.html';
    } catch (error) {
        alert('Error al iniciar sesion: ' + error.message);
    }
}

// Iniciar sesion/registro con Google
async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await upsertUserProfile(result.user, { provider: 'google' });
        window.location.href = 'app.html';
    } catch (error) {
        console.error('Error con Google:', error);
        alert('No pudimos iniciar sesion con Google: ' + error.message);
    }
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
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            loginUser(username, password);
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                alert('Las contrasenas no coinciden');
                return;
            }
            registerUser(username, password);
        });
    }

    [googleLoginBtn, googleRegisterBtn].forEach((btn) => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                loginWithGoogle();
            });
        }
    });
});
