#!/bin/bash

# Script to view logs for AI Diet Planner

echo "=========================================="
echo "AI Diet Planner - Log Viewer"
echo "=========================================="
echo ""

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Docker detected"
    echo ""
    
    # Check if containers are running
    if docker compose ps 2>/dev/null | grep -q "Up"; then
        echo "Containers are running. Choose an option:"
        echo ""
        echo "1. View all logs"
        echo "2. View application logs"
        echo "3. View MongoDB logs"
        echo "4. Follow logs in real-time (all)"
        echo "5. Follow application logs"
        echo "6. Follow MongoDB logs"
        echo "7. View last 50 lines (all)"
        echo ""
        read -p "Enter choice (1-7): " choice
        
        case $choice in
            1)
                docker compose logs
                ;;
            2)
                docker compose logs app
                ;;
            3)
                docker compose logs mongo
                ;;
            4)
                echo "Following all logs (Ctrl+C to stop)..."
                docker compose logs -f
                ;;
            5)
                echo "Following application logs (Ctrl+C to stop)..."
                docker compose logs -f app
                ;;
            6)
                echo "Following MongoDB logs (Ctrl+C to stop)..."
                docker compose logs -f mongo
                ;;
            7)
                docker compose logs --tail=50
                ;;
            *)
                echo "Invalid choice"
                ;;
        esac
    else
        echo "⚠️  Docker containers are not running"
        echo "Start them with: docker compose up -d"
    fi
else
    echo "⚠️  Docker not found"
    echo ""
    echo "If running without Docker, check:"
    echo "1. Terminal where you ran 'npm start'"
    echo "2. MongoDB logs (if installed locally)"
    echo ""
    echo "To save logs to file, run:"
    echo "  npm start > server.log 2>&1"
    echo "Then view with: tail -f server.log"
fi

echo ""
echo "=========================================="

