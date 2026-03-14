// ============================================================
//  THALLAJATAK — Admin Panel JavaScript (v2)
//  Login: aaa@gmail.com / 123
// ============================================================

const ADMIN_EMAIL = 'aaa@gmail.com';
const ADMIN_PASS  = '123';
let currentFilterStatus = 'الكل';
let detailOrderId = null;

// ===== STATUS FLOW =====
const STATUS_FLOW = ['قيد الانتظار','قيد التجهيز','قيد التوصيل','تم التوصيل'];

// ===== AUTH =====
function doAdminLogin() {
  const email = document.getElementById('adminEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('adminPass').value;
  if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
    sessionStorage.setItem('th_admin_auth', '1');
    document.getElementById('adminLoginPage').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    initAdmin();
  } else {
    const err = document.getElementById('adminLoginError');
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 3000);
    document.getElementById('adminPass').style.borderColor = '#C0392B';
    setTimeout(() => document.getElementById('adminPass').style.borderColor = '#E5E7EB', 2500);
  }
}

function doAdminLogout() {
  // Secure logout — clear session
  sessionStorage.removeItem('th_admin_auth');
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('adminLoginPage').style.display = 'flex';
  document.getElementById('adminEmail').value = '';
  document.getElementById('adminPass').value  = '';
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('th_admin_auth') === '1') {
    document.getElementById('adminLoginPage').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    initAdmin();
  }
});

