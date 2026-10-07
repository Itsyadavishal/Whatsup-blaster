#!/bin/bash
cd /home/z/my-project
while true; do
    echo "[$(date)] Starting Next.js dev server..."
    bun run dev --port 3000
    echo "[$(date)] Server stopped. Restarting in 3 seconds..."
    sleep 3
done
