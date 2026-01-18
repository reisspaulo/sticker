#!/bin/bash
# Memory Investigation Script for VPS
# Run this on VPS: ssh root@69.62.100.250 'bash -s' < scripts/investigate-memory.sh

echo "=========================================="
echo "🔍 MEMORY INVESTIGATION - VPS"
echo "=========================================="
echo ""

echo "📊 1. MEMORY OVERVIEW"
echo "----------------------------------------"
free -h
echo ""

echo "📊 2. TOP 10 PROCESSES BY MEMORY"
echo "----------------------------------------"
ps aux --sort=-%mem | head -11
echo ""

echo "🐳 3. DOCKER CONTAINERS MEMORY USAGE"
echo "----------------------------------------"
docker stats --no-stream --format "table {{.Name}}\t{{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}"
echo ""

echo "🐳 4. DOCKER SERVICES STATUS"
echo "----------------------------------------"
docker service ls
echo ""

echo "🔍 5. NODE.JS PROCESSES"
echo "----------------------------------------"
ps aux | grep -E "node|Node" | grep -v grep
echo ""

echo "📦 6. REDIS MEMORY INFO"
echo "----------------------------------------"
docker exec redis redis-cli info memory | grep -E "used_memory_human|used_memory_peak_human|maxmemory_human"
echo ""

echo "📦 7. REDIS QUEUE SIZES (BullMQ)"
echo "----------------------------------------"
echo "Total keys with 'bull:' pattern:"
docker exec redis redis-cli --scan --pattern "bull:*" | wc -l
echo ""
echo "Queue details:"
docker exec redis redis-cli --scan --pattern "bull:*:*" | head -20
echo ""

echo "📦 8. REDIS SPECIFIC QUEUES"
echo "----------------------------------------"
for queue in "process-sticker" "download-twitter-video" "scheduled-jobs" "welcome-messages" "activate-pix-subscription" "edit-buttons"; do
  count=$(docker exec redis redis-cli llen "bull:${queue}:wait" 2>/dev/null || echo "0")
  active=$(docker exec redis redis-cli llen "bull:${queue}:active" 2>/dev/null || echo "0")
  echo "${queue}: ${count} waiting, ${active} active"
done
echo ""

echo "💾 9. DISK USAGE"
echo "----------------------------------------"
df -h
echo ""

echo "📝 10. RECENT BACKEND LOGS (errors/warnings)"
echo "----------------------------------------"
docker service logs stickerbot-backend --tail 30 2>&1 | grep -iE "error|warn|memory|oom"
echo ""

echo "📝 11. RECENT WORKER LOGS (errors/warnings)"
echo "----------------------------------------"
docker service logs stickerbot-worker --tail 30 2>&1 | grep -iE "error|warn|memory|oom"
echo ""

echo "🔍 12. SYSTEM MEMORY DETAILS"
echo "----------------------------------------"
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable|Cached|Buffers|Shmem"
echo ""

echo "🐳 13. DOCKER SYSTEM INFO"
echo "----------------------------------------"
docker system df
echo ""

echo "=========================================="
echo "✅ Investigation Complete!"
echo "=========================================="
