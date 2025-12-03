# How to Get a New Label Studio Token

## The Problem
Your current token is **expired or invalid**. You need to generate a **NEW** Personal Access Token.

## Steps to Get a New Token

### 1. Open Label Studio
Go to: **http://localhost:8081**

### 2. Log In
Use your Label Studio account credentials

### 3. Navigate to Access Tokens
- Click on your **profile/account icon** (top right)
- Go to **"Account & Settings"**
- Click on **"Access Token"** in the left menu

### 4. Create New Token
- If you see your old token, you can **"Revoke"** it (optional)
- Click **"Create New Token"** button
- **Copy the new token** immediately (you won't be able to see it again!)

### 5. Update Your `.env` File
Open your `.env` file and update line 17:

```env
LABEL_STUDIO_API_KEY=<paste-your-new-token-here>
```

**Important**: 
- Make sure there are **no spaces** before or after the token
- The token should be on a single line
- Don't add quotes around it

### 6. Restart Backend
```bash
docker-compose restart backend
```

### 7. Verify It Works
Check the logs:
```bash
docker-compose logs backend --tail=10
```

You should see: `✅ Label Studio access token refreshed`

## If You Still Get Errors

1. **Double-check the token**: Make sure you copied the entire token (it's very long)
2. **Check for spaces**: Make sure there are no extra spaces in your `.env` file
3. **Verify project ID**: Make sure `LABEL_STUDIO_PROJECT_ID=12` in your `.env`
4. **Check Label Studio is running**: Make sure http://localhost:8081 is accessible

## Your Current `.env` Should Have:

```env
LABEL_STUDIO_URL=http://label-studio:8080
LABEL_STUDIO_API_KEY=<your-new-token>
LABEL_STUDIO_PROJECT_ID=12
```

