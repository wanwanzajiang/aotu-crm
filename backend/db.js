const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
let db;

const dbPath = path.join(__dirname, '..', 'data.db');

async function initDB(callback) {
  const SQL = await initSqlJs();
  
  // Try to load existing DB
  try {
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  } catch {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT DEFAULT '',
      role TEXT DEFAULT 'sales',
      avatar TEXT DEFAULT '👤',
      created_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      inquiry_no TEXT,
      salesperson TEXT,
      inquiry_date TEXT,
      status TEXT DEFAULT '跟进中',
      source TEXT,
      channel TEXT,
      country TEXT,
      customer_name TEXT,
      products TEXT DEFAULT '[]',
      total_amount REAL DEFAULT 0,
      created_by TEXT,
      created_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      product_code TEXT,
      brand TEXT,
      model TEXT,
      category TEXT,
      series TEXT,
      price REAL DEFAULT 0,
      created_by TEXT,
      created_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      customer_name TEXT,
      company TEXT,
      contact TEXT,
      customer_type TEXT,
      bargaining_style TEXT,
      created_by TEXT,
      created_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS fx_receipts (
      id TEXT PRIMARY KEY,
      receipt_no TEXT,
      applicant TEXT,
      customer_name TEXT,
      customer_company TEXT,
      country TEXT,
      currency TEXT DEFAULT 'USD',
      amount REAL DEFAULT 0,
      receipt_account TEXT,
      shipping_method TEXT,
      notes TEXT,
      depart_audit TEXT DEFAULT '待审核',
      finance_audit TEXT DEFAULT '待审核',
      ceo_approval TEXT DEFAULT '待审批',
      status TEXT DEFAULT '待审核',
      created_by TEXT,
      created_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS cert_docs (
      id TEXT PRIMARY KEY,
      order_no TEXT,
      customer_name TEXT,
      products TEXT DEFAULT '[]',
      total_amount REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT '待审核',
      created_by TEXT,
      created_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS price_quotes (
      id TEXT PRIMARY KEY,
      order_no TEXT,
      customer_name TEXT,
      products TEXT DEFAULT '[]',
      total_amount REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT '待审核',
      created_by TEXT,
      created_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS real_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT,
      customer_name TEXT,
      products TEXT DEFAULT '[]',
      total_amount REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT '待审核',
      created_by TEXT,
      created_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      order_no TEXT,
      refund_type TEXT,
      customer_name TEXT,
      receipt_account TEXT,
      notes TEXT,
      total_amount REAL DEFAULT 0,
      status TEXT DEFAULT '待审核',
      created_by TEXT,
      created_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT,
      title TEXT,
      body TEXT,
      link_id TEXT,
      link_tab TEXT,
      for_role TEXT,
      read INTEGER DEFAULT 0,
      created_at INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS perms (
      role TEXT PRIMARY KEY,
      label TEXT,
      data TEXT
    )
  `);

  // Seed default data
  const count = db.exec('SELECT COUNT(*) as c FROM users');
  const c = count[0]?.values[0][0] || 0;
  if (c === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin888');
    const hash2 = bcrypt.hashSync('123456');
    const seed = [
      ['u_admin','admin',hash,'系统管理员','admin','👑'],
      ['u_sales','sales01',hash2,'张销售','sales','💼'],
      ['u_dept','dept_mgr',hash2,'王主管','dept_manager','📋'],
      ['u_finance','finance',hash2,'李财务','finance','💰'],
      ['u_ceo','ceo',hash2,'陈总','ceo','🏢'],
    ];
    const now = Date.now();
    const ins = db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)');
    seed.forEach(s => ins.run([s[0],s[1],s[2],s[3],s[4],s[5],now]));

    const defPerms = {
      sales:{label:'普通业务员',inquiries:'own',general:'own',products:true,customers:true,users:false,settings:false,perms:false},
      dept_manager:{label:'部门主管',inquiries:'own',general:'own',products:true,customers:true,users:false,settings:false,perms:false},
      finance:{label:'财务',inquiries:'all',general:'all',products:true,customers:true,users:false,settings:false,perms:false},
      ceo:{label:'总经理',inquiries:'all',general:'all',products:true,customers:true,users:false,settings:true,perms:false},
      admin:{label:'管理员',inquiries:'all',general:'all',products:true,customers:true,users:true,settings:true,perms:true}
    };
    const pIns = db.prepare('INSERT INTO perms VALUES(?,?,?)');
    Object.entries(defPerms).forEach(([k,v]) => pIns.run([k, v.label, JSON.stringify(v)]));
  }

  saveDB();
  callback();
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDB() { return db; }

module.exports = { initDB, getDB, saveDB };
