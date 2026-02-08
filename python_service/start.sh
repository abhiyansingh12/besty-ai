#!/bin/bash

echo "🐍 Starting Pandas Calculator Service..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Start the service
echo "🚀 Launching service on http://localhost:5001"
python app.py
