// staff.js - staff dashboard
let currentUser = null;
auth.onAuthStateChanged(user=>{
  if (!user) {
    window.location = 'login.html';
    return;
  }
  currentUser = user;
  initStaff();
});

function logout(){ auth.signOut().then(()=> window.location='login.html'); }

async function initStaff(){
  // register messaging sw and get token for staff notifications
  try {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('SW registered for staff');
    }
    // ask permission
    const p = await Notification.requestPermission();
    if (p === 'granted') {
      const token = await messaging.getToken({ vapidKey: 'TfO_CtUX05DQL6WF3ElDrbdMryXtjNJD9255fg7F810' });
      if (token) {
        // save to deviceTokens collection with role staff
        await db.collection('deviceTokens').doc(token).set({
          token, uid: currentUser.uid, role: 'staff', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  } catch(e){ console.warn('Staff messaging init', e); }

  loadOrders();
  loadInventory();
  populateWalkParts();
  messaging.onMessage(payload=>{
    console.log('Foreground message for staff', payload);
    alert((payload.notification && payload.notification.title) || 'Notification');
  });
}

function loadOrders(){
  const tbody = document.querySelector('#ordersTable tbody');
  db.collection('orders').orderBy('timestamp','desc').onSnapshot(snapshot=>{
    tbody.innerHTML='';
    snapshot.forEach(async doc=>{
      const o = doc.data(); const id = doc.id;
      const partSnap = await db.collection('spareParts').doc(o.partId).get();
      const p = partSnap.exists ? partSnap.data() : { name:'Unknown', size:'' };
      const itemName = p.category==='Tires' ? `Tire ${p.size}` : p.name;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${o.name} <div class="small">${o.phone || ''}</div></td>
        <td>${itemName}</td><td>${o.quantity}</td><td>KSh ${o.total}</td><td>${o.status||''}</td><td></td>`;
      const actionCell = tr.cells[5];

      if (o.status === 'new') {
        const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Mark Ready';
        btn.onclick = ()=> db.collection('orders').doc(id).update({ status:'ready' });
        actionCell.appendChild(btn);
        const cancel = document.createElement('button'); cancel.className='btn ghost'; cancel.style.marginLeft='6px'; cancel.textContent='Cancel';
        cancel.onclick = ()=> db.collection('orders').doc(id).update({ status:'cancelled', reason:'staff_cancelled' });
        actionCell.appendChild(cancel);
      } else if (o.status === 'ready') {
        const complete = document.createElement('button'); complete.className='btn'; complete.textContent='Complete';
        complete.onclick = ()=> db.collection('orders').doc(id).update({ status:'completed' });
        actionCell.appendChild(complete);
      } else {
        actionCell.textContent = o.status;
      }
      // receipt
      const rbtn = document.createElement('button'); rbtn.className='btn ghost'; rbtn.style.marginLeft='6px'; rbtn.textContent='Receipt';
      rbtn.onclick = async ()=>{
        const pr = p;
        generateReceipt({
          name:o.name, partName:(pr.category==='Tires'?('Tire '+pr.size):pr.name),
          quantity:o.quantity, price: Math.round((o.total||0)/(o.quantity||1)), total:o.total||0,
          timestamp:(o.timestamp && o.timestamp.toDate)? o.timestamp.toDate() : new Date()
        });
      };
      actionCell.appendChild(rbtn);
      tbody.appendChild(tr);
    });
  });
}

function generateReceipt(o){
  try { const { jsPDF } = window.jspdf; const doc = new jsPDF({unit:'pt'}); doc.setFontSize(18); doc.text('AutoFix Spare Parts — Receipt',40,60); doc.setFontSize(11); doc.text(`Date: ${o.timestamp.toLocaleString()}`,40,90); doc.text(`Customer: ${o.name}`,40,110); doc.text(`Item: ${o.partName}`,40,130); doc.text(`Quantity: ${o.quantity}`,40,150); doc.text(`Price (each): KSh ${o.price}`,40,170); doc.setFontSize(13); doc.text(`Total: KSh ${o.total}`,40,200); doc.save(`receipt_${Date.now()}.pdf`); } catch(e){console.error(e)}
}

// INVENTORY functions
async function loadInventory(){
  const tbody = document.querySelector('#invTable tbody');
  db.collection('spareParts').orderBy('name').onSnapshot(snapshot=>{
    tbody.innerHTML='';
    snapshot.forEach(doc=>{
      const d = doc.data(); d.id = doc.id;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><img src="${d.imageUrl || 'https://images.unsplash.com/photo-1518133910546-b6c2fb0b13f2?q=80&w=400&auto=format&fit=crop&s=8e3b5f7f4f66f4c4f0d2f7a9f8a1b0f4'}" class="item-photo"/></td><td>${d.name || ''}</td><td>KSh ${d.price}</td><td>${d.stock ?? 0}</td><td></td>`;
      const action = tr.cells[4];
      const edit = document.createElement('button'); edit.className='btn ghost'; edit.textContent='Edit';
      edit.onclick = ()=> populateEditForm(doc.id, d);
      action.appendChild(edit);
      const del = document.createElement('button'); del.className='btn danger'; del.style.marginLeft='6px'; del.textContent='Delete';
      del.onclick = async ()=> { if (confirm('Delete this item?')) await db.collection('spareParts').doc(doc.id).delete(); };
      action.appendChild(del);
      tbody.appendChild(tr);
    });
  });
}

function populateEditForm(id, d){
  document.getElementById('itemId').value = id;
  document.getElementById('itemName').value = d.name || '';
  document.getElementById('itemCategory').value = d.category || 'General';
  document.getElementById('itemSize').value = d.size || '';
  document.getElementById('itemPrice').value = d.price || 0;
  document.getElementById('itemStock').value = d.stock || 0;
  document.getElementById('itemImage').value = d.imageUrl || '';
}

async function saveItem(){
  const id = document.getElementById('itemId').value;
  const name = document.getElementById('itemName').value.trim();
  const category = document.getElementById('itemCategory').value;
  const size = document.getElementById('itemSize').value.trim();
  const price = Number(document.getElementById('itemPrice').value || 0);
  const stock = Number(document.getElementById('itemStock').value || 0);
  const imageUrl = document.getElementById('itemImage').value.trim();

  const doc = { name, category, size: size||null, price, stock, imageUrl: imageUrl||null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  if (id) {
    await db.collection('spareParts').doc(id).update(doc);
    alert('Item updated');
  } else {
    await db.collection('spareParts').add(Object.assign({ createdAt: firebase.firestore.FieldValue.serverTimestamp() }, doc));
    alert('Item added');
  }
  document.getElementById('itemForm').reset();
}

// walk-in
async function populateWalkParts(){
  const sel = document.getElementById('walkPart');
  const snapshot = await db.collection('spareParts').orderBy('name').get();
  sel.innerHTML = '<option value="">-- Select part --</option>';
  snapshot.forEach(doc=>{
    const d = doc.data();
    if ((d.stock||0)>0) {
      const opt = document.createElement('option'); opt.value = doc.id; opt.text = `${d.name} — KSh ${d.price} — ${d.stock} in stock`;
      sel.add(opt);
    }
  });
}

async function recordWalkin(){
  const name = document.getElementById('walkName').value.trim();
  const phone = document.getElementById('walkPhone').value.trim();
  const partId = document.getElementById('walkPart').value;
  const qty = Number(document.getElementById('walkQty').value || 1);
  if (!name || !phone || !partId || !qty) { alert('Complete fields'); return; }
  const pRef = db.collection('spareParts').doc(partId);
  const pSnap = await pRef.get();
  if (!pSnap.exists) { alert('Part not found'); return; }
  const p = pSnap.data();
  if ((p.stock||0) < qty) { alert('Insufficient stock'); return; }

  const total = p.price * qty;
  // Create order as walkIn: true and status completed and decrement stock in transaction via cloud function (or client update in dev)
  await db.collection('orders').add({
    name, phone, email: '', partId, quantity: qty, total, status:'completed', walkIn:true, timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  // In production, stock decrement happens in Cloud Function triggered by orders onCreate.
  if (confirm('Record walk-in sale and download receipt?')) {
    generateReceipt({ id:'walkin', name, item: p.name, qty, price: p.price, total, date: new Date() });
  }
  document.getElementById('walkForm').reset();
}

// inventory search
function filterInv(){
  const q = (document.getElementById('invSearch').value || '').toLowerCase();
  const rows = document.querySelectorAll('#invTable tbody tr');
  rows.forEach(r => {
    const name = (r.cells[1].innerText||'').toLowerCase();
    r.style.display = name.includes(q) ? '' : 'none';
  });
}
