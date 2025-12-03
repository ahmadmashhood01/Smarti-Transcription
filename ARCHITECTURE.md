# System Architecture

## Overview

Smarti Transcription is a hybrid architecture combining serverless (Firebase Cloud Functions) and containerized services (Docker) for audio transcription and annotation workflows.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                           │
│                      http://localhost:3000                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
        ┌──────────────┐        ┌─────────────┐
        │   React UI   │        │  Firebase   │
        │   (Vite +    │        │  (Firestore │
        │  Tailwind)   │        │  + Storage) │
        └──────┬───────┘        └─────┬───────┘
               │                      │
               ▼                      ▼
        ┌──────────────┐      ┌──────────────┐
        │ Node.js API  │      │Cloud Function│
        │  (Express)   │      │   (Whisper   │
        │   :5000      │      │  + peaks.json)│
        └──────┬───────┘      └──────────────┘
               │                      │
               ▼                      ▼
        ┌──────────────┐        ┌──────────────┐
        │Label Studio  │        │ OpenAI API   │
        │   Server     │        │   (Whisper)  │
        │   :8080      │        └──────────────┘
        └──────────────┘
```

## Components

### 1. React Frontend (Port 3000)

**Technology**: Vite + React 18 + Tailwind CSS

**Responsibilities**:
- Audio file upload UI
- Display transcription list with real-time updates
- Search and filter functionality
- Waveform visualization (WaveSurfer.js)
- Export dialog
- Label Studio integration (open in new tab)

**Key Features**:
- Drag & drop file upload
- Real-time Firestore listeners
- Batch upload support
- Responsive design

**Data Flow**:
1. User uploads audio → Firebase Storage
2. Creates Firestore task document
3. Subscribes to task updates via `onSnapshot`
4. Displays status changes in real-time

### 2. Node.js Backend (Port 5000)

**Technology**: Express.js + Firebase Admin SDK

**Responsibilities**:
- Export formatters (SRT, VTT, TXT, JSON)
- Label Studio API integration
- Middleware between frontend and Label Studio

**Why Separate Backend?**
- Export logic should run server-side (format conversion)
- Label Studio API calls need server-side authentication
- Easier to add rate limiting and caching
- Keeps frontend lightweight

**Routes**:
```
/api/export/:taskId              # Export single task
/api/export/batch                # Batch export
/api/label-studio/create         # Create LS task
/api/label-studio/sync/:taskId   # Sync annotations
/api/label-studio/task/:taskId   # Get LS task URL
```

### 3. Firebase Cloud Function

**Trigger**: Firestore document creation (`projects/{projectId}/tasks/{taskId}`)

**Responsibilities**:
1. Download audio from Storage
2. Call OpenAI Whisper API
3. Generate peaks.json for waveform
4. Update Firestore with segments

**Why Cloud Function?**
- Auto-scales with demand
- No server management
- Pay only for execution time
- Direct Firebase integration

**Process Flow**:
```
1. Task created → status: 'queued'
2. Function triggered
3. Update status: 'transcribing'
4. Download audio from Storage
5. Call Whisper API
6. Generate peaks.json
7. Upload peaks to Storage
8. Update task with segments
9. Set status: 'transcribed'
```

**Error Handling**:
- Catches all errors
- Updates task status to 'error'
- Logs to Firebase Functions logger
- Saves error message to Firestore

### 4. Label Studio (Port 8080)

**Technology**: Label Studio OSS (Docker)

**Responsibilities**:
- Annotation interface for reviewing transcriptions
- Audio playback synchronized with text
- Segment editing and speaker labeling

**Why Separate Tab?**
- Avoids CORS and iframe issues
- Better performance
- Native Label Studio experience
- Easier to maintain

**Integration Flow**:
```
1. Backend creates LS task with predictions
2. Predictions = Whisper segments (pre-annotations)
3. User edits in Label Studio
4. User saves annotation
5. Backend syncs changes back to Firestore
```

### 5. Firebase Services

#### Firestore

**Schema**:
```javascript
projects/{projectId}/tasks/{taskId}
{
  id, audioUrl, peaksUrl, filename, duration,
  status, whisper, segments, labelStudioTaskId,
  createdAt, updatedAt, metadata
}
```

**Indexes**:
- `status` + `createdAt` (for filtering)
- `filename` + `createdAt` (for search)

#### Storage

**Structure**:
```
/audio/{projectId}/{taskId}/{filename}      # Audio files
/peaks/{projectId}/{taskId}/peaks.json      # Waveform data
/exports/{projectId}/{taskId}/{format}      # Exported files
```

**Rules**:
- Public read (for audio playback)
- Authenticated write (for uploads)
- Cloud Function write (for peaks)

## Data Flow

### Upload & Transcribe Flow

```
1. User drops audio file
   ↓
2. Frontend uploads to Firebase Storage
   ↓
3. Frontend creates Firestore task document
   status: 'queued'
   ↓
4. Cloud Function triggered (onCreate)
   ↓
5. Function downloads audio
   ↓
6. Function calls Whisper API
   ↓
7. Function generates peaks.json
   ↓
8. Function updates Firestore
   status: 'transcribed'
   segments: [...]
   ↓
9. Frontend receives update (onSnapshot)
   ↓
10. UI displays transcription
```

### Review Flow

```
1. User clicks "Create Label Studio Task"
   ↓
2. Backend creates LS task via API
   predictions: Whisper segments
   ↓
3. Backend updates Firestore with LS task ID
   ↓
