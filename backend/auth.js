const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB, saveDB } = require('./db');

const JWT_SECRET = 'aotu_crm_jwt_secret_2026';
const JWT_EXPIRES = '7d';

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

function login(username, password) {
  const user = qOne('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password)) return null;
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  const { password: _, ...safe } = user;
  qRun('UPDATE users SET created_at=? WHERE id=?', [Date.now(), user.id]);
  return { token, user: safe };
}

function register(username, password, name) {
  const exist = qOne('SELECT id FROM users WHERE username = ?', [username]);
  if (exist) return null;
  const hash = bcrypt.hashSync(password);
  const id = uid('u_');
  qRun('INSERT INTO users(id,username,password,name,role,created_at) VALUES(?,?,?,?,?,?)',
    [id, username, hash, name||username, 'sales', Date.now()]);
  const user = qOne('SELECT * FROM users WHERE id = ?', [id]);
  const { password: _, ...safe } = user;
  return safe;
}

function verify(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = qOne('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user) return null;
    const { password: _, ...safe } = user;
    return safe;
  } catch { return null; }
}

module.exports = { login, register, verify, qOne, qAll, qRun };
