/**
 * 奥图CRM - 应用逻辑
 * Supabase 直连版
 */

/* ====== 全局变量 ====== */
let _currentTab = 'inquiries';
let _userCache = {};

/* ====== 初始化 ====== */
(async function(){
  // 检测是否已登录
  const user = Store.currentUser();
  if (user) {
    document.getElementById('loginForm').style.display = 'none';
    renderApp();
  }
})();

/* ====== 登录 ====== */
async function doLogin() {
  const u = document.querySelector('input[placeholder="用户名"]').value.trim();
  const p = document.querySelector('input[placeholder="密码"]').value.trim();
  if (!u || !p) { showMsg('请输入用户名和密码'); return; }
  showMsg('登录中...');
  const user = await Store.login(u, p);
  if (user) {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('message').textContent = '';
    renderApp();
  } else {
    showMsg('用户名或密码错误');
  }
}

/* ====== 注册 ====== */
function showRegister() {
  const box = document.querySelector('.login-box');
  box.innerHTML = `
    <div class="company">注册新账号</div>
    <div class="input-group"><input type="text" placeholder="用户名" id="regUser" class="input"></div>
    <div class="input-group"><input type="text" placeholder="姓名" id="regName" class="input"></div>
    <div class="input-group"><input type="password" placeholder="密码" id="regPass" class="input"></div>
    <button class="login-btn" onclick="doRegister()">注 册</button>
    <a onclick="showLogin()" style="display:block;text-align:center;margin-top:10px;font-size:13px;color:#667;cursor:pointer">返回登录</a>`;
}

function showLogin() {
  const box = document.querySelector('.login-box');
  box.innerHTML = `
    <div class="company">深圳市华联自动化设备有限公司</div>
    <div class="input-group"><input type="text" placeholder="用户名" class="input" value=""></div>
    <div class="input-group"><input type="password" placeholder="密码" class="input" value=""></div>
    <button class="login-btn" onclick="doLogin()">登 录</button>
    <a onclick="showRegister()" style="display:block;text-align:center;margin-top:10px;font-size:13px;color:#667;cursor:pointer">注册新账号</a>`;
}

async function doRegister() {
  const u = document.getElementById('regUser').value.trim();
  const n = document.getElementById('regName').value.trim();
  const p = document.getElementById('regPass').value.trim();
  if (!u || !p) { showMsg('请填写完整'); return; }
  showMsg('注册中...');
  const user = await Store.register(u, p, n);
  if (user) {
    showMsg('注册成功，请登录');
    showLogin();
  } else {
    showMsg('用户名已存在');
  }
}

function showMsg(t) {
  const el = document.getElementById('message');
  if (el) el.textContent = t;
}

/* ====== 渲染主应用 ====== */
async function renderApp() {
  const app = document.getElementById('app');
  const tabs = Store.currentUser()?.role === 'admin'
    ? ['inquiries','products','customers','fx_receipts','docs','notifications','settings']
    : ['inquiries','products','customers','fx_receipts','docs','notifications','settings'];
  
  const labels = { inquiries:'询价', products:'产品管理', customers:'客户管理',
    fx_receipts:'外汇收款', docs:'单证管理', notifications:'通知', settings:'设置' };
  
  app.innerHTML = `
    <div class="top-bar">
      <div class="top-title">奥图CRM</div>
      <div class="top-user">${Store.currentUser()?.name||''} (${Store.currentUser()?.role||''}) 
        <a onclick="doLogout()" style="margin-left:15px;font-size:13px;cursor:pointer;color:#99a">退出</a>
      </div>
    </div>
    <div class="tab-bar">${tabs.map(t => `<button class="tab ${t==='inquiries'?'active':''}" onclick="switchTab('${t}')">${labels[t]||t}</button>`).join('')}</div>
    <div class="main-content"><div id="tabContent"></div></div>`;
  
  switchTab('inquiries');
}

function doLogout() {
  Store.logout();
  document.getElementById('app').innerHTML = '';
  document.getElementById('loginForm').style.display = '';
}

