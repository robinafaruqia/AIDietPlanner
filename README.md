# AI Diet Planner

A full-stack web application that generates personalized weekly meal plans based on user weight and health conditions, along with automatically generated grocery lists.

## Features

- **Personalized Meal Plans**: Custom meal plans based on weight and health conditions
- **Health Condition Support**: Specialized meal plans for conditions like gallstones, diabetes, high blood pressure, etc.
- **Weekly Planning**: Complete 7-day meal plans with breakfast, lunch, dinner, and snacks
- **Grocery Lists**: Automatically generated shopping lists organized by category
- **Nutritional Information**: Detailed calorie and macronutrient information for each meal

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Frontend**: EJS templates, Bootstrap 5, jQuery
- **Styling**: Bootstrap 5, Custom CSS

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd AIDietPlanner
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ai-diet-planner
SESSION_SECRET=your-secret-key-here
GOOGLE_AI_API_KEY=your-google-gemini-api-key-here
```

**Getting Google Gemini API Key (Optional but Recommended):**
1. Visit: https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy the key and add it to `.env` as `GOOGLE_AI_API_KEY`
4. **Note:** Without the API key, the app uses hardcoded meal plans (still functional)

4. Make sure MongoDB is running on your system

5. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

6. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Navigate to the "Create Plan" page
2. Enter your weight in kilograms
3. Select your health condition (if any)
4. Click "Generate Meal Plan"
5. View your personalized weekly meal plan and grocery list

## Project Structure

```
AIDietPlanner/
├── models/
│   ├── User.js          # User model
│   └── MealPlan.js      # Meal plan model
├── routes/
│   └── mealPlan.js      # Meal plan API routes
├── services/
│   └── mealPlanner.js   # Meal planning algorithm
├── views/
│   ├── index.ejs        # Home page
│   └── plan.ejs         # Meal plan creation page
├── public/
│   └── css/
│       └── style.css    # Custom styles
├── server.js            # Express server
├── package.json         # Dependencies
└── README.md           # This file
```

## API Endpoints

- `POST /api/meal-plan/generate` - Generate a new meal plan
- `GET /api/meal-plan/:id` - Get a specific meal plan
- `GET /api/meal-plan` - Get all meal plans

## Deployment

### Using Docker

**Option 1: Using Docker Compose (Recommended)**

1. Start all services (app + MongoDB):
```bash
docker compose up -d
```

Or if you have older Docker version:
```bash
docker-compose up -d
```

2. Access the application at `http://localhost:3000`

3. Stop services:
```bash
docker compose down
```

**Option 2: Manual Docker Setup**

1. Build the Docker image:
```bash
docker build -t ai-diet-planner .
```

2. Run the container:
```bash
docker run -p 3000:3000 --env-file .env ai-diet-planner
```

### Using Heroku

1. Install Heroku CLI
2. Login to Heroku:
```bash
heroku login
```

3. Create a new app:
```bash
heroku create your-app-name
```

4. Set environment variables:
```bash
heroku config:set MONGODB_URI=your-mongodb-uri
heroku config:set SESSION_SECRET=your-secret-key
```

5. Deploy:
```bash
git push heroku main
```

### Using Railway/Render

1. Connect your GitHub repository
2. Set environment variables in the platform dashboard
3. Deploy automatically on push

## Health Conditions Supported

- **Gallstones**: Low-fat meal plans
- **Diabetes**: Low-carb, diabetic-friendly meals
- **High Blood Pressure**: Low-fat, heart-healthy options
- **Heart Disease**: Low-fat, nutrient-rich meals
- **Obesity**: High-protein, calorie-controlled plans

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

# AIDietPlanner
