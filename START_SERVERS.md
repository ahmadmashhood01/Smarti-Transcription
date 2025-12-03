# 🚀 How to Start Everything (Step-by-Step)

## Step 1: Make Sure Your `.env` File is Correct

Open your `.env` file and make sure these lines are set:

```env
LABEL_STUDIO_URL=http://label-studio:8080
LABEL_STUDIO_API_KEY=<your-token-here>
LABEL_STUDIO_PROJECT_ID=12
```

**Important:** 
- `LABEL_STUDIO_URL` should be `http://label-studio:8080` (for Docker internal communication)
- Get your token from Label Studio after it starts (see Step 3)

## Step 2: Start All Services with Docker

Open PowerShell in your project folder and run:

```powershell
docker-compose up -d
```

This will start:
- ✅ Frontend (React app) on http://localhost:3000
- ✅ Backend (Node.js API) on http://localhost:5000
- ✅ Label Studio on http://localhost:8081

**Wait 30-60 seconds** for everything to start.

## Step 3: Set Up Label Studio (First Time Only)

1. **Open Label Studio in your browser:**
   ```
   http://localhost:8081
   ```

2. **Log in:**
   - Username: `admin@smarti.com`
   - Password: `smarti123`

3. **Create a Project:**
   - Click "Create Project" or "New Project"
   - Name it (e.g., "Audio Transcription")
   - For the labeling configuration, paste this XML:
   ```xml
   <View>
     <Audio name="audio" value="$audio" withControls="true" />
     <TextArea name="transcription" toName="audio" editable="true" />
   </View>
   ```
   - Click "Save"

4. **Get Your Access Token:**
   - Click your profile icon (top right)
   - Go to "Account & Settings" → "Access Token"
   - Click "Create New Token"
   - **Copy the entire token** (it's very long!)

5. **Update Your `.env` File:**
   - Open `.env`
   - Find: `LABEL_STUDIO_API_KEY=...`
   - Replace with: `LABEL_STUDIO_API_KEY=<paste-your-new-token>`
   - **Also check your Project ID:**
     - Look at the URL when viewing your project: `http://localhost:8081/projects/12/...`
     - The number (12) is your Project ID
     - Make sure: `LABEL_STUDIO_PROJECT_ID=12` (or your actual project ID)

6. **Restart Backend:**
   ```powershell
   docker-compose restart backend
   ```

## Step 4: Test Your App

1. **Open your app:**
   ```
   http://localhost:3000
   ```

2. **Upload an audio file**

3. **Wait for transcription** (status will change to "transcribed")

4. **Click on the task** to open it

5. **You should see Label Studio interface** with waveform and segments! 🎉

## Useful Commands

### Check if everything is running:
```powershell
docker-compose ps
```

### View logs:
```powershell
# All services
docker-compose logs

# Just backend
docker-compose logs backend

# Just Label Studio
docker-compose logs label-studio

# Follow logs (live updates)
docker-compose logs -f backend
```

### Stop everything:
```powershell
docker-compose down
```

### Restart a specific service:
```powershell
docker-compose restart backend
docker-compose restart frontend
docker-compose restart label-studio
```

### Start everything fresh:
```powershell
docker-compose down
docker-compose up -d
```

## Troubleshooting

### "Label Studio won't start"
- Check logs: `docker-compose logs label-studio`
- Make sure port 8081 is not used by another program
- Try: `docker-compose down` then `docker-compose up -d`

### "Can't connect to Label Studio"
- Make sure Label Studio is running: `docker-compose ps`
- Check if it's accessible: Open http://localhost:8081 in browser
- Check logs: `docker-compose logs label-studio`

### "Invalid token" error
- Make sure you copied the **entire** token (it's very long!)
- Make sure you updated `.env` file
- Restart backend: `docker-compose restart backend`

### "Page doesn't exist" in iframe
- Check if task exists in Label Studio: Go to http://localhost:8081 and check your project
- Verify Project ID matches in `.env` file
- Check browser console (F12) for errors

## That's It! 🎉

Everything should now be running. Your app is at http://localhost:3000 and Label Studio is at http://localhost:8081.

