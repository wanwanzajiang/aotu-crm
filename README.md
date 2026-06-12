# 奥图CRM — Supabase 版

## 🚀 部署步骤

### 1️⃣ 创建数据库表
1. 打开 Supabase 控制台 → **SQL Editor**
2. 复制 `supabase/migration.sql` 全部内容
3. 粘贴运行 ✅

### 2️⃣ 配置 Supabase URL
1. 打开 `supabase/config.js`
2. 把 `YOUR_PROJECT_REF` 换成你的项目引用ID

> 项目引用ID 在 Supabase 控制台 URL 里：`https://<项目ID>.supabase.co`

### 3️⃣ 启动后端
```bash
cd backend
npm install
node server.js
```

或者直接：
```bash
bash start.sh
```

### 4️⃣ 访问
浏览器打开 `http://localhost:3456`

---

## 📡 前后端分离部署

**后端**（本仓库）：
- 部署到任意 Node.js 服务器
- 端口 3456，可通过环境变量 `PORT` 修改

**前端**（你明天上 git 的部分）：
- 可以是纯静态文件
- 只需把 API 地址改成你的服务器地址
- 或者用 Vercel/Netlify 部署

---

## 🔐 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin888 | 管理员 |
| sales01 | 123456 | 销售 |
| dept_mgr | 123456 | 部门主管 |
| finance | 123456 | 财务 |
| ceo | 123456 | 总经理 |

---

## 📋 API 文档

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/login | 登录 |
| POST | /api/register | 注册 |
| GET | /api/:table | 列表 |
| POST | /api/:table | 新增 |
| PUT | /api/:table/:id | 修改 |
| DELETE | /api/:table/:id | 删除 |
| POST | /api/approve/:table/:id | 审批通过 |
| POST | /api/reject/:table/:id | 驳回 |
| GET | /api/admin/users | 用户列表 |
| PUT | /api/admin/users/:id/role | 修改角色 |
| GET | /api/admin/perms | 权限配置 |
| PUT | /api/admin/perms | 修改权限 |
| GET | /api/notifications | 通知列表 |
| GET | /api/notifications/unread | 未读数量 |
