/**
 * 奥图CRM - Supabase 数据层
 * 所有数据通过后端 API 存取（后端连 Supabase PostgreSQL）
 */
const Store = {
  _token: sessionStorage.getItem('aotu_supa_token') || '',
  _user: null,
  _api: 'http://localhost:3456/api',

  async _fetch(path, opts={}) {
    opts.headers = { 'Content-Type': 'application/json', ...(opts.headers||{}) };
    if (this._token) opts.headers['Authorization'] = 'Bearer ' + this._token;
    const res = await fetch(this._api + path, opts);
    if (\!res.ok) throw new Error(res.statusText);
    return res.json();
  },

  async login(username, password) {
    const data = await this._fetch('/login', { method:'POST', body:JSON.stringify({username,password}) });
    if (\!data.token) return null;
    sessionStorage.setItem('aotu_supa_token', data.token);
    this._token = data.token;
    this._user = data.user;
    return data.user;
  },

  async register(username, password, name) {
    try { return await this._fetch('/register', { method:'POST', body:JSON.stringify({username,password,name}) }); }
    catch { return null; }
  },

  logout() { sessionStorage.removeItem('aotu_supa_token'); this._token = ''; this._user = null; },
  isLoggedIn() { return \!\!this._token; },
  currentUser() { return this._user; },

  // CRUD
  async _list(t) { return this._fetch('/'+t); },
  async _save(t, d) { return this._fetch('/'+t, { method:'POST', body:JSON.stringify(d) }); },
  async _upd(t, i, d) { return this._fetch('/'+t+'/'+i, { method:'PUT', body:JSON.stringify(d) }); },
  async _del(t, i) { return this._fetch('/'+t+'/'+i, { method:'DELETE' }); },

  getInquiries() { return this._list('inquiries'); },
  saveInquiry(d) { return this._save('inquiries', d); },
  updateInquiry(i, d) { return this._upd('inquiries', i, d); },
  deleteInquiry(i) { return this._del('inquiries', i); },

  getProducts() { return this._list('products'); },
  saveProduct(d) { return this._save('products', d); },
  updateProduct(i, d) { return this._upd('products', i, d); },
  deleteProduct(i) { return this._del('products', i); },

  getCustomers() { return this._list('customers'); },
  saveCustomer(d) { return this._save('customers', d); },
  updateCustomer(i, d) { return this._upd('customers', i, d); },
  deleteCustomer(i) { return this._del('customers', i); },

  getFxReceipts() { return this._list('fx_receipts'); },
  saveFxReceipt(d) { return this._save('fx_receipts', d); },
  deleteFxReceipt(i) { return this._del('fx_receipts', i); },

  getCertDocs() { return this._list('cert_docs'); },
  saveCertDoc(d) { return this._save('cert_docs', d); },
  deleteCertDoc(i) { return this._del('cert_docs', i); },

  getPriceQuotes() { return this._list('price_quotes'); },
  savePriceQuote(d) { return this._save('price_quotes', d); },
  deletePriceQuote(i) { return this._del('price_quotes', i); },

  getRealOrders() { return this._list('real_orders'); },
  saveRealOrder(d) { return this._save('real_orders', d); },
  deleteRealOrder(i) { return this._del('real_orders', i); },

  getRefunds() { return this._list('refunds'); },
  saveRefund(d) { return this._save('refunds', d); },
  deleteRefund(i) { return this._del('refunds', i); },

  async getUsers() { return this._fetch('/admin/users'); },
  async updateUserRole(i, r) { return this._fetch('/admin/users/'+i+'/role', { method:'PUT', body:JSON.stringify({role:r}) }); },
  async deleteUser(i) { return this._fetch('/admin/users/'+i, { method:'DELETE' }); },

  async getNotifications() { return this._fetch('/notifications'); },
  async getMyNotifications() { return this._fetch('/notifications'); },
  async unreadCount() { const d = await this._fetch('/notifications/unread'); return d.count; },
  async addNotification(n) { return this._fetch('/notifications', { method:'POST', body:JSON.stringify(n) }); },
  async removeNotification(l) { return this._del('notifications/'+l); },

  async getPerms() { return this._fetch('/admin/perms'); },
  async updatePerm(r, k, v) { return this._fetch('/admin/perms', { method:'PUT', body:JSON.stringify({role:r, key:k, val:v}) }); },

  async filterMine(list, module, field) {
    const u = this.currentUser(); if (\!u || \!list.length) return list;
    try {
      const perms = await this.getPerms();
      const p = perms[u.role];
      if (p && p[module] === 'all') return list;
    } catch {}
    return list.filter(i => i[field||'salesperson'] === u.name || i.created_by === u.id);
  },

  _uid(p) { return (p||'') + Date.now().toString(36) + Math.random().toString(36).substr(2,6); }
};
