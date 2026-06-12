/**
 * 奥图CRM — 数据存储层 v4.0（完整版）
 */
const Store = {
  _prefix: 'aotu_',
  _key(n) { return this._prefix + n; },
  _get(n) { try { return JSON.parse(localStorage.getItem(this._key(n))); } catch { return null; } },
  _set(n, d) { localStorage.setItem(this._key(n), JSON.stringify(d)); },
  _uid(n) { return (n||'') + Date.now().toString(36) + Math.random().toString(36).substr(2, 6); },

  /* ========== 用户 ========== */
  DEFAULT_USERS: [
    { id:'u_admin',username:'admin',password:'admin888',name:'系统管理员',role:'admin',avatar:'👑' },
    { id:'u_sales',username:'sales01',password:'123456',name:'张销售',role:'sales',avatar:'💼' },
    { id:'u_dept',username:'dept_mgr',password:'123456',name:'王主管',role:'dept_manager',avatar:'📋' },
    { id:'u_finance',username:'finance',password:'123456',name:'李财务',role:'finance',avatar:'💰' },
    { id:'u_ceo',username:'ceo',password:'123456',name:'陈总',role:'ceo',avatar:'🏢' },
  ],
  ROLE_LABELS:{admin:'管理员',sales:'销售员',dept_manager:'部门主管',finance:'财务',ceo:'总经理'},
  ROLE_APPROVE:{dept_manager:'depart_audit',finance:'finance_audit',ceo:'ceo_approval'},
  STAGE_ORDER:['depart_audit','finance_audit','ceo_approval'],
  STAGE_LABEL:{depart_audit:'部门审核',finance_audit:'财务审核',ceo_approval:'总经理审批'},
  STAGE_NEXT:{depart_audit:'finance_audit',finance_audit:'ceo_approval',ceo_approval:null},
  STAGE_APPROVER:{depart_audit:'dept_manager',finance_audit:'finance',ceo_approval:'ceo'},

  /* ========== 权限配置 ========== */
  DEFAULT_PERMS:{
    sales:{label:'普通业务员',inquiries:'own',general:'own',products:true,customers:true,users:false,settings:false,perms:false},
    dept_manager:{label:'部门主管',inquiries:'own',general:'own',products:true,customers:true,users:false,settings:false,perms:false},
    finance:{label:'财务',inquiries:'all',general:'all',products:true,customers:true,users:false,settings:false,perms:false},
    ceo:{label:'总经理',inquiries:'all',general:'all',products:true,customers:true,users:false,settings:true,perms:false},
    admin:{label:'管理员',inquiries:'all',general:'all',products:true,customers:true,users:true,settings:true,perms:true}
  },
  getPerms(){return this._get('perms')||this.DEFAULT_PERMS;},
  updatePerm(role,key,val){const perms=this.getPerms();if(!perms[role])perms[role]={};perms[role][key]=val;this._set('perms',perms);},

  /* ========== 数据权限检查 ========== */
  canViewAll(module){const u=this.currentUser();if(!u)return false;const perms=this.getPerms();const r=perms[u.role];return r&&r[module]==='all';},
  filterMine(list,module,field){const u=this.currentUser();if(!u)return list;if(this.canViewAll(module))return list;const perms=this.getPerms();const r=perms[u.role];if(r&&r[module]==='own')return list.filter(i=>i[field||'salesperson']===u.name||i.created_by===u.id);return list;},

  _initUsers(){try{const e=JSON.parse(localStorage.getItem(this._key('users'))||'[]');if(e.length===0)localStorage.setItem(this._key('users'),JSON.stringify(this.DEFAULT_USERS));}catch{localStorage.setItem(this._key('users'),JSON.stringify(this.DEFAULT_USERS));}},
  getUsers(){this._initUsers();return JSON.parse(localStorage.getItem(this._key('users'))||'[]');},

  login(username,password){const u=this.getUsers().find(u=>u.username===username&&u.password===password);if(u){const{password,...s}=u;s.token='tk_'+Date.now().toString(36);sessionStorage.setItem(this._key('session'),JSON.stringify({user:s,ts:Date.now()}));return s;}return null;},
  logout(){sessionStorage.removeItem(this._key('session'));},
  register(username,password,name){const users=this.getUsers();if(users.find(u=>u.username===username))return null;const user={id:this._uid('u_'),username,password,name:name||username,role:'sales',avatar:'👤',created_at:Date.now()};users.push(user);this._set('users',users);const{password:p,...safe}=user;return safe;},
  updateUserRole(userId,role){const users=this.getUsers();const idx=users.findIndex(u=>u.id===userId);if(idx<0)return false;users[idx].role=role;this._set('users',users);return true;},
  deleteUser(userId){const cu=this.currentUser();if(!cu||userId===cu.id)return false;const users=this.getUsers();const idx=users.findIndex(u=>u.id===userId);if(idx<0||users[idx].role==='admin')return false;users.splice(idx,1);this._set('users',users);return true;},
  currentUser(){try{const s=JSON.parse(sessionStorage.getItem(this._key('session')));if(s&&s.user)return s.user;}catch{}return null;},
  isLoggedIn(){return!!this.currentUser();},
  hasRole(role){const u=this.currentUser();return u&&(u.role===role||u.role==='admin');},

  /* ========== 通知 ========== */
  getNotifications(){return this._get('notifications')||[];},
  getMyNotifications(){const u=this.currentUser();if(!u)return this.getNotifications();return this.getNotifications().filter(n=>n.for_role==='all'||n.for_role===u.role||u.role==='admin');},
  addNotification(n){const l=this.getNotifications();l.unshift({id:this._uid('n_'),...n,read:false,created_at:Date.now()});this._set('notifications',l);},removeNotification(linkId){const l=this.getNotifications().filter(n=>n.link_id!==linkId);this._set('notifications',l);},
  unreadCount(){const u=this.currentUser();if(!u)return 0;return this.getNotifications().filter(n=>!n.read&&(n.for_role==='all'||n.for_role===u.role||u.role==='admin')).length;},

  /* ========== 通用 CRUD ========== */
  _arr(n,d){d=d||[];const v=this._get(n);return Array.isArray(v)?v:d;},
  _getById(n,id){return this._arr(n).find(x=>x.id===id);},
  _save(n,item,defaults){const l=this._arr(n);if(item.id){const i=l.findIndex(x=>x.id===item.id);if(i>=0){l[i]={...l[i],...item,updated_at:Date.now()};this._set(n,l);return l[i];}}const now=Date.now();item.id=this._uid();item.created_at=now;item.updated_at=now;if(defaults)Object.assign(item,defaults);l.unshift(item);this._set(n,l);return item;},
  _delete(n,id){const l=this._arr(n);this._set(n,l.filter(x=>x.id!==id));},

  /* ========== 基础数据 ========== */
  getProducts(){return this._arr('products');},
  saveProduct(p){return this._save('products',p);},
  deleteProduct(id){this._delete('products',id);},

  getCustomers(){return this._arr('customers');},
  saveCustomer(c){return this._save('customers',c);},
  deleteCustomer(id){this._delete('customers',id);},
  getCustomerById(id){return this._getById('customers',id);},

  getInquiries(){return this._arr('inquiries');},
  saveInquiry(i){return this._save('inquiries',i,{status:'跟进中'});},
  deleteInquiry(id){this._delete('inquiries',id);},

  getInquiryById(id){return this._getById('inquiries',id);},

  /* ========== 常规申请子表单 ========== */

  /* 外汇收款申请 */
  getFxReceipts(){return this._arr('fx_receipts');},
  saveFxReceipt(r){return this._save('fx_receipts',r,{depart_audit:'待审核',finance_audit:'待审核',ceo_approval:'待审批'});},
  deleteFxReceipt(id){this._delete('fx_receipts',id);},

  /* 证明文件申请 */
  getCertDocs(){return this._arr('cert_docs');},
  saveCertDoc(d){return this._save('cert_docs',d);},
  deleteCertDoc(id){this._delete('cert_docs',id);},

  /* 产品报价申请 */
  getPriceQuotes(){return this._arr('price_quotes');},
  savePriceQuote(q){return this._save('price_quotes',q,{depart_audit:'待审核',ceo_approval:'待审批'});},
  deletePriceQuote(id){this._delete('price_quotes',id);},

  /* 实单价格申请 */
  getRealOrders(){return this._arr('real_orders');},
  saveRealOrder(o){return this._save('real_orders',o,{depart_audit:'待审核',ceo_approval:'待审批'});},
  deleteRealOrder(id){this._delete('real_orders',id);},

  /* 实单价格申请-需借出产品 */
  getRealOrdersBorrow(){return this._arr('real_orders_borrow');},
  saveRealOrderBorrow(o){return this._save('real_orders_borrow',o,{depart_audit:'待审核',ceo_approval:'待审批'});},
  deleteRealOrderBorrow(id){this._delete('real_orders_borrow',id);},

  /* 退款申请（父表单，包含退佣金和售后） */
  getRefunds(){return this._arr('refunds');},
  saveRefund(r){return this._save('refunds',r,{status:'待处理'});},
  deleteRefund(id){this._delete('refunds',id);},

  /* ========== 审批动作（通用） ========== */
  approve(stage,id,action,collection,stages){
    const list=this._arr(collection);const idx=list.findIndex(x=>x.id===id);
    if(idx<0)return null;const item=list[idx];
    if(item[stage]!=='待审核'&&item[stage]!=='待审批')return null;
    const isReject=action==='reject';
    item[stage]=isReject?'已驳回':'已通过';
    item.updated_at=Date.now();
    // 通知
    const sLabel=stages?.[stage]||this.STAGE_LABEL[stage];
    if(isReject){
      this.addNotification({type:'reject',title:'申请被驳回',body:`${sLabel}驳回了申请「${item.order_no||item.id}」`,link_id:id,link_tab:'general',for_role:'sales'});
    }else{
      const next=this.STAGE_NEXT[stage];
      if(next){item[next]='待审核';const nr=this.STAGE_APPROVER[next];this.addNotification({type:'approve',title:'待审批',body:`${this.STAGE_LABEL[next]}待审批：申请「${item.order_no||item.id}」`,link_id:id,link_tab:'general',for_role:nr});}
      else{this.addNotification({type:'done',title:'审批完成',body:`申请「${item.order_no||item.id}」所有审批已通过 ✓`,link_id:id,link_tab:'general',for_role:'all'});}
    }
    list[idx]=item;this._set(collection,list);return item;
  },

  /* ========== 导出导入 ========== */
  exportAll(){return{products:this.getProducts(),customers:this.getCustomers(),inquiries:this.getInquiries(),fx_receipts:this.getFxReceipts(),cert_docs:this.getCertDocs(),price_quotes:this.getPriceQuotes(),real_orders:this.getRealOrders(),real_orders_borrow:this.getRealOrdersBorrow(),refunds:this.getRefunds()};},
  importAll(data){const ks=['products','customers','inquiries','fx_receipts','cert_docs','price_quotes','real_orders','real_orders_borrow','refunds'];ks.forEach(k=>{if(data[k])this._set(k,data[k]);});},
  clearAll(){['products','customers','inquiries','fx_receipts','cert_docs','price_quotes','real_orders','real_orders_borrow','refunds','notifications'].forEach(k=>localStorage.removeItem(this._key(k)));}
};
