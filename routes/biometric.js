const express = require('express');
const router = express.Router();
const { requireAuth, apiAuth } = require('../middleware/auth');
const User = require('../models/User');

// Google Fitness API configuration
const GOOGLE_FIT_SCOPES = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.nutrition.read'
];

// Get biometric connection status
router.get('/status', apiAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const connections = {
            googleFit: {
                connected: !!(user.biometricConnections?.googleFit?.connected),
                lastSync: user.biometricConnections?.googleFit?.lastSync || null
            },
            appleHealth: {
                connected: false, // Apple Health requires native app
                message: 'Apple Health integration requires a native iOS app'
            },
            fitbit: {
                connected: !!(user.biometricConnections?.fitbit?.connected),
                lastSync: user.biometricConnections?.fitbit?.lastSync || null
            }
        };

        res.json({
            success: true,
            connections,
            latestData: user.biometricData || null
        });
    } catch (error) {
        console.error('Biometric status error:', error);
        res.status(500).json({ success: false, error: 'Failed to get biometric status' });
    }
});

// Initiate Google Fit connection
router.get('/connect/google-fit', requireAuth, (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL?.replace('/auth/google/callback', '/api/biometric/callback/google-fit');
    
    if (!clientId || !redirectUri) {
        return res.status(500).json({ 
            success: false, 
            error: 'Google OAuth not configured' 
        });
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(GOOGLE_FIT_SCOPES.join(' '))}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${req.session.userId}`;

    res.redirect(authUrl);
});

// Google Fit OAuth callback
router.get('/callback/google-fit', async (req, res) => {
    try {
        const { code, state: userId } = req.query;

        if (!code || !userId) {
            return res.redirect('/profile?error=google_fit_auth_failed');
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_CALLBACK_URL?.replace('/auth/google/callback', '/api/biometric/callback/google-fit');

        // Exchange code for tokens
        const fetch = (await import('node-fetch')).default;
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error('Google Fit token error:', tokens);
            return res.redirect('/profile?error=google_fit_token_failed');
        }

        // Update user with Google Fit connection
        await User.findByIdAndUpdate(userId, {
            'biometricConnections.googleFit': {
                connected: true,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
                connectedAt: new Date()
            }
        });

        res.redirect('/profile?success=google_fit_connected');
    } catch (error) {
        console.error('Google Fit callback error:', error);
        res.redirect('/profile?error=google_fit_connection_failed');
    }
});

// Disconnect Google Fit
router.post('/disconnect/google-fit', apiAuth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.session.userId, {
            'biometricConnections.googleFit': {
                connected: false,
                accessToken: null,
                refreshToken: null,
                tokenExpiry: null
            }
        });

        res.json({ success: true, message: 'Google Fit disconnected' });
    } catch (error) {
        console.error('Disconnect error:', error);
        res.status(500).json({ success: false, error: 'Failed to disconnect' });
    }
});

// Sync data from Google Fit
router.post('/sync/google-fit', apiAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        
        if (!user?.biometricConnections?.googleFit?.connected) {
            return res.status(400).json({ 
                success: false, 
                error: 'Google Fit not connected' 
            });
        }

        let accessToken = user.biometricConnections.googleFit.accessToken;
        
        // Check if token needs refresh
        if (new Date() >= user.biometricConnections.googleFit.tokenExpiry) {
            accessToken = await refreshGoogleFitToken(user);
        }

        const fetch = (await import('node-fetch')).default;
        
        // Define time range (last 7 days)
        const endTime = Date.now();
        const startTime = endTime - (7 * 24 * 60 * 60 * 1000);

        const biometricData = {
            steps: null,
            heartRate: null,
            weight: null,
            sleep: null,
            calories: null,
            lastSync: new Date()
        };

        // Fetch Steps
        try {
            const stepsResponse = await fetch(
                `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
                        bucketByTime: { durationMillis: 86400000 }, // 1 day
                        startTimeMillis: startTime,
                        endTimeMillis: endTime
                    })
                }
            );
            const stepsData = await stepsResponse.json();
            biometricData.steps = parseGoogleFitSteps(stepsData);
        } catch (e) {
            console.error('Error fetching steps:', e);
        }

        // Fetch Heart Rate
        try {
            const heartRateResponse = await fetch(
                `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
                        bucketByTime: { durationMillis: 86400000 },
                        startTimeMillis: startTime,
                        endTimeMillis: endTime
                    })
                }
            );
            const heartRateData = await heartRateResponse.json();
            biometricData.heartRate = parseGoogleFitHeartRate(heartRateData);
        } catch (e) {
            console.error('Error fetching heart rate:', e);
        }

        // Fetch Weight
        try {
            const weightResponse = await fetch(
                `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        aggregateBy: [{ dataTypeName: 'com.google.weight' }],
                        bucketByTime: { durationMillis: 86400000 },
                        startTimeMillis: startTime,
                        endTimeMillis: endTime
                    })
                }
            );
            const weightData = await weightResponse.json();
            biometricData.weight = parseGoogleFitWeight(weightData);
        } catch (e) {
            console.error('Error fetching weight:', e);
        }

        // Fetch Calories Burned
        try {
            const caloriesResponse = await fetch(
                `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        aggregateBy: [{ dataTypeName: 'com.google.calories.expended' }],
                        bucketByTime: { durationMillis: 86400000 },
                        startTimeMillis: startTime,
                        endTimeMillis: endTime
                    })
                }
            );
            const caloriesData = await caloriesResponse.json();
            biometricData.calories = parseGoogleFitCalories(caloriesData);
        } catch (e) {
            console.error('Error fetching calories:', e);
        }

        // Update user with biometric data
        await User.findByIdAndUpdate(req.session.userId, {
            biometricData,
            'biometricConnections.googleFit.lastSync': new Date()
        });

        res.json({
            success: true,
            data: biometricData
        });

    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ success: false, error: 'Failed to sync biometric data' });
    }
});

// Get latest biometric data
router.get('/data', apiAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        
        res.json({
            success: true,
            data: user?.biometricData || null,
            lastSync: user?.biometricConnections?.googleFit?.lastSync || null
        });
    } catch (error) {
        console.error('Get biometric data error:', error);
        res.status(500).json({ success: false, error: 'Failed to get biometric data' });
    }
});

// Manual entry for biometric data (for users without connected devices)
router.post('/manual-entry', apiAuth, async (req, res) => {
    try {
        const { steps, heartRate, weight, sleepHours, caloriesBurned } = req.body;
        const today = new Date().toISOString().split('T')[0];

        const updateData = {};
        
        if (steps !== undefined) {
            updateData[`biometricData.steps.${today}`] = parseInt(steps);
        }
        if (heartRate !== undefined) {
            updateData[`biometricData.heartRate.${today}`] = {
                avg: parseInt(heartRate),
                min: parseInt(heartRate) - 10,
                max: parseInt(heartRate) + 20
            };
        }
        if (weight !== undefined) {
            updateData[`biometricData.weight.${today}`] = parseFloat(weight);
            // Also update user's current weight
            updateData['currentWeight'] = parseFloat(weight);
        }
        if (sleepHours !== undefined) {
            updateData[`biometricData.sleep.${today}`] = parseFloat(sleepHours);
        }
        if (caloriesBurned !== undefined) {
            updateData[`biometricData.calories.${today}`] = parseInt(caloriesBurned);
        }

        updateData['biometricData.lastSync'] = new Date();

        await User.findByIdAndUpdate(req.session.userId, updateData);

        res.json({ success: true, message: 'Biometric data saved' });
    } catch (error) {
        console.error('Manual entry error:', error);
        res.status(500).json({ success: false, error: 'Failed to save biometric data' });
    }
});

// Helper functions
async function refreshGoogleFitToken(user) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: user.biometricConnections.googleFit.refreshToken,
            grant_type: 'refresh_token'
        })
    });

    const tokens = await response.json();
    
    if (tokens.access_token) {
        await User.findByIdAndUpdate(user._id, {
            'biometricConnections.googleFit.accessToken': tokens.access_token,
            'biometricConnections.googleFit.tokenExpiry': new Date(Date.now() + tokens.expires_in * 1000)
        });
        return tokens.access_token;
    }
    
    throw new Error('Failed to refresh token');
}

function parseGoogleFitSteps(data) {
    const steps = {};
    if (data.bucket) {
        data.bucket.forEach(bucket => {
            const date = new Date(parseInt(bucket.startTimeMillis)).toISOString().split('T')[0];
            const points = bucket.dataset?.[0]?.point || [];
            const value = points.reduce((sum, p) => sum + (p.value?.[0]?.intVal || 0), 0);
            steps[date] = value;
        });
    }
    return steps;
}

function parseGoogleFitHeartRate(data) {
    const heartRate = {};
    if (data.bucket) {
        data.bucket.forEach(bucket => {
            const date = new Date(parseInt(bucket.startTimeMillis)).toISOString().split('T')[0];
            const points = bucket.dataset?.[0]?.point || [];
            if (points.length > 0) {
                const values = points.map(p => p.value?.[0]?.fpVal || 0).filter(v => v > 0);
                if (values.length > 0) {
                    heartRate[date] = {
                        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
                        min: Math.round(Math.min(...values)),
                        max: Math.round(Math.max(...values))
                    };
                }
            }
        });
    }
    return heartRate;
}

function parseGoogleFitWeight(data) {
    const weight = {};
    if (data.bucket) {
        data.bucket.forEach(bucket => {
            const date = new Date(parseInt(bucket.startTimeMillis)).toISOString().split('T')[0];
            const points = bucket.dataset?.[0]?.point || [];
            if (points.length > 0) {
                const value = points[points.length - 1]?.value?.[0]?.fpVal;
                if (value) {
                    weight[date] = Math.round(value * 10) / 10; // kg
                }
            }
        });
    }
    return weight;
}

function parseGoogleFitCalories(data) {
    const calories = {};
    if (data.bucket) {
        data.bucket.forEach(bucket => {
            const date = new Date(parseInt(bucket.startTimeMillis)).toISOString().split('T')[0];
            const points = bucket.dataset?.[0]?.point || [];
            const value = points.reduce((sum, p) => sum + (p.value?.[0]?.fpVal || 0), 0);
            calories[date] = Math.round(value);
        });
    }
    return calories;
}

module.exports = router;
