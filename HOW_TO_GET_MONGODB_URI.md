# How to Get Your MongoDB Atlas Connection String

## Step-by-Step Guide

### Step 1: Log in to MongoDB Atlas
1. Go to: https://cloud.mongodb.com/
2. Log in with your account (or sign up if you don't have one)

---

### Step 2: Create a Cluster (if you haven't already)
1. Click **"Build a Database"** or **"Create"** button
2. Choose **"M0 FREE"** tier (Free forever)
3. Select any cloud provider (AWS, Google Cloud, or Azure)
4. Select any region (choose closest to you)
5. Name your cluster (default: "Cluster0")
6. Click **"Create Cluster"**
7. Wait 3-5 minutes for cluster to be created

---

### Step 3: Create Database User
1. In the left sidebar, click **"Database Access"**
2. Click **"Add New Database User"** button
3. Choose **"Password"** authentication method
4. Enter a **Username** (e.g., "dietplanner" or "admin")
5. Enter a **Password** (click "Autogenerate Secure Password" or create your own)
   - **⚠️ IMPORTANT: Save this password! You'll need it for the connection string**
6. Under "Database User Privileges", select:
   - **"Atlas admin"** (for full access) OR
   - **"Read and write to any database"**
7. Click **"Add User"** at the bottom

---

### Step 4: Allow Network Access
1. In the left sidebar, click **"Network Access"**
2. Click **"Add IP Address"** button
3. For development/testing, click **"Allow Access from Anywhere"**
   - This adds `0.0.0.0/0` (allows all IPs)
   - **Note:** For production, you should add specific IPs only
4. Click **"Confirm"**
5. Wait a few seconds for it to be added

---

### Step 5: Get Your Connection String
1. Go back to **"Database"** (left sidebar, first option)
2. You should see your cluster (e.g., "Cluster0")
3. Click the **"Connect"** button (next to your cluster name)
4. A popup will appear with connection options
5. Click **"Connect your application"** (the second option)
6. You'll see a connection string that looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

---

### Step 6: Complete Your Connection String
The connection string you see has placeholders. You need to:

1. **Replace `<username>`** with your database username (from Step 3)
2. **Replace `<password>`** with your database password (from Step 3)
3. **Add database name** before the `?`:
   - Add `/ai-diet-planner` right after `.net` and before `?`
   - So it becomes: `...mongodb.net/ai-diet-planner?retryWrites=true...`

**Example:**
- Original: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
- After replacement: `mongodb+srv://dietplanner:MyPassword123@cluster0.xxxxx.mongodb.net/ai-diet-planner?retryWrites=true&w=majority`

**⚠️ Important Notes:**
- If your password has special characters (like `@`, `#`, `%`), you need to URL-encode them:
  - `@` becomes `%40`
  - `#` becomes `%23`
  - `%` becomes `%25`
  - etc.
- Or better: Use a password without special characters for simplicity

---

### Step 7: Copy the Complete Connection String
Your final connection string should look like:
```
mongodb+srv://yourusername:yourpassword@cluster0.xxxxx.mongodb.net/ai-diet-planner?retryWrites=true&w=majority
```

Copy this entire string.

---

### Step 8: Use in Your .env File
1. In your project directory, create or edit `.env` file:
   ```bash
   cd /Users/robina.khan/Desktop/AIDietPlanner
   ```

2. Add to `.env`:
   ```
   PORT=3000
   MONGODB_URI=mongodb+srv://yourusername:yourpassword@cluster0.xxxxx.mongodb.net/ai-diet-planner?retryWrites=true&w=majority
   SESSION_SECRET=ai-diet-planner-secret-key-12345
   ```

3. Replace the `MONGODB_URI` value with your actual connection string from Step 7

---

## Visual Guide (What You'll See)

### In MongoDB Atlas Dashboard:
```
┌─────────────────────────────────────┐
│  MongoDB Atlas                      │
├─────────────────────────────────────┤
│  [Database] ← Click here first      │
│  [Database Access]                   │
│  [Network Access]                    │
│  ...                                 │
└─────────────────────────────────────┘

Then you'll see:
┌─────────────────────────────────────┐
│  Cluster0                    [Connect]│
└─────────────────────────────────────┘
```

### When You Click "Connect":
```
┌─────────────────────────────────────┐
│  How would you like to connect?      │
│                                      │
│  ○ Connect with MongoDB Shell       │
│  ● Connect your application  ← Click │
│  ○ Connect using MongoDB Compass    │
│  ○ Connect with VS Code              │
└─────────────────────────────────────┘
```

### Connection String Display:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
[Copy] button
```

---

## Troubleshooting

### "Authentication failed"
- Check your username and password are correct
- Make sure you replaced `<username>` and `<password>` placeholders
- If password has special characters, URL-encode them

### "IP not whitelisted"
- Go to "Network Access" in MongoDB Atlas
- Make sure your IP is added (or "Allow Access from Anywhere")

### "Connection timeout"
- Check your internet connection
- Make sure the cluster is running (not paused)
- Verify the connection string is correct

### "Database not found"
- This is OK! MongoDB will create the database automatically when you first save data
- The database name in the URI (`ai-diet-planner`) will be created automatically

---

## Quick Checklist

- [ ] Created MongoDB Atlas account
- [ ] Created free cluster (M0)
- [ ] Created database user (username + password)
- [ ] Added network access (Allow from anywhere)
- [ ] Got connection string from "Connect" → "Connect your application"
- [ ] Replaced `<username>` and `<password>` in connection string
- [ ] Added `/ai-diet-planner` before the `?` in connection string
- [ ] Copied complete connection string to `.env` file

---

## Example .env File

```
PORT=3000
MONGODB_URI=mongodb+srv://dietplanner:MySecurePass123@cluster0.abc123.mongodb.net/ai-diet-planner?retryWrites=true&w=majority
SESSION_SECRET=ai-diet-planner-secret-key-change-in-production
```

**Remember:** Never commit your `.env` file to Git! It contains sensitive information.