4. User clicks "Edit in Label Studio"
   ↓
5. Opens http://localhost:8080/tasks/{id}
   ↓
6. User edits transcription in LS
   ↓
7. User saves in LS
   ↓
8. User clicks "Sync from Label Studio"
   ↓
9. Backend fetches annotations from LS
   ↓
10. Backend updates Firestore segments
    status: 'reviewed'
```

### Export Flow

```
1. User clicks "Export"
   ↓
2. Frontend shows format dialog
   ↓
3. User selects format (SRT/VTT/TXT/JSON)
   ↓
4. Frontend calls backend API
   ↓
5. Backend fetches task from Firestore
   ↓
6. Backend formats segments
   ↓
7. Backend returns formatted file
   ↓
8. Browser downloads file
```

## Design Decisions

### Why Not Embed Label Studio?

**Problems with Embedding**:
- CORS issues with Firebase Storage URLs
- Session/cookie conflicts
- Complex iframe communication
- Slower performance
- Maintenance overhead

**Solution**: Open in new tab
- Clean separation of concerns
- Native Label Studio experience
- Better performance
- Easier debugging

### Why Cloud Function for Whisper?

**Alternatives Considered**:
1. Run Whisper in backend container
2. Use dedicated transcription service
3. Queue-based worker

**Why Cloud Function**:
- Auto-scales with load
- No always-on costs
- Direct Firebase integration
- Simpler architecture
- OpenAI handles model management

### Why Node Backend + Cloud Function?

**Why not do everything in Cloud Functions?**

Cloud Functions are for:
- Event-driven processing (Whisper)
- Scheduled tasks
- Short-lived operations

Backend API is for:
- Real-time request/response
- Complex business logic
- Third-party integrations (Label Studio)
- Synchronous operations

### Why Firebase over Custom Backend?

**Advantages**:
- Real-time updates (`onSnapshot`)
- Managed infrastructure
- Built-in authentication
- Generous free tier
- Global CDN for Storage
- Automatic scaling

**Tradeoffs**:
- Vendor lock-in
- Cost at scale
- Limited query capabilities

## Scalability

### Current Limits

- **Cloud Function**: 540s timeout, 2GB memory
- **Firestore**: 1 write/second per document
- **Storage**: 5GB free tier

### Scaling Strategies

**For 100+ concurrent uploads**:
1. Use Cloud Pub/Sub queue
2. Add rate limiting
3. Implement batch processing
4. Use Cloud Run for longer timeouts

**For 1000+ tasks**:
1. Add Firestore indexes
2. Implement pagination
3. Use Algolia for search
4. Cache frequently accessed data

**For production**:
1. Add CDN for static assets
2. Use Redis for caching
3. Implement webhook notifications
4. Add monitoring and alerts

## Security

### Current State (Development)

- Open Firestore rules (allow all)
- Open Storage rules (allow all)
- No authentication

### Production Requirements

1. **Firebase Auth**: Enable email/Google sign-in
2. **Firestore Rules**: Check `request.auth != null`
3. **Storage Rules**: Check ownership
4. **API Keys**: Use environment variables
5. **CORS**: Whitelist specific origins
6. **Rate Limiting**: Prevent abuse

## Monitoring

### Recommended Setup

1. **Sentry**: Error tracking (backend + frontend)
2. **Firebase Performance**: Frontend performance
3. **Cloud Monitoring**: Function execution metrics
4. **Custom Dashboards**: Transcription success rate

### Key Metrics

- Transcription success rate
- Average transcription time
- API error rates
- Storage usage
- Whisper API costs

## Cost Optimization

### Current Costs

- **OpenAI Whisper**: $0.006/minute of audio
- **Firebase Storage**: $0.026/GB
- **Cloud Functions**: Free tier (2M invocations)
- **Firestore**: Free tier (50K reads/day)

### Optimization Tips

1. Cache peaks.json (reduce regeneration)
2. Delete old audio files
3. Use smaller Whisper model for drafts
4. Batch process during off-peak hours
5. Implement file size limits

## Future Enhancements

1. **Speaker Diarization**: Identify multiple speakers
2. **Real-time Transcription**: Stream results as they arrive
3. **Translation**: Multi-language support
4. **Video Support**: Extract audio from video
5. **Team Collaboration**: Multiple users, permissions
6. **Webhooks**: Notify external systems
7. **Advanced Search**: Full-text search with Algolia
8. **Mobile App**: React Native version

## Development Workflow

### Local Development

```bash
# Start all services
docker-compose up

# Frontend only
cd frontend && npm run dev

# Backend only
cd backend && npm run dev

# Test Cloud Function locally
cd cloud-functions && firebase emulators:start
```

### Testing Strategy

1. **Unit Tests**: Export formatters, utilities
2. **Integration Tests**: API endpoints
3. **E2E Tests**: Upload → Transcribe → Export flow
4. **Manual Testing**: Label Studio integration

### Deployment

```bash
# Deploy rules
firebase deploy --only firestore:rules,storage:rules

# Deploy functions
firebase deploy --only functions

# Deploy frontend
npm run build
firebase deploy --only hosting

# Backend (production)
# Deploy to Cloud Run or similar
```

## Conclusion

This architecture provides:
- ✅ Scalability (Cloud Functions + Firebase)
- ✅ Real-time updates (Firestore)
- ✅ Professional annotation (Label Studio)
- ✅ Flexibility (separate frontend/backend)
- ✅ Cost-effectiveness (serverless + containers)
- ✅ Developer experience (modern stack)

