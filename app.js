// ============================================================
//  THALLAJATAK — app.js (v3)
//  • Customer register / login / logout
//  • Persistent customer DB in localStorage
//  • GPS location attachment
//  • Cart requires login, orders saved under customer account
// ============================================================

// ===== CUSTOMER DB HELPERS =====
function getCustomers()  { return JSON.parse(localStorage.getItem('th_customers') || '[]'); }
function saveCustomers(c){ localStorage.setItem('th_customers', JSON.stringify(c)); }
function getCurrentUser() {
  const id = sessionStorage.getItem('th_current_uid');
  if (!id) return null;
  return getCustomers().find(c => c.id === id) || null;
}
function saveCurrentUser(user) {
  // Update in DB and refresh session
  let customers = getCustomers();
  const idx = customers.findIndex(c => c.id === user.id);
  if (idx !== -1) customers[idx] = user;
  saveCustomers(customers);
}

// ===== AUTH UI =====
function openAuthModal(tab) {
  switchAuthTab(tab || 'login');
  document.getElementById('authModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
  document.body.style.overflow = '';
}
function closeAuthOnBg(e) {
  if (e.target.id === 'authModal') closeAuthModal();
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginForm').style.display    = isLogin ? 'block' : 'none';
  document.getElementById('registerForm').style.display = isLogin ? 'none'  : 'block';
  document.getElementById('tabLogin').style.background    = isLogin ? 'white' : 'transparent';
  document.getElementById('tabLogin').style.color         = isLogin ? '#C0392B' : '#888';
  document.getElementById('tabLogin').style.boxShadow     = isLogin ? '0 1px 4px rgba(0,0,0,0.1)' : 'none';
  document.getElementById('tabRegister').style.background = isLogin ? 'transparent' : 'white';
  document.getElementById('tabRegister').style.color      = isLogin ? '#888' : '#C0392B';
  document.getElementById('tabRegister').style.boxShadow = isLogin ? 'none' : '0 1px 4px rgba(0,0,0,0.1)';
}

// ===== REGISTER =====
function doRegister() {
  const name  = document.getElementById('regName')?.value.trim();
  const phone = document.getElementById('regPhone')?.value.trim();
  const email = document.getElementById('regEmail')?.value.trim().toLowerCase();
  const pass  = document.getElementById('regPass')?.value;
  const errEl = document.getElementById('regErr');

  if (!name)              return showAuthErr(errEl, 'يرجى إدخال الاسم الكامل');
  if (!phone)             return showAuthErr(errEl, 'يرجى إدخال رقم الجوال');
  if (!email || !email.includes('@')) return showAuthErr(errEl, 'يرجى إدخال بريد إلكتروني صحيح');
  if (!pass || pass.length < 6)        return showAuthErr(errEl, 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل');

  let customers = getCustomers();
  if (customers.find(c => c.email === email)) return showAuthErr(errEl, 'هذا البريد مسجّل مسبقاً — سجّل دخولك');

  const user = {
    id: 'CU-' + Date.now(),
    name, phone, email,
    password: btoa(pass),   // base64 encode (basic obfuscation)
    createdAt: new Date().toISOString(),
    orders: []
  };
  customers.push(user);
  saveCustomers(customers);
  // Also save to cloud DB
  if (window.DB) DB.saveCustomer(user);
  sessionStorage.setItem('th_current_uid', user.id);

  closeAuthModal();
  updateNavUser(user);
  initTrackingSection();
  showToastGlobal(`🎉 أهلاً ${user.name}! تم إنشاء حسابك بنجاح`, 'green');
  prefillCheckout(user);
}

// ===== LOGIN =====
function doLogin() {
  const email = document.getElementById('liEmail')?.value.trim().toLowerCase();
  const pass  = document.getElementById('liPass')?.value;
  const errEl = document.getElementById('liErr');

  if (!email) return showAuthErr(errEl, 'يرجى إدخال البريد الإلكتروني');
  if (!pass)  return showAuthErr(errEl, 'يرجى إدخال كلمة المرور');

  const customers = getCustomers();
  const user = customers.find(c => c.email === email && c.password === btoa(pass));
  if (!user) return showAuthErr(errEl, '⚠️ البريد أو كلمة المرور غير صحيحة');

  sessionStorage.setItem('th_current_uid', user.id);
  closeAuthModal();
  updateNavUser(user);
  initTrackingSection();
  showToastGlobal(`👋 أهلاً بعودتك ${user.name}!`, 'green');
  prefillCheckout(user);
}

// ===== LOGOUT =====
function customerLogout() {
  sessionStorage.removeItem('th_current_uid');
  updateNavUser(null);
  initTrackingSection();
  showToastGlobal('تم تسجيل الخروج', 'blue');
}

// ===== NAV USER INDICATOR =====
function updateNavUser(user) {
  const box     = document.getElementById('navUserBox');
  const btn     = document.getElementById('navLoginBtn');
  const avatar  = document.getElementById('navUserAvatar');
  const nameEl  = document.getElementById('navUserName');
  if (!box) return;
  if (user) {
    box.style.display = 'flex';
    if (btn) btn.style.display = 'none';
    if (avatar) avatar.textContent = user.name[0].toUpperCase();
    if (nameEl) nameEl.textContent = user.name.split(' ')[0];
  } else {
    box.style.display = 'none';
    if (btn) btn.style.display = 'inline-block';
  }
}

function showAuthErr(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3500);
}

function prefillCheckout(user) {
  if (!user) return;
  const n = document.getElementById('cName');
  const p = document.getElementById('cPhone');
  if (n && !n.value) n.value = user.name;
  if (p && !p.value) p.value = user.phone;
}

// ===== GPS LOCATION =====
let currentLocationData = null; // { label, lat, lng, mapsUrl }

function openLocationModal() {
  document.getElementById('locationModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLocationModal() {
  document.getElementById('locationModal').classList.remove('open');
  document.body.style.overflow = '';
}

function requestGPS() {
  const btn    = document.getElementById('gpsBtn');
  const result = document.getElementById('gpsResult');
  if (!navigator.geolocation) {
    showToastGlobal('⚠️ متصفحك لا يدعم تحديد الموقع', 'red');
    return;
  }
  btn.textContent = '⏳ جاري تحديد موقعك...';
  btn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      currentLocationData = { label: `${lat}, ${lng}`, lat, lng, mapsUrl };

      document.getElementById('gpsResultText').textContent = `خط العرض: ${lat} | خط الطول: ${lng}`;
      document.getElementById('gmapsLink').href = mapsUrl;
      result.style.display = 'block';
      btn.textContent = '✅ تم تحديد موقعك';
      btn.disabled = false;
    },
    (err) => {
      btn.textContent = '📡 تحديد موقعي تلقائياً';
      btn.disabled = false;
      const msgs = {
        1: 'رفضت السماح بتحديد الموقع — يمكنك إدخاله يدوياً',
        2: 'تعذّر تحديد الموقع، حاول مجدداً',
        3: 'انتهت مهلة تحديد الموقع'
      };
      showToastGlobal('⚠️ ' + (msgs[err.code] || 'خطأ في تحديد الموقع'), 'red');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function confirmLocation() {
  const manual = document.getElementById('manualLocation')?.value.trim();
  if (currentLocationData) {
    // GPS confirmed
    const display = currentLocationData.mapsUrl
      ? `📍 موقع GPS (${currentLocationData.lat}, ${currentLocationData.lng})`
      : currentLocationData.label;
    setCheckoutLocation(display, currentLocationData.mapsUrl);
  } else if (manual) {
    setCheckoutLocation('📍 ' + manual, null);
    currentLocationData = { label: manual, lat: null, lng: null, mapsUrl: null };
  } else {
    showToastGlobal('يرجى تحديد موقعك أو كتابته يدوياً', 'red');
    return;
  }
  closeLocationModal();
  showToastGlobal('✅ تم إرفاق موقعك بالطلب', 'green');
}

function setCheckoutLocation(label, mapsUrl) {
  const display = document.getElementById('cLocationDisplay');
  const linkRow = document.getElementById('cMapLinkRow');
  const link    = document.getElementById('cMapLink');
  if (display) display.value = label;
  if (mapsUrl && linkRow && link) {
    link.href = mapsUrl;
    linkRow.style.display = 'block';
  } else if (linkRow) {
    linkRow.style.display = 'none';
  }
}

// ===== PRODUCTS =====
const PRODUCTS = [
  {
    id: 'tees', name: 'التيس البلدي', img: 'goat.png',
    desc: 'تيس بلدي أصيل مغذى على العشب — لحم طري ذو نكهة غنية مميزة',
    pricePerKg: 85, badge: 'الأكثر طلباً', origin: '🌿 البلدي الأصيل',
    details: 'يُربى على المراعي الطبيعية — يُذبح يومياً ويُسلّم طازجاً'
  },
  {
    id: 'howar', name: 'الحوار', img: 'camel.png',
    desc: 'حوار أصيل من أجود الأصناف — لحم طري خفيف الدهون بنكهة مميزة',
    pricePerKg: 120, badge: 'نادر وفاخر', origin: '🐪 الإبل العربية',
    details: 'من أغلى أنواع اللحوم وأفضلها قيمة غذائية'
  },
  {
    id: 'naimi', name: 'النعيمي', img: 'sheep.png',
    desc: 'ضأن نعيمي أصيل بذيل دهني كبير — أفضل لحم للمندي والكبسة',
    pricePerKg: 70, badge: 'مناسب للمندي', origin: '🐑 النعيمي الأصيل',
    details: 'الأنسب للوجبات الكبيرة والمناسبات العائلية العريقة'
  },
  {
    id: 'chicken', name: 'الدجاج البلدي', img: 'chicken.png',
    desc: 'دجاج بلدي حر التربية — نكهة طبيعية لا تقارن بالمزارع',
    pricePerKg: 45, badge: 'طازج يومياً', origin: '🐓 دجاج بلدي',
    details: 'يُربى في الهواء الطلق — خالٍ من الهرمونات والمواد الحافظة'
  },
  {
    id: 'sacrifice', name: 'ضحيتك (أضاحي)', img: 'sheep.png',
    desc: 'أضاحي وذبائح كاملة (حي بدون ذبح) مناسبة للشريعة الإسلامية — جذع فقط',
    pricePerKg: 0, badge: 'مناسب للأضحية', origin: '🇸🇦 إنتاج محلي طازج',
    details: 'أضاحي مختارة بعناية (حي بدون ذبح)، مطابقة للشروط الشرعية، عمر جذع فقط.',
    isSacrifice: true
  }
];

const SACRIFICE_WEIGHTS = [
  { label: 'صغير (١٨-٢٠ كج)', price: 1100, range: '18-20' },
  { label: 'وسط (٢٢-٢٤ كج)', price: 1350, range: '22-24' },
  { label: 'كبير (٢٦-٢٨ كج)', price: 1600, range: '26-28' }
];

const SACRIFICE_TYPES = ['نعيمي', 'تيس', 'حري'];

const PACKAGE_PRICES = { 'أكياس عادية': 0, 'تغليف فاخر': 15, 'صناديق هدايا': 30 };
const DELIVERY_FEE   = 25;

// ===== STATE =====
let cart = JSON.parse(localStorage.getItem('thallajatak_cart') || '[]');
let currentProduct = null;
let currentWeight  = 1000;
let currentCut     = 'كامل غير مقطع';
let currentFat     = 'مع الشحم الطبيعي';
let currentPackage = 'أكياس عادية';
let subMeats       = [];
let currentSubPlan = null;
let currentSubPrice= 0;
let currentSacrificeWeightIdx = 0;
let currentSacrificeType = 'نعيمي';
let currentSacrificeCondition = 'مذبوح';

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Initialize DB (Firebase or localStorage fallback)
  if (window.DB) DB.init();

  // Check if site is locked by admin
  checkSiteLock();

  renderProducts();
  updateCart();

  // Restore session
  const user = getCurrentUser();
  updateNavUser(user);
  if (user) prefillCheckout(user);

  // Navbar scroll
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
  });
});