function initAdmin() {
  const el = document.getElementById('dashDate');
  if (el) el.textContent = new Date().toLocaleDateString('ar-SA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  // Initialize cloud DB
  if (window.DB) {
    DB.init();
    // Real-time listener — يحدّث الأدمن فور وصول أي طلب جديد من أي جهاز
    DB.listenOrders(orders => {
      // Cache in localStorage for offline use
      localStorage.setItem('thallajatak_orders', JSON.stringify(orders));
      renderDashboard();
      renderOrdersTable();
      updateLockBtn();
      // Show notification for new orders
      const badge = document.getElementById('pendingBadge');
      if (badge) badge.textContent = orders.filter(o => o.status !== 'تم التوصيل').length;
    });
  } else {
    renderDashboard();
  }
  updateLockBtn();
}

// ===== SITE LOCK =====
function updateLockBtn() {
  const btn = document.getElementById('siteLockBtn');
  if (!btn) return;
  const locked = localStorage.getItem('th_site_locked') === '1';
  if (locked) {
    btn.textContent   = '🔓 فتح الموقع';
    btn.style.background = '#27AE60';
  } else {
    btn.textContent   = '🔒 قفل الموقع';
    btn.style.background = '#8E44AD';
  }
}

function toggleSiteLock() {
  const locked = localStorage.getItem('th_site_locked') === '1';
  if (locked) {
    localStorage.removeItem('th_site_locked');
    showToast('✅ تم فتح الموقع للزوار', 'green');
  } else {
    if (!confirm('هل تريد إغلاق الموقع؟ سيرى الزوار صفحة الصيانة.')) return;
    localStorage.setItem('th_site_locked', '1');
    showToast('🔒 تم إغلاق الموقع — الزوار يرون صفحة الصيانة', 'orange');
  }
  updateLockBtn();
}

// ===== DELETE ALL ORDERS =====
function deleteAllOrders() {
  const orders = getOrders();
  if (!orders.length) { showToast('⚠️ لا توجد طلبات للحذف', 'orange'); return; }
  const yes = confirm(`هل أنت متأكد؟\nسيتم حذف جميع الطلبات (${orders.length} طلب) بشكل نهائي ولا يمكن التراجع!`);
  if (!yes) return;
  if (window.DB) {
    DB.deleteAllOrders();
  }
  saveOrders([]);
  renderOrdersTable();
  renderDashboard();
  showToast(`🗑 تم حذف ${orders.length} طلب بنجاح`, 'red');
}


// ===== DATA =====
// Note: getOrders() returns cached localStorage data (synced by listenOrders)
// For writes, we always go through DB
function getOrders() { return JSON.parse(localStorage.getItem('thallajatak_orders') || '[]'); }
function saveOrders(orders) {
  localStorage.setItem('thallajatak_orders', JSON.stringify(orders));
}
async function getSubscriptions() {
  if (window.DB) return await DB.getSubscriptions();
  return JSON.parse(localStorage.getItem('thallajatak_subscriptions') || '[]');
}

// ===== NAVIGATION =====
function showPage(page, navItem) {
  document.querySelectorAll('[id^="page-"]').forEach(el => el.style.display = 'none');
  const pg = document.getElementById('page-' + page);
  if (pg) pg.style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (navItem) navItem.classList.add('active');
  switch(page) {
    case 'dashboard':    renderDashboard();    break;
    case 'orders':       renderOrdersTable();  break;
    case 'customers':    renderCustomers();    break;
    case 'subscriptions':renderSubscriptions();break;
    case 'payments':     renderPayments();     break;
  }
}

// ===== REFRESH BUTTONS =====
function refreshDashboard() {
  const btn = document.getElementById('refreshBtn');
  if (btn) { btn.textContent = '⏳ جاري...'; btn.disabled = true; }
  setTimeout(() => {
    renderDashboard();
    if (btn) { btn.textContent = '🔄 تحديث'; btn.disabled = false; }
    showToast('✅ تم التحديث', 'green');
  }, 600);
}
function refreshOrders() { renderOrdersTable(); showToast('✅ تم تحديث الطلبات', 'green'); }
function refreshPayments() { renderPayments(); showToast('✅ تم تحديث المدفوعات', 'green'); }

// ===== DEMO DATA =====
function generateDemoOrders() {
  const names = ['محمد العتيبي','سلطان القحطاني','عبدالله الغامدي','خالد الشمري','فهد الدوسري','سعد الحربي','ناصر العنزي','تركي السبيعي'];
  const products = [
    {productId:'tees',  name:'التيس البلدي', img:'goat.png',    pricePerKg:85},
    {productId:'naimi', name:'النعيمي',       img:'sheep.png',   pricePerKg:70},
    {productId:'howar', name:'الحوار',         img:'camel.png',   pricePerKg:120},
    {productId:'chicken',name:'الدجاج البلدي',img:'chicken.png', pricePerKg:45}
  ];
  const cuts   = ['مقطع كباب','مقطع مرق','مفروم','كامل غير مقطع','ربع وأجزاء'];
  const phones = ['0501234567','0551234567','0561234567','0541234567','0591234567'];
  const areas  = ['الرياض — حي العليا','جدة — الزهراء','الدمام — الشاطئ','الرياض — النزهة','الخبر — العقربية'];
  const statuses = STATUS_FLOW;
  const pays = ['مدفوع','مدفوع','مدفوع','غير مدفوع'];

  let orders = getOrders();
  for (let i = 0; i < 10; i++) {
    const prod   = products[Math.floor(Math.random()*products.length)];
    const weight = [500,1000,1500,2000,3000][Math.floor(Math.random()*5)];
    const meatCost = Math.round((prod.pricePerKg/1000)*weight);
    const total  = meatCost + 25;
    const daysAgo = Math.floor(Math.random()*8);
    const d = new Date(); d.setDate(d.getDate()-daysAgo);
    orders.push({
      id: 'TH-' + Math.floor(100000+Math.random()*900000),
      date: d.toISOString(),
      customer: {
        name:    names[Math.floor(Math.random()*names.length)],
        phone:   phones[Math.floor(Math.random()*phones.length)],
        address: areas[Math.floor(Math.random()*areas.length)]
      },
      items: [{
        productId: prod.productId, name: prod.name, img: prod.img,
        weight, cut: cuts[Math.floor(Math.random()*cuts.length)],
        fat: 'مع الشحم الطبيعي', package: 'أكياس عادية',
        meatCost, pkgCost: 0, total
      }],
      total,
      status:        statuses[Math.floor(Math.random()*statuses.length)],
      paymentStatus: pays[Math.floor(Math.random()*pays.length)],
      paymentMethod: 'بطاقة بنكية'
    });
  }
  saveOrders(orders);
  renderDashboard();
  renderOrdersTable();
  showToast('تم إضافة ١٠ طلبات تجريبية ✅', 'green');
}

// ===== DASHBOARD =====
function renderDashboard() {
  const orders = getOrders();
  const today  = new Date().toDateString();
  const todayOrders  = orders.filter(o => new Date(o.date).toDateString() === today);
  const todayRevenue = todayOrders.reduce((s,o)=>s+o.total,0);
  const pending   = orders.filter(o => o.status !== 'تم التوصيل').length;
  const totalRev  = orders.reduce((s,o)=>s+o.total,0);
  const paid      = orders.filter(o=>o.paymentStatus==='مدفوع').reduce((s,o)=>s+o.total,0);
  const unpaid    = orders.filter(o=>o.paymentStatus==='غير مدفوع').reduce((s,o)=>s+o.total,0);
  const totalCust = [...new Set(orders.map(o=>o.customer.phone))].length;

  const badge = document.getElementById('pendingBadge');
  if (badge) badge.textContent = pending;

  const statsGrid = document.getElementById('statsGrid');
  if (statsGrid) statsGrid.innerHTML = `
    <div class="stat-card red">
      <div class="stat-head"><div class="stat-card-icon">📦</div><span class="stat-card-badge up">إجمالي</span></div>
      <div class="stat-card-value">${orders.length}</div>
      <div class="stat-card-label">إجمالي الطلبات</div>
    </div>
    <div class="stat-card green">
      <div class="stat-head"><div class="stat-card-icon">💰</div><span class="stat-card-badge up">مدفوع</span></div>
      <div class="stat-card-value">${paid.toLocaleString('ar-SA')} ريال</div>
      <div class="stat-card-label">إجمالي المدفوع</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-head"><div class="stat-card-icon">⚠️</div><span class="stat-card-badge down">غير مدفوع</span></div>
      <div class="stat-card-value">${unpaid.toLocaleString('ar-SA')} ريال</div>
      <div class="stat-card-label">غير مدفوع</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-head"><div class="stat-card-icon">⏳</div></div>
      <div class="stat-card-value">${pending}</div>
      <div class="stat-card-label">قيد المعالجة</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-head"><div class="stat-card-icon">💎</div></div>
      <div class="stat-card-value">${totalRev.toLocaleString('ar-SA')} ريال</div>
      <div class="stat-card-label">إجمالي الإيرادات</div>
    </div>
  `;

  renderWeekChart(orders);
  renderProductPie(orders);
  renderRecentOrders(orders);
}

function renderWeekChart(orders) {
  const chart = document.getElementById('weekChart');
  const labelsEl = document.getElementById('weekLabels');
  if (!chart) return;
  const days = ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
  const today = new Date();
  const data = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(today.getDate()-i);
    const rev = orders.filter(o=>new Date(o.date).toDateString()===d.toDateString()).reduce((s,o)=>s+o.total,0);
    data.push({ label: days[d.getDay()], value: rev });
  }
  const max = Math.max(...data.map(d=>d.value),1);
  chart.innerHTML = data.map(d=>`
    <div class="chart-bar-wrap">
      <div class="chart-bar" style="height:${Math.max((d.value/max)*100,4)}px" title="${d.value} ريال"></div>
    </div>`).join('');
  if (labelsEl) labelsEl.innerHTML = data.map(d=>`<span>${d.label}</span>`).join('');
}

