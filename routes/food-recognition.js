const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { GoogleGenAI } = require('@google/genai');
const { optionalAuth } = require('../middleware/auth');

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================
// IMAGE ANALYSIS CACHE
// ============================================
const analysisCache = new Map();
const CACHE_MAX_SIZE = 100;  // Max cached items
const CACHE_TTL = 60 * 60 * 1000;  // 1 hour in ms

function getImageHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

function getCachedResult(imageHash) {
    const cached = analysisCache.get(imageHash);
    if (cached) {
        // Check if expired
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`✅ Cache hit for image ${imageHash.substring(0, 8)}...`);
            return cached.result;
        } else {
            // Expired, remove it
            analysisCache.delete(imageHash);
        }
    }
    return null;
}

function setCachedResult(imageHash, result) {
    // Prune cache if too large
    if (analysisCache.size >= CACHE_MAX_SIZE) {
        const oldest = analysisCache.keys().next().value;
        analysisCache.delete(oldest);
    }
    
    analysisCache.set(imageHash, {
        result,
        timestamp: Date.now()
    });
    console.log(`💾 Cached result for image ${imageHash.substring(0, 8)}...`);
}

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and HEIC are allowed.'));
        }
    }
});

// Model fallback chain for food recognition (fastest first)
const MODEL_CHAIN = [
    'gemini-3-flash-preview',     // Latest Gemini 3 - fastest
    'gemini-2.0-flash',           // Fast & capable
    'gemini-2.0-flash-lite',      // Ultra fast, lightweight
    'gemini-2.5-flash-preview-05-20', // Preview features
    'gemini-1.5-flash',           // Reliable fallback
    'gemini-1.5-flash-8b',        // High volume, fast
    'gemini-1.5-pro'              // Last resort - slower but reliable
];

const FOOD_IDENTIFICATION_PROMPT = `Identify the food in this image and estimate its nutrition.

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no extra text.

If this is NOT a food image, return:
{"isFood": false, "message": "This doesn't appear to be a food image"}

If this IS food, return:
{
    "isFood": true,
    "foodName": "Simple common food name for database search (e.g., 'chicken breast', 'caesar salad', 'cheese pizza', 'rice', 'pasta')",
    "alternateNames": ["simpler alternate name", "another name"],
    "description": "Brief description of the food",
    "servingSize": "Estimated serving size (e.g., '1 plate', '250g', '1 bowl')",
    "confidence": "high/medium/low",
    "estimatedNutrition": {
        "calories": <estimated number>,
        "protein": <estimated grams>,
        "carbs": <estimated grams>,
        "fat": <estimated grams>
    },
    "ingredients": ["main ingredient 1", "main ingredient 2"],
    "healthNotes": "Brief health observations about this food",
    "alternatives": ["healthier alternative 1", "healthier alternative 2"]
}

Use SIMPLE, common food names that would appear in a nutrition database. Estimate realistic nutrition values based on typical serving sizes.`;

// ============================================
// GEMINI - Food Identification with Fallback
// ============================================
async function identifyFoodWithGemini(imageBase64, mimeType) {
    let lastError = null;

    for (const modelName of MODEL_CHAIN) {
        try {
            console.log(`Trying model: ${modelName}...`);
            
            const response = await genAI.models.generateContent({
                model: modelName,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: FOOD_IDENTIFICATION_PROMPT },
                        { inlineData: { mimeType, data: imageBase64 } }
                    ]
                }]
            });

            let text = typeof response.text === 'function' ? response.text() : response.text;
            text = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            const result = JSON.parse(text);
            console.log(`Success with model: ${modelName}`);
            return result;

        } catch (error) {
            console.log(`Model ${modelName} failed: ${error.message?.substring(0, 100)}...`);
            lastError = error;
            
            // If it's a quota/rate limit error, try next model
            if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
                continue;
            }
            
            // For other errors, also try next model
            continue;
        }
    }

    // All models failed
    throw lastError || new Error('All Gemini models failed');
}

// ============================================
// USDA FoodData Central - Nutrition Lookup
// ============================================

