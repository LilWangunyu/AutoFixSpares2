// app.js - Customer site logic (requires firebase-config.js)
const inventoryTableBody = document.querySelector('#inventoryTable tbody');
const partSelect = document.getElementById('partSelect');
const featuredEl = document.getElementById('featured');
const searchInput = document.getElementById('search');
const categoryFilter = document.getElementById('categoryFilter');

// helper formatting
function numberWithCommas(x){ return (x||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,","); }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

let allParts = [];

// load inventory live
function loadInventory(){
  db.collection('spareParts').orderBy('category').onSnapshot(snap=>{
    allParts = [];
    inventoryTableBody.innerHTML=''; partSelect.innerHTML = '<option value="">-- Select item --</option>';
    snap.forEach(doc=>{
      const d = doc.data(); d.id = doc.id;
      allParts.push(d);
    });
    renderInventory(allParts);
    populateSelect(allParts);
    renderFeatured(allParts);
  }, err => {
    console.error('Inventory load error', err);
    alert('Failed to load inventory. Check console.');
  });
}
function renderInventory(list){
  inventoryTableBody.innerHTML = '';
  list.forEach(d=>{
    const tr = document.createElement('tr');
    const img = d.imageUrl || 'https://images.unsplash.com/photo-1518133910546-b6c2fb0b13f2?q=80&w=400&auto=format&fit=crop&s=8e3b5f7f4f66f4c4f0d2f7a9f8a1b0f4';
    const name = d.category === 'Tires' ? (`Tire ${d.size}`) : d.name;
    tr.innerHTML = `<td><img class="item-photo" src="${img}" /></td>
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(d.category || 'General')}</td>
      <td>KSh ${numberWithCommas(d.price)}</td>
      <td>${d.stock ?? 0}</td>
      <td></td>`;
    const actionCell = tr.cells[5];
    if ((d.stock||0) > 0) {
      const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Order';
      btn.onclick = ()=> { partSelect.value = d.id; window.scrollTo({top:0,behavior:'smooth'}); };
      actionCell.appendChild(btn);
    } else {
      actionCell.innerHTML = '<span class="small-note">Out of stock</span>';
    }
    inventoryTableBody.appendChild(tr);
  });
}
function populateSelect(list){
  list.forEach(d=>{
    const name = d.category==='Tires' ? (`Tire ${d.size}`) : d.name;
    const opt = document.createElement('option'); opt.value=d.id; opt.text = `${name} — KSh ${numberWithCommas(d.price)}`;
    partSelect.add(opt);
  });
}
function renderFeatured(list){
  featuredEl.innerHTML='';
  const many = list.filter(x=> x.imageUrl ).slice(0,6);
  if (many.length===0) return;
  many.forEach(d=>{
    const box = document.createElement('div'); box.className='card'; box.style.width='180px';
    const name = d.category==='Tires' ? (`Tire ${d.size}`) : d.name;
    box.innerHTML = `<img src="${d.imageUrl}" style="width:100%;height:100px;object-fit:cover;border-radius:8px"><div style="padding:8px"><strong>${escapeHtml(name)}</strong><div class="small">KSh ${numberWithCommas(d.price)}</div></div>`;
    featuredEl.appendChild(box);
  });
}

// Filter utilities
function applyFilter(){
  const q = (searchInput.value||'').toLowerCase();
  const cat = categoryFilter.value;
  const filtered = allParts.filter(d=>{
    const name = (d.name||'').toLowerCase() + ' ' + (d.size||'').toLowerCase();
    const catOK = !cat || (d.category === cat);
    return catOK && name.includes(q);
  });
  renderInventory(filtered);
}

// Order handling & notifications
async function placeOrder(){
  const partId = partSelect.value;
  const qty = parseInt(document.getElementById('qty').value || '1',10);
  const name = document.getElementById('custName').value.trim();
  const email = document.getElementById('custEmail').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const wantsPush = document.getElementById('notifyMe').checked;
  if (!partId || !qty || !name || !email || !phone) { alert('Complete all fields'); return; }

  const partRef = db.collection('spareParts').doc(partId);
  const pSnap = await partRef.get();
  if (!pSnap.exists) { alert('Item not found'); return; }
  const p = pSnap.data();
  if ((p.stock||0) < qty) { alert('Insufficient stock'); return; }
  const total = (p.price||0)*qty;

  let customerToken = null;
  if (wantsPush) {
    try {
      // request permission & get token (VAPID must be set on server console)
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        customerToken = await messaging.getToken({ vapidKey: 'TfO_CtUX05DQL6WF3ElDrbdMryXtjNJD9255fg7F810' });
        console.log('customer token', customerToken);
      }
    } catch(e){ console.warn('Token error', e); }
  }

  // Create order (client creates order doc with status 'new'); CF will process stock
  const orderRef = await db.collection('orders').add({
    name, email, phone, partId, quantity: qty, total,
    status: 'new', walkIn: false, timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    customerToken: customerToken || null
  });

  // Show receipt
  generateReceipt({ id: orderRef.id, name, item: (p.category==='Tires'?('Tire '+p.size):p.name), qty, price: p.price, total, date: new Date() });

  alert('Order placed. We will notify you when it is ready (if you allowed notifications).');
  document.getElementById('orderForm').reset();
}

// PDF receipt
function generateReceipt(o){
  try{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'pt'});
    doc.setFontSize(16); doc.text('AutoFix Spare Parts — Receipt', 40, 60);
    doc.setFontSize(10);
    doc.text(`Order ID: ${o.id||'N/A'}`, 40, 90);
    doc.text(`Date: ${ (o.date||new Date()).toLocaleString() }`, 40, 110);
    doc.text(`Customer: ${o.name}`, 40, 130);
    doc.text(`Item: ${o.item}`, 40, 150);
    doc.text(`Quantity: ${o.qty}`, 40, 170);
    doc.text(`Price (each): KSh ${numberWithCommas(o.price)}`, 40, 190);
    doc.setFontSize(12); doc.text(`Total: KSh ${numberWithCommas(o.total)}`, 40, 220);
    doc.save(`receipt_${Date.now()}.pdf`);
  }catch(e){ console.error('Receipt error', e); }
}

window.addEventListener('load', async () => {
  // Initialize messaging on load (sw must be registered)
  try {
    // register service worker for messaging
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service worker registered for messaging');
    }
    // messaging.onMessage for foreground messages
    messaging.onMessage(payload => {
      console.log('Foreground message', payload);
      // optionally show a custom in-app toast here
      alert((payload.notification && payload.notification.title) || 'Notification');
    });
  } catch(e){ console.warn('SW/messaging init failed', e); }

  loadInventory();
});
