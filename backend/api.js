const { getDB, saveDB } = require('./db');

function uid(prefix) {
  return (prefix||'') + Date.now().toString(36) + Math.random().toString(36).substr(2,6);
}

function qOne(sql, params) {
  const db = getDB();
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj;
  }
  stmt.free();
  return null;
}

function qAll(sql, params) {
  const db = getDB();
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const cols = stmt.getColumnNames();
  const rows = [];
  while (stmt.step()) {
    const vals = stmt.get();
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    rows.push(obj);
  }
  stmt.free();
  return rows;
}

function qRun(sql, params) {
  const db = getDB();
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  stmt.step();
  stmt.free();
  saveDB();
}

const STAGE_NEXT = { depart_audit: 'finance_audit', finance_audit: 'ceo_approval', ceo_approval: null };
const STAGE_ROLE = { depart_audit: 'dept_manager', finance_audit: 'finance', ceo_approval: 'ceo' };

function list(table, user) {
  const rows = qAll(`SELECT * FROM ${table} ORDER BY created_at DESC`);
  rows.forEach(r => { if (r.products && typeof r.products === 'string') r.products = JSON.parse(r.products); });
  const db = getDB();
  const pRow = qOne('SELECT data FROM perms WHERE role=?', [user.role]);
  if (pRow) {
    const p = JSON.parse(pRow.data);
    if (p[table] === 'own') {
      return rows.filter(r => r.created_by === user.id || r.salesperson === user.name || r.applicant === user.name);
    }
  }
  return rows;
}