function checkSiteLock() {
  if (localStorage.getItem('th_site_locked') !== '1') return;
  // Show maintenance page
  document.body.innerHTML = `
    <div style="
      position:fixed;inset:0;z-index:999999;
      background:linear-gradient(135deg,#1a0a08 0%,#2d0f0c 100%);
      display:flex;align-items:center;justify-content:center;flex-direction:column;
      font-family:Tajawal,sans-serif;text-align:center;padding:30px;
    ">
      <div style="font-size:72px;margin-bottom:20px">🥩</div>
      <h1 style="color:white;font-size:36px;font-weight:900;margin-bottom:12px">ثلاجتك</h1>
      <div style="background:rgba(255,255,255,.08);border-radius:20px;padding:36px 40px;max-width:480px">
        <div style="font-size:48px;margin-bottom:16px">🔧</div>
        <h2 style="color:#e74c3c;font-size:24px;font-weight:800;margin-bottom:12px">الموقع تحت الصيانة</h2>
        <p style="color:rgba(255,255,255,.75);font-size:16px;line-height:1.7">
          نعتذر عن الإزعاج — فريقنا يعمل على تطوير تجربتك.<br>سنعود قريباً بشيء رائع! 🚀
        </p>
        <div style="margin-top:24px;color:rgba(255,255,255,.5);font-size:13px">للتواصل: 📱 واتساب: 0501234567</div>
      </div>
    </div>`;
}

