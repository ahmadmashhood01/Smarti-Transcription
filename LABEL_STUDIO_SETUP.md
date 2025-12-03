# Label Studio Docker Setup Guide (For Beginners)

This guide will help you set up Label Studio to run in Docker alongside your app.

## Step 1: Stop Your Local Label Studio

If you're running Label Studio locally (in PowerShell), **close that window** or press `Ctrl+C` to stop it.

## Step 2: Update Your `.env` File

Open your `.env` file and change this line:

**Change FROM:**
```
LABEL_STUDIO_URL=http://host.docker.internal:8081
```

**Change TO:**
```
LABEL_STUDIO_URL=http://label-studio:8080
```

**Important:** Keep your `LABEL_STUDIO_API_KEY` and `LABEL_STUDIO_PROJECT_ID` for now. We'll update the token later.

## Step 3: Start Everything with Docker

Open PowerShell in your project folder and run:

```powershell
docker-compose up -d
```

This will:
- Start your frontend (React app)
- Start your backend (Node.js API)
- Start Label Studio (in Docker)

Wait about 30-60 seconds for everything to start.

## Step 4: Access Label Studio

1. Open your browser
2. Go to: **http://localhost:8081**
3. You should see the Label Studio login page

## Step 5: Log In to Label Studio

**Username:** `admin@smarti.com`  
**Password:** `smarti123`

(These are set in docker-compose.yml)

## Step 6: Create a Project in Label Studio

1. After logging in, click **"Create Project"** or **"New Project"**
2. Give it a name (e.g., "Audio Transcription")
3. For the labeling configuration, use this XML:

```xml
<View>
  <Audio name="audio" value="$audio" withControls="true" />
  <TextArea name="transcription" toName="audio" editable="true" />
</View>
```

4. Click **"Save"** or **"Create"**

## Step 7: Get Your Access Token

1. Click on your profile/account icon (top right)
2. Go to **"Account & Settings"**
3. Click **"Access Token"** or **"Personal Access Token"**
4. Click **"Create New Token"**
5. Copy the token (it's a long string starting with `eyJ...`)

## Step 8: Update Your `.env` File with the New Token

1. Open your `.env` file
2. Find this line:
   ```
   LABEL_STUDIO_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Replace the old token with your new token:
   ```
   LABEL_STUDIO_API_KEY=<paste-your-new-token-here>
   ```
4. **Also check your Project ID:**
   - In Label Studio, look at the URL when you're viewing your project
   - It will be something like: `http://localhost:8081/projects/12/...`
   - The number (12) is your Project ID
   - Make sure your `.env` has: `LABEL_STUDIO_PROJECT_ID=12` (or whatever number you see)

## Step 9: Restart the Backend

In PowerShell, run:

```powershell
docker-compose restart backend
```

This makes the backend use your new token.

## Step 10: Test It!

1. Go to your app: **http://localhost:3000**
2. Upload an audio file
3. Wait for it to transcribe
4. Click on the task
5. Click **"Create Label Studio Task"** button
6. It should work! 🎉

## Troubleshooting

### "Can't connect to Label Studio"
- Make sure Docker is running
- Check if Label Studio is running: `docker-compose ps`
- Try accessing http://localhost:8081 in your browser

### "Invalid token" error
- Make sure you copied the **entire** token (it's very long)
- Make sure you updated the `.env` file
- Restart the backend: `docker-compose restart backend`

### "Project not found"
- Check your Project ID in Label Studio URL
- Update `LABEL_STUDIO_PROJECT_ID` in `.env`
- Restart the backend

### Label Studio won't start
- Check logs: `docker-compose logs label-studio`
- Make sure port 8081 is not used by another program
- Try: `docker-compose down` then `docker-compose up -d`

## Useful Commands

```powershell
# See all running containers
docker-compose ps

# View Label Studio logs
docker-compose logs label-studio

# View backend logs
docker-compose logs backend

# Stop everything
docker-compose down

# Start everything
docker-compose up -d

# Restart just the backend
docker-compose restart backend
```

## That's It!

Now Label Studio runs in Docker with your app. Everything is managed together! 🚀
