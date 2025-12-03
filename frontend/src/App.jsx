import React, { useState } from 'react';
import AudioUploader from './components/AudioUploader';
import TranscriptionList from './components/TranscriptionList';

function App() {
  const [projectId] = useState('default');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = () => {
    // Trigger refresh of transcription list
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Smarti Transcription
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                AI-powered audio transcription with Label Studio
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Project: <span className="font-medium">{projectId}</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Upload Section */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Upload Audio
            </h2>
            <AudioUploader
              projectId={projectId}
              onUploadComplete={handleUploadComplete}
            />
          </section>

          {/* Transcriptions List */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Transcriptions
            </h2>
            <TranscriptionList
              projectId={projectId}
              refreshTrigger={refreshTrigger}
            />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            Powered by OpenAI Whisper, Firebase, and Label Studio
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

