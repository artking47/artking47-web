/* ============================================
   FIREBASE CONFIGURATION — ArtKing47
   Firestore + Auth (Multi-document architecture)
   ============================================ */

// Firebase CDN modules are loaded via <script> tags in HTML.
// This file initializes Firebase and provides helper functions.

// ---- Firebase Config ----
const firebaseConfig = {
    apiKey: "AIzaSyC_2ANOIGdkqEkTZGD2S66QJ6FrMTSw1jU",
    authDomain: "artking-web.firebaseapp.com",
    projectId: "artking-web",
    storageBucket: "artking-web.firebasestorage.app",
    messagingSenderId: "285641638520",
    appId: "1:285641638520:web:316d9ac40f9f26f6b8638d"
};

// ---- Initialize Firebase ----
let firebaseApp = null;
let db = null;
let storage = null;
let auth = null;
let firebaseReady = false;

function initFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.warn('[Firebase] SDK not loaded, falling back to localStorage');
            return false;
        }

        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            firebaseApp = firebase.apps[0];
        }

        db = firebase.firestore();

        // Auth & Storage are optional — only loaded on admin page
        try { auth = firebase.auth(); } catch(e) { auth = null; }
        try { storage = firebase.storage(); } catch(e) { storage = null; }

        firebaseReady = true;
        console.log('[Firebase] ✅ Initialized (db=' + !!db + ', auth=' + !!auth + ')');
        return true;
    } catch (error) {
        console.error('[Firebase] ❌ Initialization failed:', error);
        firebaseReady = false;
        return false;
    }
}

// ============================================
// FIRESTORE — Multi-document Read / Write
// ============================================
// Cada sección se guarda en su PROPIO documento para evitar
// el límite de 1MB por documento de Firestore.
// Las imágenes base64 van en documentos separados.

const FIRESTORE_COLLECTION = 'artking47_site';

// Sections that get their own Firestore document
const FIRESTORE_SECTIONS = [
    'general', 'hero', 'about', 'portfolio',
    'services', 'testimonials', 'process', 'faq',
    'contact', 'config'
];

/**
 * Load ALL site data from Firestore (multi-document).
 * Reads each section from its own document and merges them.
 * @returns {Promise<Object|null>} merged site data or null
 */
async function firebaseLoadSiteData() {
    if (!firebaseReady || !db) return null;

    try {
        // Read all section documents in parallel
        const promises = FIRESTORE_SECTIONS.map(section =>
            db.collection(FIRESTORE_COLLECTION).doc(section).get()
        );
        const snapshots = await Promise.all(promises);

        let hasData = false;
        const merged = {};

        snapshots.forEach((snap, i) => {
            const section = FIRESTORE_SECTIONS[i];
            if (snap.exists) {
                const docData = snap.data();
                
                // DEBUG: Log raw data from each Firestore doc
                const keys = Object.keys(docData).filter(k => k !== '_lastModified' && k !== '_section');
                console.log(`[Firebase] 📄 ${section}: keys=[${keys.join(',')}]`);
                
                // Remove Firestore metadata
                delete docData._lastModified;
                delete docData._section;

                // For array sections, the data is stored under 'items' key
                if (docData.items && Array.isArray(docData.items)) {
                    console.log(`[Firebase] 📄 ${section}: ${docData.items.length} items, sample keys: [${docData.items[0] ? Object.keys(docData.items[0]).join(',') : 'empty'}]`);
                    merged[section] = docData.items;
                } else {
                    merged[section] = docData;
                }
                hasData = true;
            } else {
                console.log(`[Firebase] 📄 ${section}: NOT FOUND in Firestore`);
            }
        });

        if (hasData) {
            console.log('[Firebase] ✅ Data loaded from Firestore (multi-doc)');
            // DEBUG: log portfolio sample
            if (merged.portfolio && merged.portfolio[0]) {
                console.log('[Firebase] 🔍 Portfolio[0]:', JSON.stringify(merged.portfolio[0]).substring(0, 200));
            }
            if (merged.services && merged.services[0]) {
                console.log('[Firebase] 🔍 Services[0]:', JSON.stringify(merged.services[0]).substring(0, 200));
            }
            return merged;
        } else {
            console.log('[Firebase] No data in Firestore yet, using defaults');
            return null;
        }
    } catch (error) {
        console.error('[Firebase] ❌ Error loading data:', error);
        return null;
    }
}