function renderProductPie(orders) {
  const pie = document.getElementById('productPie');
  if (!pie) return;
  const counts = { 'التيس البلدي':0, 'النعيمي':0, 'الحوار':0, 'الدجاج البلدي':0, 'ضحيتك (أضاحي)':0 };
  orders.forEach(o => o.items?.forEach(i => {
    const key = Object.keys(counts).find(k => i.name?.includes(k.split(' ')[0]));
    if (key) counts[key]++;
  }));
  const total = Object.values(counts).reduce((s,n)=>s+n,0)||1;
  const colors=['#C0392B','#E67E22','#8E44AD','#2980B9','#27AE60'];
  const emojis=['🐐','🐑','🐪','🐓','🐑'];
  pie.innerHTML = Object.entries(counts).map(([name,count],i)=>`
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:18px">${emojis[i]}</span>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:4px">
          <span>${name}</span><span>${count}</span>
        </div>
        <div style="height:8px;background:#F0F2F5;border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${Math.round((count/total)*100)}%;background:${colors[i]};border-radius:4px"></div>
        </div>
      </div>
    </div>`).join('');
}

function renderRecentOrders(orders) {
  const table = document.getElementById('recentOrdersTable');
  if (!table) return;
  const recent = [...orders].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  if (!recent.length) { table.innerHTML='<tbody><tr><td colspan="5" style="text-align:center;padding:30px;color:#999">لا توجد طلبات بعد</td></tr></tbody>'; return; }
  table.innerHTML = `
    <thead><tr><th>رقم الطلب</th><th>العميل</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead>
    <tbody>${recent.map(o=>`
      <tr onclick="viewOrderDetail('${o.id}')" style="cursor:pointer">
        <td><strong style="color:#C0392B">${o.id}</strong></td>
        <td>${o.customer.name}</td>
        <td><strong>${o.total} ريال</strong></td>
        <td><span class="status-badge ${getStatusClass(o.status)}">${o.status}</span></td>
        <td style="font-size:12px;color:#888">${new Date(o.date).toLocaleDateString('ar-SA')}</td>
      </tr>`).join('')}</tbody>`;
}

