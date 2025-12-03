const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {Storage} = require('@google-cloud/storage');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// Initialize Firebase Admin (only once across all functions)
if (!admin.apps.length) {
  admin.initializeApp();
}

const storage = new Storage();

/**
 * Cloud Function triggered when a new task document is created
 * Transcribes audio using OpenAI Whisper and generates peaks.json for waveform
 */
exports.transcribeOnCreate = functions
    .runWith({
      timeoutSeconds: 540, // 9 minutes (max for Cloud Functions)
      memory: '2GB',
    })
    .firestore
    .document('projects/{projectId}/tasks/{taskId}')
    .onCreate(async (snap, context) => {
      const task = snap.data();
      const {projectId, taskId} = context.params;

      functions.logger.info(`Starting transcription for task ${taskId} in project ${projectId}`);

      // Validate task data
      if (!task || !task.audioUrl || task.status !== 'queued') {
        functions.logger.warn(`Task ${taskId} not ready for transcription`, {task});
        return null;
      }

      const taskRef = snap.ref;

      try {
      // Update status to transcribing
        await taskRef.update({
          status: 'transcribing',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Use storagePath from task document if available, otherwise extract from audioUrl
        let storagePath = task.storagePath;
        if (!storagePath) {
          storagePath = extractStoragePath(task.audioUrl);
          if (!storagePath) {
            functions.logger.error('Invalid audioUrl format', {audioUrl: task.audioUrl});
            throw new Error(`Invalid audioUrl format: ${task.audioUrl}`);
          }
        }

        functions.logger.info(`Downloading audio from path: ${storagePath}`);

        // Get bucket name from Firebase config or use default
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET ||
                        admin.storage().bucket().name ||
                        'smartitranscription-e23ff.firebasestorage.app';

        functions.logger.info(`Using bucket: ${bucketName}`);
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(storagePath);

        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
          functions.logger.error('File does not exist', {bucket: bucketName, path: storagePath});
          throw new Error(`File not found: ${storagePath} in bucket ${bucketName}`);
        }

        const tmpAudioPath = path.join(os.tmpdir(), `audio-${taskId}${path.extname(task.filename || '.mp3')}`);
        await file.download({destination: tmpAudioPath});

        functions.logger.info(`Audio downloaded to ${tmpAudioPath}`);

        // Get audio duration
        const duration = await getAudioDuration(tmpAudioPath);
        functions.logger.info(`Audio duration: ${duration} seconds`);

        // Generate peaks.json for waveform visualization
        functions.logger.info('Generating peaks.json...');
        const peaksData = await generatePeaks(tmpAudioPath, duration);
        const peaksPath = `peaks/${projectId}/${taskId}/peaks.json`;
        const peaksFile = bucket.file(peaksPath);

        await peaksFile.save(JSON.stringify(peaksData), {
          contentType: 'application/json',
          metadata: {
            cacheControl: 'public, max-age=31536000',
          },
        });

        // Make peaks file publicly accessible
        await peaksFile.makePublic();
        const peaksUrl = `https://storage.googleapis.com/${bucketName}/${peaksPath}`;

        functions.logger.info(`Peaks.json uploaded to ${peaksUrl}`);

        // Call OpenAI Whisper API
        functions.logger.info('Calling OpenAI Whisper API...');
        const openaiKey = functions.config().openai?.key;

        if (!openaiKey) {
          throw new Error('OpenAI API key not configured. Run: firebase functions:config:set openai.key="sk-..."');
        }

        const formData = new FormData();
        formData.append('file', fs.createReadStream(tmpAudioPath), {
          filename: task.filename || 'audio.mp3',
        });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities[]', 'segment');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            ...formData.getHeaders(),
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const whisperResponse = await response.json();
        functions.logger.info('Whisper transcription completed', {
          segmentCount: whisperResponse.segments?.length,
        });

        // Parse segments from Whisper response
        const segments = (whisperResponse.segments || []).map((seg, idx) => ({
          id: `s${idx + 1}`,
          start: seg.start || 0,
          end: seg.end || 0,
          text: seg.text?.trim() || '',
          speaker: null, // Speaker diarization can be added later
        }));

        // Update Firestore with transcription results
        await taskRef.update({
          status: 'transcribed',
          duration: duration || whisperResponse.duration || null,
          segments,
          peaksUrl,
          whisper: {
            model: 'whisper-1',
            raw_response: whisperResponse,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info(`Transcription completed successfully for task ${taskId}`);

        // Cleanup temp file
        try {
          fs.unlinkSync(tmpAudioPath);
        } catch (cleanupError) {
          functions.logger.warn('Failed to cleanup temp file', {error: cleanupError});
        }

        return null;
      } catch (error) {
        functions.logger.error(`Transcription failed for task ${taskId}`, {
          error: error.message,
          stack: error.stack,
        });

        // Update task with error status
        await taskRef.update({
          status: 'error',
          error: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Re-throw to mark function as failed
        throw error;
      }
    });

/**
 * Extract storage path from Firebase Storage URL
 * @param {string} url - Firebase Storage URL
 * @return {string|null} Storage path or null if invalid
 */
function extractStoragePath(url) {
  try {
    functions.logger.info('Extracting storage path from URL:', url);

    // Handle different URL formats:
    // - gs://bucket/path/to/file
    // - https://storage.googleapis.com/bucket/path/to/file
    // - https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile?alt=media&token=...
    // - https://firebasestorage.googleapis.com/v0/b/bucket.firebasestorage.app/o/path%2Fto%2Ffile?alt=media&token=...

    if (url.startsWith('gs://')) {
      const path = url.replace(/^gs:\/\/[^/]+\//, '');
      functions.logger.info('Extracted from gs://:', path);
      return path;
    }

    // Handle firebasestorage.googleapis.com format
    if (url.includes('firebasestorage.googleapis.com')) {
      // Pattern: /v0/b/bucket/o/path%2Fto%2Ffile
      const match = url.match(/\/o\/([^?]+)/);
      if (match) {
        const path = decodeURIComponent(match[1]);
        functions.logger.info('Extracted from firebasestorage:', path);
        return path;
      }
    }

    // Handle storage.googleapis.com format
    if (url.includes('storage.googleapis.com')) {
      // Pattern: https://storage.googleapis.com/bucket/path/to/file
      const match = url.match(/storage\.googleapis\.com\/[^/]+\/(.+?)(\?|$)/);
      if (match) {
        const path = decodeURIComponent(match[1]);
        functions.logger.info('Extracted from storage.googleapis:', path);
        return path;
      }
    }

    functions.logger.warn('Could not extract storage path from URL:', url);
    return null;
  } catch (error) {
    functions.logger.error('Failed to extract storage path', {url, error: error.message});
    return null;
  }
}

/**
 * Get audio duration using ffmpeg
 * @param {string} filePath - Path to audio file
 * @return {Promise<number>} Audio duration in seconds
 */
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

/**
 * Generate peaks.json for waveform visualization
 * Returns array of peak values for wavesurfer.js
 * @param {string} audioPath - Path to audio file
 * @param {number} duration - Audio duration in seconds
 * @return {Promise<Object>} Peaks data object with data array and length
 */
async function generatePeaks(audioPath, duration) {
  return new Promise((resolve, reject) => {
    const samples = 1000; // Number of samples for waveform
    const peaks = [];

    ffmpeg(audioPath)
        .audioFilters([
          'aformat=channel_layouts=mono',
          `aresample=resampler=swr:osr=${samples}`,
        ])
        .format('f32le')
        .on('error', (err) => {
          functions.logger.warn('FFmpeg peaks generation failed, using fallback', {error: err.message});
          // Fallback: generate simple peaks
          for (let i = 0; i < samples; i++) {
            peaks.push(Math.random() * 0.5 + 0.25); // Random peaks between 0.25 and 0.75
          }
          resolve({data: peaks, length: samples});
        })
        .on('end', () => {
          functions.logger.info('Peaks generated successfully', {sampleCount: peaks.length});
          resolve({data: peaks, length: peaks.length});
        })
        .pipe()
        .on('data', (chunk) => {
        // Process audio samples to peaks
          const samples = new Float32Array(chunk.buffer);
          for (let i = 0; i < samples.length; i++) {
            const value = Math.abs(samples[i]);
            peaks.push(value);
          }
        });
  });
}

