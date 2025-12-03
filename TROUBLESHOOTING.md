# Troubleshooting Guide

## Issue: Tasks Stay in "Queued" Status

If tasks remain in "queued" status and never get transcribed, check the following:

### 1. Check if Cloud Function is Deployed

```bash
# List deployed functions
firebase functions:list

# Check function logs
firebase functions:log --only transcribeOnCreate
```

**Expected output**: You should see `transcribeOnCreate` in the list.

**If not deployed:**
```bash
cd cloud-functions
npm install
cd ..
firebase deploy --only functions
```

### 2. Verify OpenAI API Key is Set

```bash
# Check if key is configured
firebase functions:config:get

# Should show:
# {
#   "openai": {
#     "key": "sk-..."
#   }
# }
```

**If not set:**
```bash
firebase functions:config:set openai.key="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"
firebase deploy --only functions
```

### 3. Check Cloud Function Logs

```bash
# View recent logs
firebase functions:log --limit 50

# Watch logs in real-time
firebase functions:log --follow
```

**Look for:**
- `Starting transcription for task...` - Function triggered
- `OpenAI API error` - API key issue
- `Invalid audioUrl format` - Storage path issue
- Any error messages

### 4. Verify Task Document Structure

The Cloud Function expects:
- `status: 'queued'` (exactly this value)
- `audioUrl` field present
- Document path: `projects/{projectId}/tasks/{taskId}`

**Check in Firebase Console:**
1. Go to Firestore Database
2. Navigate to `projects/default/tasks/{taskId}`
3. Verify fields match above

### 5. Check Firebase Project Configuration

```bash
# Verify project is set correctly
firebase projects:list

# Current project should be: smartitranscription-e23ff
firebase use
```

### 6. Test Cloud Function Manually

You can test the function locally using Firebase Emulator:

```bash
# Install emulator
npm install -g firebase-tools

# Start emulator
firebase emulators:start --only functions,firestore

# In another terminal, create a test task
# The function should trigger automatically
```

### 7. Common Issues & Solutions

#### Issue: Function not triggering
**Solution**: 
- Ensure function is deployed: `firebase deploy --only functions`
- Check Firestore rules allow writes
- Verify document path matches: `projects/{projectId}/tasks/{taskId}`

#### Issue: "OpenAI API key not configured"
**Solution**:
```bash
firebase functions:config:set openai.key="your-key-here"
firebase deploy --only functions
```

#### Issue: "Invalid audioUrl format"
**Solution**: 
- Check `audioUrl` in Firestore task document
- Should be a valid Firebase Storage URL
- Format: `https://firebasestorage.googleapis.com/...` or `gs://bucket/path`

#### Issue: Function times out
**Solution**:
- Large audio files may exceed 9-minute timeout
- Consider using Cloud Run for longer processing
- Or split large files into chunks

### 8. Verify Storage Bucket

```bash
# Check if bucket exists
gsutil ls gs://smartitranscription-e23ff.firebasestorage.app

# Check storage rules
firebase deploy --only storage:rules
```

### 9. Enable Billing (If Needed)

Cloud Functions require a Blaze (pay-as-you-go) plan:
1. Go to Firebase Console
2. Settings > Usage and Billing
3. Upgrade to Blaze plan if on Spark (free) plan

### 10. Check Function Permissions

The Cloud Function needs:
- Firestore read/write permissions
- Storage read permissions
- Ability to call external APIs (OpenAI)

These are automatically granted, but verify in:
- Firebase Console > Functions > transcribeOnCreate > Permissions

## Quick Diagnostic Commands

```bash
# 1. Check function status
firebase functions:list

# 2. View recent logs
firebase functions:log --limit 20

# 3. Check config
firebase functions:config:get

# 4. Verify project
firebase use

# 5. Test deployment
firebase deploy --only functions --dry-run
```

## Still Not Working?

1. **Check Firebase Console**:
   - Functions > transcribeOnCreate > Logs
   - Look for error messages

2. **Check Firestore**:
   - Verify task document exists
   - Check `status` field is exactly `'queued'`
   - Verify `audioUrl` is present

3. **Check Storage**:
   - Verify audio file uploaded successfully
   - Check file permissions

4. **Contact Support**:
   - Share function logs
   - Share task document structure
   - Share error messages

