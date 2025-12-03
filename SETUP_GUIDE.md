# Quick Setup Guide

Follow these steps to get Smarti Transcription running locally.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Docker & Docker Compose installed
- [ ] Firebase account created
- [ ] OpenAI API key with Whisper access

## Step-by-Step Setup (15 minutes)

### 1. Firebase Project Setup (5 min)

```bash
# 1. Create Firebase project at https://console.firebase.google.com
# 2. Enable Firestore Database (Start in production mode)
# 3. Enable Storage
# 4. Download service account key:
#    Settings > Service Accounts > Generate New Private Key
#    Save as: serviceAccountKey.json in project root
```

### 2. Update Configuration (2 min)

```bash
# Update .firebaserc with your project ID
{
  "projects": {
    "default": "YOUR_PROJECT_ID_HERE"
  }
}

# Copy environment template
cp env.example .env

# Edit .env and add:
# - Firebase project details
# - OPENAI_API_KEY=sk-your-key-here
```

### 3. Deploy Firebase (2 min)

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy rules
firebase deploy --only firestore:rules,storage:rules

# Install Cloud Functions dependencies


cd cloud-functions
npm install
cd ..

# Set OpenAI API key for Cloud Functions
firebase functions:config:set openai.key="sk-your-openai-key"

# Deploy Cloud Function
firebase deploy --only functions
```

### 4. Start Docker Services (3 min)

```bash
# Start all services
docker-compose up --build

# Services will be available at:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:5000  
# - Label Studio: http://localhost:8080
```

### 5. Configure Label Studio (3 min)

```bash
# 1. Open http://localhost:8080
# 2. Sign up (or use default: admin@smarti.com / smarti123)
# 3. Create new project:
#    - Name: "Audio Transcription"
#    - Data Import: "Upload Files" (skip for now)
# 4. Go to Settings > Labeling Interface
#    - Copy contents from label-studio-config.xml
#    - Or use: Audio > Transcribe Audio
# 5. Save project
# 6. Get API token: Settings > Account > Access Token
# 7. Update .env:
LABEL_STUDIO_API_KEY=your-token-here
LABEL_STUDIO_PROJECT_ID=1

# 8. Restart backend
docker-compose restart backend
```

## Verify Installation

### Test 1: Frontend Access
```bash
# Open http://localhost:3000
# You should see the upload interface
```

### Test 2: Backend Health
```bash
curl http://localhost:5000/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Test 3: Upload & Transcribe
1. Open http://localhost:3000
2. Upload a short audio file (< 1 minute for testing)
3. Watch status change: queued → transcribing → transcribed
4. Click on transcription to view details
5. Export as SRT/VTT/TXT/JSON

### Test 4: Label Studio Integration
1. Click on a transcribed file
2. Click "Create Label Studio Task"
3. Click "Edit in Label Studio"
4. Label Studio should open in new tab
5. Make edits and save
6. Return to frontend
7. Click "Sync from Label Studio"
8. Changes should appear in Firestore

## Common Issues

### Issue: Cloud Function fails

**Solution 1: Check OpenAI API key**
```bash
firebase functions:config:get
# Verify openai.key is set

firebase functions:config:set openai.key="sk-your-key"
firebase deploy --only functions
```

**Solution 2: Check logs**
```bash
firebase functions:log
```

### Issue: Frontend can't connect to backend

**Solution: Check environment variables**
```bash
# In frontend/.env or docker-compose.yml
REACT_APP_API_URL=http://localhost:5000
REACT_APP_LABEL_STUDIO_URL=http://localhost:8080

# Restart services
docker-compose restart
```

### Issue: Label Studio integration fails

**Solution: Verify configuration**
```bash
# Check .env has:
LABEL_STUDIO_URL=http://label-studio:8080  # For backend
LABEL_STUDIO_API_KEY=your-token
LABEL_STUDIO_PROJECT_ID=1

# Restart backend
docker-compose restart backend
```

### Issue: Firebase Storage upload fails

**Solution: Check Storage rules**
```bash
# Deploy storage rules
firebase deploy --only storage

# Verify in Firebase Console:
# Storage > Rules
# Should allow read/write (for development)
```

### Issue: Docker services won't start

**Solution: Check ports**
```bash
# Make sure ports 3000, 5000, 8080 are available
lsof -i :3000
lsof -i :5000
lsof -i :8080

# Or change ports in docker-compose.yml
```

## File Checklist

Make sure these files exist:

```
✓ firebase.json
✓ .firebaserc (with your project ID)
✓ firestore.rules
✓ storage.rules
✓ serviceAccountKey.json (in root, gitignored)
✓ .env (copied from env.example)
✓ docker-compose.yml
```

## Next Steps

1. **Test with real audio**: Upload a longer file (5-10 minutes)
2. **Configure Sentry**: Add error tracking for production
3. **Add authentication**: Enable Firebase Auth
4. **Monitor costs**: Check OpenAI and Firebase usage
5. **Deploy to production**: Use Firebase Hosting for frontend

## Support

If you encounter issues:
1. Check logs: `docker-compose logs -f`
2. Check Cloud Function logs: `firebase functions:log`
3. Verify all environment variables are set
4. Ensure all services are running: `docker ps`

## Production Checklist

Before deploying to production:

- [ ] Update Firebase rules with authentication
- [ ] Add rate limiting to backend
- [ ] Set up error tracking (Sentry)
- [ ] Configure CORS properly
- [ ] Use environment-specific configs
- [ ] Set up monitoring and alerts
- [ ] Add backup strategy for Firestore
- [ ] Review and optimize Whisper model costs
- [ ] Set up CI/CD pipeline
- [ ] Add integration tests

Happy transcribing! 🎙️