// ===== ORDERS TABLE (full with dropdown + payment buttons) =====
function renderOrdersTable() {
  const orders = getOrders();
  const search = document.getElementById('orderSearch')?.value?.toLowerCase()||'';
  const countEl = document.getElementById('ordersCount');

  let filtered = orders.filter(o => {
    const matchStatus = currentFilterStatus==='الكل' || o.status===currentFilterStatus;
    const matchSearch = !search ||
      o.id.toLowerCase().includes(search) ||
      o.customer.name.includes(search) ||
      o.customer.phone.includes(search);
    return matchStatus && matchSearch;
  }).sort((a,b)=>new Date(b.date)-new Date(a.date));

  if (countEl) countEl.textContent = `${filtered.length} طلب`;
  const badge = document.getElementById('pendingBadge');
  if (badge) badge.textContent = orders.filter(o=>o.status!=='تم التوصيل').length;

  const table = document.getElementById('ordersTableAll');
  if (!table) return;

  if (!filtered.length) {
    table.innerHTML=`<tbody><tr><td colspan="9" style="text-align:center;padding:50px;color:#999;font-size:16px">لا توجد طلبات</td></tr></tbody>`;
    return;
  }

  table.innerHTML = `
    <thead><tr>
      <th>رقم الطلب</th>
      <th>اسم الزبون</th>
      <th>الهاتف</th>
      <th>العنوان</th>
      <th>المنتج / الوزن / التقطيع</th>
      <th>المبلغ</th>
      <th>حالة الطلب</th>
      <th>الدفع</th>
      <th>إجراءات</th>
    </tr></thead>
    <tbody>${filtered.map(o => {
      const item = o.items?.[0] || {};
      const weightLabel = item.weight >= 1000 ? (item.weight/1000).toFixed(1)+' كج' : (item.weight||'-')+' جم';
      return `
      <tr>
        <td>
          <div style="font-weight:800;color:#C0392B;font-size:13px">${o.id}</div>
          <div style="font-size:11px;color:#aaa">${new Date(o.date).toLocaleDateString('ar-SA')}</div>
        </td>
        <td>
          <div class="customer-cell">
            <div class="customer-avatar">${o.customer.name[0]}</div>
            <div><div class="customer-name">${o.customer.name}</div></div>
          </div>
        </td>
        <td style="font-size:13px;direction:ltr;text-align:right">${o.customer.phone}</td>
        <td style="font-size:12px;color:#555;max-width:150px">
          <div>${o.customer.address||'-'}</div>
          ${o.location && o.location!==o.customer.address ? `<div style="color:#888;font-size:11px;margin-top:2px">📍 ${o.location}</div>` : ''}
          ${o.locationMapsUrl ? `<a href="${o.locationMapsUrl}" target="_blank" style="color:#C0392B;font-size:11px;font-weight:700">🗺️ موقع GPS</a>` : ''}
        </td>
        <td style="font-size:13px">
          <div style="font-weight:700">${item.name||'-'}</div>
          <div style="color:#888;font-size:12px">${weightLabel} | ${item.cut||'-'}</div>
        </td>
        <td><strong style="color:#C0392B;font-size:15px">${o.total} ريال</strong></td>
        <td>
          <!-- Status Dropdown -->
          <select class="status-select" onchange="updateOrderStatus('${o.id}', this.value)"
            style="border-color:${getStatusColor(o.status)}">
            ${STATUS_FLOW.map(s=>`<option value="${s}" ${s===o.status?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>
          <div style="display:flex;flex-direction:column;gap:4px">
            <span class="status-badge ${o.paymentStatus==='مدفوع'?'paid':'failed'}" style="margin-bottom:4px">
              ${o.paymentStatus==='مدفوع'?'✅ مدفوع':'❌ غير مدفوع'}
            </span>
            ${o.paymentStatus!=='مدفوع'
              ? `<button class="action-btn advance" onclick="confirmPayment('${o.id}')" title="تأكيد الدفع">✅ تأكيد</button>`
              : `<button class="action-btn delete" onclick="cancelPayment('${o.id}')" title="إلغاء الدفع">↩️ إلغاء</button>`}
          </div>
        </td>
        <td>
          <div class="actions-cell">
            <button class="action-btn view" onclick="viewOrderDetail('${o.id}')" title="عرض التفاصيل">👁</button>
            <button class="action-btn delete" onclick="deleteOrder('${o.id}')" title="حذف الطلب">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('')}</tbody>`;
}

function filterOrders(status, btn) {
  currentFilterStatus = status;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderOrdersTable();
}

// ===== ORDER STATUS UPDATE via dropdown =====
function updateOrderStatus(id, newStatus) {
  // Update Firebase (syncs all devices)
  if (window.DB) {
    DB.updateOrder(id, { status: newStatus });
  }
  // Also update local cache immediately for fast UI
  let orders = getOrders();
  const idx = orders.findIndex(o=>o.id===id);
  if (idx!==-1) { orders[idx].status = newStatus; saveOrders(orders); }
  renderDashboard();
  showToast(`✅ تم تغيير حالة الطلب ${id} إلى: ${newStatus}`, 'blue');
  const badge = document.getElementById('pendingBadge');
  if (badge) badge.textContent = getOrders().filter(o=>o.status!=='تم التوصيل').length;
}

// ===== PAYMENT ACTIONS =====
function confirmPayment(id) {
  if (window.DB) DB.updateOrder(id, { paymentStatus: 'مدفوع' });
  let orders = getOrders();
  const idx = orders.findIndex(o=>o.id===id);
  if (idx!==-1) { orders[idx].paymentStatus = 'مدفوع'; saveOrders(orders); }
  renderOrdersTable();
  renderDashboard();
  showToast(`✅ تم تأكيد الدفع للطلب ${id}`, 'green');
}

function cancelPayment(id) {
  if (!confirm('هل تريد إلغاء تأكيد الدفع لهذا الطلب؟')) return;
  if (window.DB) DB.updateOrder(id, { paymentStatus: 'غير مدفوع' });
  let orders = getOrders();
  const idx = orders.findIndex(o=>o.id===id);
  if (idx!==-1) { orders[idx].paymentStatus = 'غير مدفوع'; saveOrders(orders); }
  renderOrdersTable();
  renderDashboard();
  showToast(`↩️ تم إلغاء الدفع للطلب ${id}`, 'red');
}

// ===== DELETE ORDER =====
function deleteOrder(id) {
  if (!confirm(`هل أنت متأكد من حذف الطلب ${id}؟`)) return;
  if (window.DB) DB.deleteOrder(id);
  saveOrders(getOrders().filter(o=>o.id!==id));
  renderOrdersTable();
  renderDashboard();
  showToast('🗑 تم حذف الطلب', 'red');
}

// ===== ORDER DETAIL MODAL =====
function viewOrderDetail(id) {
  const order = getOrders().find(o=>o.id===id);
  if (!order) return;
  detailOrderId = id;
  const content = document.getElementById('detailContent');
  const item = order.items?.[0]||{};
  const wLabel = item.weight>=1000?(item.weight/1000).toFixed(1)+' كج':(item.weight||'-')+' جم';
  content.innerHTML = `
    <div class="detail-row"><span class="detail-label">رقم الطلب</span><span class="detail-value" style="color:#C0392B">${order.id}</span></div>
    <div class="detail-row"><span class="detail-label">اسم الزبون</span><span class="detail-value">${order.customer.name}</span></div>
    <div class="detail-row"><span class="detail-label">الهاتف</span><span class="detail-value" style="direction:ltr">${order.customer.phone}</span></div>
    <div class="detail-row"><span class="detail-label">العنوان</span><span class="detail-value">${order.customer.address||'-'}</span></div>
    ${order.location && order.location!==order.customer.address
      ?`<div class="detail-row"><span class="detail-label">📍 موقع GPS</span><span class="detail-value" style="font-size:13px">${order.location}</span></div>`:''}
    ${order.locationMapsUrl
      ?`<div class="detail-row"><span class="detail-label">خريطة</span><a href="${order.locationMapsUrl}" target="_blank" style="color:#C0392B;font-weight:700;font-size:14px">🗺️ افتح في خرائط جوجل</a></div>`:''}  
    <div class="detail-row"><span class="detail-label">المنتج</span><span class="detail-value">${item.name||'-'}</span></div>
    <div class="detail-row"><span class="detail-label">الوزن</span><span class="detail-value">${wLabel}</span></div>
    <div class="detail-row"><span class="detail-label">التقطيع</span><span class="detail-value">${item.cut||'-'}</span></div>
    <div class="detail-row"><span class="detail-label">الشحم</span><span class="detail-value">${item.fat||'-'}</span></div>
    <div class="detail-row"><span class="detail-label">التغليف</span><span class="detail-value">${item.package||'-'}</span></div>
    ${item.notes?`<div class="detail-row"><span class="detail-label">ملاحظات</span><span class="detail-value">${item.notes}</span></div>`:''}
    <div class="detail-row"><span class="detail-label">تاريخ الطلب</span><span class="detail-value">${new Date(order.date).toLocaleString('ar-SA')}</span></div>
    <div class="detail-row">
      <span class="detail-label">حالة الطلب</span>
      <select class="status-select" onchange="updateOrderStatus('${order.id}',this.value);viewOrderDetail('${order.id}')">
        ${STATUS_FLOW.map(s=>`<option value="${s}" ${s===order.status?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="detail-row">
      <span class="detail-label">حالة الدفع</span>
      <span class="status-badge ${order.paymentStatus==='مدفوع'?'paid':'failed'}">${order.paymentStatus}</span>
    </div>
    <div class="detail-row" style="margin-top:8px">
      <span class="detail-label" style="font-size:17px;font-weight:900">المجموع الكلي</span>
      <span class="detail-value" style="color:#C0392B;font-size:22px;font-weight:900">${order.total} ريال</span>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      ${order.paymentStatus!=='مدفوع'
        ? `<button class="action-btn advance" style="padding:10px 18px;font-size:13px" onclick="confirmPayment('${order.id}');closeDetail()">✅ تأكيد الدفع</button>`
        : `<button class="action-btn delete" style="padding:10px 18px;font-size:13px" onclick="cancelPayment('${order.id}');closeDetail()">↩️ إلغاء الدفع</button>`}
      <button class="action-btn delete" style="padding:10px 18px;font-size:13px" onclick="deleteOrder('${order.id}');closeDetail()">🗑 حذف الطلب</button>
    </div>
  `;
  document.getElementById('detailOverlay').classList.add('open');
}
function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('open');
  detailOrderId = null;
}

// ===== CUSTOMERS =====
function renderCustomers() {
  const orders = getOrders();
  const registered = JSON.parse(localStorage.getItem('th_customers') || '[]');

  // Build map from orders
  const map = {};
  orders.forEach(o => {
    const k = o.customer.phone;
    if (!map[k]) map[k] = { name: o.customer.name, phone: k, orders: 0, total: 0, email: '' };
    map[k].orders++; map[k].total += o.total;
  });

  // Merge registered accounts
  registered.forEach(c => {
    if (map[c.phone]) {
      map[c.phone].email    = c.email;
      map[c.phone].name     = c.name;
      map[c.phone].hasAcct  = true;
    } else {
      map[c.phone] = { name: c.name, phone: c.phone, email: c.email, orders: c.orders?.length||0, total: 0, hasAcct: true };
    }
  });

  const grid = document.getElementById('customersGrid');
  if (!grid) return;
  const list = Object.values(map).sort((a, b) => b.total - a.total);
  if (!list.length) {
    grid.innerHTML = '<p style="color:#999;text-align:center;padding:50px;grid-column:1/-1">لا يوجد عملاء بعد</p>';
    return;
  }
  grid.innerHTML = list.map(c => `
    <div class="customer-card">
      <div style="position:relative">
        <div class="cust-avatar-lg">${c.name[0]}</div>
        ${c.hasAcct ? '<span style="position:absolute;top:-4px;left:-4px;background:#27AE60;color:white;font-size:10px;padding:2px 6px;border-radius:10px;font-weight:700">✓ حساب</span>' : ''}
      </div>
      <div class="cust-name">${c.name}</div>
      ${c.email ? `<div style="font-size:12px;color:#888;direction:ltr">${c.email}</div>` : ''}
      <div class="cust-phone">📱 ${c.phone}</div>
      <div class="cust-stats">
        <div class="cust-stat"><strong>${c.orders}</strong>طلب</div>
        <div class="cust-stat"><strong>${c.total > 0 ? c.total+' ر' : '-'}</strong>إجمالي</div>
      </div>
    </div>`).join('');
}

// ===== SUBSCRIPTIONS =====
function renderSubscriptions() {
  const subs = getSubscriptions();
  const table = document.getElementById('subsTable');
  if (!table) return;
  if (!subs.length) {
    table.innerHTML=`<tbody><tr><td colspan="5" style="text-align:center;padding:50px;color:#999">لا توجد اشتراكات</td></tr></tbody>`;
    return;
  }
  table.innerHTML = `
    <thead><tr><th>رقم الاشتراك</th><th>العميل</th><th>الخطة</th><th>الرسوم</th><th>الحالة</th></tr></thead>
    <tbody>${subs.map(s=>`
      <tr>
        <td><strong style="color:#C0392B">${s.id}</strong></td>
        <td><div class="customer-cell">
          <div class="customer-avatar">${s.customer.name[0]}</div>
          <div><div class="customer-name">${s.customer.name}</div><div class="customer-phone">${s.customer.phone}</div></div>
        </div></td>
        <td><strong>${s.plan}</strong></td>
        <td><strong style="color:#C0392B">${s.price} ريال/شهر</strong></td>
        <td><span class="status-badge paid">${s.status}</span></td>
      </tr>`).join('')}</tbody>`;
}

// ===== PAYMENTS =====
function renderPayments() {
  const orders = getOrders();
  const paid   = orders.filter(o=>o.paymentStatus==='مدفوع');
  const unpaid = orders.filter(o=>o.paymentStatus==='غير مدفوع');
  const totalPaid   = paid.reduce((s,o)=>s+o.total,0);
  const totalUnpaid = unpaid.reduce((s,o)=>s+o.total,0);

  const statsGrid = document.getElementById('paymentStats');
  if (statsGrid) statsGrid.innerHTML = `
    <div class="stat-card green">
      <div class="stat-head"><div class="stat-card-icon">✅</div></div>
      <div class="stat-card-value">${totalPaid.toLocaleString('ar-SA')} ريال</div>
      <div class="stat-card-label">إجمالي المدفوع (${paid.length} طلب)</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-head"><div class="stat-card-icon">⚠️</div></div>
      <div class="stat-card-value">${totalUnpaid.toLocaleString('ar-SA')} ريال</div>
      <div class="stat-card-label">غير مدفوع (${unpaid.length} طلب)</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-head"><div class="stat-card-icon">📊</div></div>
      <div class="stat-card-value">${orders.length}</div>
      <div class="stat-card-label">إجمالي الطلبات</div>
    </div>`;

  const table = document.getElementById('paymentsTable');
  if (!table) return;
  const sorted = [...orders].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (!sorted.length) {
    table.innerHTML=`<tbody><tr><td colspan="5" style="text-align:center;padding:50px;color:#999">لا توجد مدفوعات</td></tr></tbody>`;
    return;
  }
  table.innerHTML = `
    <thead><tr><th>رقم الطلب</th><th>العميل</th><th>طريقة الدفع</th><th>المبلغ</th><th>الحالة</th></tr></thead>
    <tbody>${sorted.map(o=>`
      <tr>
        <td><strong style="color:#C0392B">${o.id}</strong><br><span style="font-size:11px;color:#aaa">${new Date(o.date).toLocaleDateString('ar-SA')}</span></td>
        <td>${o.customer.name}</td>
        <td>${o.paymentMethod||'بطاقة بنكية'}</td>
        <td>${o.total} ريال</td>
        <td>
          <span class="status-badge ${o.paymentStatus==='مدفوع'?'paid':'failed'}">${o.paymentStatus}</span>
          ${o.paymentStatus!=='مدفوع'
            ?`<button class="action-btn advance" style="margin-right:6px" onclick="confirmPayment('${o.id}');renderPayments()">✅</button>`
            :`<button class="action-btn delete" style="margin-right:6px" onclick="cancelPayment('${o.id}');renderPayments()">↩️</button>`}
        </td>
      </tr>`).join('')}</tbody>`;
}

// ===== HELPERS =====
function getStatusClass(s) {
  if (s==='قيد الانتظار')  return 'pending';
  if (s==='قيد التجهيز')   return 'preparing';
  if (s==='قيد التوصيل')   return 'delivering';
  if (s==='تم التوصيل')    return 'delivered';
  return 'pending';
}
function getStatusColor(s) {
  if (s==='قيد الانتظار')  return '#E67E22';
  if (s==='قيد التجهيز')   return '#2980B9';
  if (s==='قيد التوصيل')   return '#8E44AD';
  if (s==='تم التوصيل')    return '#27AE60';
  return '#E5E7EB';
}

function showToast(msg, color='green') {
  const cols = { green:'#27AE60', red:'#C0392B', blue:'#2980B9', orange:'#E67E22' };
  const t = document.createElement('div');
  t.style.cssText=`position:fixed;bottom:30px;right:30px;z-index:9999;background:${cols[color]||cols.green};color:white;padding:14px 22px;border-radius:12px;font-family:Tajawal,sans-serif;font-size:15px;font-weight:700;box-shadow:0 6px 24px rgba(0,0,0,0.3);transition:opacity 0.3s`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 3500);
}
