import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadAudioFile, createTask } from '../services/firebase';

function AudioUploader({ projectId, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setUploading(true);

      const uploads = acceptedFiles.map(async (file) => {
        const fileId = `${Date.now()}_${file.name}`;

        try {
          // Update progress
          setUploadProgress((prev) => ({
            ...prev,
            [fileId]: { filename: file.name, progress: 0, status: 'uploading' },
          }));

          // Upload to Firebase Storage
          const { taskId, audioUrl, storagePath } = await uploadAudioFile(
            file,
            projectId,
            (progress) => {
              setUploadProgress((prev) => ({
                ...prev,
                [fileId]: { ...prev[fileId], progress },
              }));
            }
          );

          // Create Firestore task document
          // Note: createTask returns the Firestore document ID, not the taskId
          const firestoreTaskId = await createTask(projectId, {
            id: taskId, // Store original taskId for reference
            audioUrl,
            storagePath, // Store the path for reference
            filename: file.name,
            metadata: {
              fileSize: file.size,
              mimeType: file.type,
            },
          });
          
          console.log('Task created:', { firestoreTaskId, originalTaskId: taskId, audioUrl, storagePath });

          // Mark as completed
          setUploadProgress((prev) => ({
            ...prev,
            [fileId]: { ...prev[fileId], progress: 100, status: 'completed' },
          }));

          setUploadedFiles((prev) => [...prev, file.name]);

          return { success: true, filename: file.name };
        } catch (error) {
          console.error('Upload failed:', error);
          setUploadProgress((prev) => ({
            ...prev,
            [fileId]: {
              ...prev[fileId],
              status: 'error',
              error: error.message,
            },
          }));
          return { success: false, filename: file.name, error: error.message };
        }
      });

      await Promise.all(uploads);
      setUploading(false);

      if (onUploadComplete) {
        onUploadComplete();
      }

      // Clear progress after 3 seconds
      setTimeout(() => {
        setUploadProgress({});
      }, 3000);
    },
    [projectId, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
    },
    multiple: true,
    disabled: uploading,
  });

  const progressEntries = Object.entries(uploadProgress);

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-gray-600">
            {isDragActive ? (
              <p className="text-lg font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="text-lg">
                  <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                </p>
                <p className="text-sm text-gray-500">
                  MP3, WAV, M4A, OGG, FLAC (max 500MB each)
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {progressEntries.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h3 className="font-medium text-gray-900">Upload Progress</h3>
          {progressEntries.map(([fileId, { filename, progress, status, error }]) => (
            <div key={fileId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate flex-1">{filename}</span>
                <span className="ml-2">
                  {status === 'uploading' && `${Math.round(progress)}%`}
                  {status === 'completed' && (
                    <span className="text-green-600 font-medium">✓ Complete</span>
                  )}
                  {status === 'error' && (
                    <span className="text-red-600 font-medium">✗ Failed</span>
                  )}
                </span>
              </div>
              {status === 'uploading' && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AudioUploader;

