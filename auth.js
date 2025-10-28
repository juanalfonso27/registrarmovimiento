import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

// Configuración de Firebase
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

// Función para registrar usuarios
async function registerUser(username, password) {
    try {
        // Crear usuario con email (usando username como email para simplificar)
        const userCredential = await createUserWithEmailAndPassword(auth, `${username}@domain.com`, password);
        const user = userCredential.user;

        // Guardar información adicional del usuario en Firestore
        await setDoc(doc(db, 'users', user.uid), {
            username: username,
            createdAt: new Date().toISOString()
        });

        window.location.href = 'app.html';
    } catch (error) {
        alert('Error al registrar: ' + error.message);
    }
}

// Función para iniciar sesión
async function loginUser(username, password) {
    try {
        // Login con email (usando username como email para simplificar)
        const userCredential = await signInWithEmailAndPassword(auth, `${username}@domain.com`, password);
        window.location.href = 'app.html';
    } catch (error) {
        alert('Error al iniciar sesión: ' + error.message);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

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
                alert('Las contraseñas no coinciden');
                return;
            }
            registerUser(username, password);
        });
    }
});