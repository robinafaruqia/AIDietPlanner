#!/bin/bash

# Script to check MongoDB connection and status

echo "=========================================="
echo "MongoDB Connection Checker"
echo "=========================================="
echo ""

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Checking Docker MongoDB container..."
    
    if docker compose ps mongo 2>/dev/null | grep -q "Up"; then
        echo "✅ MongoDB container is running"
        echo ""
        echo "Testing connection..."
        docker compose exec -T mongo mongosh --quiet --eval "db.adminCommand('ping')" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "✅ MongoDB is responding"
            echo ""
            echo "Connection string: mongodb://localhost:27017/ai-diet-planner"
        else
            echo "❌ MongoDB is not responding"
            echo ""
            echo "View logs: docker compose logs mongo"
        fi
    else
        echo "❌ MongoDB container is not running"
        echo "Start with: docker compose up -d mongo"
    fi
else
    echo "⚠️  Docker not found"
    echo ""
    echo "Checking local MongoDB..."
    
    if command -v mongosh &> /dev/null; then
        echo "Testing connection to local MongoDB..."
        mongosh mongodb://localhost:27017/ai-diet-planner --quiet --eval "db.adminCommand('ping')" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "✅ Local MongoDB is responding"
        else
            echo "❌ Cannot connect to local MongoDB"
            echo "Make sure MongoDB is running: brew services start mongodb-community"
        fi
    else
        echo "⚠️  mongosh not found"
        echo "Install MongoDB tools or use MongoDB Compass"
    fi
fi

echo ""
echo "=========================================="