// ===== PRODUCTS =====
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = PRODUCTS.map(p => `
    <div class="product-card" onclick="openOrderModal('${p.id}')">
      <div class="product-img-wrap">
        <img src="${p.img}" alt="${p.name}" loading="lazy">
        <div class="product-badge">${p.badge}</div>
      </div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-meta">
          <div class="product-price">${p.isSacrifice ? 'تبدأ من ١١٠٠' : p.pricePerKg}<span> ريال${p.isSacrifice ? '' : '/كج'}</span></div>
          <div class="product-origin">${p.origin}</div>
        </div>
        <button class="btn-order">اطلب الآن ←</button>
      </div>
    </div>
  `).join('');
}

// ===== ORDER MODAL =====
function openOrderModal(productId) {
  // Must be logged in to order
  if (!getCurrentUser()) {
    openAuthModal('login');
    showToastGlobal('سجّل دخولك أولاً لتتمكن من الطلب 👆', 'blue');
    return;
  }
  currentProduct = PRODUCTS.find(p => p.id === productId);
  if (!currentProduct) return;
  currentWeight  = 1000;
  currentCut     = 'كامل غير مقطع';
  currentFat     = 'مع الشحم الطبيعي';
  currentPackage = 'أكياس عادية';

  document.getElementById('modalImg').src = currentProduct.img;
  document.getElementById('modalName').textContent = currentProduct.name;
  document.getElementById('modalDesc').textContent = currentProduct.details;
  document.getElementById('modalPricePerKg').textContent = currentProduct.pricePerKg;

  document.querySelectorAll('#cutOptions .option-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  document.querySelectorAll('#fatOptions .option-btn').forEach((b,i) => b.classList.toggle('active', i===0));

  // Handle Sacrifice specific UI
  const isSacrifice = !!currentProduct.isSacrifice;
  document.getElementById('weightStandard').style.display = isSacrifice ? 'none' : 'block';
  document.getElementById('weightSacrifice').style.display = isSacrifice ? 'block' : 'none';
  document.getElementById('livestockTypeGroup').style.display = isSacrifice ? 'block' : 'none';
  document.getElementById('sacrificeAgeGroup').style.display = isSacrifice ? 'block' : 'none';
  document.getElementById('sacrificeConditionGroup').style.display = isSacrifice ? 'block' : 'none';
  document.getElementById('sacrificeNotice').style.display = 'none'; // Hide fixed notice

  if (isSacrifice) {
    currentSacrificeWeightIdx = 0;
    currentSacrificeType = 'نعيمي';
    currentSacrificeCondition = 'مذبوح';
    renderSacrificeOptions();
    toggleSacrificeForm(true); // show cutting options by default
  } else {
    toggleSacrificeForm(true); // show cutting for standard products
  }

  updateWeightDisplay();
  updatePrice();
  document.getElementById('orderModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderSacrificeOptions() {
  const wGrid = document.getElementById('sacrificeWeightOptions');
  const tGrid = document.getElementById('sacrificeTypeOptions');
  
  wGrid.innerHTML = SACRIFICE_WEIGHTS.map((w, i) => `
    <button class="option-btn ${i===currentSacrificeWeightIdx?'active':''}" onclick="selectSacrificeWeight(${i})">
      ${w.label}<br><small>${w.price} ريال</small>
    </button>
  `).join('');

  tGrid.innerHTML = SACRIFICE_TYPES.map(t => `
    <button class="option-btn ${t===currentSacrificeType?'active':''}" onclick="selectSacrificeType('${t}')">
      ${t}
    </button>
  `).join('');
}

function selectSacrificeWeight(idx) {
  currentSacrificeWeightIdx = idx;
  renderSacrificeOptions();
  updatePrice();
}

function selectSacrificeType(type) {
  currentSacrificeType = type;
  renderSacrificeOptions();
}

function selectSacrificeCondition(cond) {
  currentSacrificeCondition = cond;
  const isLive = cond==='حي بدون ذبح';
  document.getElementById('btnCondSlaughter').classList.toggle('active', !isLive);
  document.getElementById('btnCondLive').classList.toggle('active', isLive);
  
  // Hide cutting/fat options if live
  toggleSacrificeForm(!isLive);
}

function toggleSacrificeForm(show) {
  const cutGroup = document.querySelector('#cutOptions')?.closest('.form-group');
  const fatGroup = document.querySelector('#fatOptions')?.closest('.form-group');
  if (cutGroup) cutGroup.style.display = show ? 'block' : 'none';
  if (fatGroup) fatGroup.style.display = show ? 'block' : 'none';
}
function closeModal() {
  document.getElementById('orderModal').classList.remove('open');
  document.body.style.overflow = '';
}
function closeOrderModal(e) { if (e.target.id === 'orderModal') closeModal(); }

function changeWeight(delta) { currentWeight = Math.max(250, currentWeight + delta); updateWeightDisplay(); updatePrice(); }
function setWeight(w)        { currentWeight = w; updateWeightDisplay(); updatePrice(); }

function updateWeightDisplay() {
  const el = document.getElementById('weightDisplay');
  if (el) el.textContent = currentWeight >= 1000
    ? (currentWeight/1000).toFixed(currentWeight%1000===0?0:1)+' كج'
    : currentWeight+' جم';
}

function selectCut(btn, val) {
  currentCut = val;
  btn.closest('.options-grid').querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updatePrice();
}
function selectFat(btn, val) {
  currentFat = val;
  btn.closest('.options-grid').querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updatePrice();
}
function selectPackage(btn, val) {
  currentPackage = val;
  btn.closest('.options-grid').querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updatePrice();
}

function updatePrice() {
  if (!currentProduct) return;
  
  let meatCost = 0;
  if (currentProduct.isSacrifice) {
    meatCost = SACRIFICE_WEIGHTS[currentSacrificeWeightIdx].price;
  } else {
    meatCost = Math.round((currentProduct.pricePerKg/1000)*currentWeight);
  }

  const pkgCost  = PACKAGE_PRICES[currentPackage]||0;
  const total    = meatCost + pkgCost + DELIVERY_FEE;
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('meatPrice',   meatCost+' ريال');
  s('packagePrice', pkgCost ? pkgCost+' ريال' : 'مجاني');
  s('totalPrice',   total+' ريال');
}

function addToCart() {
  if (!currentProduct) return;
  
  let meatCost, weightLabel, details;
  const pkgCost  = PACKAGE_PRICES[currentPackage]||0;
  const notes    = document.getElementById('orderNotes')?.value||'';

  if (currentProduct.isSacrifice) {
    const sw = SACRIFICE_WEIGHTS[currentSacrificeWeightIdx];
    meatCost = sw.price;
    weightLabel = sw.label;
    details = `النوع: ${currentSacrificeType} | الحالة: ${currentSacrificeCondition}`;
  } else {
    meatCost = Math.round((currentProduct.pricePerKg/1000)*currentWeight);
    weightLabel = currentWeight >= 1000 ? (currentWeight/1000).toFixed(1)+' كج' : currentWeight+' جم';
    details = `${currentCut} | ${currentFat}`;
  }

  const item = {
    id: Date.now(), productId: currentProduct.id,
    name: currentProduct.name, img: currentProduct.img,
    weight: currentProduct.isSacrifice ? weightLabel : currentWeight,
    weightLabel: weightLabel,
    cut: currentProduct.isSacrifice ? currentSacrificeCondition : currentCut, 
    fat: (currentProduct.isSacrifice && currentSacrificeCondition==='حي بدون ذبح') ? '-' : currentFat,
    package: currentPackage, notes, meatCost, pkgCost,
    details: details,
    total: meatCost + pkgCost + DELIVERY_FEE
  };
  cart.push(item);
  localStorage.setItem('thallajatak_cart', JSON.stringify(cart));
  closeModal();
  updateCart();
  showToastGlobal(`✅ تم إضافة ${currentProduct.name} للسلة`, 'green');
}

// ===== CART =====
function updateCart() {
  const countEl   = document.getElementById('cartCount');
  const cartItems = document.getElementById('cartItems');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartFooter= document.getElementById('cartFooter');
  const cartTotal = document.getElementById('cartTotal');
  if (countEl) countEl.textContent = cart.length;
  if (!cartItems) return;
  if (!cart.length) {
    cartItems.innerHTML = '';
    if (cartEmpty)  cartEmpty.style.display  = 'block';
    if (cartFooter) cartFooter.style.display = 'none';
    return;
  }
  if (cartEmpty)  cartEmpty.style.display  = 'none';
  if (cartFooter) cartFooter.style.display = 'block';
  if (cartTotal)  cartTotal.textContent    = cart.reduce((s,i)=>s+i.total,0)+' ريال';
  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.img}" alt="${item.name}">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-detail">${item.weightLabel || (item.weight>=1000?(item.weight/1000).toFixed(1)+' كج':item.weight+' جم')} | ${item.details || item.cut}</div>
        <div class="cart-item-price">${item.total} ريال</div>
      </div>
      <button class="cart-item-del" onclick="removeFromCart(${item.id})">🗑</button>
    </div>`).join('');
}

function removeFromCart(id) {
  cart = cart.filter(i=>i.id!==id);
  localStorage.setItem('thallajatak_cart', JSON.stringify(cart));
  updateCart();
}

function toggleCart() {
  const panel   = document.getElementById('cartPanel');
  const overlay = document.getElementById('cartOverlay');
  if (!panel) return;
  const open = !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

// ===== CHECKOUT =====
function openCheckout() {
  if (!getCurrentUser()) {
    toggleCart();
    openAuthModal('login');
    showToastGlobal('سجّل دخولك أولاً لإتمام الطلب', 'blue');
    return;
  }
  toggleCart();
  prefillCheckout(getCurrentUser());
  updateCheckoutSummary();
  document.getElementById('checkoutModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('open');
  document.body.style.overflow = '';
}
function closeCheckoutModal(e) { if (e.target.id==='checkoutModal') closeCheckout(); }

function updateCheckoutSummary() {
  const box = document.getElementById('checkoutSummary');
  if (!box||!cart.length) return;
  const total = cart.reduce((s,i)=>s+i.total,0);
  box.innerHTML = `
    <div style="font-weight:700;font-size:15px;margin-bottom:10px;color:#C0392B">ملخص طلبك</div>
    ${cart.map(i=>`
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;color:#555">
        <span>${i.name} (${i.weight>=1000?(i.weight/1000).toFixed(1)+' كج':i.weight+' جم'})</span>
        <span style="font-weight:700">${i.total} ريال</span>
      </div>`).join('')}
    <div style="border-top:1px dashed #ddd;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;font-weight:900;font-size:16px">
      <span>الإجمالي</span><span style="color:#C0392B">${total} ريال</span>
    </div>`;
}

function formatCard(input) {
  let v = input.value.replace(/\D/g,'').substring(0,16);
  input.value = v.replace(/(.{4})/g,'$1 ').trim();
}
function formatExp(input) {
  let v = input.value.replace(/\D/g,'').substring(0,4);
  if (v.length>=2) v=v.substring(0,2)+'/'+v.substring(2);
  input.value = v;
}

function processPayment() {
  const user    = getCurrentUser();
  const name    = document.getElementById('cName')?.value.trim();
  const phone   = document.getElementById('cPhone')?.value.trim();
  const address = document.getElementById('cAddress')?.value.trim();
  const card    = document.getElementById('cardNum')?.value.trim();
  const exp     = document.getElementById('cardExp')?.value.trim();
  const cvv     = document.getElementById('cardCvv')?.value.trim();

  if (!name||!phone||!address) return showToastGlobal('يرجى تعبئة الاسم والجوال والعنوان', 'red');
  if (!card||card.replace(/\s/g,'').length<16) return showToastGlobal('يرجى إدخال رقم البطاقة كاملاً', 'red');
  if (!exp)  return showToastGlobal('يرجى إدخال تاريخ انتهاء البطاقة', 'red');
  if (!cvv||cvv.length<3) return showToastGlobal('يرجى إدخال رمز CVV', 'red');

  const btn     = document.getElementById('payBtn');
  const btnText = document.getElementById('payBtnText');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = '⏳ جاري معالجة الدفع...';

  // Build location info
  const locationLabel = document.getElementById('cLocationDisplay')?.value || '';
  const mapsUrl = currentLocationData?.mapsUrl || null;

  const total    = cart.reduce((s,i)=>s+i.total,0);
  const orderNum = 'TH-' + Date.now().toString().slice(-6);
  const time     = document.getElementById('cTime')?.value;

  setTimeout(() => {
    // ── بناء الطلب ────────────────────────────────────────
    const order = {
      id: orderNum,
      date: new Date().toISOString(),
      customerId: user?.id || null,
      customer: { name, phone, address },
      location: locationLabel || address,
      locationMapsUrl: mapsUrl,
      items: [...cart],
      total,
      deliveryTime: time,
      status: 'قيد الانتظار',
      paymentStatus: 'مدفوع',
      paymentMethod: 'بطاقة بنكية'
    };

    // ── 1. حفظ محلي فوراً (دائماً يعمل) ─────────────────
    try {
      const orders = JSON.parse(localStorage.getItem('thallajatak_orders') || '[]');
      orders.push(order);
      localStorage.setItem('thallajatak_orders', JSON.stringify(orders));
    } catch(e) { console.warn('localStorage save error', e); }

    // ── 2. تحديث بيانات العميل محلياً ────────────────────
    try {
      if (user) {
        let customers = getCustomers();
        const idx = customers.findIndex(c => c.id === user.id);
        if (idx !== -1) {
          if (!customers[idx].orders) customers[idx].orders = [];
          customers[idx].orders.push(orderNum);
          saveCustomers(customers);
        }
      }
    } catch(e) {}

    // ── 3. إعادة تعيين السلة وعرض النجاح ─────────────────
    cart = [];
    localStorage.setItem('thallajatak_cart', JSON.stringify(cart));
    currentLocationData = null;
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'ادفع الآن وتأكيد الطلب';
    updateCart();
    closeCheckout();
    showSuccessOrder(order);

    // ── 4. رفع الطلب لـ Firebase في الخلفية (بدون await) ─
    if (window.DB && DB._firebaseOk) {
      DB.saveOrder(order).catch(e => console.warn('Firebase sync error (non-blocking):', e));
    }
  }, 1200);

}

function showSuccessOrder(order) {
  document.getElementById('successTitle').textContent = 'تم الطلب بنجاح! ✅';
  document.getElementById('successMsg').textContent =
    `طلبك قيد الانتظار. سيتواصل معك مندوبنا على رقم ${order.customer.phone}`;
  const inv = document.getElementById('invoiceBox');
  inv.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong>رقم الطلب:</strong><span style="color:#C0392B;font-weight:800">${order.id}</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong>الاسم:</strong><span>${order.customer.name}</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong>الجوال:</strong><span>${order.customer.phone}</span></div>
    ${order.location && order.location!==order.customer.address
      ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong>الموقع:</strong><span style="font-size:12px">${order.location}</span></div>`:''}
    ${order.locationMapsUrl
      ? `<div style="margin-bottom:8px"><a href="${order.locationMapsUrl}" target="_blank" style="color:#C0392B;font-size:13px;font-weight:700">🗺️ الموقع على الخريطة</a></div>`:''}
    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong>وقت التوصيل:</strong><span>${order.deliveryTime}</span></div>
    <div style="border-top:1px dashed #ccc;padding-top:10px;margin-top:8px;display:flex;justify-content:space-between;font-weight:900;font-size:18px">
      <strong>المبلغ الكلي:</strong><span style="color:#C0392B">${order.total} ريال</span>
    </div>`;
  document.getElementById('successModal').classList.add('open');
}
function closeSuccess() {
  document.getElementById('successModal').classList.remove('open');
  document.body.style.overflow = '';
  // Scroll to tracking section so customer can track their order
  setTimeout(() => {
    renderTrackingOrders();
    const section = document.getElementById('tracking');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 400);
}

// ===== SUBSCRIPTIONS =====
function openSubscriptionForm(planName, price) {
  if (!getCurrentUser()) {
    openAuthModal('login');
    showToastGlobal('سجّل دخولك أولاً للاشتراك', 'blue');
    return;
  }
  currentSubPlan  = planName;
  currentSubPrice = price;
  document.getElementById('subPlanName').textContent = planName;
  document.getElementById('subPrice').textContent    = price+' ريال';
  document.getElementById('subModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSubModal(e) {
  if (!e||e.target?.id==='subModal'||!e.target) {
    document.getElementById('subModal').classList.remove('open');
    document.body.style.overflow = '';
  }
}
function toggleSubMeat(btn, meat) {
  btn.classList.toggle('active');
  if (btn.classList.contains('active')) { if (!subMeats.includes(meat)) subMeats.push(meat); }
  else subMeats = subMeats.filter(m=>m!==meat);
}
function processSubscription() {
  const user  = getCurrentUser();
  const name  = document.getElementById('subName')?.value.trim();
  const phone = document.getElementById('subPhone')?.value.trim();
  const card  = document.getElementById('subCardNum')?.value.trim();
  if (!name||!phone) return showToastGlobal('يرجى تعبئة الاسم والجوال','red');
  if (!card||card.replace(/\s/g,'').length<16) return showToastGlobal('يرجى إدخال رقم البطاقة','red');
  setTimeout(() => {
    const subNum = 'SUB-' + Date.now().toString().slice(-5);
    const subs = JSON.parse(localStorage.getItem('thallajatak_subscriptions')||'[]');
    subs.push({
      id:subNum, plan:currentSubPlan, price:currentSubPrice,
      customer:{name,phone}, customerId: user?.id||null,
      meats:subMeats, date:new Date().toISOString(), status:'نشط'
    });
    localStorage.setItem('thallajatak_subscriptions',JSON.stringify(subs));
    closeSubModal();
    document.getElementById('successTitle').textContent = 'تم الاشتراك بنجاح! 🎉';
    document.getElementById('successMsg').textContent = `مرحباً ${name}! اشتراكك في خطة "${currentSubPlan}" فعّال الآن.`;
    document.getElementById('invoiceBox').innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong>رقم الاشتراك:</strong><span style="color:#C0392B;font-weight:800">${subNum}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong>الخطة:</strong><span>${currentSubPlan}</span></div>
      <div style="display:flex;justify-content:space-between"><strong>الرسوم الشهرية:</strong><span style="color:#C0392B;font-weight:900">${currentSubPrice} ريال</span></div>`;
    document.getElementById('successModal').classList.add('open');
  }, 1500);
}