function create(table, data, user) {
  const id = uid('');
  const now = Date.now();
  if (table === 'fx_receipts') {
    data.depart_audit = '待审核';
    data.finance_audit = '待审核';
    data.ceo_approval = '待审批';
    data.status = '待审核';
  }
  const keys = ['id', ...Object.keys(data), 'created_by', 'created_at'];
  const vals = [id, ...Object.values(data), user.id, now];
  const ph = keys.map(() => '?').join(',');
  qRun(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${ph})`, vals);
  return { id, ...data, created_by: user.id, created_at: now };
}

function update(table, id, data) {
  const sets = Object.keys(data).map(k => `${k}=?`).join(',');
  const vals = [...Object.values(data), id];
  qRun(`UPDATE ${table} SET ${sets} WHERE id=?`, vals);
  return { id, ...data };
}

function remove(table, id) {
  qRun(`DELETE FROM ${table} WHERE id=?`, [id]);
  return { success: true };
}

// Approval
function approve(id, table, user) {
  const raw = qAll(`SELECT * FROM ${table} WHERE id=?`, [id]);
  if (!raw.length) return { error: '未找到' };
  const item = raw[0];
  if (item.products && typeof item.products === 'string') item.products = JSON.parse(item.products);
  
  let stage = null;
  if ((item.depart_audit==='待审核'||item.depart_audit==='审核中') && (user.role==='dept_manager'||user.role==='admin')) stage = 'depart_audit';
  else if ((item.finance_audit==='待审核'||item.finance_audit==='审核中') && (user.role==='finance'||user.role==='admin')) stage = 'finance_audit';
  else if ((item.ceo_approval==='待审批'||item.ceo_approval==='待审核'||item.ceo_approval==='审批中') && (user.role==='ceo'||user.role==='admin')) stage = 'ceo_approval';
  if (!stage) return { error: '无法审批' };

  const next = STAGE_NEXT[stage];
  item[stage] = '已通过';
  if (next) item[next] = '待审核';
  else item.status = '已通过';
  
  const sets = Object.keys(item).map(k => `${k}=?`).join(',');
  qRun(`UPDATE ${table} SET ${sets} WHERE id=?`, [...Object.values(item), id]);
  
  // Remove old notification
  qRun('DELETE FROM notifications WHERE link_id=?', [id]);
  
  // Add new notification
  if (next) {
    const label = next === 'finance_audit' ? '财务审核' : '总经理审批';
    addNoti({ type:'approve', title:'待审批', body:label+'待处理', link_id:id, link_tab:'general', for_role:STAGE_ROLE[next] });
  } else {
    addNoti({ type:'info', title:'审批完成', body:'申请已全部通过', link_id:id, link_tab:'general', for_role:'all' });
  }
  return { success: true, stage };
}

function reject(id, table, user) {
  const raw = qAll(`SELECT * FROM ${table} WHERE id=?`, [id]);
  if (!raw.length) return { error: '未找到' };
  const item = raw[0];
  
  let stage = null;
  if ((item.depart_audit==='待审核'||item.depart_audit==='审核中') && (user.role==='dept_manager'||user.role==='admin')) stage = 'depart_audit';
  else if ((item.finance_audit==='待审核'||item.finance_audit==='审核中') && (user.role==='finance'||user.role==='admin')) stage = 'finance_audit';
  else if ((item.ceo_approval==='待审批'||item.ceo_approval==='待审核'||item.ceo_approval==='审批中') && (user.role==='ceo'||user.role==='admin')) stage = 'ceo_approval';
  if (!stage) return { error: '无法驳回' };

  item[stage] = '已驳回';
  item.status = '已驳回';
  const sets = Object.keys(item).map(k => `${k}=?`).join(',');
  qRun(`UPDATE ${table} SET ${sets} WHERE id=?`, [...Object.values(item), id]);
  qRun('DELETE FROM notifications WHERE link_id=?', [id]);
  return { success: true };
}

// Users
function listUsers(user) {
  if (user.role !== 'admin') return { error: '无权限' };
  return qAll('SELECT id,username,name,role,avatar,created_at FROM users ORDER BY created_at');
}

function setUserRole(user, userId, role) {
  if (user.role !== 'admin') return { error: '无权限' };
  qRun('UPDATE users SET role=? WHERE id=?', [role, userId]);
  return { success: true };
}

function deleteUser(user, userId) {
  if (user.role !== 'admin' || userId === user.id) return { error: '无权限' };
  const target = qOne('SELECT role FROM users WHERE id=?', [userId]);
  if (!target || target.role === 'admin') return { error: '无法删除' };
  qRun('DELETE FROM users WHERE id=?', [userId]);
  return { success: true };
}

// Permissions
function getPerms(user) {
  if (!user) return {};
  const rows = qAll('SELECT * FROM perms');
  const result = {};
  rows.forEach(r => { result[r.role] = { ...JSON.parse(r.data), label: r.label }; });
  return result;
}

function setPerm(user, data) {
  if (user.role !== 'admin') return { error: '无权限' };
  const { role, key, val } = data;
  const row = qOne('SELECT * FROM perms WHERE role=?', [role]);
  if (!row) return { error: '角色不存在' };
  const perm = JSON.parse(row.data);
  perm[key] = val;
  qRun('UPDATE perms SET data=? WHERE role=?', [JSON.stringify(perm), role]);
  return { success: true };
}

// Notifications
function getNotis(user) {
  const rows = qAll('SELECT * FROM notifications ORDER BY created_at DESC');
  return rows.filter(n => n.for_role === 'all' || n.for_role === user.role || user.role === 'admin');
}

function addNoti(data) {
  const id = uid('n_');
  qRun('INSERT INTO notifications(id,type,title,body,link_id,link_tab,for_role,read,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    [id, data.type||'info', data.title||'', data.body||'', data.link_id||'', data.link_tab||'', data.for_role||'all', 0, Date.now()]);
  return { id };
}

function delNoti(id) {
  qRun('DELETE FROM notifications WHERE id=?', [id]);
  return { success: true };
}

function clearNotis() {
  qRun('DELETE FROM notifications');
  return { success: true };
}

function readNoti(id) {
  qRun('UPDATE notifications SET read=1 WHERE id=?', [id]);
  return { success: true };
}

function unreadCount(user) {
  const rows = qAll('SELECT * FROM notifications WHERE read=0');
  return rows.filter(n => n.for_role === 'all' || n.for_role === user.role || user.role === 'admin').length;
}

module.exports = { list, create, update, remove, listUsers, setUserRole, deleteUser, getPerms, setPerm, getNotis, addNoti, delNoti, clearNotis, readNoti, approve, reject, qOne, qAll, qRun, unreadCount };
