import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

const WaveformPlayer = forwardRef(({ audioUrl, peaksUrl, segments = [], onSegmentClick }, ref) => {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionsRef = useRef([]);
  const currentSegmentRef = useRef(null); // Track which segment is currently playing
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    seekTo: (time) => {
      if (wavesurferRef.current) {
        const duration = wavesurferRef.current.getDuration();
        if (duration > 0) {
          wavesurferRef.current.seekTo(time / duration);
        }
      }
    },
    play: () => {
      if (wavesurferRef.current) {
        currentSegmentRef.current = null; // Clear segment restriction for manual play
        wavesurferRef.current.play();
      }
    },
    pause: () => wavesurferRef.current?.pause(),
    playSegment: (segment) => {
      if (wavesurferRef.current) {
        currentSegmentRef.current = segment;
        const duration = wavesurferRef.current.getDuration();
        if (duration > 0) {
          wavesurferRef.current.seekTo(segment.start / duration);
          wavesurferRef.current.play();
        }
      }
    },
  }));

  useEffect(() => {
    if (!waveformRef.current) return;

    // Initialize WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#ddd',
      progressColor: '#3b82f6',
      cursorColor: '#1e40af',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 1,
      height: 100,
      barGap: 2,
      normalize: true,
      backend: 'WebAudio',
      minPxPerSec: 10 * zoom, // Zoom control
    });

    wavesurferRef.current = wavesurfer;

    // Load audio
    if (peaksUrl) {
      // Load with peaks for faster rendering
      fetch(peaksUrl)
        .then((res) => res.json())
        .then((peaks) => {
          wavesurfer.load(audioUrl, peaks.data || peaks);
        })
        .catch((error) => {
          console.warn('Failed to load peaks, loading audio directly:', error);
          wavesurfer.load(audioUrl);
        });
    } else {
      wavesurfer.load(audioUrl);
    }

    // Event listeners
    wavesurfer.on('ready', () => {
      setLoading(false);
      const duration = wavesurfer.getDuration();
      setDuration(duration);
      
      // Add segment regions after a short delay to ensure waveform is fully rendered
      setTimeout(() => {
        if (segments && segments.length > 0) {
          // Clear existing regions
          regionsRef.current.forEach((region) => {
            try {
              region.remove();
            } catch (e) {
              // Region might already be removed
            }
          });
          regionsRef.current = [];
          
          // Add new regions
          regionsRef.current = segments.map((segment) => {
            try {
              const region = wavesurfer.addRegion({
                start: segment.start,
                end: segment.end,
                color: 'rgba(59, 130, 246, 0.25)',
                drag: false,
                resize: false,
              });
              
              // Add data attribute for easy selection
              region.element.setAttribute('data-region-id', segment.id || segment.start);
              
              // Make region clickable - play only this segment
              region.on('click', () => {
                const dur = wavesurfer.getDuration();
                if (dur > 0) {
                  // Set current segment so we can stop at the end
                  currentSegmentRef.current = segment;
                  wavesurfer.seekTo(segment.start / dur);
                  wavesurfer.play();
                }
                if (onSegmentClick) {
                  onSegmentClick(segment);
                }
              });
              
              // Add hover effect and visual styling
              region.element.style.cursor = 'pointer';
              region.element.title = `Click to play segment (${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s)`;
              
              // Add borders to make segments visually distinct with clear separation
              region.element.style.borderLeft = '2px solid #2563eb';
              region.element.style.borderRight = '2px solid #2563eb';
              region.element.style.boxShadow = '0 0 0 1px rgba(37, 99, 235, 0.2) inset';
              
              // Add hover effect
              region.element.addEventListener('mouseenter', () => {
                region.element.style.borderLeft = '3px solid #1d4ed8';
                region.element.style.borderRight = '3px solid #1d4ed8';
                region.element.style.boxShadow = '0 0 0 2px rgba(29, 78, 216, 0.3) inset';
              });
              region.element.addEventListener('mouseleave', () => {
                region.element.style.borderLeft = '2px solid #2563eb';
                region.element.style.borderRight = '2px solid #2563eb';
                region.element.style.boxShadow = '0 0 0 1px rgba(37, 99, 235, 0.2) inset';
              });
              
              return region;
            } catch (error) {
              console.error('Error adding region:', error);
              return null;
            }
          }).filter(Boolean);
        }
      }, 100);
    });

    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));

    wavesurfer.on('audioprocess', () => {
      const currentTime = wavesurfer.getCurrentTime();
      setCurrentTime(currentTime);
      
      // Stop playback if we've reached the end of the current segment
      if (currentSegmentRef.current) {
        const segment = currentSegmentRef.current;
        const duration = wavesurfer.getDuration();
        // Stop at segment end (with small buffer to ensure we stop)
        if (currentTime >= segment.end - 0.05) {
          wavesurfer.pause();
          if (duration > 0) {
            wavesurfer.seekTo(segment.end / duration);
          }
          currentSegmentRef.current = null;
          setIsPlaying(false);
        }
      }
    });

    wavesurfer.on('seek', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });
    
    wavesurfer.on('finish', () => {
      setIsPlaying(false);
      currentSegmentRef.current = null;
    });

    // Cleanup
    return () => {
      // Remove regions
      regionsRef.current.forEach((region) => {
        try {
          region.remove();
        } catch (e) {
          // Region might already be removed
        }
      });
      regionsRef.current = [];
      
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [audioUrl, peaksUrl]);
  
  // Update segments when they change
  useEffect(() => {
    if (!wavesurferRef.current || loading || !segments || segments.length === 0) return;
    
    const wavesurfer = wavesurferRef.current;
    const duration = wavesurfer.getDuration();
    if (!duration || duration === 0) return;
    
    // Clear existing regions
    regionsRef.current.forEach((region) => {
      try {
        region.remove();
      } catch (e) {
        // Ignore
      }
    });
    regionsRef.current = [];
    
    // Add new regions
    regionsRef.current = segments.map((segment) => {
      try {
        const region = wavesurfer.addRegion({
          start: segment.start,
          end: segment.end,
          color: 'rgba(59, 130, 246, 0.25)',
          drag: false,
          resize: false,
        });
        
        // Add data attribute for easy selection
        region.element.setAttribute('data-region-id', segment.id || segment.start);
        
        region.on('click', () => {
          // Set current segment so we can stop at the end
          currentSegmentRef.current = segment;
          wavesurfer.seekTo(segment.start / duration);
          wavesurfer.play();
          if (onSegmentClick) {
            onSegmentClick(segment);
          }
        });
        
        region.element.style.cursor = 'pointer';
        region.element.title = `Click to play segment (${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s)`;
        
        // Add borders to make segments visually distinct with clear separation
        region.element.style.borderLeft = '2px solid #2563eb';
        region.element.style.borderRight = '2px solid #2563eb';
        region.element.style.boxShadow = '0 0 0 1px rgba(37, 99, 235, 0.2) inset';
        
        // Add hover effect
        region.element.addEventListener('mouseenter', () => {
          region.element.style.borderLeft = '3px solid #1d4ed8';
          region.element.style.borderRight = '3px solid #1d4ed8';
          region.element.style.boxShadow = '0 0 0 2px rgba(29, 78, 216, 0.3) inset';
        });
        region.element.addEventListener('mouseleave', () => {
          region.element.style.borderLeft = '2px solid #2563eb';
          region.element.style.borderRight = '2px solid #2563eb';
          region.element.style.boxShadow = '0 0 0 1px rgba(37, 99, 235, 0.2) inset';
        });
        
        return region;
      } catch (error) {
        console.error('Error adding region:', error);
        return null;
      }
    }).filter(Boolean);
  }, [segments, loading, onSegmentClick]);

  // Update zoom when it changes
  useEffect(() => {
    if (wavesurferRef.current && !loading) {
      const duration = wavesurferRef.current.getDuration();
      if (duration && duration > 0) {
        wavesurferRef.current.zoom(10 * zoom);
      }
    }
  }, [zoom, loading]);

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      // If clicking play/pause manually, clear segment restriction
      currentSegmentRef.current = null;
      wavesurferRef.current.playPause();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.5, 50));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.5, 0.1));
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      {/* Waveform */}
      <div className="waveform-container bg-white rounded overflow-x-auto" ref={waveformRef}>
        {loading && (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePlayPause}
          disabled={loading}
          className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        <div className="flex-1 mx-4 text-sm text-gray-600">
          <span className="font-mono">{formatTime(currentTime)}</span>
          <span className="mx-1">/</span>
          <span className="font-mono">{formatTime(duration)}</span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={loading}
            className="px-2 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            disabled={loading}
            className="px-2 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
});

WaveformPlayer.displayName = 'WaveformPlayer';

export default WaveformPlayer;

