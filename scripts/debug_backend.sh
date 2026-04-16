#!/bin/bash

echo "--- Debugging Backend Infrastructure ---"

# 1. Container Status
echo "1. Container Status:"
docker ps --filter "name=bikes" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. Network check
echo -e "\n2. Port overlaps (lsof):"
lsof -i :8000
lsof -i :5432

# 3. Log errors
echo -e "\n3. Critical Log Errors (last 20 lines):"
docker logs bikes_backend 2>&1 | grep -i "error\|fail\|exception" | tail -n 20
