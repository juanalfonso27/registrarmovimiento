// firebase-init.js
import {
  collection,
  getDocs,
  setDoc,
  doc,
  writeBatch,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"

// Esperar a que db esté disponible
let db;
const waitForDb = new Promise((resolve) => {
  const checkDb = () => {
    if (window.db) {
      db = window.db;
      resolve();
    } else {
      setTimeout(checkDb, 100);
    }
  };
  checkDb();
});

// Crear las funciones de Firebase después de que db esté disponible
const initFirebase = async () => {
  await waitForDb;
  
  window.firebaseDB = {
    async getAreas() {
      try {
        console.log('[firebase] getAreas starting');
        const snap = await getDocs(collection(db, 'areas'));
        const areas = [];
        snap.forEach((doc) => {
          areas.push({ ...doc.data(), id: doc.id });
        });
        console.log(`[firebase] getAreas loaded ${areas.length} docs`);
        return areas;
      } catch (error) {
        console.error('[firebase] Error getting areas:', error);
        throw error;
      }
    },

    async saveAreas(areas) {
      try {
        console.log('[firebase] saveAreas starting, count=', areas.length);
        const batch = writeBatch(db);
        const areasRef = collection(db, 'areas');

        // Obtener y eliminar documentos existentes
        const snapshot = await getDocs(areasRef);
        snapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Agregar nuevos documentos
        areas.forEach((area) => {
          const newDoc = doc(areasRef);
          batch.set(newDoc, area);
        });

        await batch.commit();
        console.log('[firebase] saveAreas completed successfully');
      } catch (error) {
        console.error('[firebase] Error saving areas:', error);
        throw error;
      }
    },

    async getProducts() {
      try {
        console.log('[firebase] getProducts starting');
        const snap = await getDocs(collection(db, 'products'));
        const products = [];
        snap.forEach((doc) => {
          products.push({ ...doc.data(), id: doc.id });
        });
        console.log(`[firebase] getProducts loaded ${products.length} docs`);
        return products;
      } catch (error) {
        console.error('[firebase] Error getting products:', error);
        throw error;
      }
    },

    async saveProducts(products) {
      try {
        console.log('[firebase] saveProducts starting, count=', products.length);
        const batch = writeBatch(db);
        const productsRef = collection(db, 'products');

        // Obtener y eliminar documentos existentes
        const snapshot = await getDocs(productsRef);
        snapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Agregar nuevos documentos
        products.forEach((product) => {
          const newDoc = doc(productsRef);
          batch.set(newDoc, product);
        });

        await batch.commit();
        console.log('[firebase] saveProducts completed successfully');
      } catch (error) {
        console.error('[firebase] Error saving products:', error);
        throw error;
      }
    }
  };
};

// Inicializar Firebase
initFirebase().catch(console.error);