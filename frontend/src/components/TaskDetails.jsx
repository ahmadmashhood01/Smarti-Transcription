import React, { useState } from 'react';
import {
  syncLabelStudioAnnotations,
} from '../services/api';
import { deleteTask } from '../services/firebase';
import LabelStudioIframe from './LabelStudioIframe';
import ExportDialog from './ExportDialog';

function TaskDetails({ task, projectId, onClose, onDelete }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSyncAnnotations = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const result = await syncLabelStudioAnnotations(task.id, projectId);
      setMessage({
        type: 'success',
        text: `Synced ${result.segmentCount} segments from Label Studio`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await deleteTask(projectId, task.id);
      setMessage({ type: 'success', text: 'Task deleted successfully' });
      
      // Close modal and refresh list after a short delay
      setTimeout(() => {
        if (onDelete) {
          onDelete();
        }
        onClose();
      }, 1000);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete task' });
      setLoading(false);
    }
  };

  const handleAnnotationUpdate = async (annotation) => {
    // This will be called when Label Studio sends annotation updates
    // You can sync back to Firestore here if needed
    console.log('Annotation updated in Label Studio:', annotation);
    setMessage({ type: 'success', text: 'Annotation updated in Label Studio' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-900 truncate">
              {task.filename || task.id}
            </h2>
            <span className={`status-badge status-${task.status}`}>
              {task.status}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {/* Export Button */}
            <button
              onClick={() => setShowExportDialog(true)}
              disabled={!task.segments || task.segments.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Export
            </button>
            {/* Sync from Label Studio */}
            {task.labelStudioTaskId && (
              <button
                onClick={handleSyncAnnotations}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {loading ? 'Syncing...' : 'Sync Changes'}
              </button>
            )}
            {/* Delete Button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`mx-6 mt-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Label Studio Editor - Full Screen Iframe */}
        <div className="flex-1 overflow-hidden p-6">
          {task.audioUrl && task.status === 'transcribed' ? (
            <LabelStudioIframe
              taskId={task.id}
              projectId={projectId}
              task={task}
              onAnnotationUpdate={handleAnnotationUpdate}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-600 mb-2">
                  {task.status === 'queued' || task.status === 'transcribing'
                    ? 'Transcription in progress...'
                    : 'Audio not available'}
                </p>
                {(task.status === 'queued' || task.status === 'transcribing') && (
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          task={task}
          projectId={projectId}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Task</h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete "{task.filename || task.id}"? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskDetails;

