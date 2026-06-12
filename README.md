# 🏢 奥图CRM - 商务审批管理系统

> 基于 Supabase PostgreSQL + Node.js 的商务审批管理系统

## ✨ 功能特性

- ✅ **5种角色**：管理员 / 总经理 / 财务 / 部门主管 / 业务员
- ✅ **三级审批流**：部门主管 → 财务 → 总经理
- ✅ **询价管理**：产品型号/品牌搜索下拉、批量粘贴导入
- ✅ **客户管理**：关联客户搜索
- ✅ **产品管理**：含单证文件上传
- ✅ **外汇到账**：Fx Receipt 完整审批流程
- ✅ **通知系统**：实时推送、点击跳转、角色过滤
- ✅ **权限配置**：管理员可自由分配模块权限
- ✅ **用户管理**：注册用户、修改角色、数据隔离

## 🚀 一键部署

### 方式1：Railway（推荐）

[\![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new?template=wanwanzajiang/aotu-crm)

1. 点击上方按钮 → 登录 GitHub
2. 选择仓库 `wanwanzajiang/aotu-crm`
3. 点击 "Deploy"
4. 2分钟后打开 Railway 生成的 URL ✓

### 方式2：直接运行（本地开发）

```bash
# 1. 安装依赖
cd backend && npm install

# 2. 启动（默认端口 3456）
node server.js

# 3. 打开浏览器
open http://localhost:3456
```

## 🔐 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin888 | 管理员 👑 |
| sales01 | 123456 | 业务员 💼 |
| dept_mgr | 123456 | 部门主管 📋 |
| finance | 123456 | 财务 💰 |
| ceo | 123456 | 总经理 🏢 |

## 🗄️ 数据库

使用 Supabase PostgreSQL，项目 ID: `liisnttpmsuynpqhiapj`

## 📂 项目结构

```
├── index.html        ← 主页面
├── js/
│   ├── store.js      ← 数据层（localStorage + Supabase API）
│   ├── app.js        ← 应用逻辑
│   └── supabase-client.js  ← Supabase 直接连接
├── css/style.css
├── backend/
│   ├── server.js     ← Node.js 后端
│   ├── api.js        ← API 路由
│   └── package.json
└── supabase/
    ├── config.js     ← Supabase 配置
    └── migration.sql ← 数据库建表脚本
```
