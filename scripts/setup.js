/**
 * 奥图CRM - 一键部署脚本
 * 运行: cd 奥图CRM-Supabase && node scripts/setup.js
 * 
 * 功能:
 * 1. 连接 Supabase PostgreSQL
 * 2. 创建所有表 - 插入默认数据
 * 3. 启动后端服务
 */
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function main() {
  console.log('\n🏢 奥图CRM - 一键部署');
  console.log('══════════════════════\n');
  
  const dbPassword = process.env.DB_PASSWORD || 'msrry815999';
  const projectRef = 'liisnttpmsuynpqhiapj';
  
  console.log(`📡 Supabase: ${projectRef}`);
  console.log(`🔌 连接数据库...`);
  
  const client = new Client({
    connectionString: `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  });
  
  try { await client.connect(); }
  catch (e) {
    console.log('❌ 连接失败:', e.message);
    console.log('👉 请到 Supabase Dashboard → Database → "Add IP to Whitelist" 把当前IP加入白名单');
    console.log('👉 或手动运行 supabase/migration.sql 到 SQL Editor');
    process.exit(1);
  }
  console.log('✅ 数据库连接成功\n');
  
  // 创建表
  console.log('📦 创建表...');
  const sql = `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    name TEXT DEFAULT '', role TEXT DEFAULT 'sales', avatar TEXT DEFAULT '👤',
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000));
  CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY, inquiry_no TEXT, salesperson TEXT, inquiry_date TEXT,
    status TEXT DEFAULT '跟进中', source TEXT, channel TEXT, country TEXT,
    customer_name TEXT, products JSONB DEFAULT '[]', total_amount REAL DEFAULT 0,
    created_by TEXT, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000));
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, product_code TEXT, brand TEXT, model TEXT,
    category TEXT, series TEXT, price REAL DEFAULT 0,
    created_by TEXT, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000));
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, customer_name TEXT, company TEXT, contact TEXT,
    customer_type TEXT, bargaining_style TEXT,
    created_by TEXT, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000));
  CREATE TABLE IF NOT EXISTS fx_receipts (
    id TEXT PRIMARY KEY, receipt_no TEXT, applicant TEXT, customer_name TEXT,
    customer_company TEXT, country TEXT, currency TEXT DEFAULT 'USD',
    amount REAL DEFAULT 0, receipt_account TEXT, shipping_method TEXT, notes TEXT,
    depart_audit TEXT DEFAULT '待审核', finance_audit TEXT DEFAULT '待审核',
    ceo_approval TEXT DEFAULT '待审批', status TEXT DEFAULT '待审核',
    created_by TEXT, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000));
  CREATE TABLE IF NOT EXISTS cert_docs (
    id TEXT PRIMARY KEY, order_no TEXT, customer_name TEXT,
    products JSONB DEFAULT '[]', total_amount REAL DEFAULT 0, notes TEXT,
    status TEXT DEFAULT '待审核', created_by TEXT,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000));
  CREATE TABLE IF NOT EXISTS price_quotes (
    id TEXT PRIMARY KEY, order_no TEXT, customer_name TEXT,
    products JSONB DEFAULT '[]', total_amount REAL DEFAULT 0, notes TEXT,
    status TEXT DEFAULT '待审核', created_by TEXT,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000));
  CREATE TABLE IF NOT EXISTS real_orders (
    id TEXT PRIMARY KEY, order_no TEXT, customer_name TEXT,
    products JSONB DEFAULT '[]', total_amount REAL DEFAULT 0, notes TEXT,
    status TEXT DEFAULT '待审核', created_by TEXT,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000));
  CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY, order_no TEXT, refund_type TEXT, customer_name TEXT,
    receipt_account TEXT, notes TEXT, total_amount REAL DEFAULT 0,
    status TEXT DEFAULT '待审核', created_by TEXT,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000));
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, type TEXT, title TEXT, body TEXT,
    link_id TEXT, link_tab TEXT, for_role TEXT, read INTEGER DEFAULT 0,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000));
  CREATE TABLE IF NOT EXISTS perms (
    role TEXT PRIMARY KEY, label TEXT, data JSONB);`;
  
  const statements = sql.split(';').filter(s => s.trim().length > 10);
  let ok = 0;
  for (const stmt of statements) {
    try { await client.query(stmt + ';'); ok++; }
    catch(e) { if (\!e.message.includes('already exists')) console.log(' ⚠️', e.message.slice(0,50)); }
  }
  console.log(`✅ ${ok} 张表就绪`);
  
  // 插入用户数据
  console.log('\n👤 创建默认用户...');
  const hash888 = bcrypt.hashSync('admin888');
  const hash456 = bcrypt.hashSync('123456');
  const users = [
    ['u_admin','admin',hash888,'系统管理员','admin','👑'],
    ['u_sales','sales01',hash456,'张销售','sales','💼'],
    ['u_dept','dept_mgr',hash456,'王主管','dept_manager','📋'],
    ['u_finance','finance',hash456,'李财务','finance','💰'],
    ['u_ceo','ceo',hash456,'陈总','ceo','🏢']
  ];
  for (const u of users) {
    await client.query(
      'INSERT INTO users(id,username,password,name,role,avatar,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',
      [u[0],u[1],u[2],u[3],u[4],u[5],Date.now()]
    );
  }
  console.log(`✅ ${users.length} 个用户创建成功`);
  
  // 权限配置
  console.log('\n📋 创建权限配置...');
  const permsData = {
    sales:     ['普通业务员','{"inquiries":"own","general":"own","products":true,"customers":true,"users":false,"settings":false,"perms":false}'],
    dept_manager:['部门主管','{"inquiries":"own","general":"own","products":true,"customers":true,"users":false,"settings":false,"perms":false}'],
    finance:  ['财务','{"inquiries":"all","general":"all","products":true,"customers":true,"users":false,"settings":false,"perms":false}'],
    ceo:      ['总经理','{"inquiries":"all","general":"all","products":true,"customers":true,"users":false,"settings":true,"perms":false}'],
    admin:    ['管理员','{"inquiries":"all","general":"all","products":true,"customers":true,"users":true,"settings":true,"perms":true}']
  };
  for (const [role, [label, data]] of Object.entries(permsData)) {
    await client.query('INSERT INTO perms(role,label,data) VALUES($1,$2,$3) ON CONFLICT(role) DO NOTHING',
      [role, label, data]);
  }
  console.log(`✅ ${Object.keys(permsData).length} 个角色配置就绪`);
  
  await client.end();
  console.log('\n🚀 启动后端...');
  
  const server = spawn('node', ['backend/server.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, PORT: '3456' }
  });
  console.log('✅ 一键部署完成！');
  console.log('📡 http://localhost:3456');
  console.log('👤 admin / admin888\n');
}
main();
