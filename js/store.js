/**
 * 奥图CRM - 数据层
 * 双模式: 自动检测后端 API, 有则用 API, 无则用 localStorage
 */

const API_BASE = window.location.port === '3456' || window.location.port === '3000' 
  ? '' : 'http://localhost:3456';

const Store = {
  _token: localStorage.getItem('aotu_token') || '',
  _user: JSON.parse(localStorage.getItem('aotu_user') || 'null'),
  _ready: false,
  _api: API_BASE + '/api',
  _fallback: \!API_BASE, // 无 API 时用 localStorage

  async init() {
    if (this._ready) return;
    // 检测后端是否可用
    try {
      const res = await fetch(this._api + '/login', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({username:'probe', password:'probe'})
      });
      if (res.status === 401) {
        // API 存在\!
        this._fallback = false;
        console.log('📡 后端 API 模式');
      } else {
        this._fallback = true;
        console.log('📄 localStorage 模式');
      }
    } catch {
      this._fallback = true;
      console.log('📄 localStorage 模式');
    }
    this._ready = true;
  },

  async _fetch(path, opts = {}) {
    opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (this._token) opts.headers['Authorization'] = 'Bearer ' + this._token;
    const res = await fetch(this._api + path, opts);
    if (\!res.ok) throw new Error(res.statusText);
    return res.json();
  },

  // ========== Auth ==========
  async login(username, password) {
    await this.init();
    if (\!this._fallback) {
      try {
        const data = await this._fetch('/login', { method:'POST', body:JSON.stringify({username,password}) });
        if (\!data.token) return null;
        this._token = data.token;
        this._user = data.user;
        localStorage.setItem('aotu_token', data.token);
        localStorage.setItem('aotu_user', JSON.stringify(data.user));
        return data.user;
      } catch { this._fallback = true; }
    }
    // localStorage fallback
    const users = JSON.parse(localStorage.getItem('aotu_users') || '{}');
    const user = Object.values(users).find(u => u.username === username);
    if (\!user) return null;
    const { default: bcrypt } = await import('https://cdn.jsdelivr.net/npm/bcryptjs@2/+esm');
    if (\!bcrypt.compareSync(password, user.password)) return null;
    this._user = user;
    localStorage.setItem('aotu_user', JSON.stringify(user));
    return user;
  },

  async register(username, password, name) {
    await this.init();
    if (\!this._fallback) {
      try {
        const user = await this._fetch('/register', { method:'POST', body:JSON.stringify({username,password,name}) });
        return user;
      } catch { return null; }
    }
    const users = JSON.parse(localStorage.getItem('aotu_users') || '{}');
    if (Object.values(users).find(u => u.username === username)) return null;
    const bcrypt = await import('https://cdn.jsdelivr.net/npm/bcryptjs@2/+esm');
    const id = 'u_' + Date.now().toString(36);
    const user = { id, username, password: bcrypt.hashSync(password), name: name||username, role: 'sales', avatar: '👤', created_at: Date.now() };
    users[id] = user;
    localStorage.setItem('aotu_users', JSON.stringify(users));
    const { password: _, ...safe } = user;
    return safe;
  },

  logout() {
    this._token = ''; this._user = null;
    localStorage.removeItem('aotu_token');
    localStorage.removeItem('aotu_user');
  },
  isLoggedIn() { return \!\!this._user; },
  currentUser() { return this._user; },

  // ========== CRUD (通用) ==========
  async _load(table) {
    if (\!this._fallback) {
      try { return await this._fetch('/' + table); } catch {}
    }
    const data = JSON.parse(localStorage.getItem('aotu_' + table) || '[]');
    const user = this._user;
    if (\!user) return data;
    const perms = JSON.parse(localStorage.getItem('aotu_perms_raw') || '{}');
    const p = perms[user.role];
    if (p && (p[table] === 'all' || p[table] === true)) return data;
    return data.filter(r => r.created_by === user.id || r.salesperson === user.name || r.applicant === user.name);
  },

  async _save(table, data) {
    if (\!this._fallback) {
      try { return await this._fetch('/' + table, { method:'POST', body:JSON.stringify(data) }); } catch {}
    }
    const all = JSON.parse(localStorage.getItem('aotu_' + table) || '[]');
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2,4);
    const now = Date.now();
    const item = { id, ...data, created_by: this._user?.id, created_at: now };
    all.push(item);
    localStorage.setItem('aotu_' + table, JSON.stringify(all));
    if (table === 'fx_receipts') {
      this._addNoti({ type:'approve', title:'待审批', body:'部门审核待处理:'+data.receipt_no, link_id:id, link_tab:'general', for_role:'dept_manager' });
    }
    return item;
  },

  async _update(table, id, data) {
    if (\!this._fallback) {
      try { return await this._fetch('/' + table + '/' + id, { method:'PUT', body:JSON.stringify(data) }); } catch {}
    }
    const all = JSON.parse(localStorage.getItem('aotu_' + table) || '[]');
    const idx = all.findIndex(r => r.id === id);
    if (idx >= 0) { all[idx] = { ...all[idx], ...data }; localStorage.setItem('aotu_' + table, JSON.stringify(all)); }
    return { id, ...data };
  },

  async _delete(table, id) {
    if (\!this._fallback) {
      try { return await this._fetch('/' + table + '/' + id, { method:'DELETE' }); } catch {}
    }
    const all = JSON.parse(localStorage.getItem('aotu_' + table) || '[]');
    localStorage.setItem('aotu_' + table, JSON.stringify(all.filter(r => r.id \!== id)));
    return { success: true };
  },

  // ========== 各模块 ==========
  getInquiries() { return this._load('inquiries'); },
  saveInquiry(d) { return this._save('inquiries', d); },
  updateInquiry(i, d) { return this._update('inquiries', i, d); },
  deleteInquiry(i) { return this._delete('inquiries', i); },

  getProducts() { return this._load('products'); },
  saveProduct(d) { return this._save('products', d); },
  updateProduct(i, d) { return this._update('products', i, d); },
  deleteProduct(i) { return this._delete('products', i); },

  getCustomers() { return this._load('customers'); },
  saveCustomer(d) { return this._save('customers', d); },
  updateCustomer(i, d) { return this._update('customers', i, d); },
  deleteCustomer(i) { return this._delete('customers', i); },

  getFxReceipts() { return this._load('fx_receipts'); },
  saveFxReceipt(d) { return this._save('fx_receipts', d); },
  deleteFxReceipt(i) { return this._delete('fx_receipts', i); },

  getCertDocs() { return this._load('cert_docs'); },
  saveCertDoc(d) { return this._save('cert_docs', d); },
  deleteCertDoc(i) { return this._delete('cert_docs', i); },

  getPriceQuotes() { return this._load('price_quotes'); },
  savePriceQuote(d) { return this._save('price_quotes', d); },
  deletePriceQuote(i) { return this._delete('price_quotes', i); },

  getRealOrders() { return this._load('real_orders'); },
  saveRealOrder(d) { return this._save('real_orders', d); },
  deleteRealOrder(i) { return this._delete('real_orders', i); },

  getRefunds() { return this._load('refunds'); },
  saveRefund(d) { return this._save('refunds', d); },
  deleteRefund(i) { return this._delete('refunds', i); },

  getUsers() {
    if (\!this._fallback) return this._fetch('/admin/users');
    return Object.values(JSON.parse(localStorage.getItem('aotu_users') || '{}'))
      .map(({password, ...u}) => ({...u, role: u.role||'sales'}));
  },
  async updateUserRole(id, role) {
    if (\!this._fallback) return this._fetch('/admin/users/'+id+'/role', { method:'PUT', body:JSON.stringify({role}) });
    const users = JSON.parse(localStorage.getItem('aotu_users') || '{}');
    if (users[id]) { users[id].role = role; localStorage.setItem('aotu_users', JSON.stringify(users)); }
  },
  async deleteUser(id) {
    if (\!this._fallback) return this._fetch('/admin/users/'+id, { method:'DELETE' });
    const users = JSON.parse(localStorage.getItem('aotu_users') || '{}');
    delete users[id]; localStorage.setItem('aotu_users', JSON.stringify(users));
  },

  getNotifications() { return this._load('notifications'); },
  async getMyNotifications() {
    const all = await this._load('notifications');
    const user = this._user;
    if (\!user) return all;
    return all.filter(n => n.for_role === 'all' || n.for_role === user.role || user.role === 'admin');
  },

  async unreadCount() {
    const all = await this.getMyNotifications();
    return all.filter(n => \!n.read).length;
  },
  _addNoti(n) { return this._save('notifications', n); },
  async addNotification(n) { return this._save('notifications', n); },
  async removeNotification(linkId) {
    const all = await this._load('notifications');
    for (const n of all) {
      if (n.link_id === linkId) await this._delete('notifications', n.id);
    }
  },

  getPerms() {
    if (\!this._fallback) return this._fetch('/admin/perms');
    return JSON.parse(localStorage.getItem('aotu_perms') || '{}');
  },
  async updatePerm(role, key, val) {
    if (\!this._fallback) return this._fetch('/admin/perms', { method:'PUT', body:JSON.stringify({role,key,val}) });
    const perms = JSON.parse(localStorage.getItem('aotu_perms') || '{}');
    if (perms[role]) { perms[role][key] = val; localStorage.setItem('aotu_perms', JSON.stringify(perms)); }
  }
};
