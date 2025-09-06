// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// When a new order is created: validate, transactionally decrement stock, update order, and notify staff
exports.processNewOrder = functions.region('us-central1').firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const order = snap.data();
    const orderRef = snap.ref;
    const partId = order.partId;
    const qty = Number(order.quantity || 0);

    if (!partId || qty <= 0) {
      await orderRef.update({ status: 'cancelled', reason: 'invalid-order' });
      return null;
    }

    const partRef = db.collection('spareParts').doc(partId);
    try {
      await db.runTransaction(async tx => {
        const partDoc = await tx.get(partRef);
        if (!partDoc.exists) {
          await tx.update(orderRef, { status: 'cancelled', reason: 'part-not-found' });
          return;
        }
        const stock = Number(partDoc.data().stock || 0);
        if (stock < qty) {
          await tx.update(orderRef, { status: 'cancelled', reason: 'insufficient_stock' });
          return;
        }
        tx.update(partRef, { stock: stock - qty, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        tx.update(orderRef, { status: 'processing', processedAt: admin.firestore.FieldValue.serverTimestamp() });
      });

      // Notify staff devices using tokens stored in deviceTokens collection (doc id = token)
      const tokensSnapshot = await db.collection('deviceTokens').where('role','==','staff').get();
      const tokens = tokensSnapshot.docs.map(d => d.id).filter(Boolean);

      if (tokens.length) {
        // Limit to 500 tokens per sendMulticast call
        const batches = [];
        while (tokens.length) batches.push(tokens.splice(0, 500));
        const payload = {
          notification: {
            title: 'New order received',
            body: `Order ${context.params.orderId} — KSh ${order.total || 0}`
          },
          data: { orderId: context.params.orderId || '' }
        };
        for (const batch of batches) {
          await admin.messaging().sendMulticast({ tokens: batch, ...payload });
        }
      }

      console.log('Order processed', context.params.orderId);
    } catch (err) {
      console.error('processNewOrder error', err);
      try { await orderRef.update({ status: 'cancelled', reason: 'processing_error' }); } catch(e){}
    }
    return null;
  });

// When an order's status becomes 'ready', notify the customer's token (if present)
exports.notifyCustomerReady = functions.region('us-central1').firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return null;
    if (before.status === after.status) return null;
    if (after.status === 'ready') {
      const token = after.customerToken || null;
      if (!token) return null;
      const message = {
        notification: {
          title: 'Your AutoFix order is ready',
          body: `Order ${context.params.orderId} is ready for collection.`
        },
        token: token
      };
      try {
        await admin.messaging().send(message);
        console.log('Customer notified for order', context.params.orderId);
      } catch (err) {
        console.error('Notify customer failed', err);
      }
    }
    return null;
  });
