import React, { useState, useEffect } from 'react';
import { createLabelStudioTask } from '../services/api';

/**
 * Label Studio Iframe Component
 * Embeds the full Label Studio application in an iframe
 * This gives you the complete Label Studio UI with waveform, segments, and all features
 */
function LabelStudioIframe({ taskId, projectId = 'default', task, onAnnotationUpdate }) {
  // Initialize URL immediately if task already has a Label Studio task ID
  const getInitialUrl = () => {
    if (task.labelStudioTaskId) {
      const baseUrl = import.meta.env.VITE_LABEL_STUDIO_URL || 'http://localhost:8081';
      const lsProjectId = import.meta.env.VITE_LABEL_STUDIO_PROJECT_ID || '1';
      return `${baseUrl}/projects/${lsProjectId}/data?tab=1&task=${task.labelStudioTaskId}`;
    }
    return null;
  };

  const [labelStudioTaskId, setLabelStudioTaskId] = useState(task.labelStudioTaskId || null);
  const [loading, setLoading] = useState(!task.labelStudioTaskId);
  const [error, setError] = useState(null);
  const [lsUrl, setLsUrl] = useState(getInitialUrl);
  const [isCreating, setIsCreating] = useState(false); // Guard against duplicate calls

  // Create Label Studio task if it doesn't exist
  useEffect(() => {
    // If we already have a URL (task exists), nothing to do
    if (lsUrl) {
      setLoading(false);
      return;
    }

    // If task already has a Label Studio ID but URL wasn't set, set it now
    if (task.labelStudioTaskId && !lsUrl) {
      const baseUrl = import.meta.env.VITE_LABEL_STUDIO_URL || 'http://localhost:8081';
      const lsProjectId = import.meta.env.VITE_LABEL_STUDIO_PROJECT_ID || '1';
      setLsUrl(`${baseUrl}/projects/${lsProjectId}/data?tab=1&task=${task.labelStudioTaskId}`);
      setLabelStudioTaskId(task.labelStudioTaskId);
      setLoading(false);
      return;
    }

    const createTask = async () => {
      // Guard: If already creating, skip
      if (isCreating) {
        return;
      }

      // Need to create the task in Label Studio
      if (!task.segments || task.segments.length === 0) {
        const errorMsg = task.status === 'transcribed' 
          ? 'No segments available. The transcription may have failed. Please check the task status.'
          : `Task is not ready. Current status: ${task.status || 'unknown'}. Please wait for transcription to complete.`;
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Log segment info for debugging
      console.log('📊 Task segments info:', {
        segmentCount: task.segments.length,
        sampleSegment: task.segments[0] ? {
          start: task.segments[0].start,
          end: task.segments[0].end,
          hasText: !!task.segments[0].text,
          textLength: task.segments[0].text?.length || 0,
        } : 'none',
      });

      try {
        setIsCreating(true); // Set guard to prevent duplicate calls
        setLoading(true);
        setError(null);
        
        console.log('🚀 Creating Label Studio task:', { 
          taskId, 
          projectId,
          segmentCount: task.segments.length,
          status: task.status,
        });
        
        const result = await createLabelStudioTask(taskId, projectId);
        
        console.log('✅ Label Studio task creation response:', result);
        
        if (result.labelStudioTaskId) {
          setLabelStudioTaskId(result.labelStudioTaskId);
          const baseUrl = import.meta.env.VITE_LABEL_STUDIO_URL || 'http://localhost:8081';
          const lsProjectId = import.meta.env.VITE_LABEL_STUDIO_PROJECT_ID || '1';
          setLsUrl(`${baseUrl}/projects/${lsProjectId}/data?tab=1&task=${result.labelStudioTaskId}`);
          setLoading(false);
        } else {
          throw new Error('Failed to get Label Studio task ID from response');
        }
      } catch (err) {
        console.error('❌ Error creating Label Studio task:', err);
        const errorDetails = err.response?.data;
        const errorMessage = errorDetails?.error || errorDetails?.message || err.message || 'Failed to create Label Studio task';
        const errorDetailsText = errorDetails?.details ? `\n\nDetails: ${errorDetails.details}` : '';
        const errorStatus = errorDetails?.taskStatus ? `\n\nTask Status: ${errorDetails.taskStatus}` : '';
        setError(`${errorMessage}${errorDetailsText}${errorStatus}`);
        setLoading(false);
        setIsCreating(false); // Reset guard on error so user can retry
      }
    };

    if (task && task.status === 'transcribed' && !task.labelStudioTaskId) {
      createTask();
    }
  }, [taskId, projectId, task.labelStudioTaskId, task.status, task.segments?.length, isCreating, lsUrl]);

  // Listen for messages from Label Studio iframe (for annotation updates)
  useEffect(() => {
    const handleMessage = (event) => {
      // Verify origin for security
      const lsOrigin = import.meta.env.VITE_LABEL_STUDIO_URL || 'http://localhost:8081';
      if (event.origin !== lsOrigin.replace(/\/$/, '')) {
        return;
      }

      // Handle annotation updates from Label Studio
      if (event.data && event.data.type === 'label-studio-annotation-updated') {
        console.log('Annotation updated in Label Studio:', event.data);
        if (onAnnotationUpdate) {
          onAnnotationUpdate(event.data.annotation);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onAnnotationUpdate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[600px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">Setting up Label Studio...</p>
          <p className="text-sm text-gray-500">
            {task.segments?.length > 0 
              ? `Creating task with ${task.segments.length} segments...`
              : 'Preparing task...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    const isInvalidToken = error.includes('Invalid token') || error.includes('401');
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-red-600 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h3 className="text-red-800 font-semibold mb-1">Error</h3>
            <p className="text-red-700 mb-3">{error}</p>
            {isInvalidToken && (
              <div className="bg-white border border-red-200 rounded p-4 mt-3">
                <p className="text-sm font-semibold text-red-800 mb-2">How to fix:</p>
                <ol className="text-sm text-red-700 list-decimal list-inside space-y-1">
                  <li>Open Label Studio: <a href="http://localhost:8080" target="_blank" rel="noopener noreferrer" className="underline">http://localhost:8080</a></li>
                  <li>Log in (or create account if needed)</li>
                  <li>Go to <strong>Account & Settings</strong> → <strong>Access Token</strong></li>
                  <li>Copy the <strong>Access Token</strong> (not the refresh token)</li>
                  <li>Update your <code className="bg-gray-100 px-1 rounded">.env</code> file: <code className="bg-gray-100 px-1 rounded">LABEL_STUDIO_API_KEY=your-access-token</code></li>
                  <li>Restart backend: <code className="bg-gray-100 px-1 rounded">docker-compose restart backend</code></li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!lsUrl) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">Label Studio task is being prepared...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full border border-gray-200 rounded-lg overflow-hidden relative">
      <style>{`
        /* Hide Label Studio navigation when embedded */
        .ls-iframe-container iframe {
          margin-left: -250px;
          width: calc(100% + 250px);
        }
      `}</style>
      <iframe
        src={lsUrl}
        className="w-full h-full"
        style={{ 
          minHeight: '700px', 
          border: 'none',
        }}
        title="Label Studio Editor"
        allow="microphone; camera"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}

export default LabelStudioIframe;

