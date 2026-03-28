/* ============================================
   FIREBASE CONFIGURATION — ArtKing47
   Firestore + Storage + Auth
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
        // Check if Firebase SDK is loaded
        if (typeof firebase === 'undefined') {
            console.warn('[Firebase] SDK not loaded, falling back to localStorage');
            return false;
        }

        // Initialize app (prevent double init)
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            firebaseApp = firebase.apps[0];
        }

        db = firebase.firestore();
        storage = firebase.storage();
        auth = firebase.auth();
        firebaseReady = true;

        console.log('[Firebase] ✅ Initialized successfully');
        return true;
    } catch (error) {
        console.error('[Firebase] ❌ Initialization failed:', error);
        firebaseReady = false;
        return false;
    }
}

// ============================================
// FIRESTORE — Read / Write Site Data
// ============================================
const FIRESTORE_DOC = 'artking47_site/config';

/**
 * Load all site data from Firestore.
 * Falls back to DEFAULTS if no data exists.
 * @returns {Promise<Object|null>} site data or null on error
 */
async function firebaseLoadSiteData() {
    if (!firebaseReady || !db) return null;

    try {
        const doc = await db.doc(FIRESTORE_DOC).get();
        if (doc.exists) {
            console.log('[Firebase] ✅ Data loaded from Firestore');
            return doc.data();
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
 * Save all site data to Firestore.
 * @param {Object} data — the siteData object
 * @returns {Promise<boolean>} success
 */
async function firebaseSaveSiteData(data) {
    if (!firebaseReady || !db) return false;

    try {
        // Clean data — remove base64 images (they go to Storage)
        const cleanData = JSON.parse(JSON.stringify(data));

        // Add metadata
        cleanData._lastModified = firebase.firestore.FieldValue.serverTimestamp();
        cleanData._version = '2.0';

        await db.doc(FIRESTORE_DOC).set(cleanData, { merge: true });
        console.log('[Firebase] ✅ Data saved to Firestore');
        return true;
    } catch (error) {
        console.error('[Firebase] ❌ Error saving data:', error);
        return false;
    }
}

// ============================================
// FIREBASE STORAGE — Image Upload / Delete
// ============================================

/**
 * Upload an image file to Firebase Storage.
 * @param {File} file — the image file
 * @param {string} path — storage path (e.g., 'portfolio/project-1/img-0')
 * @returns {Promise<string|null>} download URL or null on error
 */
async function firebaseUploadImage(file, path) {
    if (!firebaseReady || !storage) return null;

    try {
        const storageRef = storage.ref(path);
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        console.log(`[Firebase Storage] ✅ Uploaded: ${path}`);
        return downloadURL;
    } catch (error) {
        console.error('[Firebase Storage] ❌ Upload error:', error);
        return null;
    }
}

/**
 * Delete an image from Firebase Storage.
 * @param {string} path — storage path
 * @returns {Promise<boolean>} success
 */
async function firebaseDeleteImage(path) {
    if (!firebaseReady || !storage) return false;

    try {
        await storage.ref(path).delete();
        console.log(`[Firebase Storage] ✅ Deleted: ${path}`);
        return true;
    } catch (error) {
        console.warn('[Firebase Storage] Delete error (may not exist):', error.code);
        return false;
    }
}

/**
 * Upload a base64 data URL to Firebase Storage and return the download URL.
 * @param {string} dataUrl — base64 data URL
 * @param {string} path — storage path
 * @returns {Promise<string|null>} download URL or null
 */
async function firebaseUploadBase64(dataUrl, path) {
    if (!firebaseReady || !storage) return null;

    try {
        const storageRef = storage.ref(path);
        const snapshot = await storageRef.putString(dataUrl, 'data_url');
        const downloadURL = await snapshot.ref.getDownloadURL();
        console.log(`[Firebase Storage] ✅ Base64 uploaded: ${path}`);
        return downloadURL;
    } catch (error) {
        console.error('[Firebase Storage] ❌ Base64 upload error:', error);
        return null;
    }
}

// ============================================
// FIREBASE AUTH — Admin Login
// ============================================

/**
 * Sign in admin with email/password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, error?: string}>}
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
 * @returns {Promise<boolean>}
 */
function firebaseIsAuthenticated() {
    if (!firebaseReady || !auth) return false;
    return auth.currentUser !== null;
}

/**
 * Listen to auth state changes.
 * @param {Function} callback — receives (user) or (null)
 */
function firebaseOnAuthStateChanged(callback) {
    if (!firebaseReady || !auth) return;
    auth.onAuthStateChanged(callback);
}