// Simple cleanup - no hardcoded mappings
function cleanFoodNameForUSDA(foodName) {
    return foodName
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s]/g, ' ')  // Remove special characters
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 2) // Take first 2 words only
        .join(' ');
}

async function getNutritionFromUSDA(foodName) {
    const USDA_API_KEY = process.env.USDA_API_KEY;
    
    if (!USDA_API_KEY) {
        console.log('USDA API key not configured, using AI estimates');
        return null;
    }

    try {
        const fetch = (await import('node-fetch')).default;
        
        // Simple cleanup
        const searchTerm = cleanFoodNameForUSDA(foodName);
        
        console.log(`USDA search: "${searchTerm}"`);
        
        if (!searchTerm || searchTerm.length < 2) {
            return null;
        }
        
        const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(searchTerm)}&pageSize=5`;
        
        const searchResponse = await fetch(searchUrl);
        
        // Check if response is JSON before parsing
        const contentType = searchResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.log('USDA returned non-JSON, will use AI estimates');
            return null;
        }
        
        const searchData = await searchResponse.json();
        
        if (!searchData.foods || searchData.foods.length === 0) {
            console.log(`No USDA match for "${searchTerm}", will use AI estimates`);
            return null;
        }

        // Get the best match
        const food = searchData.foods[0];
        console.log(`USDA found: "${food.description}" (FDC ID: ${food.fdcId})`);
        
        // Extract nutrients - handle different field names
        const nutrients = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            sugar: 0,
            sodium: 0
        };
        
        (food.foodNutrients || []).forEach(n => {
            const name = n.nutrientName || '';
            const value = n.value || 0;
            
            if (name.includes('Energy') && !name.includes('kJ')) {
                nutrients.calories = Math.round(value);
            } else if (name === 'Protein') {
                nutrients.protein = Math.round(value * 10) / 10;
            } else if (name.includes('Carbohydrate')) {
                nutrients.carbs = Math.round(value * 10) / 10;
            } else if (name.includes('Total lipid') || name === 'Fat') {
                nutrients.fat = Math.round(value * 10) / 10;
            } else if (name.includes('Fiber')) {
                nutrients.fiber = Math.round(value * 10) / 10;
            } else if (name.includes('Sugars')) {
                nutrients.sugar = Math.round(value * 10) / 10;
            } else if (name.includes('Sodium')) {
                nutrients.sodium = Math.round(value);
            }
        });

        console.log(`USDA nutrients:`, nutrients);

        return {
            name: food.description,
            brandOwner: food.brandOwner || null,
            servingSize: food.servingSize ? `${food.servingSize} ${food.servingSizeUnit || 'g'}` : '100g',
            nutrients,
            fdcId: food.fdcId,
            dataType: food.dataType
        };
    } catch (error) {
        console.error('USDA API error:', error.message);
        return null;
    }
}

// ============================================
// MAIN ANALYZE ENDPOINT
// ============================================
router.post('/analyze', optionalAuth, upload.single('foodImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(503).json({
                success: false,
                error: 'Gemini API key not configured'
            });
        }

        // Check cache first for instant results
        const imageHash = getImageHash(req.file.buffer);
        const cachedResult = getCachedResult(imageHash);
        
        if (cachedResult) {
            return res.json({
                success: true,
                analysis: cachedResult,
                cached: true
            });
        }

        const imageBase64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;

        console.log('Step 1: Identifying food with Gemini...');
        
        // Step 1: Use Gemini to identify the food
        let geminiResult;
        try {
            geminiResult = await identifyFoodWithGemini(imageBase64, mimeType);
        } catch (parseError) {
            console.error('Gemini parse error:', parseError);
            return res.status(500).json({
                success: false,
                error: 'Failed to analyze the image. Please try again.'
            });
        }

        if (!geminiResult.isFood) {
            return res.json({
                success: true,
                analysis: geminiResult
            });
        }

        console.log(`Step 2: Looking up nutrition for "${geminiResult.foodName}" in USDA...`);

        // Step 2: Get nutrition data from USDA
        let usdaNutrition = await getNutritionFromUSDA(geminiResult.foodName);
        
        // Try alternate names if primary doesn't match
        if (!usdaNutrition && geminiResult.alternateNames?.length > 0) {
            for (const altName of geminiResult.alternateNames) {
                console.log(`Trying alternate name: ${altName}`);
                usdaNutrition = await getNutritionFromUSDA(altName);
                if (usdaNutrition) break;
            }
        }

        // Build nutrition - prefer USDA, fallback to Gemini estimates
        let finalNutrition;
        let nutritionSource;
        
        if (usdaNutrition?.nutrients && usdaNutrition.nutrients.calories > 0) {
            finalNutrition = usdaNutrition.nutrients;
            nutritionSource = 'usda';
        } else if (geminiResult.estimatedNutrition) {
            // Use Gemini's estimates as fallback
            finalNutrition = {
                calories: geminiResult.estimatedNutrition.calories || 0,
                protein: geminiResult.estimatedNutrition.protein || 0,
                carbs: geminiResult.estimatedNutrition.carbs || 0,
                fat: geminiResult.estimatedNutrition.fat || 0,
                fiber: 0,
                sugar: 0,
                sodium: 0
            };
            nutritionSource = 'gemini-estimate';
            console.log('Using Gemini estimated nutrition:', finalNutrition);
        } else {
            finalNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
            nutritionSource = 'none';
        }

        // Build final response
        const analysisResult = {
            isFood: true,
            foodName: usdaNutrition?.name || geminiResult.foodName,
            description: geminiResult.description,
            servingSize: usdaNutrition?.servingSize || geminiResult.servingSize,
            confidence: geminiResult.confidence,
            nutrition: finalNutrition,
            ingredients: geminiResult.ingredients || [],
            healthScore: calculateHealthScore(finalNutrition),
            healthNotes: geminiResult.healthNotes || generateHealthNotes(finalNutrition),
            alternatives: geminiResult.alternatives || [],
            source: nutritionSource === 'usda' ? 'gemini+usda' : 'gemini',
            nutritionSource: nutritionSource,
            usdaFdcId: usdaNutrition?.fdcId || null,
            usdaDataType: usdaNutrition?.dataType || null
        };

        // Cache the result for fast retrieval on repeat analysis
        setCachedResult(imageHash, analysisResult);

        console.log(`Analysis complete. Source: ${analysisResult.source}`);

        res.json({
            success: true,
            analysis: analysisResult,
            cached: false
        });

    } catch (error) {
        console.error('Food recognition error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to analyze food image'
        });
    }
});

// Search USDA database directly
router.get('/search', optionalAuth, async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({ success: false, error: 'Search query required' });
        }

        const nutrition = await getNutritionFromUSDA(query);
        
        if (!nutrition) {
            return res.json({ success: true, results: [] });
        }

        res.json({
            success: true,
            results: [nutrition]
        });
    } catch (error) {
        console.error('USDA search error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// Helper: Calculate health score based on nutrition
function calculateHealthScore(nutrients) {
    if (!nutrients) return 5;
    
    let score = 5;
    
    if (nutrients.protein > 20) score += 1;
    if (nutrients.protein > 30) score += 1;
    if (nutrients.fiber > 5) score += 1;
    if (nutrients.fiber > 10) score += 1;
    if (nutrients.sugar > 20) score -= 1;
    if (nutrients.sugar > 40) score -= 1;
    if (nutrients.sodium > 600) score -= 1;
    if (nutrients.sodium > 1000) score -= 1;
    if (nutrients.calories > 400) score -= 1;
    if (nutrients.calories > 600) score -= 1;
    
    return Math.max(1, Math.min(10, score));
}

// Helper: Generate health notes
function generateHealthNotes(nutrients) {
    if (!nutrients) return 'Nutrition data from USDA database not available.';
    
    const notes = [];
    
    if (nutrients.protein > 20) notes.push('Good source of protein');
    if (nutrients.fiber > 5) notes.push('Contains dietary fiber');
    if (nutrients.sugar > 20) notes.push('Relatively high in sugar');
    if (nutrients.sodium > 600) notes.push('Watch sodium intake');
    if (nutrients.calories < 150) notes.push('Low calorie option');
    
    return notes.length > 0 ? notes.join('. ') + '.' : 'Moderate nutritional profile.';
}

module.exports = router;
