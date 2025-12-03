import axios from 'axios';

const API_URL = import.meta.env.REACT_APP_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
const LABEL_STUDIO_URL = import.meta.env.REACT_APP_LABEL_STUDIO_URL || import.meta.env.VITE_LABEL_STUDIO_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

/**
 * Export a task in the specified format
 */
export async function exportTask(taskId, format = 'srt', projectId = 'default') {
  const response = await api.get(`/api/export/${taskId}`, {
    params: { format, projectId },
    responseType: 'blob',
  });

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;

  // Get filename from Content-Disposition header or generate one
  const contentDisposition = response.headers['content-disposition'];
  let filename = `transcription.${format}`;
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return { success: true, filename };
}

/**
 * Export multiple tasks in batch
 */
export async function exportBatch(taskIds, format = 'srt', projectId = 'default') {
  const response = await api.post('/api/export/batch', {
    taskIds,
    format,
    projectId,
  });

  return response.data;
}

/**
 * Create a task in Label Studio
 */
export async function createLabelStudioTask(taskId, projectId = 'default') {
  try {
    const response = await api.post('/api/label-studio/create', {
      taskId,
      projectId,
    });
    return response.data;
  } catch (error) {
    console.error('Create Label Studio task error:', error);
    throw error;
  }
}

/**
 * Sync annotations from Label Studio to Firestore
 */
export async function syncLabelStudioAnnotations(taskId, projectId = 'default') {
  const response = await api.post(`/api/label-studio/sync/${taskId}`, {
    projectId,
  });

  return response.data;
}

/**
 * Get Label Studio task URL
 */
export async function getLabelStudioTaskUrl(taskId, projectId = 'default') {
  const response = await api.get(`/api/label-studio/task/${taskId}`, {
    params: { projectId },
  });

  return response.data;
}

/**
 * Open task in Label Studio (new tab)
 */
export function openInLabelStudio(labelStudioTaskId, projectId = '1') {
  const url = `${LABEL_STUDIO_URL}/projects/${projectId}/data?tab=1&task=${labelStudioTaskId}`;
  window.open(url, '_blank');
}

/**
 * Delete a task (calls backend to delete from Label Studio)
 */
export async function deleteLabelStudioTask(taskId, projectId = 'default') {
  try {
    const response = await api.delete(`/api/label-studio/task/${taskId}`, {
      data: { projectId },
    });
    return response.data;
  } catch (error) {
    console.error('Delete Label Studio task error:', error);
    throw error;
  }
}

export { API_URL, LABEL_STUDIO_URL };

