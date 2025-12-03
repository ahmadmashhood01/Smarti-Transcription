const express = require('express');
const router = express.Router();
const { getFirestore } = require('../services/firebase');
const { LabelStudioClient, LABEL_STUDIO_URL, LABEL_STUDIO_PROJECT_ID } = require('../services/labelStudio');
const { captureException } = require('../services/sentry');

const labelStudioClient = new LabelStudioClient();

/**
 * Create a new task in Label Studio
 * POST /api/label-studio/create
 * Body: { taskId, projectId }
 */
router.post('/create', async (req, res) => {
  try {
    const { taskId, projectId = 'default' } = req.body;

    console.log('Creating Label Studio task request:', { taskId, projectId });

    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }

    // Get task from Firestore
    const db = getFirestore();
    const taskRef = db.collection('projects').doc(projectId).collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      console.error('Task not found in Firestore', { 
        taskId, 
        projectId,
        collectionPath: `projects/${projectId}/tasks/${taskId}`
      });
      
      // Try to list some tasks to help debug
      const tasksSnapshot = await db.collection('projects').doc(projectId).collection('tasks').limit(5).get();
      const taskIds = tasksSnapshot.docs.map(doc => doc.id);
      console.log('Available task IDs (first 5):', taskIds);
      
      return res.status(404).json({ 
        error: 'Task not found',
        details: `Task ${taskId} not found in project ${projectId}`,
        availableTaskIds: taskIds
      });
    }

    const task = { id: taskDoc.id, ...taskDoc.data() };

    // Log task data for debugging
    console.log('📋 Task data from Firestore:', {
      taskId: task.id,
      filename: task.filename,
      status: task.status,
      hasAudioUrl: !!task.audioUrl,
      segmentCount: task.segments?.length || 0,
      hasLabelStudioTaskId: !!task.labelStudioTaskId,
    });

    // Validate segments exist and are in correct format
    if (!task.segments || !Array.isArray(task.segments) || task.segments.length === 0) {
      console.error('❌ Task has no segments:', {
        taskId: task.id,
        segments: task.segments,
        status: task.status,
      });
      return res.status(400).json({
        error: 'Task has no segments',
        message: 'Task must be transcribed before creating Label Studio task. Current status: ' + (task.status || 'unknown'),
        taskStatus: task.status,
      });
    }

    // Log sample segment to verify format
    const sampleSegment = task.segments[0];
    console.log('📝 Sample segment format:', {
      hasStart: typeof sampleSegment.start === 'number',
      hasEnd: typeof sampleSegment.end === 'number',
      hasText: typeof sampleSegment.text === 'string',
      start: sampleSegment.start,
      end: sampleSegment.end,
      textLength: sampleSegment.text?.length || 0,
      textPreview: sampleSegment.text?.substring(0, 50) || '',
    });

    // Validate segment format
    const invalidSegments = task.segments.filter(seg => 
      typeof seg.start !== 'number' || 
      typeof seg.end !== 'number' || 
      !seg.text || 
      seg.start >= seg.end
    );
    
    if (invalidSegments.length > 0) {
      console.warn('⚠️ Found invalid segments:', invalidSegments.length);
      console.warn('Invalid segments:', invalidSegments.slice(0, 3));
    }

    // Check if task already has a Label Studio task
    if (task.labelStudioTaskId) {
      console.log('ℹ️ Task already has Label Studio task ID:', task.labelStudioTaskId);
      return res.json({
        message: 'Task already exists in Label Studio',
        labelStudioTaskId: task.labelStudioTaskId,
        labelStudioUrl: `${LABEL_STUDIO_URL}/projects/${LABEL_STUDIO_PROJECT_ID || 1}/data?tab=1&task=${task.labelStudioTaskId}`,
      });
    }

    // Create task in Label Studio
    console.log('🚀 Creating Label Studio task with:', {
      segmentCount: task.segments.length,
      audioUrl: task.audioUrl ? 'present' : 'missing',
      filename: task.filename,
    });

    const lsTask = await labelStudioClient.createTask({
      audioUrl: task.audioUrl,
      segments: task.segments,
      taskId: task.id,
      filename: task.filename,
    });

    // Update Firestore with Label Studio task ID
    await taskRef.update({
      labelStudioTaskId: lsTask.id,
      labelStudioUrl: `${LABEL_STUDIO_URL}/tasks/${lsTask.id}`,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      message: 'Label Studio task created successfully',
      labelStudioTaskId: lsTask.id,
      labelStudioUrl: `${LABEL_STUDIO_URL}/tasks/${lsTask.id}`,
    });
  } catch (error) {
    console.error('Failed to create Label Studio task:', error);
    captureException(error, { body: req.body });
    res.status(500).json({
      error: 'Failed to create Label Studio task',
      message: error.message,
    });
  }
});

