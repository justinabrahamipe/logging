#!/bin/bash
# Comprehensive type checking script

echo "=== Running TypeScript compiler with full output ==="
npx tsc --noEmit --pretty 2>&1

echo ""
echo "=== Running Next.js type check ==="
npx next build --profile 2>&1 | grep -A 50 "Type error"

echo ""
echo "=== Checking for any .d.ts issues ==="
find . -name "*.d.ts" -not -path "./node_modules/*" -not -path "./.next/*"