/**
 * Save ALL site data to Firestore (multi-document).
 * Each section is saved as its own document to stay under 1MB limit.
 * @param {Object} data — the siteData object
 * @returns {Promise<boolean>} success
 */
async function firebaseSaveSiteData(data) {
    if (!firebaseReady || !db) return false;

    try {
        const batch = db.batch();
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();

        FIRESTORE_SECTIONS.forEach(section => {
            if (data[section] === undefined) return;

            const docRef = db.collection(FIRESTORE_COLLECTION).doc(section);
            let docData;

            // Arrays get wrapped in { items: [...] } because Firestore
            // documents must be objects, not arrays
            if (Array.isArray(data[section])) {
                docData = {
                    items: data[section],
                    _section: section,
                    _lastModified: timestamp
                };
            } else {
                docData = {
                    ...data[section],
                    _section: section,
                    _lastModified: timestamp
                };
            }

            batch.set(docRef, docData);
        });

        await batch.commit();
        console.log('[Firebase] ✅ Data saved to Firestore (multi-doc, ' + FIRESTORE_SECTIONS.length + ' docs)');
        return true;
    } catch (error) {
        console.error('[Firebase] ❌ Error saving data:', error);

        // If batch fails, try saving sections individually
        // (in case ONE section is too large)
        console.log('[Firebase] Retrying individual section saves...');
        let savedCount = 0;

        for (const section of FIRESTORE_SECTIONS) {
            if (data[section] === undefined) continue;
            try {
                const docRef = db.collection(FIRESTORE_COLLECTION).doc(section);
                let docData;

                if (Array.isArray(data[section])) {
                    docData = {
                        items: data[section],
                        _section: section,
                        _lastModified: firebase.firestore.FieldValue.serverTimestamp()
                    };
                } else {
                    docData = {
                        ...data[section],
                        _section: section,
                        _lastModified: firebase.firestore.FieldValue.serverTimestamp()
                    };
                }

                await docRef.set(docData);
                savedCount++;
                console.log(`[Firebase] ✅ Saved section: ${section}`);
            } catch (sectionErr) {
                console.error(`[Firebase] ❌ Failed to save section: ${section}`, sectionErr.message);
            }
        }

        return savedCount > 0;
    }
}

// ============================================
// FIREBASE AUTH — Admin Login
// ============================================

/**
 * Sign in admin with email/password.
 */
async function firebaseLogin(email, password) {
    if (!firebaseReady || !auth) {
        return { success: false, error: 'Firebase no está disponible' };
    }

    try {
        const credential = await auth.signInWithEmailAndPassword(email, password);
        console.log('[Firebase Auth] ✅ Logged in:', credential.user.email);
        return { success: true };
    } catch (error) {
        console.error('[Firebase Auth] ❌ Login error:', error.code);
        const messages = {
            'auth/user-not-found': 'Usuario no encontrado',
            'auth/wrong-password': 'Contraseña incorrecta',
            'auth/invalid-email': 'Email inválido',
            'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
            'auth/invalid-credential': 'Credenciales inválidas'
        };
        return { success: false, error: messages[error.code] || 'Error de autenticación' };
    }
}

/**
 * Sign out admin.
 */
async function firebaseLogout() {
    if (!firebaseReady || !auth) return;
    try {
        await auth.signOut();
        console.log('[Firebase Auth] ✅ Signed out');
    } catch (error) {
        console.error('[Firebase Auth] ❌ Logout error:', error);
    }
}

/**
 * Check if admin is currently authenticated.
 */
function firebaseIsAuthenticated() {
    if (!firebaseReady || !auth) return false;
    return auth.currentUser !== null;
}

/**
 * Listen to auth state changes.
 */
function firebaseOnAuthStateChanged(callback) {
    if (!firebaseReady || !auth) return;
    auth.onAuthStateChanged(callback);
}
