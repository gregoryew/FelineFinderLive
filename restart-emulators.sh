#!/bin/bash

# Bulletproof Firebase Emulator Restart Script
# This script ensures ALL old emulators are killed before starting new ones

echo "🔴 STEP 1: Killing ALL Firebase and Node processes..."
killall -9 node java 2>/dev/null || true
killall -9 firebase 2>/dev/null || true
sleep 2

echo "🔴 STEP 2: Finding processes on emulator ports..."
ps aux | grep -E "(firebase|node)" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
sleep 1

echo "🔴 STEP 3: Killing any processes still on emulator ports..."
lsof -ti:3000,9099,4000,5001,4400,4500 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

echo ""
echo "✅ VERIFICATION: Checking ports are FREE..."
for port in 3000 9099 4000 5001 4400 4500; do
  if lsof -ti:$port 2>/dev/null; then
    echo "❌ ERROR: Port $port is STILL BLOCKED!"
    echo "   Run: lsof -ti:$port | xargs kill -9"
    exit 1
  else
    echo "✅ Port $port: FREE"
  fi
done

echo ""
echo "✅ VERIFICATION: Checking for Firebase processes..."
FIREBASE_PROCS=$(ps aux | grep -E "firebase.*emulator" | grep -v grep | wc -l | tr -d ' ')
if [ "$FIREBASE_PROCS" != "0" ]; then
  echo "❌ ERROR: $FIREBASE_PROCS Firebase emulator process(es) still running!"
  echo "   Showing processes:"
  ps aux | grep -E "firebase.*emulator" | grep -v grep
  exit 1
else
  echo "✅ No Firebase emulator processes found"
fi

echo ""
echo "🔨 STEP 4: Rebuilding functions..."
cd functions
rm -rf lib
npm run build
cd ..

echo ""
echo "🚀 STEP 5: Starting emulators in background..."
nohup firebase emulators:start --only functions,hosting,auth > emulator.log 2>&1 &
EMULATOR_PID=$!
echo "✅ Emulators started with PID: $EMULATOR_PID"
echo ""
echo "📋 Useful commands:"
echo "  - View logs: tail -f emulator.log"
echo "  - Stop emulators: kill $EMULATOR_PID"
echo "  - Portal: http://127.0.0.1:3000"
echo "  - Emulator UI: http://127.0.0.1:4000"
echo ""
echo "⏳ Waiting 5 seconds for emulators to start..."
sleep 5
echo "✅ Emulators should be ready!"

