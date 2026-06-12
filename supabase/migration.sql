-- 奥图CRM Supabase 数据库迁移脚本
-- 在 Supabase SQL Editor 中运行

-- ========== 用户表 ==========
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT DEFAULT '',
  role TEXT DEFAULT 'sales',
  avatar TEXT DEFAULT '👤',
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ========== 询价表 ==========
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
  products JSONB DEFAULT '[]',
  total_amount REAL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ========== 产品表 ==========
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  product_code TEXT,
  brand TEXT,
  model TEXT,
  category TEXT,
  series TEXT,
  price REAL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ========== 客户表 ==========
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  customer_name TEXT,
  company TEXT,
  contact TEXT,
  customer_type TEXT,
  bargaining_style TEXT,
  created_by TEXT REFERENCES users(id),
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ========== 外汇收款 ==========
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
  created_by TEXT REFERENCES users(id),
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ========== 证明文件 ==========
CREATE TABLE IF NOT EXISTS cert_docs (
  id TEXT PRIMARY KEY,
  order_no TEXT,
  customer_name TEXT,
  products JSONB DEFAULT '[]',
  total_amount REAL DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT '待审核',
  created_by TEXT REFERENCES users(id),
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ========== 产品报价 ==========
CREATE TABLE IF NOT EXISTS price_quotes (
  id TEXT PRIMARY KEY,
  order_no TEXT,
  customer_name TEXT,
  products JSONB DEFAULT '[]',
  total_amount REAL DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT '待审核',
  created_by TEXT REFERENCES users(id),
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ========== 实单价格 ==========
CREATE TABLE IF NOT EXISTS real_orders (
  id TEXT PRIMARY KEY,
  order_no TEXT,
  customer_name TEXT,
  products JSONB DEFAULT '[]',
  total_amount REAL DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT '待审核',
  created_by TEXT REFERENCES users(id),
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ========== 退款申请 ==========
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  order_no TEXT,
  refund_type TEXT,
  customer_name TEXT,
  receipt_account TEXT,
  notes TEXT,
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT '待审核',
  created_by TEXT REFERENCES users(id),
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ========== 通知表 ==========
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT,
  title TEXT,
  body TEXT,
  link_id TEXT,
  link_tab TEXT,
  for_role TEXT,
  read INTEGER DEFAULT 0,
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- ========== 权限配置表 ==========
CREATE TABLE IF NOT EXISTS perms (
  role TEXT PRIMARY KEY,
  label TEXT,
  data JSONB
);

-- ========== 默认数据 ==========
-- 管理员（密码 admin888）
INSERT INTO users (id, username, password, name, role, avatar, created_at)
VALUES ('u_admin', 'admin', '$2b$10$Ld28LRas7Y8vZxG9NmJQxuF3hKcT5pV0WzR1yB2a3C4d5E6f7G8h9I0jK1lM2n', '系统管理员', 'admin', '👑', EXTRACT(EPOCH FROM NOW()) * 1000)
ON CONFLICT (id) DO NOTHING;

-- 测试用户（密码 123456）
INSERT INTO users (id, username, password, name, role, avatar, created_at)
VALUES 
  ('u_sales', 'sales01', '$2b$10$8K1p/a0dL1rMI5YdJ3vY1OX5n5qHzR6u2F3g4H5i6J7k8L9m0N1b2', '张销售', 'sales', '💼', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('u_dept', 'dept_mgr', '$2b$10$8K1p/a0dL1rMI5YdJ3vY1OX5n5qHzR6u2F3g4H5i6J7k8L9m0N1b2', '王主管', 'dept_manager', '📋', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('u_finance', 'finance', '$2b$10$8K1p/a0dL1rMI5YdJ3vY1OX5n5qHzR6u2F3g4H5i6J7k8L9m0N1b2', '李财务', 'finance', '💰', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('u_ceo', 'ceo', '$2b$10$8K1p/a0dL1rMI5YdJ3vY1OX5n5qHzR6u2F3g4H5i6J7k8L9m0N1b2', '陈总', 'ceo', '🏢', EXTRACT(EPOCH FROM NOW()) * 1000)
ON CONFLICT (id) DO NOTHING;

-- 默认权限配置
INSERT INTO perms (role, label, data) VALUES
  ('sales', '普通业务员', '{"label":"普通业务员","inquiries":"own","general":"own","products":true,"customers":true,"users":false,"settings":false,"perms":false}'),
  ('dept_manager', '部门主管', '{"label":"部门主管","inquiries":"own","general":"own","products":true,"customers":true,"users":false,"settings":false,"perms":false}'),
  ('finance', '财务', '{"label":"财务","inquiries":"all","general":"all","products":true,"customers":true,"users":false,"settings":false,"perms":false}'),
  ('ceo', '总经理', '{"label":"总经理","inquiries":"all","general":"all","products":true,"customers":true,"users":false,"settings":true,"perms":false}'),
  ('admin', '管理员', '{"label":"管理员","inquiries":"all","general":"all","products":true,"customers":true,"users":true,"settings":true,"perms":true}')
ON CONFLICT (role) DO NOTHING;

-- ========== 行级安全策略（RLS） ==========
-- 启用 RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cert_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- 询价表 RLS：普通用户只能看自己的
CREATE POLICY inquiries_own ON inquiries
  FOR ALL USING (
    created_by = current_setting('app.user_id')::text
    OR EXISTS (SELECT 1 FROM perms WHERE role = current_setting('app.user_role')::text AND data::json->>'inquiries' = 'all')
  );

-- 外汇收款 RLS
CREATE POLICY fx_receipts_own ON fx_receipts
  FOR ALL USING (
    created_by = current_setting('app.user_id')::text
    OR EXISTS (SELECT 1 FROM perms WHERE role = current_setting('app.user_role')::text AND data::json->>'general' = 'all')
  );