/**
 * Sync annotations from Label Studio back to Firestore
 * POST /api/label-studio/sync/:taskId
 */
router.post('/sync/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { projectId = 'default' } = req.body;

    // Get task from Firestore
    const db = getFirestore();
    const taskRef = db.collection('projects').doc(projectId).collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = { id: taskDoc.id, ...taskDoc.data() };

    if (!task.labelStudioTaskId) {
      return res.status(400).json({ error: 'Task does not have a Label Studio task ID' });
    }

    // Get annotations from Label Studio
    const annotations = await labelStudioClient.getAnnotations(task.labelStudioTaskId);

    if (!annotations || annotations.length === 0) {
      return res.json({
        message: 'No annotations found in Label Studio',
        synced: false,
      });
    }

    // Parse annotations to our segment format
    const updatedSegments = labelStudioClient.parseAnnotations(annotations);

    if (updatedSegments.length === 0) {
      return res.json({
        message: 'No valid segments found in annotations',
        synced: false,
      });
    }

    // Update Firestore with synced segments
    await taskRef.update({
      segments: updatedSegments,
      status: 'reviewed',
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({
      message: 'Annotations synced successfully',
      synced: true,
      segmentCount: updatedSegments.length,
    });

    console.log(`✅ Synced ${updatedSegments.length} segments from Label Studio for task ${taskId}`);
  } catch (error) {
    console.error('Failed to sync Label Studio annotations:', error);
    captureException(error, { taskId: req.params.taskId });
    res.status(500).json({
      error: 'Failed to sync annotations',
      message: error.message,
    });
  }
});

/**
 * Get Label Studio task URL
 * GET /api/label-studio/task/:taskId
 */
router.get('/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { projectId = 'default' } = req.query;

    // Get task from Firestore
    const db = getFirestore();
    const taskRef = db.collection('projects').doc(projectId).collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = { id: taskDoc.id, ...taskDoc.data() };

    if (!task.labelStudioTaskId) {
      return res.status(404).json({ error: 'Task does not have a Label Studio task' });
    }

    res.json({
      labelStudioTaskId: task.labelStudioTaskId,
      labelStudioUrl: task.labelStudioUrl || `${LABEL_STUDIO_URL}/projects/${LABEL_STUDIO_PROJECT_ID || 1}/data?tab=1&task=${task.labelStudioTaskId}`,
    });
  } catch (error) {
    console.error('Failed to get Label Studio task URL:', error);
    captureException(error, { taskId: req.params.taskId });
    res.status(500).json({
      error: 'Failed to get Label Studio task URL',
      message: error.message,
    });
  }
});

/**
 * Delete Label Studio task
 * DELETE /api/label-studio/task/:taskId
 */
router.delete('/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { projectId = 'default' } = req.body;

    // Get task from Firestore
    const db = getFirestore();
    const taskRef = db.collection('projects').doc(projectId).collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      // Task doesn't exist in Firestore - this is OK, it may have been already deleted
      return res.json({ message: 'Task not found in Firestore (may have been already deleted)' });
    }

    const task = { id: taskDoc.id, ...taskDoc.data() };

    // Delete task from Label Studio if it exists
    if (task.labelStudioTaskId) {
      try {
        await labelStudioClient.deleteTask(task.labelStudioTaskId);
        console.log(`✅ Deleted Label Studio task: ${task.labelStudioTaskId}`);
      } catch (lsError) {
        // Don't fail if Label Studio task doesn't exist
        const errorMessage = lsError.response?.data?.error || lsError.message || 'Unknown error';
        if (errorMessage.includes('not found') || errorMessage.includes('404') || lsError.response?.status === 404) {
          console.log(`ℹ️ Label Studio task ${task.labelStudioTaskId} not found (may have been already deleted)`);
        } else {
          console.warn(`⚠️ Failed to delete Label Studio task ${task.labelStudioTaskId}:`, errorMessage);
        }
        // Continue even if Label Studio deletion fails
      }
    } else {
      console.log('ℹ️ Task does not have a Label Studio task ID, skipping Label Studio deletion');
    }

    // Update Firestore (remove Label Studio references) - only if task still exists
    try {
      await taskRef.update({
        labelStudioTaskId: null,
        labelStudioUrl: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (updateError) {
      // Task may have been deleted between check and update - that's OK
      console.log('ℹ️ Could not update task (may have been deleted):', updateError.message);
    }

    res.json({ message: 'Label Studio task deletion completed' });
  } catch (error) {
    console.error('Failed to delete Label Studio task:', error);
    captureException(error, { taskId: req.params.taskId });
    res.status(500).json({
      error: 'Failed to delete Label Studio task',
      message: error.message,
    });
  }
});

module.exports = router;

