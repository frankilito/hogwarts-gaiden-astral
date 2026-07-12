#!/bin/bash
cd "$(dirname "$0")"
echo "🏰 霍格沃茨之遗·番外篇 启动中..."
node server/server.js &
SERVER_PID=$!
sleep 1
open "http://localhost:8966"
echo "服务器运行中 (http://localhost:8966)，关闭此窗口即退出。"
wait $SERVER_PID
