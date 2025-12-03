const admin = require('firebase-admin');

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
  if (firebaseInitialized) {
    console.log('Firebase already initialized');
    return admin;
  }

  try {
    // Check if running in Firebase Cloud Functions environment
    if (process.env.FUNCTIONS_EMULATOR || process.env.K_SERVICE) {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized (Cloud Functions)');
    } else {
      // Local development - use service account key
      const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      if (!serviceAccount) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
      }

      admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccount)),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
      });
      
      console.log('✅ Firebase Admin initialized (Local)');
    }

    firebaseInitialized = true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    throw error;
  }

  return admin;
}

/**
 * Get Firestore instance
 */
function getFirestore() {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return admin.firestore();
}

/**
 * Get Storage instance
 */
function getStorage() {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return admin.storage();
}

module.exports = {
  initializeFirebase,
  getFirestore,
  getStorage,
  admin,
};

