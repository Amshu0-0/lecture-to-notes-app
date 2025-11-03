import { useState, useRef } from 'react';

const AudioRecorder = () => {
  // State management
  const [recordingState, setRecordingState] = useState('idle'); // idle, recording, stopped
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Get status message based on state
  const getStatusMessage = () => {
    switch (recordingState) {
      case 'idle':
        return audioBlob ? 'Recording ready to process' : 'Ready to Record';
      case 'recording':
        return 'Recording...';
      case 'stopped':
        return 'Processing...';
      default:
        return 'Ready to Record';
    }
  };

  // Format recording time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording timer
  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  // Stop recording timer
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      // Create MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Handle data available event
      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      // Handle stop event
      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setRecordingState('idle');
        stopTimer();

        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
      });

      // Start recording
      mediaRecorder.start();
      setRecordingState('recording');
      startTimer();

    } catch (err) {
      console.error('Error accessing microphone:', err);

      // Provide user-friendly error messages
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone permissions in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Microphone is already in use by another application. Please close other apps and try again.');
      } else {
        setError('Failed to access microphone. Please check your browser settings and try again.');
      }

      setRecordingState('idle');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      setRecordingState('stopped');
      mediaRecorderRef.current.stop();
    }
  };

  // Clear recording
  const clearRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Audio Recorder
        </h2>
        <p className="text-gray-600">
          Record your lecture to get started
        </p>
      </div>

      {/* Status Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            {/* Status dot */}
            <div className="relative">
              <div
                className={`w-3 h-3 rounded-full ${
                  recordingState === 'recording'
                    ? 'bg-red-500 animate-pulse'
                    : recordingState === 'stopped'
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
              />
              {recordingState === 'recording' && (
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500 animate-ping" />
              )}
            </div>

            {/* Status text */}
            <span className="text-lg font-medium text-gray-700">
              {getStatusMessage()}
            </span>
          </div>

          {/* Recording timer */}
          {recordingState === 'recording' && (
            <span className="text-xl font-mono font-bold text-red-600">
              {formatTime(recordingTime)}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {recordingState === 'recording' && (
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="bg-red-500 h-2 animate-pulse" style={{ width: '100%' }} />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Microphone Error
              </h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Record/Stop Button */}
        {recordingState !== 'recording' ? (
          <button
            onClick={startRecording}
            disabled={recordingState === 'stopped'}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
              recordingState === 'stopped'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-md hover:shadow-lg'
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                clipRule="evenodd"
              />
            </svg>
            <span>Start Recording</span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-all shadow-md hover:shadow-lg"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <rect x="6" y="6" width="8" height="8" rx="1" />
            </svg>
            <span>Stop Recording</span>
          </button>
        )}

        {/* Clear Button */}
        {audioBlob && recordingState === 'idle' && (
          <button
            onClick={clearRecording}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Audio Preview */}
      {audioBlob && recordingState === 'idle' && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Recording Preview
          </h3>
          <audio
            controls
            src={URL.createObjectURL(audioBlob)}
            className="w-full"
          />
          <div className="mt-3 text-sm text-gray-600">
            Size: {(audioBlob.size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
