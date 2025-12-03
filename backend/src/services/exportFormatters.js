/**
 * Export formatters for transcription segments
 * Supports: SRT, VTT, TXT, JSON
 */

/**
 * Convert seconds to SRT timestamp format (HH:MM:SS,mmm)
 */
function toSRTTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

/**
 * Convert seconds to VTT timestamp format (HH:MM:SS.mmm)
 */
function toVTTTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/**
 * Export as SRT (SubRip Subtitle) format
 */
function exportSRT(segments) {
  if (!segments || segments.length === 0) {
    return '';
  }

  return segments
    .map((seg, idx) => {
      const index = idx + 1;
      const startTime = toSRTTimestamp(seg.start);
      const endTime = toSRTTimestamp(seg.end);
      const text = seg.text || '';
      const speaker = seg.speaker ? `[${seg.speaker}] ` : '';

      return `${index}\n${startTime} --> ${endTime}\n${speaker}${text}\n`;
    })
    .join('\n');
}

/**
 * Export as VTT (WebVTT) format
 */
function exportVTT(segments) {
  if (!segments || segments.length === 0) {
    return 'WEBVTT\n\n';
  }

  const cues = segments
    .map((seg, idx) => {
      const startTime = toVTTTimestamp(seg.start);
      const endTime = toVTTTimestamp(seg.end);
      const text = seg.text || '';
      const speaker = seg.speaker ? `<v ${seg.speaker}>` : '';

      return `${idx + 1}\n${startTime} --> ${endTime}\n${speaker}${text}\n`;
    })
    .join('\n');

  return `WEBVTT\n\n${cues}`;
}

/**
 * Export as plain text with timestamps
 */
function exportTXT(segments, includeTimestamps = true) {
  if (!segments || segments.length === 0) {
    return '';
  }

  return segments
    .map((seg) => {
      const text = seg.text || '';
      const speaker = seg.speaker ? `[${seg.speaker}] ` : '';

      if (includeTimestamps) {
        const timestamp = `[${formatTimestamp(seg.start)} - ${formatTimestamp(seg.end)}]`;
        return `${timestamp} ${speaker}${text}`;
      }

      return `${speaker}${text}`;
    })
    .join('\n');
}

/**
 * Export as JSON (full structured data)
 */
function exportJSON(task) {
  return JSON.stringify(
    {
      id: task.id,
      filename: task.filename,
      duration: task.duration,
      status: task.status,
      segments: task.segments || [],
      whisper: task.whisper || null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      metadata: task.metadata || {},
    },
    null,
    2
  );
}

/**
 * Format seconds to readable timestamp (MM:SS)
 */
function formatTimestamp(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Get content type for format
 */
function getContentType(format) {
  const types = {
    srt: 'application/x-subrip',
    vtt: 'text/vtt',
    txt: 'text/plain',
    json: 'application/json',
  };

  return types[format] || 'text/plain';
}

/**
 * Get file extension for format
 */
function getFileExtension(format) {
  const extensions = {
    srt: '.srt',
    vtt: '.vtt',
    txt: '.txt',
    json: '.json',
  };

  return extensions[format] || '.txt';
}

module.exports = {
  exportSRT,
  exportVTT,
  exportTXT,
  exportJSON,
  getContentType,
  getFileExtension,
  toSRTTimestamp,
  toVTTTimestamp,
  formatTimestamp,
};

