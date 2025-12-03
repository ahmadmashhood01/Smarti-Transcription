# Smarti Transcription System

A production-ready audio transcription system powered by OpenAI Whisper, Firebase, and Label Studio.

## Features

- **Automatic Transcription**: OpenAI Whisper API integration for high-quality speech-to-text
- **Waveform Visualization**: Interactive audio playback with peaks.json generation
- **Label Studio Integration**: Professional annotation workflow for reviewing and editing transcriptions
- **Real-time Updates**: Live status updates using Firestore listeners
- **Batch Processing**: Upload and process multiple audio files simultaneously
- **Multiple Export Formats**: SRT, VTT, TXT, JSON
- **Search & Filter**: Find transcriptions by filename, status, or date
- **Modern UI**: Clean React interface with Tailwind CSS

## Architecture

```
[React Frontend] <---> [Node.js Backend] <---> [Firebase Firestore/Storage]
                              |
                              v
                    [Label Studio Server]
                              |
                              v
                    [Cloud Function] ---> [OpenAI Whisper API]
                              |
                              v
                        [peaks.json generation]
```

### Services

1. **React Frontend** (Port 3000): Upload UI, transcription list, waveform player
2. **Node.js Backend** (Port 5000): Export formatters, Label Studio API integration
3. **Label Studio** (Port 8080): Annotation and review interface
4. **Firebase Cloud Function**: Whisper transcription + peaks.json generation

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Firebase project with Firestore and Storage enabled
- OpenAI API key with Whisper access
- Firebase Admin SDK service account key

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd Smarti_Transcription_3
```

### 2. Firebase Configuration

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database and Storage
3. Download service account key:
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Save as `serviceAccountKey.json` in project root

4. Update `.firebaserc`:
```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

### 3. Environment Variables

Copy `env.example` to `.env` and fill in your credentials:

```bash
cp env.example .env
```

Update `.env` with:
- Firebase credentials
- OpenAI API key
- Label Studio API key (generated after first run)

### 4. Deploy Firebase Rules

```bash
firebase deploy --only firestore:rules,storage:rules
```

### 5. Deploy Cloud Function

```bash
cd cloud-functions
npm install
cd ..

# Set OpenAI API key
firebase functions:config:set openai.key="sk-your-openai-api-key"

# Deploy
firebase deploy --only functions
```

### 6. Start Docker Services

```bash
docker-compose up --build
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Label Studio: http://localhost:8080

### 7. Label Studio Setup

1. Open http://localhost:8080
2. Create account (or use default: admin@smarti.com / smarti123)
3. Create a new project for audio transcription
4. Get API token from Account & Settings
5. Update `.env` with `LABEL_STUDIO_API_KEY` and `LABEL_STUDIO_PROJECT_ID`
6. Restart backend: `docker-compose restart backend`

## Usage

### Upload Audio

1. Go to http://localhost:3000
2. Drag & drop audio files or click to upload
3. Supported formats: MP3, WAV, M4A, OGG, FLAC
4. Watch real-time transcription status

### Review in Label Studio

1. Click on a transcription in the list
2. Click "Create Label Studio Task" (first time only)
3. Click "Edit in Label Studio" to open annotation interface
4. Make corrections to the transcription
5. Save in Label Studio
6. Click "Sync from Label Studio" to update Firestore

### Export Transcriptions

1. Click on a transcription
2. Click "Export"
3. Choose format: SRT, VTT, TXT, or JSON
4. File downloads automatically

## Development

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Backend Development

```bash
cd backend
npm install
npm run dev
```

### Cloud Function Local Testing

```bash
cd cloud-functions
npm install
firebase emulators:start --only functions
```

## Project Structure

```
.
├── frontend/                 # React app (Vite)
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # Firebase & API services
│   │   └── App.jsx          # Main app
│   └── Dockerfile
├── backend/                  # Node.js API
│   ├── src/
│   │   ├── routes/          # Express routes
│   │   ├── services/        # Business logic
│   │   └── server.js        # Express server
│   └── Dockerfile
├── cloud-functions/          # Firebase Cloud Functions
│   └── transcribe/          # Whisper + peaks.json
├── docker-compose.yml        # Multi-service setup
├── firebase.json             # Firebase config
├── firestore.rules           # Security rules
└── storage.rules             # Storage rules
```

## Firestore Schema

### Collection: `projects/{projectId}/tasks/{taskId}`

```javascript
{
  id: string,
  audioUrl: string,              // Storage URL
  peaksUrl: string,              // Waveform peaks.json
  filename: string,
  duration: number,
  status: 'queued' | 'transcribing' | 'transcribed' | 'ready_for_review' | 'reviewed' | 'error',
  whisper: {
    model: 'whisper-1',
    raw_response: object
  },
  segments: [{
    id: string,
    start: number,
    end: number,
    text: string,
    speaker: string | null
  }],
  labelStudioTaskId: number,     // LS task ID
  labelStudioUrl: string,         // Direct link
  createdAt: timestamp,
  updatedAt: timestamp,
  metadata: {
    fileSize: number,
    mimeType: string
  }
}
```

## API Endpoints

### Backend (Port 5000)

**Export**
- `GET /api/export/:taskId?format=srt&projectId=default` - Export task
- `POST /api/export/batch` - Batch export

**Label Studio**
- `POST /api/label-studio/create` - Create LS task
- `POST /api/label-studio/sync/:taskId` - Sync annotations
- `GET /api/label-studio/task/:taskId` - Get LS task URL
- `DELETE /api/label-studio/task/:taskId` - Delete LS task

## Troubleshooting

### Cloud Function Errors

Check logs:
```bash
firebase functions:log
```

### Docker Issues

Restart services:
```bash
docker-compose down
docker-compose up --build
```

View logs:
```bash
docker-compose logs -f
```

### Firebase Connection Issues

1. Verify `serviceAccountKey.json` is in project root
2. Check Firebase project ID in `.firebaserc`
3. Ensure Firestore and Storage are enabled

### Label Studio Connection

1. Verify Label Studio is running: `docker ps`
2. Check API key is set in `.env`
3. Verify project ID exists in Label Studio

## Security

### Production Deployment

Before deploying to production:

1. **Update Firebase Rules**: Add authentication checks
2. **Environment Variables**: Use secret managers (Google Secret Manager, AWS Secrets)
3. **API Keys**: Rotate regularly, use key restrictions
4. **CORS**: Configure proper origins for backend
5. **Rate Limiting**: Add rate limits to APIs
6. **Monitoring**: Set up error tracking (Sentry) and monitoring

### Current Rules (Development Only)

⚠️ Current Firebase rules allow all reads/writes. Update before production!

## Cost Estimates

- **OpenAI Whisper**: ~$0.006 per minute of audio
- **Firebase Storage**: ~$0.026 per GB
- **Firestore**: Free tier includes 50K reads, 20K writes per day
- **Cloud Functions**: Free tier includes 2M invocations per month
- **Label Studio**: Free (self-hosted)

## Next Steps

- [ ] Add Firebase Authentication
- [ ] Implement speaker diarization
- [ ] Add rate limiting
- [ ] Set up monitoring dashboard
- [ ] Deploy to production
- [ ] Add webhook notifications
- [ ] Implement team collaboration features

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

