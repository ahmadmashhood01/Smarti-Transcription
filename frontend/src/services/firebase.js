import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, where, orderBy, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'smartitranscription-e23ff.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || import.meta.env.REACT_APP_FIREBASE_APP_ID,
};

// Validate required config
if (!firebaseConfig.storageBucket) {
  console.error('Firebase Storage bucket is not configured! Please set VITE_FIREBASE_STORAGE_BUCKET in your .env file');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

/**
 * Upload audio file to Firebase Storage
 */
export async function uploadAudioFile(file, projectId, onProgress) {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const storagePath = `audio/${projectId}/${taskId}/${file.name}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) {
          onProgress(progress);
        }
      },
      (error) => {
        console.error('Upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            taskId,
            audioUrl: downloadURL,
            storagePath,
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

/**
 * Create a new task in Firestore
 * Returns the Firestore document ID (not the taskId from taskData)
 */
export async function createTask(projectId, taskData) {
  const tasksRef = collection(db, 'projects', projectId, 'tasks');
  // Remove 'id' from taskData if present - Firestore will generate its own document ID
  const { id, ...dataWithoutId } = taskData;
  const docRef = await addDoc(tasksRef, {
    ...dataWithoutId,
    originalTaskId: id, // Store original taskId for reference
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return docRef.id; // Return Firestore document ID
}

/**
 * Subscribe to tasks in a project (real-time)
 */
export function subscribeToTasks(projectId, callback) {
  const tasksRef = collection(db, 'projects', projectId, 'tasks');
  const q = query(tasksRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    // Filter out any null/undefined tasks (shouldn't happen, but safety check)
    const validTasks = tasks.filter(task => task && task.id);
    callback(validTasks);
  }, (error) => {
    console.error('Error in task subscription:', error);
    callback([]); // Return empty array on error
  });
}

/**
 * Subscribe to a single task (real-time)
 */
export function subscribeToTask(projectId, taskId, callback) {
  const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);

  return onSnapshot(taskRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() });
    } else {
      callback(null);
    }
  });
}

/**
 * Update a task
 */
export async function updateTask(projectId, taskId, data) {
  const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
  await updateDoc(taskRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete a task (from Firestore, Storage, and Label Studio)
 */
export async function deleteTask(projectId, taskId) {
  try {
    // Get task data first to access storagePath and labelStudioTaskId
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);
    
    if (!taskDoc.exists()) {
      // Task doesn't exist - it may have been already deleted
      // This is OK - the goal is to remove it from the UI, which will happen via the listener
      console.log('Task not found in Firestore (may have been already deleted):', taskId);
      return; // Return successfully - task is already gone
    }
    
    const taskData = taskDoc.data();
    
    // Delete from Label Studio if it exists (via backend API)
    if (taskData.labelStudioTaskId) {
      try {
        const { default: api } = await import('./api');
        await api.delete(`/api/label-studio/task/${taskId}`, {
          data: { projectId },
        });
        console.log('Deleted from Label Studio:', taskData.labelStudioTaskId);
      } catch (lsError) {
        // Don't fail if Label Studio task doesn't exist or is already deleted
        const errorMessage = lsError.response?.data?.error || lsError.message || 'Unknown error';
        if (errorMessage.includes('not found') || errorMessage.includes('404') || lsError.response?.status === 404) {
          console.log('Label Studio task not found (may have been already deleted), continuing...');
        } else {
          console.warn('Failed to delete from Label Studio (continuing):', errorMessage);
        }
        // Continue with Firebase deletion even if Label Studio deletion fails
      }
    }
    
    // Delete audio file from Storage if storagePath exists
    if (taskData.storagePath) {
      try {
        const storageRef = ref(storage, taskData.storagePath);
        await deleteObject(storageRef);
        console.log('Deleted audio file from Storage:', taskData.storagePath);
      } catch (storageError) {
        // Don't fail if file doesn't exist
        if (storageError.code === 'storage/object-not-found') {
          console.log('Audio file not found in Storage (may have been already deleted), continuing...');
        } else {
          console.warn('Failed to delete audio file from Storage (continuing):', storageError.message);
        }
        // Continue with Firestore deletion even if Storage deletion fails
      }
    }
    
    // Delete peaks.json if it exists
    if (taskData.peaksUrl || taskData.peaksPath) {
      try {
        // Extract path from peaksUrl or construct it
        const peaksPath = taskData.peaksPath || `peaks/${projectId}/${taskId}/peaks.json`;
        const peaksRef = ref(storage, peaksPath);
        await deleteObject(peaksRef);
        console.log('Deleted peaks.json from Storage');
      } catch (peaksError) {
        // Don't fail if file doesn't exist
        if (peaksError.code === 'storage/object-not-found') {
          console.log('Peaks file not found in Storage (may have been already deleted), continuing...');
        } else {
          console.warn('Failed to delete peaks.json (continuing):', peaksError.message);
        }
      }
    }
    
    // Finally, delete the Firestore document
    await deleteDoc(taskRef);
    console.log('Task deleted successfully from Firestore:', taskId);
  } catch (error) {
    // Only throw if it's a real error (not a "not found" case)
    if (error.code === 'permission-denied' || error.code === 'unavailable') {
      console.error('Error deleting task (permission or network issue):', error);
      throw error;
    }
    // For other errors, log but don't throw - the task may have been partially deleted
    console.warn('Error during task deletion (task may have been partially deleted):', error.message);
    // Try to delete from Firestore anyway to ensure it's removed from the UI
    try {
      const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
      await deleteDoc(taskRef);
      console.log('Task document removed from Firestore despite errors');
    } catch (finalError) {
      // If we can't delete from Firestore, this is a real error
      console.error('Failed to delete task document from Firestore:', finalError);
      throw finalError;
    }
  }
}

export { db, storage };