// ===== AI CHATBOT =====
const AI_RESPONSES = {
  greet: ['مرحباً! كيف أقدر أساعدك؟ 😊','أهلاً وسهلاً! أنا جزارك الذكي 🤖'],
  sacrifice: '🐑 الأضاحي: نوفر نعيمي، تيس، وحري (جذع فقط) مطابة للشريعة. نوصيك بالوسط (٢٢-٢٤ كج) للمناسبة المتوسطة. التوصيل حية لبيتك.',
  guests: n=>`لـ ${n} ضيف، توصيتي:\n• وجبة رئيسية: ${Math.ceil(n*0.35)} كج (٣٥٠ جم/شخص)\n• مناسبة كبيرة: ${Math.ceil(n*0.45)} كج\nالنعيمي أو التيس هو الأنسب 🐑`,
  mandi:    '🍖 المندي: النعيمي هو الملك — اطلب "مقطع مرق" | ٤٠٠-٤٥٠ جم/شخص',
  kabsa:    '🍛 الكبسة: النعيمي أو التيس — "ربع وأجزاء" | ٣٥٠ جم/شخص',
  diff:     '🐐 التيس: نكهة قوية، مشاوي ومرق\n🐑 النعيمي: دهن طبيعي، ملك المندي\nكلاهما بلدي ١٠٠٪ 💪',
  chicken:  '🐓 دجاجنا البلدي: تربية حرة، لا هرمونات، ٤٥ ريال/كج',
  camel:    '🐪 الحوار: لحم فاخر نادر، خفيف الدهون، ١٢٠ ريال/كج — للمناسبات الخاصة',
  price:    '💰 أسعارنا:\n🐐 التيس: ٨٥، 🐪 الحوار: ١٢٠، 🐑 النعيمي: ٧٠، 🐓 الدجاج: ٤٥ ريال/كج\n+٢٥ توصيل',
  delivery: '🚚 التوصيل يومي — اطلب قبل ٢ظهراً يوصلك قبل المغرب | ٢٥ ريال',
  halal:    '✅ جميع ذبائحنا حلال ١٠٠٪ — ذبح شرعي يومي بشهادات صحية معتمدة',
  default:  ['اخبرني بعدد ضيوفك ونوع الوجبة وأنا أرشح لك الأنسب 😊','ما فهمت — كيف أقدر أساعدك؟ اسألني عن الأصناف والأسعار والكميات']
};

