#!/bin/bash
# Check if lino-arguments package exists on npmjs.com and get its details

echo "=== Checking lino-arguments package on npm ==="
npm view lino-arguments --json 2>&1 || echo "Package may not exist or not published yet"

echo ""
echo "=== Checking package.json configuration ==="
cat package.json | jq '{name, version, repository}'
