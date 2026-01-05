# Troubleshooting Guide

## Error: "Failed to generate meal plan"

This error can occur for several reasons. Follow these steps to diagnose and fix:

### Step 1: Check if Server is Running

1. Open terminal
2. Navigate to project:
   ```bash
   cd /Users/robina.khan/Desktop/AIDietPlanner
   ```
3. Check if server is running:
   ```bash
   npm start
   ```
4. You should see:
   ```
   MongoDB connected successfully
   Server running on port 3000
   ```

### Step 2: Check MongoDB Connection

**If you see "MongoDB connection error":**

1. **Check your .env file:**
   ```bash
   cat .env
   ```
   Make sure `MONGODB_URI` is set correctly

2. **For MongoDB Atlas:**
   - Verify connection string is correct
   - Check username and password are correct
   - Make sure network access is allowed (IP whitelist)

3. **For Local MongoDB:**
   - Make sure MongoDB is running:
     ```bash
     brew services list  # Check if mongodb-community is running
     ```
   - Start MongoDB if not running:
     ```bash
     brew services start mongodb-community
     ```

4. **Test MongoDB Connection:**
   ```bash
   # For local MongoDB
   mongosh mongodb://localhost:27017/ai-diet-planner
   
   # For MongoDB Atlas
   mongosh "your-connection-string"
   ```

### Step 3: Check Server Logs

When you submit the form, check the terminal where the server is running. You should see:
- Any error messages
- "Error generating meal plan:" followed by details
- MongoDB connection status

### Step 4: Check Browser Console

1. Open browser Developer Tools (F12 or Cmd+Option+I)
2. Go to "Console" tab
3. Try generating a meal plan
4. Look for any JavaScript errors or API errors

### Step 5: Common Issues and Solutions

#### Issue: "MongoDB connection error"
**Solution:**
- Verify `.env` file has correct `MONGODB_URI`
- For Atlas: Check connection string format
- For local: Make sure MongoDB service is running

#### Issue: "Network Error" or "Connection Refused"
**Solution:**
- Make sure server is running on port 3000
- Check if port 3000 is already in use:
  ```bash
  lsof -i :3000
  ```
- Change PORT in `.env` if needed

#### Issue: "Cannot read property of undefined"
**Solution:**
- This might be a code issue
- Check server logs for detailed error
- Make sure all dependencies are installed:
  ```bash
  npm install
  ```

#### Issue: Form submits but nothing happens
**Solution:**
- Check browser console for JavaScript errors
- Verify jQuery is loaded
- Check network tab in DevTools to see if API call is made

### Step 6: Test Without MongoDB (Fallback Mode)

The application now has a fallback mode that works even if MongoDB is not connected. The meal plan will be generated but not saved to database.

To test:
1. Make sure server is running
2. Submit the form
3. You should see a meal plan (with a warning that it's not saved)

### Step 7: Verify All Files Are Present

Make sure these files exist:
- `server.js`
- `routes/mealPlan.js`
- `services/mealPlanner.js`
- `models/User.js`
- `models/MealPlan.js`
- `.env` file

### Step 8: Reinstall Dependencies

If nothing works, try:
```bash
rm -rf node_modules
npm install
npm start
```

## Quick Diagnostic Commands

```bash
# Check if Node.js is installed
node --version

# Check if npm is installed
npm --version

# Check if MongoDB is running (local)
brew services list | grep mongodb

# Check if port 3000 is in use
lsof -i :3000

# Check .env file
cat .env

# Test MongoDB connection (local)
mongosh mongodb://localhost:27017/ai-diet-planner

# View server logs
# (Check terminal where npm start is running)
```

## Still Having Issues?

1. **Check server terminal** for detailed error messages
2. **Check browser console** (F12) for JavaScript errors
3. **Check network tab** in browser DevTools to see API responses
4. **Verify .env file** has correct MongoDB URI
5. **Make sure all dependencies are installed**: `npm install`

## Getting More Help

If you're still stuck, provide:
1. Full error message from server terminal
2. Error from browser console
3. Your `.env` file (remove password before sharing)
4. MongoDB connection type (Atlas or local)