function getBotReply(msg) {
  const m = msg.toLowerCase();
  if (/مرحب|أهل|سلام|هلا/.test(m))                   return AI_RESPONSES.greet[Math.floor(Math.random()*2)];
  if (/مندي/.test(m))                                   return AI_RESPONSES.mandi;
  if (/كبسة/.test(m))                                   return AI_RESPONSES.kabsa;
  if (/فرق|تيس.*نعيمي|نعيمي.*تيس/.test(m))            return AI_RESPONSES.diff;
  if (/دجاج/.test(m))                                   return AI_RESPONSES.chicken;
  if (/حوار|جمل|إبل/.test(m))                          return AI_RESPONSES.camel;
  if (/سعر|ريال|كم.*يكلف|غلا|رخيص/.test(m))           return AI_RESPONSES.price;
  if (/توصيل|يوصل|وقت|متى/.test(m))                    return AI_RESPONSES.delivery;
  if (/حلال|ذبح|شرعي/.test(m))                         return AI_RESPONSES.halal;
  if (/ضحية|أضحية|ضحي/.test(m))                         return AI_RESPONSES.sacrifice;
  const gm = m.match(/(\d+)\s*(ضيف|شخص|أشخاص|نفر)/);
  if (gm) return AI_RESPONSES.guests(gm[1]);
  const nm = m.match(/(\d+)/);
  if (nm && /كيلو|كمية|وزن/.test(m)) return AI_RESPONSES.guests(nm[1]);
  return AI_RESPONSES.default[Math.floor(Math.random()*2)];
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg   = input?.value.trim();
  if (!msg) return;
  input.value = '';
  appendChatMsg(msg,'user');
  showTyping();
  setTimeout(() => { removeTyping(); appendChatMsg(getBotReply(msg),'bot'); }, 800+Math.random()*600);
}
function sendQuick(msg) { const i=document.getElementById('chatInput'); if(i) i.value=msg; sendChat(); }
function handleChatKey(e) { if(e.key==='Enter') sendChat(); }

