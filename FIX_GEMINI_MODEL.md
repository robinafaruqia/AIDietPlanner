# Fix Gemini Model Error: 404 Not Found

## Problem
You're seeing this error:
```
[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent: [404 Not Found] models/gemini-1.5-flash-latest is not found
```

## Solution

The model name `gemini-1.5-flash-latest` is not valid. Use one of these valid model names:

### Valid Gemini Model Names:
1. **`gemini-1.5-flash`** ✅ (Recommended - Fast and free tier)
2. **`gemini-1.5-pro`** ✅ (More capable, may have usage limits)
3. **`gemini-pro`** ✅ (Older version, still works)

## Fix Applied

The code has been updated to use `gemini-1.5-flash` instead of `gemini-1.5-flash-latest`.

## If You Still Get Errors

### Option 1: Try gemini-pro (Most Compatible)
If `gemini-1.5-flash` doesn't work, try the older model:

Edit `services/aiMealGenerator.js` line 16:
```javascript
model = genAI.getGenerativeModel({ model: 'gemini-pro' });
```

### Option 2: Check Available Models
You can list available models using the API:

```bash
curl "https://generativelanguage.googleapis.com/v1/models?key=YOUR_API_KEY"
```

Replace `YOUR_API_KEY` with your actual API key.

### Option 3: Verify API Key
Make sure your API key is valid and has access to Gemini models:

1. Go to: https://aistudio.google.com/apikey
2. Verify your API key is active
3. Check if there are any restrictions on the key

## Restart After Fix

After updating the model name:

1. **If using Docker:**
   ```bash
   docker compose restart app
   ```

2. **If running locally:**
   ```bash
   # Stop server (Ctrl+C)
   npm start
   ```

## Verify It's Working

Check the logs - you should see:
```
✅ Google Gemini AI initialized
```

And when generating a meal plan:
```
Generating meal plan with AI...
AI meal plan generated successfully
```

The fix has been applied - the model name is now `gemini-1.5-flash` which is a valid model name.

