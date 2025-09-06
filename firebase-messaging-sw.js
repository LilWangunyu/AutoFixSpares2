// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize the firebase app in the service worker using the same config
firebase.initializeApp({
  apiKey: "AIzaSyBo8V2ZCG6eZc2shWpJiIeDWj4n-4XIWNk",
  authDomain: "autofixspares2.firebaseapp.com",
  projectId: "autofixspares2",
  storageBucket: "autofixspares2.firebasestorage.app",
  messagingSenderId: "751270391827",
  appId: "1:751270391827:web:571a070a4ae108fe1b8fe6"
});

const messagingSW = firebase.messaging();

messagingSW.onBackgroundMessage(function(payload) {
  // Show system notification for background messages
  const title = (payload.notification && payload.notification.title) || 'AutoFix Notification';
  const options = {
    body: payload.notification ? payload.notification.body : '',
    icon: '/icons/icon-192.png',
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});
