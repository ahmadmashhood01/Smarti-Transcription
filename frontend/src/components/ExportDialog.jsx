import React, { useState } from 'react';
import { exportTask } from '../services/api';

function ExportDialog({ task, projectId, onClose }) {
  const [format, setFormat] = useState('srt');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);

  const formats = [
    { value: 'srt', label: 'SRT (SubRip Subtitle)', extension: '.srt' },
    { value: 'vtt', label: 'VTT (WebVTT)', extension: '.vtt' },
    { value: 'txt', label: 'TXT (Plain Text)', extension: '.txt' },
    { value: 'json', label: 'JSON (Structured Data)', extension: '.json' },
  ];

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);

    try {
      const result = await exportTask(task.id, format, projectId);
      setMessage({
        type: 'success',
        text: `Successfully exported as ${result.filename}`,
      });

      // Close dialog after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || error.message || 'Export failed',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Export Transcription</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Status Message */}
          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* File Info */}
          <div>
            <p className="text-sm text-gray-600">File:</p>
            <p className="font-medium text-gray-900 truncate">{task.filename || task.id}</p>
            <p className="text-xs text-gray-500 mt-1">
              {task.segments?.length || 0} segments • {task.duration?.toFixed(2)}s
            </p>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <div className="space-y-2">
              {formats.map((fmt) => (
                <label
                  key={fmt.value}
                  className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="format"
                    value={fmt.value}
                    checked={format === fmt.value}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{fmt.label}</p>
                    <p className="text-xs text-gray-500">{fmt.extension}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportDialog;

