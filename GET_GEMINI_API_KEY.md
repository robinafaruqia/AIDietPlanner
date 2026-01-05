# How to Get Google Gemini API Key (Free)

## Step-by-Step Guide

### Step 1: Go to Google AI Studio
Visit: https://aistudio.google.com/apikey

### Step 2: Sign In
- Sign in with your Google account
- No credit card required for free tier!

### Step 3: Create API Key
1. Click **"Create API Key"** button
2. Select **"Create API key in new project"** (or choose existing project)
3. Click **"Create API key in [Project Name]"**

### Step 4: Copy Your API Key
- Your API key will be displayed
- **Copy it immediately** - you won't be able to see it again!
- It looks like: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

### Step 5: Add to Your Project
1. Open your `.env` file in the project root
2. Add the line:
   ```
   GOOGLE_AI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
   (Replace with your actual API key)

3. Save the file

### Step 6: Restart Your Server
```bash
# Stop server (Ctrl+C)
npm start
```

## Free Tier Limits

- **60 requests per minute** (free)
- **1,500 requests per day** (free)
- Perfect for development and small-scale applications
- **Cost: $0** (completely free!)

## Security Notes

- **Never commit your API key to Git**
- The `.env` file is already in `.gitignore`
- Keep your API key secret
- If you accidentally share it, regenerate it in Google AI Studio

## Troubleshooting

### "API key not found"
- Make sure `.env` file exists in project root
- Check that `GOOGLE_AI_API_KEY` is spelled correctly
- Restart the server after adding the key

### "API key invalid"
- Verify you copied the entire key
- Check for extra spaces or characters
- Try creating a new API key

### "Quota exceeded"
- You've hit the free tier limit (60/min or 1500/day)
- Wait a bit and try again
- The app will automatically fallback to hardcoded meals

## What Happens Without API Key?

The app will still work! It will use hardcoded meal plans instead of AI-generated ones. You'll still get:
- Weekly meal plans
- Grocery lists
- All features work normally

The AI just makes the meal plans more personalized and dynamic.

