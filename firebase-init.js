// firebase-init.js
// Inicializa Firebase y exporta helpers simples en window.firebaseDB
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js"
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js"
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  doc,
  writeBatch,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"

// Configuración de Firebase (tu nuevo proyecto)
const firebaseConfig = {
  apiKey: "AIzaSyDjFqNeLUSVv0LkZ8QlC6H5G_ApPg1GT4Y",
  authDomain: "gabriel-bca01.firebaseapp.com",
  projectId: "gabriel-bca01",
  storageBucket: "gabriel-bca01.firebasestorage.app",
  messagingSenderId: "1680436733",
  appId: "1:1680436733:web:136f95ce654f66f1adfd94",
  measurementId: "G-CEKEMFPWPD",
}

const app = initializeApp(firebaseConfig)
try {
  getAnalytics(app)
} catch (e) {
  // Analytics puede fallar en entornos locales sin ventana segura
  console.warn('Firebase analytics no disponible:', e && e.message ? e.message : e)
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
    
    // Primero eliminar todos los documentos existentes
    const snapshot = await getDocs(colRef)
    snapshot.forEach((doc) => {
      batch.delete(doc.ref)
    })
    
    // Luego agregar los nuevos documentos
    areas.forEach((area) => {
      const docRef = doc(colRef)
      batch.set(docRef, area)
    })
    
    await batch.commit()
    console.log('[firebase] saveAreas completed')
  },

  async saveProducts(products) {
    console.log('[firebase] saveProducts starting, count=', products.length)
    const batch = writeBatch(db)
    const colRef = collection(db, 'products')
    
    // Primero eliminar todos los documentos existentes
    const snapshot = await getDocs(colRef)
    snapshot.forEach((doc) => {
      batch.delete(doc.ref)
    })
    
    // Luego agregar los nuevos documentos
    products.forEach((product) => {
      const docRef = doc(colRef)
      batch.set(docRef, product)
    })
    
    await batch.commit()
    console.log('[firebase] saveProducts completed')
  },

  async getProducts() {
    console.log('[firebase] getProducts starting')
    const snap = await getDocs(collection(db, 'products'))
    const products = []
    snap.forEach((d) => products.push(d.data()))
    console.log(`[firebase] getProducts loaded ${products.length} docs`)
    return products
  }
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