/* ====== Tab 切换 ====== */
async function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab[onclick*="${tab}"]`)?.classList.add('active');
  _currentTab = tab;
  
  const el = document.getElementById('tabContent');
  
  if (tab === 'inquiries') { renderInquiries(el); return; }
  if (tab === 'products') { renderProducts(el); return; }
  if (tab === 'customers') { renderCustomers(el); return; }
  if (tab === 'fx_receipts') { renderFxReceipts(el); return; }
  if (tab === 'docs') { renderDocs(el); return; }
  if (tab === 'notifications') { renderNotifications(el); return; }
  if (tab === 'settings') { renderSettings(el); return; }
}

/* ====== 通用表格渲染 ====== */
function renderTable(container, columns, data, actions) {
  let html = `<table class="data-table"><thead><tr>`;
  columns.forEach(c => { html += `<th>${c.label}</th>`; });
  if (actions) html += `<th>操作</th>`;
  html += `</tr></thead><tbody>`;
  
  if (!data || !data.length) {
    html += `<tr><td colspan="${columns.length+(actions?1:0)}" style="text-align:center;color:#999;padding:30px">暂无数据</td></tr>`;
  } else {
    data.forEach((row, idx) => {
      html += `<tr${actions ? ` onclick="editItem('${_currentTab}','${row.id}')" style="cursor:pointer"` : ''}>`;
      columns.forEach(c => {
        let val = row[c.field] || '';
        if (c.format) val = c.format(val, row);
        html += `<td>${val}</td>`;
      });
      if (actions) html += `<td><a onclick="event.stopPropagation();deleteItem('${_currentTab}','${row.id}')" style="color:red;cursor:pointer">删除</a></td>`;
      html += `</tr>`;
    });
  }
  
  html += `</tbody></table>`;
  html += `<button class="add-btn" onclick="addItem('${_currentTab}')">+ 新增</button>`;
  
  container.innerHTML = html;
}

/* ====== 询价管理 ====== */
async function renderInquiries(el) { el.innerHTML = '<div style="padding:20px;text-align:center">加载中...</div>';
  const data = await Store.getInquiries();
  renderTable(el, [
    { label:'询价编号', field:'inquiry_no' },
    { label:'客户', field:'customer_name' },
    { label:'业务员', field:'salesperson' },
    { label:'日期', field:'inquiry_date' },
    { label:'状态', field:'status' }
  ], data, true);
}

/* ====== 产品管理 ====== */
async function renderProducts(el) {
  el.innerHTML = '<div style="padding:20px;text-align:center">加载中...</div>';
  const data = await Store.getProducts();
  renderTable(el, [
    { label:'产品编号', field:'product_code' },
    { label:'品牌', field:'brand' },
    { label:'型号', field:'model' },
    { label:'分类', field:'category' },
    { label:'价格', field:'price', format: v => '¥' + Number(v).toFixed(2) }
  ], data, true);
}

/* ====== 客户管理 ====== */
async function renderCustomers(el) {
  el.innerHTML = '<div style="padding:20px;text-align:center">加载中...</div>';
  const data = await Store.getCustomers();
  renderTable(el, [
    { label:'客户名', field:'customer_name' },
    { label:'公司', field:'company' },
    { label:'联系人', field:'contact' },
    { label:'类型', field:'customer_type' },
    { label:'风格', field:'bargaining_style' }
  ], data, true);
}

/* ====== 外汇收款 ====== */
async function renderFxReceipts(el) {
  el.innerHTML = '<div style="padding:20px;text-align:center">加载中...</div>';
  const data = await Store.getFxReceipts();
  renderTable(el, [
    { label:'收款编号', field:'receipt_no' },
    { label:'申请人', field:'applicant' },
    { label:'客户', field:'customer_name' },
    { label:'币种', field:'currency' },
    { label:'金额', field:'amount', format: v => Number(v).toLocaleString() },
    { label:'状态', field:'status' }
  ], data, true);
}

/* ====== 单证管理 ====== */
async function renderDocs(el) {
  el.innerHTML = '<div style="padding:20px;text-align:center">加载中...</div>';
  const data = await Store.getCertDocs();
  renderTable(el, [
    { label:'订单编号', field:'order_no' },
    { label:'客户', field:'customer_name' },
    { label:'金额', field:'total_amount', format: v => Number(v).toFixed(2) },
    { label:'状态', field:'status' }
  ], data, true);
}

/* ====== 通知 ====== */
async function renderNotifications(el) {
  el.innerHTML = '<div style="padding:20px;text-align:center">加载中...</div>';
  const data = await Store.getMyNotifications();
  let html = `<div style="padding:15px"><h3>通知中心</h3><a onclick="clearAllNoti()" style="color:#66b;cursor:pointer;font-size:13px">清除全部</a></div>`;
  if (!data || !data.length) {
    html += `<div style="padding:30px;text-align:center;color:#999">暂无通知</div>`;
  } else {
    data.forEach(n => {
      html += `<div class="noti-item ${n.read?'':'unread'}" onclick="goToNoti('${n.link_id||''}','${n.link_tab||''}')" style="padding:12px 15px;border-bottom:1px solid #eee;cursor:pointer${n.read?'':';background:#e8f4ff'}">
        <div style="font-weight:bold;font-size:14px">${n.title||''}</div>
        <div style="font-size:12px;color:#667;margin-top:4px">${n.body||''}</div>
      </div>`;
    });
  }
  el.innerHTML = html;
}

function clearAllNoti() {
  Store.getNotifications().then(all => all.forEach(n => Store._delete('notifications', n.id)));
  renderNotifications(document.getElementById('tabContent'));
}

function goToNoti(linkId, linkTab) {
  if (linkTab) switchTab(linkTab);
}

/* ====== 设置 ====== */
async function renderSettings(el) {
  const user = Store.currentUser();
  if (user?.role !== 'admin') { el.innerHTML = '<div style="padding:20px">无权限访问</div>'; return; }
  
  const users = await Store.getUsers();
  const perms = await Store.getPerms();
  
  let html = `<div style="padding:15px"><h3>设置</h3></div>`;
  
  // 用户管理
  html += `<div class="section"><h4>管理用户</h4><table class="data-table"><thead><tr><th>用户名</th><th>姓名</th><th>角色</th><th>操作</th></tr></thead><tbody>`;
  users.forEach(u => {
    const roles = Object.keys(perms).map(r => `<option value="${r}" ${u.role===r?'selected':''}>${perms[r]?.label||r}</option>`).join('');
    html += `<tr>
      <td>${u.username}</td><td>${u.name}</td>
      <td><select onchange="updateUserRole('${u.id}',this.value)">${roles}</select></td>
      <td><a onclick="deleteUser('${u.id}')" style="color:red;cursor:pointer">删除</a></td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  
  // 权限配置
  html += `<div class="section"><h4>配置权限</h4>`;
  html += `<table class="data-table"><thead><tr><th>角色</th><th>询价</th><th>外汇/通用</th><th>产品</th><th>客户</th><th>用户</th><th>设置</th></tr></thead><tbody>`;
  Object.entries(perms).forEach(([role, p]) => {
    html += `<tr><td><b>${p.label}</b></td>`;
    ['inquiries','general','products','customers','users','settings'].forEach(k => {
      const v = p[k];
      const checked = v === true || v === 'all' ? 'checked' : '';
      html += `<td><input type="checkbox" ${checked} onchange="updatePerm('${role}','${k}',this.checked?'all':false)"></td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  
  el.innerHTML = html;
}

async function updateUserRole(id, role) {
  await Store.updateUserRole(id, role);
  showMsg('角色已更新');
}

async function deleteUser(id) {
  if (!confirm('确定删除此用户？')) return;
  await Store.deleteUser(id);
  renderSettings(document.getElementById('tabContent'));
}

async function updatePerm(role, key, val) {
  await Store.updatePerm(role, key, val);
  showMsg('权限已更新');
}

/* ====== 新增/编辑/删除 ====== */
async function addItem(tab) {
  const labels = { inquiries:'询价', products:'产品', customers:'客户', fx_receipts:'外汇收款', docs:'单证' };
  const fields = {
    inquiries: [{k:'inquiry_no',l:'询价编号'},{k:'customer_name',l:'客户名'},{k:'salesperson',l:'业务员'},{k:'inquiry_date',l:'日期'},{k:'status',l:'状态'}],
    products: [{k:'product_code',l:'产品编号'},{k:'brand',l:'品牌'},{k:'model',l:'型号'},{k:'category',l:'分类'},{k:'price',l:'价格'}],
    customers: [{k:'customer_name',l:'客户名'},{k:'company',l:'公司'},{k:'contact',l:'联系人'},{k:'customer_type',l:'类型'},{k:'bargaining_style',l:'风格'}],
    fx_receipts: [{k:'receipt_no',l:'收款编号'},{k:'applicant',l:'申请人'},{k:'customer_name',l:'客户'},{k:'currency',l:'币种'},{k:'amount',l:'金额'}],
    docs: [{k:'order_no',l:'订单编号'},{k:'customer_name',l:'客户'},{k:'total_amount',l:'金额'}]
  };
  
  let html = `<div class="modal-overlay" onclick="this.remove()"><div class="modal" onclick="event.stopPropagation()">
    <h3>新增${labels[tab]}</h3>`;
  
  (fields[tab]||[]).forEach(f => {
    html += `<div style="margin:8px 0"><label>${f.l}</label><input type="text" id="f_${f.k}" class="input" style="width:100%"></div>`;
  });
  
  html += `<button class="login-btn" onclick="saveItem('${tab}')">保存</button>
    <button class="login-btn" style="background:#999;margin-left:10px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div></div>`;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

async function saveItem(tab) {
  const fields = {inquiries:['inquiry_no','customer_name','salesperson','inquiry_date','status'],
    products:['product_code','brand','model','category','price'],
    customers:['customer_name','company','contact','customer_type','bargaining_style'],
    fx_receipts:['receipt_no','applicant','customer_name','currency','amount'],
    docs:['order_no','customer_name','total_amount']};
  
  const data = {};
  (fields[tab]||[]).forEach(k => {
    const el = document.getElementById('f_'+k);
    if (el) data[k] = el.value.trim();
  });
  if (!Object.values(data).some(v => v)) return;
  
  if (tab === 'products') await Store.saveProduct(data);
  else if (tab === 'inquiries') await Store.saveInquiry(data);
  else if (tab === 'customers') await Store.saveCustomer(data);
  else if (tab === 'fx_receipts') await Store.saveFxReceipt(data);
  else if (tab === 'docs') await Store.saveCertDoc(data);
  
  document.querySelector('.modal-overlay')?.remove();
  switchTab(tab);
}

async function editItem(tab, id) {
  const all = await Store['get' + tab.charAt(0).toUpperCase() + tab.slice(1)]();
  const item = all.find(r => r.id === id);
  if (!item) return;
  
  const fields = {inquiries:['inquiry_no','customer_name','salesperson','inquiry_date','status'],
    products:['product_code','brand','model','category','price'],
    customers:['customer_name','company','contact','customer_type','bargaining_style'],
    fx_receipts:['receipt_no','applicant','customer_name','currency','amount'],
    docs:['order_no','customer_name','total_amount']};
  
  let html = `<div class="modal-overlay" onclick="this.remove()"><div class="modal" onclick="event.stopPropagation()">
    <h3>编辑</h3>`;
  
  (fields[tab]||[]).forEach(f => {
    html += `<div style="margin:8px 0"><label>${f}</label><input type="text" id="e_${f}" class="input" value="${item[f]||''}" style="width:100%"></div>`;
  });
  
  html += `<button class="login-btn" onclick="updateItem('${tab}','${id}')">保存</button>
    <button class="login-btn" style="background:#999;margin-left:10px" onclick="this.closest('.modal-overlay').remove()">取消</button>
  </div></div>`;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

async function updateItem(tab, id) {
  const fields = {inquiries:['inquiry_no','customer_name','salesperson','inquiry_date','status'],
    products:['product_code','brand','model','category','price'],
    customers:['customer_name','company','contact','customer_type','bargaining_style'],
    fx_receipts:['receipt_no','applicant','customer_name','currency','amount'],
    docs:['order_no','customer_name','total_amount']};
  
  const data = {};
  (fields[tab]||[]).forEach(k => {
    const el = document.getElementById('e_'+k);
    if (el) data[k] = el.value.trim();
  });
  
  const method = Store['update' + tab.charAt(0).toUpperCase() + tab.slice(1)] || Store._update;
  await method(tab, id, data);
  document.querySelector('.modal-overlay')?.remove();
  switchTab(tab);
}

async function deleteItem(tab, id) {
  if (!confirm('确定删除？')) return;
  const method = Store['delete' + tab.charAt(0).toUpperCase() + tab.slice(1)] || Store._delete;
  await method(tab, id);
  switchTab(tab);
}
