// firebase-config.js
// Project: autofixspares2 — inserted as requested
// Do not commit sensitive server keys (service account) here.
var firebaseConfig = {
  apiKey: "AIzaSyBo8V2ZCG6eZc2shWpJiIeDWj4n-4XIWNk",
  authDomain: "autofixspares2.firebaseapp.com",
  projectId: "autofixspares2",
  storageBucket: "autofixspares2.firebasestorage.app",
  messagingSenderId: "751270391827",
  appId: "1:751270391827:web:571a070a4ae108fe1b8fe6",
  measurementId: "G-L5PMY1CBEX"
};

// Initialize Firebase app (compat SDK expected in HTML pages)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();
const messaging = firebase.messaging();
