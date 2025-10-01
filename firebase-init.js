// firebase-init.js
// Inicializa Firebase y exporta helpers simples en window.firebaseDB
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js"
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js"
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  doc,
  writeBatch,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js"

// Configuración de Firebase (mantén la tuya)
const firebaseConfig = {
  apiKey: "AIzaSyDnHQx0ann2v5cWVT-wvRjFke_BLG5anpo",
  authDomain: "datos-de-gabriel.firebaseapp.com",
  projectId: "datos-de-gabriel",
  storageBucket: "datos-de-gabriel.firebasestorage.app",
  messagingSenderId: "512812286319",
  appId: "1:512812286319:web:958a933d855100ef4e689a",
  measurementId: "G-0CQM7DJJHB",
}

const app = initializeApp(firebaseConfig)
try {
  getAnalytics(app)
} catch (e) {
  // Analytics puede fallar en entornos locales sin ventana segura
  console.warn('Firebase analytics no disponible:', e.message)
}

const db = getFirestore(app)

// Helpers simples para sincronizar colecciones locales (areas, products)
window.firebaseDB = {
  async getAreas() {
    console.log('[firebase] getAreas starting')
    const snap = await getDocs(collection(db, 'areas'))
    const areas = []
    snap.forEach((d) => areas.push(d.data()))
    console.log(`[firebase] getAreas loaded ${areas.length} docs`)
    return areas
  },

  async saveAreas(areas) {
    console.log('[firebase] saveAreas starting, count=', areas.length)
    const batch = writeBatch(db)
    const colRef = collection(db, 'areas')
    // Simplificamos: borramos todo y reescribimos
    const existing = await getDocs(colRef)
    existing.forEach((d) => batch.delete(doc(db, 'areas', d.id)))

    areas.forEach((a) => {
      const ref = doc(db, 'areas', a.id)
      batch.set(ref, a)
    })

    await batch.commit()
    console.log('[firebase] saveAreas success')
    return true
  },

  async getProducts() {
    console.log('[firebase] getProducts starting')
    const snap = await getDocs(collection(db, 'products'))
    const products = []
    snap.forEach((d) => products.push(d.data()))
    console.log(`[firebase] getProducts loaded ${products.length} docs`)
    return products
  },

  async saveProducts(products) {
    console.log('[firebase] saveProducts starting, count=', products.length)
    const batch = writeBatch(db)
    const colRef = collection(db, 'products')
    const existing = await getDocs(colRef)
    existing.forEach((d) => batch.delete(doc(db, 'products', d.id)))

    products.forEach((p) => {
      const ref = doc(db, 'products', p.id)
      batch.set(ref, p)
    })

    await batch.commit()
    console.log('[firebase] saveProducts success')
    return true
  },
}
