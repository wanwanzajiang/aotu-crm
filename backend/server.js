const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = parseInt(process.env.RAILWAY_PORT || process.env.PORT) || 3456;
const JWT_SECRET = 'aotu_crm_jwt_secret_2026';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://liisnttpmsuynpqhiapj.supabase.co';
const DB_PASS = process.env.DB_PASS || 'msrry815999';
const PROJECT_REF = SUPABASE_URL.replace('https://','').replace('.supabase.co','');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://postgres:${DB_PASS}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..')));

function uid(p) { return (p||'') + Date.now().toString(36) + Math.random().toString(36).substr(2,6); }

// 启动时自动建表
async function initTables() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ 数据库连接成功');
  } catch(e) {
    console.log('⚠️ 数据库连接失败, 进入静态模式:', e.message);
    return false;
  }
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,name TEXT DEFAULT '',role TEXT DEFAULT 'sales',avatar TEXT DEFAULT '👤',created_at BIGINT DEFAULT(EXTRACT(EPOCH FROM NOW())*1000))`,
    `CREATE TABLE IF NOT EXISTS inquiries(id TEXT PRIMARY KEY,inquiry_no TEXT,salesperson TEXT,inquiry_date TEXT,status TEXT DEFAULT '跟进中',source TEXT,channel TEXT,country TEXT,customer_name TEXT,products JSONB DEFAULT '[]',total_amount REAL DEFAULT 0,created_by TEXT,created_at BIGINT DEFAULT(EXTRACT(EPOCH FROM NOW())*1000))`,
    `CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,product_code TEXT,brand TEXT,model TEXT,category TEXT,series TEXT,price REAL DEFAULT 0,created_by TEXT,created_at BIGINT DEFAULT(EXTRACT(EPOCH FROM NOW())*1000))`,
    `CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,customer_name TEXT,company TEXT,contact TEXT,customer_type TEXT,bargaining_style TEXT,created_by TEXT,created_at BIGINT DEFAULT(EXTRACT(EPOCH FROM NOW())*1000))`,
    `CREATE TABLE IF NOT EXISTS fx_receipts(id TEXT PRIMARY KEY,receipt_no TEXT,applicant TEXT,customer_name TEXT,customer_company TEXT,country TEXT,currency TEXT DEFAULT 'USD',amount REAL DEFAULT 0,receipt_account TEXT,shipping_method TEXT,notes TEXT,depart_audit TEXT DEFAULT '待审核',finance_audit TEXT DEFAULT '待审核',ceo_approval TEXT DEFAULT '待审批',status TEXT DEFAULT '待审核',created_by TEXT,created_at BIGINT DEFAULT(EXTRACT(EPOCH FROM NOW())*1000))`,
    `CREATE TABLE IF NOT EXISTS cert_docs(id TEXT PRIMARY KEY,order_no TEXT,customer_name TEXT,products JSONB DEFAULT '[]',total_amount REAL DEFAULT 0,notes TEXT,status TEXT DEFAULT '待审核',created_by TEXT,created_at BIGINT DEFAULT(EXTRACT(EPOCH FROM NOW())*1000))`,
    `CREATE TABLE IF NOT EXISTS price_quotes(id TEXT PRIMARY KEY,order_no TEXT,customer_name TEXT,products JSONB DEFAULT '[]',total_amount REAL DEFAULT 0,notes TEXT,status TEXT DEFAULT '待审核',created_by TEXT,created_at BIGINT DEFAULT(EXTRACT(EPOCH FROM NOW())*1000))`,
    `CREATE TABLE IF NOT EXISTS real_orders(id TEXT PRIMARY KEY,order_no TEXT,customer_name TEXT,products JSONB DEFAULT '[]',total_amount REAL DEFAULT 0,notes TEXT,status TEXT DEFAULT '待审核',created_by TEXT,created_at BIGINT DEFAULT(EXTRACT(EPOCH FROM NOW())*1000))`,
    `CREATE TABLE IF NOT EXISTS refunds(id TEXT PRIMARY KEY,order_no TEXT,refund_type TEXT,customer_name TEXT,receipt_account TEXT,notes TEXT,total_amount REAL DEFAULT 0,status TEXT DEFAULT '待审核',created_by TEXT,created_at BIGINT DEFAULT(EXTRACT(EPOCH FROM NOW())*1000))`,
    `CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,type TEXT,title TEXT,body TEXT,link_id TEXT,link_tab TEXT,for_role TEXT,read INTEGER DEFAULT 0,created_at BIGINT DEFAULT(EXTRACT(EPOCH FROM NOW())*1000))`,
    `CREATE TABLE IF NOT EXISTS perms(role TEXT PRIMARY KEY,label TEXT,data JSONB)`
  ];
  
  for (const sql of tables) {
    try { await pool.query(sql); } catch(e) { console.log('  ⚠️', e.message.slice(0,50)); }
  }
  console.log('✅ 数据库表就绪');
  
  // Seed default users
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
    await pool.query('INSERT INTO users(id,username,password,name,role,avatar,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',
      u.concat(Date.now()));
  }
  console.log('✅ 默认用户就绪');
  
  // Seed perms
  const permsData = [
    ['sales','普通业务员','{"inquiries":"own","general":"own","products":true,"customers":true,"users":false,"settings":false,"perms":false}'],
    ['dept_manager','部门主管','{"inquiries":"own","general":"own","products":true,"customers":true,"users":false,"settings":false,"perms":false}'],
    ['finance','财务','{"inquiries":"all","general":"all","products":true,"customers":true,"users":false,"settings":false,"perms":false}'],
    ['ceo','总经理','{"inquiries":"all","general":"all","products":true,"customers":true,"users":false,"settings":true,"perms":false}'],
    ['admin','管理员','{"inquiries":"all","general":"all","products":true,"customers":true,"users":true,"settings":true,"perms":true}']
  ];
  for (const p of permsData) {
    await pool.query('INSERT INTO perms(role,label,data) VALUES($1,$2,$3) ON CONFLICT(role) DO NOTHING', p);
  }
  console.log('✅ 权限配置就绪');
  return true;
}

// Auth
app.post('/api/login', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [req.body.username]);
    if (\!rows.length) return res.status(401).json({ error: '用户名或密码错误' });
    const user = rows[0];
    if (\!bcrypt.compareSync(req.body.password, user.password)) return res.status(401).json({ error: '用户名或密码错误' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const { password, ...safe } = user;
    res.json({ token, user: safe });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/register', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE username=$1', [req.body.username]);
    if (rows.length) return res.status(400).json({ error: '用户名已存在' });
    const hash = bcrypt.hashSync(req.body.password);
    const id = uid('u_');
    await pool.query('INSERT INTO users(id,username,password,name,role,created_at) VALUES($1,$2,$3,$4,$5,$6)',
      [id, req.body.username, hash, req.body.name||req.body.username, 'sales', Date.now()]);
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    const { password, ...safe } = user;
    res.json(safe);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/register') return next();
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: '未登录' }); }
});

// CRUD
const JSON_TABLES = ['inquiries', 'price_quotes', 'real_orders', 'cert_docs'];

app.get('/api/:table', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${req.params.table} ORDER BY created_at DESC`);
    rows.forEach(r => { if (JSON_TABLES.includes(req.params.table) && typeof r.products === 'string') r.products = JSON.parse(r.products); });
    const pRows = await pool.query('SELECT data FROM perms WHERE role=$1', [req.user.role]);
    if (pRows.rows.length) {
      const p = JSON.parse(pRows.rows[0].data);
      if (p[req.params.table] === 'own') {
        const filtered = rows.filter(r => r.created_by === req.user.id || r.salesperson === req.user.name || r.applicant === req.user.name);
        return res.json(filtered);
      }
    }
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/:table', async (req, res) => {
  try {
    const id = uid('');
    const data = { ...req.body };
    if (req.params.table === 'fx_receipts') {
      data.depart_audit = '待审核'; data.finance_audit = '待审核'; data.ceo_approval = '待审批'; data.status = '待审核';
    }
    if (JSON_TABLES.includes(req.params.table) && data.products) data.products = JSON.stringify(data.products);
    const keys = ['id', ...Object.keys(data), 'created_by', 'created_at'];
    const vals = [id, ...Object.values(data), req.user.id, Date.now()];
    const ph = keys.map((_, i) => `$${i+1}`).join(',');
    await pool.query(`INSERT INTO ${req.params.table}(${keys.join(',')}) VALUES(${ph})`, vals);
    if (req.params.table === 'fx_receipts') {
      await pool.query('INSERT INTO notifications(id,type,title,body,link_id,link_tab,for_role,read,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [uid('n_'), 'approve', '待审批', '部门审核待处理:'+(data.receipt_no||''), id, 'general', 'dept_manager', 0, Date.now()]);
    }
    res.json({ id, ...data, created_by: req.user.id, created_at: Date.now() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/:table/:id', async (req, res) => {
  try {
    const sets = Object.keys(req.body).map((k, i) => `${k}=$${i+1}`).join(',');
    const vals = [...Object.values(req.body), req.params.id];
    await pool.query(`UPDATE ${req.params.table} SET ${sets} WHERE id=$${Object.keys(req.body).length+1}`, vals);
    res.json({ id: req.params.id, ...req.body });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/:table/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM ${req.params.table} WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Approval
app.post('/api/approve/:table/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${req.params.table} WHERE id=$1`, [req.params.id]);
    if (\!rows.length) return res.status(404).json({ error: '未找到' });
    const item = rows[0];
    let stage = null;
    if ((item.depart_audit==='待审核'||item.depart_audit==='审核中') && (req.user.role==='dept_manager'||req.user.role==='admin')) stage = 'depart_audit';
    else if ((item.finance_audit==='待审核'||item.finance_audit==='审核中') && (req.user.role==='finance'||req.user.role==='admin')) stage = 'finance_audit';
    else if ((item.ceo_approval==='待审批'||item.ceo_approval==='待审核'||item.ceo_approval==='审批中') && (req.user.role==='ceo'||req.user.role==='admin')) stage = 'ceo_approval';
    if (\!stage) return res.status(400).json({ error: '无法审批' });
    
    const STAGE_NEXT = { depart_audit: 'finance_audit', finance_audit: 'ceo_approval', ceo_approval: null };
    const STAGE_ROLE = { depart_audit: 'dept_manager', finance_audit: 'finance', ceo_approval: 'ceo' };
    const next = STAGE_NEXT[stage];
    await pool.query(`UPDATE ${req.params.table} SET ${stage}='已通过',${next?`${next}='待审核',`:''}status='已通过' WHERE id=$1`, [req.params.id]);
    await pool.query('DELETE FROM notifications WHERE link_id=$1', [req.params.id]);
    if (next) {
      await pool.query('INSERT INTO notifications(id,type,title,body,link_id,link_tab,for_role,read,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [uid('n_'), 'approve', '待审批', `${next==='finance_audit'?'财务':'总经理'}审核待处理`, req.params.id, 'general', STAGE_ROLE[next], 0, Date.now()]);
    } else {
      await pool.query('INSERT INTO notifications(id,type,title,body,link_id,link_tab,for_role,read,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [uid('n_'), 'info', '审批完成', '申请已全部通过', req.params.id, 'general', 'all', 0, Date.now()]);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reject/:table/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${req.params.table} WHERE id=$1`, [req.params.id]);
    if (\!rows.length) return res.status(404).json({ error: '未找到' });
    const item = rows[0];
    let stage = null;
    if ((item.depart_audit==='待审核'||item.depart_audit==='审核中') && (req.user.role==='dept_manager'||req.user.role==='admin')) stage = 'depart_audit';
    else if ((item.finance_audit==='待审核'||item.finance_audit==='审核中') && (req.user.role==='finance'||req.user.role==='admin')) stage = 'finance_audit';
    else if ((item.ceo_approval==='待审批'||item.ceo_approval==='待审核'||item.ceo_approval==='审批中') && (req.user.role==='ceo'||req.user.role==='admin')) stage = 'ceo_approval';
    if (\!stage) return res.status(400).json({ error: '无法驳回' });
    await pool.query(`UPDATE ${req.params.table} SET ${stage}='已驳回',status='已驳回' WHERE id=$1`, [req.params.id]);
    await pool.query('DELETE FROM notifications WHERE link_id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Admin
app.get('/api/admin/users', async (req, res) => {
  if (req.user.role \!== 'admin') return res.status(403).json({ error: '无权限' });
  const { rows } = await pool.query('SELECT id,username,name,role,avatar,created_at FROM users ORDER BY created_at');
  res.json(rows);
});
app.put('/api/admin/users/:id/role', async (req, res) => {
  if (req.user.role \!== 'admin') return res.status(403).json({ error: '无权限' });
  await pool.query('UPDATE users SET role=$1 WHERE id=$2', [req.body.role, req.params.id]);
  res.json({ success: true });
});
app.delete('/api/admin/users/:id', async (req, res) => {
  if (req.user.role \!== 'admin' || req.params.id === req.user.id) return res.status(403).json({ error: '无权限' });
  const { rows } = await pool.query('SELECT role FROM users WHERE id=$1', [req.params.id]);
  if (\!rows.length || rows[0].role === 'admin') return res.status(400).json({ error: '无法删除' });
  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// Perms
app.get('/api/admin/perms', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM perms');
  const result = {};
  rows.forEach(r => { result[r.role] = { ...JSON.parse(r.data), label: r.label }; });
  res.json(result);
});
app.put('/api/admin/perms', async (req, res) => {
  if (req.user.role \!== 'admin') return res.status(403).json({ error: '无权限' });
  const { role, key, val } = req.body;
  const { rows } = await pool.query('SELECT * FROM perms WHERE role=$1', [role]);
  if (\!rows.length) return res.status(404).json({ error: '角色不存在' });
  const perm = JSON.parse(rows[0].data);
  perm[key] = val;
  await pool.query('UPDATE perms SET data=$1 WHERE role=$2', [JSON.stringify(perm), role]);
  res.json({ success: true });
});

// Notifications
app.get('/api/notifications', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
  res.json(rows.filter(n => n.for_role === 'all' || n.for_role === req.user.role || req.user.role === 'admin'));
});
app.get('/api/notifications/unread', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notifications WHERE read=0');
  const count = rows.filter(n => n.for_role === 'all' || n.for_role === req.user.role || req.user.role === 'admin').length;
  res.json({ count });
});
app.post('/api/notifications/read/:id', async (req, res) => {
  await pool.query('UPDATE notifications SET read=1 WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});
app.delete('/api/notifications/:id', async (req, res) => {
  await pool.query('DELETE FROM notifications WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});
app.post('/api/notifications/clear', async (req, res) => {
  await pool.query('DELETE FROM notifications');
  res.json({ success: true });
});

// Start
initTables().then(async (hasDB) => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════');
    console.log('  🏢 奥图CRM 启动成功\!');
    if (hasDB) {
      console.log(`  📡 http://localhost:${PORT}`);
      console.log('  🗄️  Supabase PostgreSQL');
    } else {
      console.log(`  📡 http://localhost:${PORT}`);
      console.log('  📄 localStorage 模式 (静态页面)');
    }
    console.log('');
    console.log('  👤 admin / admin888');
    console.log('═══════════════════════════════════');
    console.log('');
  });
}).catch(e => {
  console.log('⚠️ 数据库初始化失败, 作为静态服务启动');
  app.listen(PORT, '0.0.0.0', () => {
    console.log('📡 http://localhost:' + PORT + ' (静态模式)');
  });
});