function appendChatMsg(text,type) {
  const c = document.getElementById('chatMessages');
  if (!c) return;
  const d = document.createElement('div');
  d.className='chat-msg '+type;
  d.innerHTML = type==='bot'
    ?`<div class="bot-avatar">🤖</div><div class="msg-content">${text.replace(/\n/g,'<br>')}</div>`
    :`<div class="msg-content">${text}</div><div class="user-avatar">👤</div>`;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}
function showTyping() {
  const c=document.getElementById('chatMessages'); if(!c) return;
  const d=document.createElement('div'); d.className='chat-msg bot'; d.id='typingIndicator';
  d.innerHTML=`<div class="bot-avatar">🤖</div><div class="msg-content"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
}
function removeTyping() { document.getElementById('typingIndicator')?.remove(); }
function openChat() {
  document.getElementById('ai-butcher')?.scrollIntoView({behavior:'smooth',block:'start'});
  setTimeout(()=>document.getElementById('chatInput')?.focus(),600);
}

// ===== UTILS =====
function scrollTo(id) { document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); }

function showToastGlobal(msg, color='green') {
  const cols={green:'#27AE60',red:'#C0392B',blue:'#2980B9'};
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;bottom:30px;right:30px;z-index:99998;background:${cols[color]||cols.green};color:white;padding:14px 22px;border-radius:12px;font-family:Tajawal,sans-serif;font-size:15px;font-weight:700;box-shadow:0 6px 24px rgba(0,0,0,0.3);animation:stIn .3s ease;`;
  t.textContent=msg;
  if(!document.getElementById('__toast_css')) {
    const s=document.createElement('style');
    s.id='__toast_css';
    s.textContent='@keyframes stIn{from{transform:translateX(100%);opacity:0}to{transform:translate(0);opacity:1}}';
    document.head.appendChild(s);
  }
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300);},3500);
}

