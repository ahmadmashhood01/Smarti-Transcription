const axios = require('axios');
const { captureException } = require('./sentry');

const LABEL_STUDIO_URL = process.env.LABEL_STUDIO_URL || 'http://label-studio:8080';
const LABEL_STUDIO_API_KEY = process.env.LABEL_STUDIO_API_KEY;
const LABEL_STUDIO_PROJECT_ID = process.env.LABEL_STUDIO_PROJECT_ID || 1;

/**
 * Label Studio API client with automatic token refresh
 */
class LabelStudioClient {
  constructor() {
    this.baseURL = LABEL_STUDIO_URL;
    this.refreshToken = LABEL_STUDIO_API_KEY;
    this.projectId = LABEL_STUDIO_PROJECT_ID;
    this.accessToken = null;
    this.tokenExpiry = null;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor to handle token refresh on 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If we get a 401 and haven't already retried, try to refresh the token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.refreshAccessToken();
            // Retry the original request with the new token
            originalRequest.headers['Authorization'] = `Bearer ${this.accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            console.error('Failed to refresh access token:', refreshError);
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Exchange refresh token for access token
   */
  async refreshAccessToken() {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/token/refresh`,
        { refresh: this.refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      );

      this.accessToken = response.data.access;
      // Access tokens typically expire in 5 minutes, set expiry to 4.5 minutes for safety
      this.tokenExpiry = Date.now() + (4.5 * 60 * 1000);

      // Update the default authorization header
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;

      console.log('✅ Label Studio access token refreshed');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Failed to refresh Label Studio access token:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      const errorDetail = error.response?.data?.detail || error.response?.data?.error || error.message;
      throw new Error(`Token refresh failed: ${errorDetail}`);
    }
  }

  /**
   * Ensure we have a valid access token
   */
  async ensureAccessToken() {
    // Check if token is expired or missing
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Create a new task in Label Studio
   */
  async createTask(taskData) {
    try {
      // Ensure we have a valid access token
      await this.ensureAccessToken();

      const { audioUrl, segments, taskId, filename } = taskData;

      // Debug: Log segments received
      console.log('📥 Received task data:', {
        taskId,
        filename,
        audioUrl: audioUrl ? 'present' : 'missing',
        segmentCount: segments?.length || 0,
        segments: segments ? segments.slice(0, 2).map(s => ({ start: s.start, end: s.end, text: s.text?.substring(0, 50) })) : 'none',
      });

      // Validate segments
      if (!segments || !Array.isArray(segments) || segments.length === 0) {
        console.warn('⚠️ No segments provided or segments array is empty');
        throw new Error('No segments available. Task must be transcribed before creating Label Studio task.');
      }

      // Prepare predictions (pre-annotations) from Whisper segments
      // Each segment needs a 'labels' type (for the waveform region box)
      // and a 'textarea' type (for the transcription text attached to that region)
      const result = [];
      
      if (segments && segments.length > 0) {
        // Create audio regions with transcription text
        // Each segment gets a textarea result that creates both the region and text
        segments.forEach((seg, idx) => {
          // Validate segment data
          if (typeof seg.start !== 'number' || typeof seg.end !== 'number') {
            console.warn(`⚠️ Invalid segment ${idx}: missing start/end times`, seg);
            return; // Skip invalid segments
          }
          
          if (seg.start >= seg.end) {
            console.warn(`⚠️ Invalid segment ${idx}: start (${seg.start}) >= end (${seg.end})`, seg);
            return; // Skip invalid segments
          }
          
          // Create textarea result with start/end to create the region
          const textareaResult = {
            from_name: 'transcription',
            to_name: 'audio',
            type: 'textarea',
            value: {
              start: seg.start,
              end: seg.end,
              text: [seg.text || ''],
            },
          };
          
          result.push(textareaResult);
        });
        
        console.log(`📊 Created ${segments.length} segment regions with transcriptions`);
      }
      
      const predictions = result.length > 0 ? [
        {
          model_version: 'whisper-1',
          score: 0.95,
          result: result,
        },
      ] : [];

      // Create task payload
      const payload = {
        data: {
          audio: audioUrl,
          taskId: taskId,
          filename: filename,
        },
        predictions,
      };

      // Detailed logging of prediction payload
      console.log('📤 Creating Label Studio task with predictions:', {
        segmentCount: segments?.length || 0,
        predictionCount: result.length,
        expectedRegions: segments?.length || 0, // Should be 2x segments (labels + textarea each)
        sampleLabelPrediction: result.find(r => r.type === 'labels'),
        sampleTextareaPrediction: result.find(r => r.type === 'textarea' && r.from_name === 'region_transcription'),
        fullTranscriptionPrediction: result.find(r => r.from_name === 'transcription'),
      });

      // Log full payload structure (truncated for readability)
      console.log('📋 Full payload structure:', {
        data: payload.data,
        predictionsCount: predictions.length,
        firstPrediction: {
          model_version: predictions[0]?.model_version,
          score: predictions[0]?.score,
          resultCount: predictions[0]?.result?.length,
          resultTypes: predictions[0]?.result?.map(r => r.type),
        },
      });

      // Log the actual payload being sent (full structure)
      console.log('📤 Sending payload to Label Studio:', JSON.stringify(payload, null, 2).substring(0, 2000));
      
      // Log a sample of the first few predictions for debugging
      if (predictions.length > 0 && predictions[0].result) {
        console.log('📋 Sample predictions (first 3):', 
          predictions[0].result.slice(0, 3).map(r => ({
            type: r.type,
            from_name: r.from_name,
            to_name: r.to_name,
            hasStart: r.value?.start !== undefined,
            hasEnd: r.value?.end !== undefined,
            hasText: r.value?.text !== undefined,
            hasLabels: r.value?.labels !== undefined,
          }))
        );
      }

      // Use the IMPORT endpoint instead of tasks endpoint
      // The /api/projects/{id}/tasks endpoint silently ignores predictions
      // The /api/projects/{id}/import endpoint correctly saves predictions
      const taskPayload = {
        data: {
          audio: audioUrl,
          taskId: taskId,  // Store our Firestore taskId for reference
          filename: filename,
        },
        predictions: predictions,
      };

      console.log('📤 Using IMPORT endpoint to create task with predictions...');
      console.log('📋 Prediction summary:', {
        predictionCount: predictions.length,
        resultCount: predictions[0]?.result?.length || 0,
        firstResultType: predictions[0]?.result?.[0]?.type,
      });

      // Import endpoint expects an array of tasks
      const response = await this.client.post(
        `/api/projects/${this.projectId}/import`,
        [taskPayload]  // Wrap in array for import endpoint
      );

      console.log('📥 Import response:', {
        taskCount: response.data.task_count,
        predictionCount: response.data.prediction_count,
        annotationCount: response.data.annotation_count,
      });

      // Import endpoint doesn't return the task ID directly
      // We need to find the task by querying with our unique taskId
      let labelStudioTaskId = null;
      
      if (response.data.task_count > 0) {
        // Query for the task we just created using our Firestore taskId
        try {
          const tasksResponse = await this.client.get(
            `/api/projects/${this.projectId}/tasks`,
            {
              params: {
                page_size: 20, // Get more tasks to find the right one
              }
            }
          );
          
          // Find ALL tasks with our taskId in the data
          const tasks = tasksResponse.data.tasks || tasksResponse.data || [];
          const matchingTasks = tasks.filter(t => t.data?.taskId === taskId);
          
          if (matchingTasks.length > 0) {
            // If multiple tasks match, prefer the one WITH predictions
            // Sort by: 1) has predictions (desc), 2) created_at (desc)
            const sortedMatches = matchingTasks.sort((a, b) => {
              // First, prefer tasks with predictions
              if (a.total_predictions > 0 && b.total_predictions === 0) return -1;
              if (b.total_predictions > 0 && a.total_predictions === 0) return 1;
              // Then sort by creation time (newest first)
              return new Date(b.created_at) - new Date(a.created_at);
            });
            
            const ourTask = sortedMatches[0];
            labelStudioTaskId = ourTask.id;
            
            console.log('✅ Found task with ID:', labelStudioTaskId);
            console.log('✅ Task has predictions:', ourTask.total_predictions > 0);
            console.log('📊 Matching tasks found:', matchingTasks.length);
            
            if (ourTask.total_predictions > 0) {
              console.log('✅ Predictions confirmed! Count:', ourTask.total_predictions);
            } else {
              console.warn('⚠️ Task created but no predictions found');
            }
          } else {
            // If we can't find by taskId, get the most recent task with predictions
            console.warn('⚠️ Could not find task by taskId, using most recent task with predictions');
            if (tasks.length > 0) {
              // Prefer tasks with predictions, then sort by created_at
              const sortedTasks = tasks.sort((a, b) => {
                if (a.total_predictions > 0 && b.total_predictions === 0) return -1;
                if (b.total_predictions > 0 && a.total_predictions === 0) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
              });
              labelStudioTaskId = sortedTasks[0].id;
              console.log('✅ Using task ID:', labelStudioTaskId, 'with predictions:', sortedTasks[0].total_predictions);
            }
          }
        } catch (queryError) {
          console.error('⚠️ Failed to query for created task:', queryError.message);
        }
      }

      if (!labelStudioTaskId) {
        throw new Error('Failed to get Label Studio task ID after import');
      }

      // Return in the same format as before for compatibility
      return { id: labelStudioTaskId };
    } catch (error) {
      console.error('❌ Failed to create Label Studio task:', error.message);
      captureException(error, { context: 'createLabelStudioTask', taskData });
      throw error;
    }
  }

  /**
   * Get task from Label Studio
   */
  async getTask(labelStudioTaskId) {
    try {
      await this.ensureAccessToken();
      const response = await this.client.get(
        `/api/tasks/${labelStudioTaskId}`
      );
      
      // Log task details for debugging
      console.log('📥 Fetched Label Studio task:', {
        taskId: response.data.id,
        hasPredictions: response.data.predictions?.length > 0,
        hasData: !!response.data.data,
        dataKeys: response.data.data ? Object.keys(response.data.data) : [],
      });
      
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to get Label Studio task ${labelStudioTaskId}:`, error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      captureException(error, { context: 'getLabelStudioTask', labelStudioTaskId });
      throw error;
    }
  }

  /**
   * Get annotations for a task
   */
  async getAnnotations(labelStudioTaskId) {
    try {
      await this.ensureAccessToken();
      const response = await this.client.get(
        `/api/tasks/${labelStudioTaskId}/annotations`
      );
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to get annotations for task ${labelStudioTaskId}:`, error.message);
      captureException(error, { context: 'getLabelStudioAnnotations', labelStudioTaskId });
      throw error;
    }
  }

  /**
   * Update task in Label Studio
   */
  async updateTask(labelStudioTaskId, data) {
    try {
      await this.ensureAccessToken();
      const response = await this.client.patch(
        `/api/tasks/${labelStudioTaskId}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to update Label Studio task ${labelStudioTaskId}:`, error.message);
      captureException(error, { context: 'updateLabelStudioTask', labelStudioTaskId, data });
      throw error;
    }
  }

  /**
   * Delete task from Label Studio
   */
  async deleteTask(labelStudioTaskId) {
    try {
      await this.ensureAccessToken();
      await this.client.delete(`/api/tasks/${labelStudioTaskId}`);
      console.log(`✅ Label Studio task deleted: ${labelStudioTaskId}`);
    } catch (error) {
      console.error(`❌ Failed to delete Label Studio task ${labelStudioTaskId}:`, error.message);
      captureException(error, { context: 'deleteLabelStudioTask', labelStudioTaskId });
      throw error;
    }
  }

  /**
   * Get Label Studio project info
   */
  async getProject() {
    try {
      await this.ensureAccessToken();
      const response = await this.client.get(`/api/projects/${this.projectId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get Label Studio project:', error.message);
      captureException(error, { context: 'getLabelStudioProject' });
      throw error;
    }
  }

  /**
   * Parse annotations from Label Studio format to our segment format
   */
  parseAnnotations(annotations) {
    if (!annotations || annotations.length === 0) {
      return [];
    }

    // Get the most recent completed annotation
    const completedAnnotations = annotations.filter((a) => a.was_cancelled === false);
    if (completedAnnotations.length === 0) {
      return [];
    }

    const latestAnnotation = completedAnnotations[completedAnnotations.length - 1];
    const results = latestAnnotation.result || [];

    // Get all textarea regions with transcriptions
    const segments = results
      .filter((r) => r.type === 'textarea' && r.from_name === 'transcription' && r.value && r.value.start !== undefined)
      .map((r, idx) => ({
        id: r.id || `s${idx + 1}`,
        start: r.value.start || 0,
        end: r.value.end || 0,
        text: Array.isArray(r.value.text) ? r.value.text[0] : r.value.text || '',
      }));
    
    return segments;
  }
}

module.exports = {
  LabelStudioClient,
  LABEL_STUDIO_URL,
  LABEL_STUDIO_PROJECT_ID,
};

