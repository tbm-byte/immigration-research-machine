#!/bin/bash
# Immigration Research Machine — double-click to start
cd "$(dirname "$0")"

echo "🚀 Starting Immigration Research Machine..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies first..."
  npm install
  echo ""
fi

# Check for .env file
if [ ! -f ".env" ]; then
  echo "⚠️  No .env file found!"
  echo "   Please copy .env.example to .env and fill in your keys."
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

echo "✅ Opening http://localhost:3000 in your browser in 3 seconds..."
sleep 3
open http://localhost:3000

npm run dev
