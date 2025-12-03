const express = require('express');
const router = express.Router();
const { getFirestore } = require('../services/firebase');
const {
  exportSRT,
  exportVTT,
  exportTXT,
  exportJSON,
  getContentType,
  getFileExtension,
} = require('../services/exportFormatters');
const { captureException } = require('../services/sentry');

/**
 * Export task in specified format
 * GET /api/export/:taskId?format=srt&projectId=default
 */
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { format = 'srt', projectId = 'default' } = req.query;

    // Validate format
    const validFormats = ['srt', 'vtt', 'txt', 'json'];
    if (!validFormats.includes(format.toLowerCase())) {
      return res.status(400).json({
        error: `Invalid format. Supported formats: ${validFormats.join(', ')}`,
      });
    }

    // Get task from Firestore
    const db = getFirestore();
    const taskRef = db.collection('projects').doc(projectId).collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = { id: taskDoc.id, ...taskDoc.data() };

    // Check if task has been transcribed
    if (!task.segments || task.segments.length === 0) {
      return res.status(400).json({
        error: 'Task has no transcription segments. Please wait for transcription to complete.',
      });
    }

    // Generate export based on format
    let content;
    let filename;

    switch (format.toLowerCase()) {
      case 'srt':
        content = exportSRT(task.segments);
        filename = `${task.filename || taskId}.srt`;
        break;

      case 'vtt':
        content = exportVTT(task.segments);
        filename = `${task.filename || taskId}.vtt`;
        break;

      case 'txt':
        content = exportTXT(task.segments, true);
        filename = `${task.filename || taskId}.txt`;
        break;

      case 'json':
        content = exportJSON(task);
        filename = `${task.filename || taskId}.json`;
        break;

      default:
        return res.status(400).json({ error: 'Invalid format' });
    }

    // Set response headers
    res.setHeader('Content-Type', getContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);

    console.log(`✅ Exported task ${taskId} as ${format.toUpperCase()}`);
  } catch (error) {
    console.error('Export error:', error);
    captureException(error, { taskId: req.params.taskId, format: req.query.format });
    res.status(500).json({ error: 'Failed to export task', message: error.message });
  }
});

/**
 * Export multiple tasks as a batch
 * POST /api/export/batch
 * Body: { taskIds: [], format: 'srt', projectId: 'default' }
 */
router.post('/batch', async (req, res) => {
  try {
    const { taskIds, format = 'srt', projectId = 'default' } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'taskIds array is required' });
    }

    const db = getFirestore();
    const exports = [];

    for (const taskId of taskIds) {
      try {
        const taskRef = db.collection('projects').doc(projectId).collection('tasks').doc(taskId);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
          exports.push({ taskId, error: 'Task not found' });
          continue;
        }

        const task = { id: taskDoc.id, ...taskDoc.data() };

        if (!task.segments || task.segments.length === 0) {
          exports.push({ taskId, error: 'No transcription segments' });
          continue;
        }

        let content;
        switch (format.toLowerCase()) {
          case 'srt':
            content = exportSRT(task.segments);
            break;
          case 'vtt':
            content = exportVTT(task.segments);
            break;
          case 'txt':
            content = exportTXT(task.segments, true);
            break;
          case 'json':
            content = exportJSON(task);
            break;
          default:
            exports.push({ taskId, error: 'Invalid format' });
            continue;
        }

        exports.push({
          taskId,
          filename: `${task.filename || taskId}${getFileExtension(format)}`,
          content,
        });
      } catch (error) {
        exports.push({ taskId, error: error.message });
      }
    }

    res.json({ exports });
    console.log(`✅ Batch exported ${exports.length} tasks`);
  } catch (error) {
    console.error('Batch export error:', error);
    captureException(error, { body: req.body });
    res.status(500).json({ error: 'Failed to export tasks', message: error.message });
  }
});

module.exports = router;

