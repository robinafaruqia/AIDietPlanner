# Environment Setup

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ai-diet-planner
SESSION_SECRET=your-secret-key-here-change-in-production
GOOGLE_AI_API_KEY=your-google-gemini-api-key-here
```

## Getting Google Gemini API Key

1. Go to: https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy the API key
4. Add it to your `.env` file as `GOOGLE_AI_API_KEY`

**Note:** If you don't provide `GOOGLE_AI_API_KEY`, the app will use hardcoded meal plans as fallback.

## For Production

Make sure to:
1. Use a strong, random SESSION_SECRET
2. Use a secure MongoDB connection string (MongoDB Atlas or your production database)
3. Set appropriate PORT for your hosting platform
4. Keep your `GOOGLE_AI_API_KEY` secure and never commit it to version control