// ===================================================
//  ORDER TRACKING
// ===================================================
const TRACK_STEPS = ['قيد الانتظار','قيد التجهيز','قيد التوصيل','تم التوصيل'];
const TRACK_ICONS = ['⏳','🔪','🚚','✅'];

function requireLoginForTracking(e) {
  const user = getCurrentUser();
  if (!user) {
    if (e) e.preventDefault();
    openAuthModal('login');
    showToastGlobal('سجّل دخولك لتتبع طلباتك 📦', 'blue');
  }
}

// Call this whenever user logs in / from init
function initTrackingSection() {
  const user = getCurrentUser();
  const loginDiv   = document.getElementById('trackLogin');
  const contentDiv = document.getElementById('trackContent');
  if (!loginDiv || !contentDiv) return;
  if (user) {
    loginDiv.style.display   = 'none';
    contentDiv.style.display = 'block';
    renderTrackingOrders();
  } else {
    loginDiv.style.display   = 'block';
    contentDiv.style.display = 'none';
  }
}

function renderTrackingOrders() {
  const user = getCurrentUser();
  const list = document.getElementById('trackOrdersList');
  if (!list || !user) return;

  const search = document.getElementById('trackSearchInput')?.value.trim().toUpperCase() || '';
  const allOrders = JSON.parse(localStorage.getItem('thallajatak_orders') || '[]');

  // Show all orders for this customer (by customerId or phone match)
  let myOrders = allOrders.filter(o =>
    o.customerId === user.id ||
    o.customer?.phone === user.phone
  );

  if (search) myOrders = myOrders.filter(o => o.id.toUpperCase().includes(search));
  myOrders = myOrders.sort((a,b) => new Date(b.date) - new Date(a.date));

  if (!myOrders.length) {
    list.innerHTML = `<div class="track-empty"><div>📦</div><p>${search ? 'لا يوجد طلب بهذا الرقم' : 'لا توجد طلبات بعد — اطلب الآن!'}</p></div>`;
    return;
  }

  list.innerHTML = myOrders.map(order => {
    const item = order.items?.[0] || {};
    const wLabel = item.weight >= 1000 ? (item.weight/1000).toFixed(1)+' كج' : (item.weight||'-')+' جم';
    const curStep = TRACK_STEPS.indexOf(order.status);

    const stepper = TRACK_STEPS.map((step, i) => {
      const isDone   = i < curStep;
      const isActive = i === curStep;
      const cls = isDone ? 'done' : (isActive ? 'active' : '');
      return `
        <div class="step-item ${cls}">
          <div class="step-dot">${isDone ? '✓' : TRACK_ICONS[i]}</div>
          <div class="step-label">${step.replace('قيد ','')}</div>
        </div>`;
    }).join('');

    return `
      <div class="track-order-card" onclick="openTrackingModal('${order.id}')">
        <div class="track-order-header">
          <div>
            <div class="track-order-id">${order.id}</div>
            <div class="track-order-date">${new Date(order.date).toLocaleDateString('ar-SA', {year:'numeric',month:'long',day:'numeric'})}</div>
          </div>
          <div class="track-order-total">${order.total} ريال</div>
        </div>
        <div style="font-size:13px;color:#666;margin-bottom:10px">
          ${item.name || '-'} · ${wLabel} · ${item.cut || '-'}
        </div>
        <div class="status-stepper">${stepper}</div>
        ${order.locationMapsUrl
          ? `<div style="margin-top:8px"><a href="${order.locationMapsUrl}" target="_blank" onclick="event.stopPropagation()" style="font-size:12px;color:#C0392B;font-weight:700">🗺️ موقع التوصيل</a></div>` : ''}
      </div>`;
  }).join('');
}

