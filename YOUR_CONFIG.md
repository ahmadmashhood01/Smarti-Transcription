# Your Project Configuration

This file contains your specific Firebase and OpenAI configuration. Follow the steps below to complete setup.

## ✅ Step 1: Firebase Rules (Already Deployed)

Your Firestore and Storage rules look good for development!

## ✅ Step 2: Create .env File

Create a `.env` file in the project root with this content:

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=smartitranscription-e23ff
FIREBASE_API_KEY=AIzaSyBs9S4I8-tgoIJh1Jgv7Axw4aj9yiUSEEY
FIREBASE_AUTH_DOMAIN=smartitranscription-e23ff.firebaseapp.com
FIREBASE_STORAGE_BUCKET=smartitranscription-e23ff.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=146825638576
FIREBASE_APP_ID=1:146825638576:web:7915c4044cfca2dcef4175

# Firebase Admin SDK (for backend)
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# OpenAI API
OPENAI_API_KEY=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

# Label Studio Configuration
LABEL_STUDIO_URL=http://label-studio:8080
LABEL_STUDIO_API_KEY=your-label-studio-api-key-after-setup
LABEL_STUDIO_PROJECT_ID=1

# Backend API
BACKEND_PORT=5000

# Frontend (Vite uses VITE_ prefix)
VITE_API_URL=http://localhost:5000
VITE_LABEL_STUDIO_URL=http://localhost:8080
VITE_FIREBASE_API_KEY=AIzaSyBs9S4I8-tgoIJh1Jgv7Axw4aj9yiUSEEY
VITE_FIREBASE_AUTH_DOMAIN=smartitranscription-e23ff.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=smartitranscription-e23ff
VITE_FIREBASE_STORAGE_BUCKET=smartitranscription-e23ff.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=146825638576
VITE_FIREBASE_APP_ID=1:146825638576:web:7915c4044cfca2dcef4175

# Sentry (optional, for error tracking)
SENTRY_DSN=
```

## ⚠️ Step 3: Download Service Account Key (IMPORTANT!)

The backend needs a service account key to access Firebase:

1. Go to [Firebase Console](https://console.firebase.google.com/project/smartitranscription-e23ff/settings/serviceaccounts/adminsdk)
2. Click **"Generate New Private Key"**
3. Save the downloaded JSON file as `serviceAccountKey.json` in your project root
4. Make sure it's in `.gitignore` (already configured)

## 🔧 Step 4: Set OpenAI Key for Cloud Functions

The Cloud Function needs the OpenAI API key set via Firebase config:

```bash
# Login to Firebase (if not already)
firebase login

# Set the OpenAI API key
firebase functions:config:set openai.key="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"

# Verify it's set
firebase functions:config:get
```

## 📦 Step 5: Install Cloud Function Dependencies

```bash
cd cloud-functions
npm install
cd ..
```

## 🚀 Step 6: Deploy Cloud Function

```bash
firebase deploy --only functions
```

This will deploy the `transcribeOnCreate` function that listens for new tasks and calls Whisper API.

## 🐳 Step 7: Start Docker Services

```bash
docker-compose up --build
```

This starts:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **Label Studio**: http://localhost:8080

## 🏷️ Step 8: Configure Label Studio (After First Start)

1. Open http://localhost:8080
2. Create an account (or use default: admin@smarti.com / smarti123)
3. Create a new project:
   - Name: "Audio Transcription"
   - Go to Settings > Labeling Interface
   - Use the "Audio > Transcribe Audio" template (or paste from `label-studio-config.xml`)
4. Get your API token:
   - Go to Account & Settings
   - Copy the "Access Token"
5. Update your `.env` file:
   ```bash
   LABEL_STUDIO_API_KEY=your-actual-token-here
   ```
6. Restart backend:
   ```bash
   docker-compose restart backend
   ```

## ✅ Verification Checklist

- [x] `.firebaserc` updated with project ID: `smartitranscription-e23ff`
- [x] Firestore rules deployed
- [x] Storage rules deployed
- [ ] `.env` file created with all variables
- [ ] `serviceAccountKey.json` downloaded and placed in project root
- [ ] OpenAI key set for Cloud Functions
- [ ] Cloud Function deployed
- [ ] Docker services running
- [ ] Label Studio configured with API key

## 🧪 Test Your Setup

1. Open http://localhost:3000
2. Upload a short audio file (< 1 minute for testing)
3. Watch the status change in real-time:
   - `queued` → Cloud Function triggered
   - `transcribing` → Whisper API called
   - `transcribed` → Segments ready!
4. Click on the transcription to view details
5. Export as SRT/VTT/TXT/JSON

## 🆘 Troubleshooting

### Cloud Function Not Triggering?

```bash
# Check Cloud Function logs
firebase functions:log

# Make sure function is deployed
firebase deploy --only functions
```

### Backend Can't Connect to Firebase?

Make sure `serviceAccountKey.json` exists:
```bash
ls -la serviceAccountKey.json
```

### Frontend Not Loading?

Check environment variables are set:
```bash
docker-compose exec frontend env | grep VITE_FIREBASE
```

### Label Studio Integration Failing?

Check backend logs:
```bash
docker-compose logs backend
```

Make sure `LABEL_STUDIO_API_KEY` is set in `.env`.

## 📝 Next Steps

Once everything is working:
1. Test with longer audio files (5-10 minutes)
2. Try batch upload (multiple files)
3. Test Label Studio integration
4. Export in different formats
5. Monitor OpenAI usage/costs

## 🔐 Security Note

⚠️ **Important**: Your API keys are visible in this file. 

For production:
1. Never commit `.env` or `serviceAccountKey.json` to git
2. Use environment-specific configs
3. Rotate API keys regularly
4. Enable Firebase Authentication
5. Update security rules to check `request.auth != null`

---

**Your system is almost ready! Just complete steps 3-7 above and you're good to go! 🚀**

