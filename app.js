import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore, collection, query, where, getDocs, addDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

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

// Verificar si el usuario está autenticado
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Si no hay usuario autenticado, redirigir al login
        window.location.href = 'index.html';
    } else {
        // Cargar los datos del usuario
        loadUserData(user.uid);
    }
});

// Función para cargar los datos del usuario
async function loadUserData(userId) {
    try {
        // Obtener los movimientos del usuario
        const q = query(collection(db, 'movements'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        
        const movementsList = document.getElementById('movements-list');
        movementsList.innerHTML = ''; // Limpiar la lista

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const movementElement = document.createElement('div');
            movementElement.className = 'movement-item';
            movementElement.innerHTML = `
                <h3>${data.description}</h3>
                <p>Cantidad: $${data.amount}</p>
                <p>Fecha: ${new Date(data.date).toLocaleDateString()}</p>
            `;
            movementsList.appendChild(movementElement);
        });
    } catch (error) {
        console.error('Error al cargar los datos:', error);
    }
}

// Función para agregar un nuevo movimiento
async function addMovement(description, amount) {
    try {
        const user = auth.currentUser;
        if (!user) return;

        await addDoc(collection(db, 'movements'), {
            userId: user.uid,
            description,
            amount: parseFloat(amount),
            date: new Date().toISOString()
        });

        // Recargar los datos
        loadUserData(user.uid);
        
        // Limpiar el formulario
        document.getElementById('movement-form').reset();
    } catch (error) {
        console.error('Error al agregar movimiento:', error);
        alert('Error al agregar el movimiento');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Listener para el botón de cerrar sesión
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = 'index.html';
            });
        });
    }

    // Listener para el formulario de nuevo movimiento
    const movementForm = document.getElementById('movement-form');
    if (movementForm) {
        movementForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const description = document.getElementById('movement-description').value;
            const amount = document.getElementById('movement-amount').value;
            addMovement(description, amount);
        });
    }
});