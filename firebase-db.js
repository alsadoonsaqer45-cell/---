// ============================================================
//  firebase-db.js  —  ثلاجتك
//  طبقة قاعدة البيانات: Firebase Realtime Database
//  يعمل على جميع الأجهزة في نفس الوقت
// ============================================================

// ===== إعدادات Firebase =====
// أنشئ مشروعاً مجانياً على https://console.firebase.google.com
// ثم استبدل القيم أدناه بقيم مشروعك
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBOyM8y-oJqTh9MdgVsJXJ1XKxovgRVI4Q",
  authDomain:        "thallajatak.firebaseapp.com",
  databaseURL:       "https://thallajatak-default-rtdb.firebaseio.com",
  projectId:         "thallajatak",
  storageBucket:     "thallajatak.firebasestorage.app",
  messagingSenderId: "945237491301",
  appId:             "1:945237491301:web:ed22d05c7c73b22f99908c",
  measurementId:     "G-6W27VM70ZE"
};

// ===== كشف إذا Firebase مهيأ =====
const FIREBASE_READY = FIREBASE_CONFIG.databaseURL &&
  !FIREBASE_CONFIG.databaseURL.includes('YOUR-PROJECT');

let _db = null; // مرجع قاعدة البيانات

function initFirebase() {
  if (!FIREBASE_READY) return false;
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _db = firebase.database();
    console.log('✅ Firebase متصل — الطلبات تُحفظ على السحابة');
    return true;
  } catch(e) {
    console.warn('⚠️ خطأ في تهيئة Firebase — سيتم استخدام التخزين المحلي', e);
    return false;
  }
}

// ============================================================
//  DB — واجهة موحدة (Firebase أو localStorage)
// ============================================================
window.DB = {
  _firebaseOk: false,

  // يجب استدعاؤه عند تحميل الصفحة
  init() {
    this._firebaseOk = initFirebase();
    if (!this._firebaseOk) {
      console.warn('📦 يعمل بوضع التخزين المحلي — الطلبات لن تظهر على أجهزة أخرى');
      this._showOfflineBanner();
    }
  },

  _showOfflineBanner() {
    // أظهر تنبيهاً صغيراً للأدمن فقط
    if (!document.getElementById('adminPanel') && !document.getElementById('firebaseNotice')) return;
    const d = document.createElement('div');
    d.id = 'firebaseNotice';
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#E67E22;color:white;text-align:center;padding:10px;font-family:Tajawal,sans-serif;font-size:14px;font-weight:700';
    d.innerHTML = '⚠️ Firebase غير مهيأ — الطلبات تُحفظ محلياً فقط. <a href="#" style="color:white;text-decoration:underline" onclick="document.getElementById(\'firebaseNotice\').remove()">إخفاء</a>';
    document.body.prepend(d);
  },

  // ─── حفظ طلب ─────────────────────────────────────────────
  async saveOrder(order) {
    if (this._firebaseOk) {
      await _db.ref('orders/' + order.id).set(order);
    } else {
      const orders = this._localGet('thallajatak_orders');
      orders.push(order);
      this._localSet('thallajatak_orders', orders);
    }
  },

  // ─── جلب كل الطلبات (مرة واحدة) ──────────────────────────
  async getOrders() {
    if (this._firebaseOk) {
      const snap = await _db.ref('orders').once('value');
      const val = snap.val() || {};
      return Object.values(val).sort((a,b) => new Date(b.date) - new Date(a.date));
    }
    return this._localGet('thallajatak_orders');
  },

  // ─── تحديث حقول في طلب ───────────────────────────────────
  async updateOrder(id, data) {
    if (this._firebaseOk) {
      await _db.ref('orders/' + id).update(data);
    } else {
      const orders = this._localGet('thallajatak_orders');
      const idx = orders.findIndex(o => o.id === id);
      if (idx !== -1) { Object.assign(orders[idx], data); this._localSet('thallajatak_orders', orders); }
    }
  },

  // ─── حذف طلب ─────────────────────────────────────────────
  async deleteOrder(id) {
    if (this._firebaseOk) {
      await _db.ref('orders/' + id).remove();
    } else {
      const orders = this._localGet('thallajatak_orders').filter(o => o.id !== id);
      this._localSet('thallajatak_orders', orders);
    }
  },

  // ─── حذف جميع الطلبات ────────────────────────────────────
  async deleteAllOrders() {
    if (this._firebaseOk) {
      await _db.ref('orders').remove();
    } else {
      this._localSet('thallajatak_orders', []);
    }
  },

  // ─── مستمع فوري للطلبات (للأدمن) ────────────────────────
  listenOrders(callback) {
    if (this._firebaseOk) {
      _db.ref('orders').on('value', snap => {
        const val = snap.val() || {};
        const orders = Object.values(val).sort((a,b) => new Date(b.date) - new Date(a.date));
        callback(orders);
      });
    } else {
      // وضع غير متصل: استرجاع من localStorage مرة واحدة
      callback(this._localGet('thallajatak_orders'));
    }
  },

  // ─── إيقاف الاستماع ──────────────────────────────────────
  stopListening() {
    if (this._firebaseOk && _db) {
      _db.ref('orders').off();
    }
  },

  // ─── حفظ عميل ────────────────────────────────────────────
  async saveCustomer(customer) {
    if (this._firebaseOk) {
      await _db.ref('customers/' + customer.id).set(customer);
    } else {
      const customers = this._localGet('th_customers');
      const idx = customers.findIndex(c => c.id === customer.id);
      if (idx !== -1) customers[idx] = customer; else customers.push(customer);
      this._localSet('th_customers', customers);
    }
  },

  // ─── جلب كل العملاء ──────────────────────────────────────
  async getCustomers() {
    if (this._firebaseOk) {
      const snap = await _db.ref('customers').once('value');
      return Object.values(snap.val() || {});
    }
    return this._localGet('th_customers');
  },

  // ─── حفظ اشتراك ──────────────────────────────────────────
  async saveSubscription(sub) {
    if (this._firebaseOk) {
      await _db.ref('subscriptions/' + sub.id).set(sub);
    } else {
      const subs = this._localGet('thallajatak_subscriptions');
      subs.push(sub);
      this._localSet('thallajatak_subscriptions', subs);
    }
  },

  // ─── جلب كل الاشتراكات ───────────────────────────────────
  async getSubscriptions() {
    if (this._firebaseOk) {
      const snap = await _db.ref('subscriptions').once('value');
      return Object.values(snap.val() || {});
    }
    return this._localGet('thallajatak_subscriptions');
  },

  // ─── مساعدات localStorage ────────────────────────────────
  _localGet(key) { return JSON.parse(localStorage.getItem(key) || '[]'); },
  _localSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};
