// Inicializa Firebase en el navegador usando módulos CDN (no requiere bundler)
// Exporta referencias útiles en window para que el resto de la app las use.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js'
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js'
import { getFirestore, enablePersistence } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js'
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js'
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js'

// Configuración proporcionada
const firebaseConfig = {
  apiKey: "AIzaSyDjFqNeLUSVv0LkZ8QlC6H5G_ApPg1GT4Y",
  authDomain: "gabriel-bca01.firebaseapp.com",
  projectId: "gabriel-bca01",
  storageBucket: "gabriel-bca01.firebasestorage.app",
  messagingSenderId: "1680436733",
  appId: "1:1680436733:web:136f95ce654f66f1adfd94",
  measurementId: "G-CEKEMFPWPD"
}

// Inicializa
const firebaseApp = initializeApp(firebaseConfig)
let analytics = null
try {
  analytics = getAnalytics(firebaseApp)
} catch (err) {
  // Analytics puede fallar en entornos locales o brotando restringido
  console.warn('Firebase Analytics no disponible:', err.message)
}

// Inicializa otros SDKs
const db = getFirestore(firebaseApp)
// Habilita la persistencia offline
enablePersistence(db)
  .then(() => console.log('Firestore offline persistence enabled'))
  .catch((err) => console.warn('Error enabling offline persistence:', err))
const auth = getAuth(firebaseApp)
const storage = getStorage(firebaseApp)

// Exponer en window para uso sencillo desde script.js
window.firebaseApp = firebaseApp
window.firebaseAnalytics = analytics
window.firebaseDB = db
window.firebaseAuth = auth
window.firebaseStorage = storage

console.log('Firebase inicializado', { app: firebaseApp, analytics })

// Ejemplo: función simple para escribir una colección de prueba
export async function saveTestDoc() {
  const { doc, setDoc, collection } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js')
  try {
    const ref = doc(collection(db, 'test-areas'), Math.random().toString(36).slice(2, 9))
    await setDoc(ref, { created: new Date().toISOString(), note: 'prueba desde firebase-init' })
    console.log('Documento de prueba guardado')
  } catch (err) {
    console.error('Error guardando doc de prueba', err)
  }
}

// Notify the page that Firebase is ready so other scripts can sync
try {
  window.dispatchEvent(new CustomEvent('firebase-ready', { detail: { app: firebaseApp } }))
} catch (err) {
  console.warn('No se pudo emitir evento firebase-ready:', err && err.message)
}
