/**
 * 奥图CRM - Supabase 直连版
 * 前端直接调用 Supabase REST API
 * 兼容 app.js 的 _load/_save/_update/_delete 通用接口
 */

const SUPABASE_URL = 'https://liisnttpmsuynpqhiapj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_J1qeBOfij7BUBV1Jok38RQ_1uVCiRgj';

const Store = {
  _user: JSON.parse(localStorage.getItem('aotu_user') || 'null'),
  
  _headers(extra) {
    return { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json', 'Prefer': 'return=representation', ...(extra||{}) };
  },

  async _fetch(url, opts) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + url, { headers: this._headers(), ...opts });
    if (\!res.ok && res.status \!== 201) { const t = await res.text(); throw new Error(t.slice(0,100)); }
    const ct = res.headers.get('content-type')||'';
    return ct.includes('json') ? res.json() : res.text();
  },

  // === app.js 使用的通用接口 ===
  async _load(table) {
    const data = await this._fetch(table + '?order=created_at.desc');
    // 权限过滤
    const u = this._user;
    if (\!u || \!data.length) return data;
    try {
      const perms = await this._fetch('perms?select=*');
      const p = perms.find(r => r.role === u.role);
      if (p) {
        const pd = JSON.parse(p.data);
        if (pd[table] === 'all' || pd[table] === true) return data;
      }
    } catch {}
    // own mode filter
    return data.filter(r => r.created_by === u.id || r.salesperson === u.name || r.applicant === u.name);
  },

  async _save(table, body) {
    const data = { ...body, created_by: this._user?.id || '', created_at: Date.now() };
    if (\!data.id) data.id = Date.now().toString(36) + Math.random().toString(36).substr(2,4);
    const res = await this._fetch(table, { method: 'POST', body: JSON.stringify(data) });
    // FX receipt auto notification
    if (table === 'fx_receipts') {
      this.addNotification({ type:'approve', title:'待审批', body:'部门审核待处理:'+(data.receipt_no||''),
        link_id:data.id, link_tab:'general', for_role:'dept_manager', read:0 });
    }
    return data;
  },

  async _update(table, id, body) {
    // 找出主键列
    return this._fetch(table + '?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(body) });
  },

  async _delete(table, id) {
    await this._fetch(table + '?id=eq.' + id, { method: 'DELETE' });
    return { success: true };
  },

  // === Auth ===
  async login(username, password) {
    try {
      const users = await this._fetch('users?select=*');
      const user = users.find(u => u.username === username);
      if (\!user) return null;
      
      if (\!bcrypt.compareSync(password, user.password)) return null;
      const { password:_, ...safe } = user;
      this._user = safe;
      localStorage.setItem('aotu_user', JSON.stringify(safe));
      return safe;
    } catch(e) { console.error('Login error:', e); return null; }
  },

  async register(username, password, name) {
    try {
      const users = await this._fetch('users?select=username');
      if (users.find(u => u.username === username)) return null;
      
      const hash = dcodeIO.bcrypt.hashSync(password);
      const id = 'u_' + Date.now().toString(36);
      const user = { id, username, password:hash, name:name||username, role:'sales', avatar:'👤', created_at:Date.now() };
      await this._fetch('users', { method:'POST', body:JSON.stringify(user) });
      const { password:_, ...safe } = user;
      return safe;
    } catch(e) { return null; }
  },

  logout() { this._user = null; localStorage.removeItem('aotu_user'); },
  isLoggedIn() { return \!\!this._user; },
  currentUser() { return this._user; },

  // === CRUD (各模块专有方法 - 部分app.js使用) ===
  getProducts()      { return this._load('products'); },
  saveProduct(d)     { return this._save('products', d); },
  updateProduct(i,d) { return this._update('products', i, d); },
  deleteProduct(i)   { return this._delete('products', i); },

  getCustomers()      { return this._load('customers'); },
  saveCustomer(d)     { return this._save('customers', d); },
  updateCustomer(i,d) { return this._update('customers', i, d); },
  deleteCustomer(i)   { return this._delete('customers', i); },

  getInquiries()      { return this._load('inquiries'); },
  saveInquiry(d)      { return this._save('inquiries', d); },
  updateInquiry(i,d)  { return this._update('inquiries', i, d); },
  deleteInquiry(i)    { return this._delete('inquiries', i); },

  getFxReceipts()     { return this._load('fx_receipts'); },
  saveFxReceipt(d)    { return this._save('fx_receipts', d); },
  deleteFxReceipt(i)  { return this._delete('fx_receipts', i); },

  getCertDocs()       { return this._load('cert_docs'); },
  saveCertDoc(d)      { return this._save('cert_docs', d); },
  deleteCertDoc(i)    { return this._delete('cert_docs', i); },

  getPriceQuotes()    { return this._load('price_quotes'); },
  savePriceQuote(d)   { return this._save('price_quotes', d); },
  deletePriceQuote(i) { return this._delete('price_quotes', i); },

  getRealOrders()     { return this._load('real_orders'); },
  saveRealOrder(d)    { return this._save('real_orders', d); },
  deleteRealOrder(i)  { return this._delete('real_orders', i); },

  getRefunds()        { return this._load('refunds'); },
  saveRefund(d)       { return this._save('refunds', d); },
  deleteRefund(i)     { return this._delete('refunds', i); },

  // === 通知 ===
  getNotifications()     { return this._load('notifications'); },
  async getMyNotifications() {
    const all = await this._load('notifications');
    const u = this._user;
    if (\!u) return all;
    return all.filter(n => n.for_role === 'all' || n.for_role === u.role || u.role === 'admin');
  },
  async unreadCount() {
    const n = await this.getMyNotifications();
    return n.filter(x => \!x.read).length;
  },
  addNotification(n) { return this._save('notifications', n); },
  async removeNotification(linkId) {
    const all = await this._load('notifications');
    for (const n of all) {
      if (n.link_id === linkId) await this._delete('notifications', n.id);
    }
  },

  // === 用户管理 ===
  async getUsers() {
    const users = await this._fetch('users?select=id,username,name,role,avatar,created_at');
    return users;
  },
  async updateUserRole(id, role) {
    await this._fetch('users?id=eq.' + id, { method:'PATCH', body:JSON.stringify({role}) });
  },
  async deleteUser(id) {
    await this._fetch('users?id=eq.' + id, { method:'DELETE' });
  },

  // === 权限 ===
  async getPerms() {
    const rows = await this._fetch('perms?select=*');
    const result = {};
    rows.forEach(r => { result[r.role] = { ...JSON.parse(r.data), label: r.label }; });
    return result;
  },
  async updatePerm(role, key, val) {
    const rows = await this._fetch('perms?role=eq.' + role + '&select=data');
    if (\!rows.length) return;
    const p = JSON.parse(rows[0].data);
    p[key] = val;
    await this._fetch('perms?role=eq.' + role, { method:'PATCH', body:JSON.stringify({data:JSON.stringify(p)}) });
  }
};
