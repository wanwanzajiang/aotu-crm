#\!/bin/bash
# 奥图CRM - 一键启动脚本

echo ""
echo "═══════════════════════════"
echo "  🏢 奥图CRM - 启动中..."
echo "═══════════════════════════"
echo ""

# 安装依赖
if [ \! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  npm install --silent
fi

# 启动后端
echo "🚀 启动后端服务..."
cd backend && node server.js &
BACKEND_PID=$\!
cd ..

# 等待服务启动
sleep 2

# 检查是否启动成功
if kill -0 $BACKEND_PID 2>/dev/null; then
  echo ""
  echo "═══════════════════════════"
  echo "  ✅ 奥图CRM 启动成功\!"
  echo "  📡 http://localhost:3456"
  echo ""
  echo "  👤 管理员: admin / admin888"
  echo "  👤 测试: sales01 / 123456"
  echo "═══════════════════════════"
  echo ""
  
  # 自动打开浏览器
  open "http://localhost:3456" 2>/dev/null || true
  
  # 等待进程
  wait $BACKEND_PID
else
  echo "❌ 启动失败，检查端口是否被占用"
  exit 1
fi
