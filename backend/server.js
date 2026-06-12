const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3456;

const JWT_SECRET = 'aotu_crm_jwt_secret_2026';

const pool = new Pool({
  connectionString: 'postgresql://postgres:msrry815999@db.liisnttpmsuynpqhiapj.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..')));

function uid(p) { return (p||'') + Date.now().toString(36) + Math.random().toString(36).substr(2,6); }

/* ====== Auth ====== */
app.post('/api/login', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [req.body.username]);
    if (!rows.length) return res.status(401).json({ error: '用户名或密码错误' });
    const user = rows[0];
    if (!bcrypt.compareSync(req.body.password, user.password)) return res.status(401).json({ error: '用户名或密码错误' });
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

/* ====== Auth Middleware ====== */
app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/register') return next();
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: '未登录' }); }
});

/* ====== CRUD ====== */
const JSON_TABLES = ['inquiries', 'cert_docs', 'price_quotes', 'real_orders'];

app.get('/api/:table', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${req.params.table} ORDER BY created_at DESC`);
    rows.forEach(r => { if (JSON_TABLES.includes(req.params.table) && typeof r.products === 'string') r.products = JSON.parse(r.products); });
    // Permission filter
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
    const now = Date.now();
    const data = { ...req.body };
    if (req.params.table === 'fx_receipts') {
      data.depart_audit = '待审核'; data.finance_audit = '待审核'; data.ceo_approval = '待审批'; data.status = '待审核';
    }
    if (JSON_TABLES.includes(req.params.table) && data.products) {
      data.products = JSON.stringify(data.products);
    }
    const keys = ['id', ...Object.keys(data), 'created_by', 'created_at'];
    const vals = [id, ...Object.values(data), req.user.id, now];
    const ph = keys.map((_, i) => `$${i+1}`).join(',');
    await pool.query(`INSERT INTO ${req.params.table}(${keys.join(',')}) VALUES(${ph})`, vals);
    if (req.params.table === 'fx_receipts') {
      await pool.query('INSERT INTO notifications(id,type,title,body,link_id,link_tab,for_role,read,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [uid('n_'), 'approve', '待审批', '部门审核待处理:'+(data.receipt_no||''), id, 'general', 'dept_manager', 0, now]);
    }
    res.json({ id, ...data, created_by: req.user.id, created_at: now });
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

/* ====== Approval ====== */
app.post('/api/approve/:table/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM ${req.params.table} WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '未找到' });
    const item = rows[0];
    const STAGE_NEXT = { depart_audit: 'finance_audit', finance_audit: 'ceo_approval', ceo_approval: null };
    const STAGE_ROLE = { depart_audit: 'dept_manager', finance_audit: 'finance', ceo_approval: 'ceo' };
    let stage = null;
    if ((item.depart_audit==='待审核'||item.depart_audit==='审核中') && (req.user.role==='dept_manager'||req.user.role==='admin')) stage = 'depart_audit';
    else if ((item.finance_audit==='待审核'||item.finance_audit==='审核中') && (req.user.role==='finance'||req.user.role==='admin')) stage = 'finance_audit';
    else if ((item.ceo_approval==='待审批'||item.ceo_approval==='待审核'||item.ceo_approval==='审批中') && (req.user.role==='ceo'||req.user.role==='admin')) stage = 'ceo_approval';
    if (!stage) return res.status(400).json({ error: '无法审批' });

    const next = STAGE_NEXT[stage];
    await pool.query(`UPDATE ${req.params.table} SET ${stage}='已通过', ${next ? `${next}='待审核', ` : ''} status='已通过' WHERE id=$1`, [req.params.id]);
    
    await pool.query('DELETE FROM notifications WHERE link_id=$1', [req.params.id]);
    if (next) {
      const label = next === 'finance_audit' ? '财务审核' : '总经理审批';
      await pool.query('INSERT INTO notifications(id,type,title,body,link_id,link_tab,for_role,read,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [uid('n_'), 'approve', '待审批', label+'待处理', req.params.id, 'general', STAGE_ROLE[next], 0, Date.now()]);
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
    if (!rows.length) return res.status(404).json({ error: '未找到' });
    const item = rows[0];
    let stage = null;
    if ((item.depart_audit==='待审核'||item.depart_audit==='审核中') && (req.user.role==='dept_manager'||req.user.role==='admin')) stage = 'depart_audit';
    else if ((item.finance_audit==='待审核'||item.finance_audit==='审核中') && (req.user.role==='finance'||req.user.role==='admin')) stage = 'finance_audit';
    else if ((item.ceo_approval==='待审批'||item.ceo_approval==='待审核'||item.ceo_approval==='审批中') && (req.user.role==='ceo'||req.user.role==='admin')) stage = 'ceo_approval';
    if (!stage) return res.status(400).json({ error: '无法驳回' });
    await pool.query(`UPDATE ${req.params.table} SET ${stage}='已驳回', status='已驳回' WHERE id=$1`, [req.params.id]);
    await pool.query('DELETE FROM notifications WHERE link_id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ====== Admin ====== */
app.get('/api/admin/users', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '无权限' });
  const { rows } = await pool.query('SELECT id,username,name,role,avatar,created_at FROM users ORDER BY created_at');
  res.json(rows);
});

app.put('/api/admin/users/:id/role', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '无权限' });
  await pool.query('UPDATE users SET role=$1 WHERE id=$2', [req.body.role, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', async (req, res) => {
  if (req.user.role !== 'admin' || req.params.id === req.user.id) return res.status(403).json({ error: '无权限' });
  const { rows } = await pool.query('SELECT role FROM users WHERE id=$1', [req.params.id]);
  if (!rows.length || rows[0].role === 'admin') return res.status(400).json({ error: '无法删除' });
  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

/* ====== Permissions ====== */
app.get('/api/admin/perms', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM perms');
  const result = {};
  rows.forEach(r => { result[r.role] = { ...JSON.parse(r.data), label: r.label }; });
  res.json(result);
});

app.put('/api/admin/perms', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '无权限' });
  const { role, key, val } = req.body;
  const { rows } = await pool.query('SELECT * FROM perms WHERE role=$1', [role]);
  if (!rows.length) return res.status(404).json({ error: '角色不存在' });
  const perm = JSON.parse(rows[0].data);
  perm[key] = val;
  await pool.query('UPDATE perms SET data=$1 WHERE role=$2', [JSON.stringify(perm), role]);
  res.json({ success: true });
});

/* ====== Notifications ====== */
app.get('/api/notifications', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
  res.json(rows.filter(n => n.for_role === 'all' || n.for_role === req.user.role || req.user.role === 'admin'));
});

app.get('/api/notifications/unread', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notifications WHERE read=0');
  const count = rows.filter(n => n.for_role === 'all' || n.for_role === req.user.role || req.user.role === 'admin').length;
  res.json({ count });
});

app.post('/api/notifications', async (req, res) => {
  const id = uid('n_');
  await pool.query('INSERT INTO notifications(id,type,title,body,link_id,link_tab,for_role,read,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, req.body.type||'info', req.body.title||'', req.body.body||'', req.body.link_id||'', req.body.link_tab||'', req.body.for_role||'all', 0, Date.now()]);
  res.json({ id });
});

app.delete('/api/notifications/:id', async (req, res) => {
  await pool.query('DELETE FROM notifications WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

app.post('/api/notifications/clear', async (req, res) => {
  await pool.query('DELETE FROM notifications');
  res.json({ success: true });
});

app.post('/api/notifications/read/:id', async (req, res) => {
  await pool.query('UPDATE notifications SET read=1 WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// Start
app.listen(PORT, () => {
  console.log('✅ 奥图CRM Supabase 版后端启动!');
  console.log('📡 http://localhost:' + PORT);
  console.log('🗄️  Supabase PostgreSQL: liisnttpmsuynpqhiapj');
});
