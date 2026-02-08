#!/bin/bash

# Betsy AI - Quick Verification Checklist
# Run this after updating the database function

echo "🔍 Betsy AI - System Verification"
echo "=================================="
echo ""

# Check if essential files exist
echo "📁 Checking essential files..."
FILES=(
  ".env"
  "app/api/chat/route.ts"
  "app/api/ingest/route.ts"
  "components/betsy-dashboard.tsx"
  "supabase_setup.sql"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file (MISSING)"
  fi
done

echo ""
echo "🔐 Checking environment variables..."

if [ -f ".env" ]; then
  if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env && \
     grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env && \
     grep -q "OPENAI_API_KEY" .env; then
    echo "   ✅ All required environment variables found"
  else
    echo "   ⚠️  Some environment variables might be missing"
    echo "      Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY"
  fi
else
  echo "   ❌ .env file not found"
fi

echo ""
echo "📦 Checking Node modules..."

if [ -d "node_modules" ]; then
  echo "   ✅ node_modules exists"
  
  # Check critical packages
  PACKAGES=("pdf-parse" "xlsx" "csv-parse" "openai" "@supabase/supabase-js")
  for pkg in "${PACKAGES[@]}"; do
    if [ -d "node_modules/$pkg" ]; then
      echo "   ✅ $pkg installed"
    else
      echo "   ⚠️  $pkg might be missing - run: npm install $pkg"
    fi
  done
else
  echo "   ❌ node_modules not found - run: npm install"
fi

echo ""
echo "=================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. ✅ Update Database Function:"
echo "   Run: ./update-db-function.sh"
echo "   Then copy/paste SQL into Supabase SQL Editor"
echo ""
echo "2. 🚀 Start Dev Server:"
echo "   Run: npm run dev"
echo ""
echo "3. 🧪 Test the Fix:"
echo "   a) Login to your dashboard"
echo "   b) Upload a document (PDF, CSV, or TXT)"
echo "   c) Ask a question about the document"
echo "   d) Check browser console for debug logs"
echo ""
echo "4. 📊 Watch for these success indicators:"
echo "   - Upload: '✅ Successfully stored X/X chunks'"
echo "   - Chat: '📊 Found X chunks' (where X > 0)"
echo "   - Chat: AI responds with actual document content"
echo ""
echo "📖 For detailed debugging: See DEBUGGING_GUIDE.md"
echo ""