function openTrackingModal(orderId) {
  const allOrders = JSON.parse(localStorage.getItem('thallajatak_orders') || '[]');
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  const item = order.items?.[0] || {};
  const wLabel = item.weight >= 1000 ? (item.weight/1000).toFixed(1)+' كج' : (item.weight||'-')+' جم';
  const curStep = TRACK_STEPS.indexOf(order.status);

  const stepper = TRACK_STEPS.map((step, i) => {
    const isDone = i < curStep, isActive = i === curStep;
    const cls = isDone ? 'done' : (isActive ? 'active' : '');
    return `
      <div class="step-item ${cls}">
        <div class="step-dot">${isDone ? '✓' : TRACK_ICONS[i]}</div>
        <div class="step-label">${step}</div>
      </div>`;
  }).join('');

  const content = document.getElementById('trackingModalContent');
  content.innerHTML = `
    <div style="background:linear-gradient(135deg,#1a0a08,#2d110e);border-radius:16px;padding:20px 24px;margin-bottom:20px;color:white">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:900;color:#e74c3c">${order.id}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.6)">${new Date(order.date).toLocaleString('ar-SA')}</div>
        </div>
        <div style="font-size:22px;font-weight:900;color:#e74c3c">${order.total} ريال</div>
      </div>
    </div>

    <div class="status-stepper" style="margin-bottom:24px">${stepper}</div>

    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F0F2F5">
        <span style="color:#888;font-size:14px">المنتج</span>
        <span style="font-weight:700">${item.name || '-'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F0F2F5">
        <span style="color:#888;font-size:14px">الوزن / التقطيع</span>
        <span style="font-weight:700">${wLabel} · ${item.cut || '-'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F0F2F5">
        <span style="color:#888;font-size:14px">وقت التوصيل</span>
        <span style="font-weight:700">${order.deliveryTime || '-'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F0F2F5">
        <span style="color:#888;font-size:14px">الدفع</span>
        <span style="font-weight:700;color:${order.paymentStatus==='مدفوع'?'#27AE60':'#E67E22'}">${order.paymentStatus==='مدفوع'?'✅ مدفوع':'⚠️ غير مدفوع'}</span>
      </div>
      ${order.locationMapsUrl ? `
      <div style="display:flex;justify-content:space-between;padding:10px 0">
        <span style="color:#888;font-size:14px">الموقع</span>
        <a href="${order.locationMapsUrl}" target="_blank" style="color:#C0392B;font-weight:700;font-size:14px">🗺️ خرائط جوجل</a>
      </div>` : ''}
    </div>

    <div style="background:#FEF2F2;border-radius:12px;padding:14px;text-align:center">
      <div style="font-size:13px;color:#888;margin-bottom:4px">الحالة الحالية</div>
      <div style="font-size:18px;font-weight:900;color:#C0392B">${TRACK_ICONS[curStep>=0?curStep:0]} ${order.status}</div>
    </div>`;

  document.getElementById('trackingModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTrackingModal() {
  document.getElementById('trackingModal').classList.remove('open');
  document.body.style.overflow = '';
}

