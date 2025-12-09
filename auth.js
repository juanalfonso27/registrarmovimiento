import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
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

// Fallback to show inline status instead of popups if something calls alert
window.alert = (msg) => setStatus(msg, 'error');

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

function cleanEmail(email) {
    return (email || '').trim();
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
async function registerUser(email, password) {
    const trimmedEmail = cleanEmail(email);
    if (!trimmedEmail) {
        setStatus('Ingresa tu correo', 'error');
        return;
    }
    if (!trimmedEmail.includes('@')) {
        setStatus('El correo no es valido', 'error');
        return;
    }
    if (!password || password.length < 6) {
        setStatus('La contrasena debe tener al menos 6 caracteres', 'error');
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await upsertUserProfile(userCredential.user, {
            username: trimmedEmail.split('@')[0],
            provider: 'password'
        });
        setStatus('Cuenta creada, redirigiendo...', 'success');
        window.location.href = 'app.html';
    } catch (error) {
        const message = friendlyAuthError(error, { email: trimmedEmail, stage: 'register' });
        setStatus(message, 'error');
    }
}

// Iniciar sesion con email/usuario
async function loginUser(email, password) {
    const trimmedEmail = cleanEmail(email);
    if (!trimmedEmail || !password) {
        setStatus('Completa correo y contrasena', 'error');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
        setStatus('Accediendo...', 'success');
        window.location.href = 'app.html';
    } catch (error) {
        const message = friendlyAuthError(error, { email: trimmedEmail, stage: 'login' });
        setStatus(message, 'error');
    }
}

async function resetPassword(email) {
    const trimmedEmail = cleanEmail(email);
    if (!trimmedEmail) {
        setStatus('Ingresa tu correo para enviarte la recuperacion.', 'error');
        return;
    }
    if (!trimmedEmail.includes('@')) {
        setStatus('El correo no es valido', 'error');
        return;
    }
    try {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setStatus(`Enviamos un correo a ${trimmedEmail}. Revisa tu bandeja (y spam).`, 'success');
    } catch (error) {
        const message = friendlyAuthError(error, { email: trimmedEmail, stage: 'reset' });
        setStatus(message, 'error');
    }
}

function friendlyAuthError(error, context = {}) {
    const code = error?.code || '';
    const name = context.email ? ` "${context.email}"` : '';
    const map = {
        'auth/invalid-credential': 'Correo o contrasena incorrecta.',
        'auth/wrong-password': 'Contrasena incorrecta. Revisa mayusculas y vuelve a intentar.',
        'auth/user-not-found': `No encontramos la cuenta${name}. Revisa el correo o registrate.`,
        'auth/too-many-requests': 'Demasiados intentos. Intenta nuevamente en unos minutos.',
        'auth/network-request-failed': 'Problema de conexion. Revisa tu red e intenta otra vez.',
        'auth/email-already-in-use': `Ese correo${name} ya esta en uso. Inicia sesion o usa otro.`,
        'auth/invalid-email': 'El correo ingresado no es valido. Intenta de nuevo.',
        'auth/internal-error': 'No pudimos completar la accion. Intenta de nuevo.',
        'auth/missing-email': 'Ingresa tu usuario para recuperar la contrasena.',
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
    const resetLink = document.getElementById('resetLink');
    const resetBtn = document.getElementById('resetBtn');
    const resetEmailInput = document.getElementById('resetEmail');
    const resetCard = document.getElementById('resetCard');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            clearStatus();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            loginUser(email, password);
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            clearStatus();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                setStatus('Las contrasenas no coinciden', 'error');
                return;
            }
            registerUser(email, password);
        });
    }

    if (resetLink) {
        resetLink.addEventListener('click', (e) => {
            e.preventDefault();
            clearStatus();
            const emailInput = document.getElementById('email');
            const email = emailInput ? emailInput.value : '';
            if (resetEmailInput && email) {
                resetEmailInput.value = email;
            }
            if (resetEmailInput) {
                resetEmailInput.focus();
            }
            if (resetCard) resetCard.classList.remove('hidden');
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearStatus();
            const email = resetEmailInput ? resetEmailInput.value : '';
            resetPassword(email);
        });
    }
});
