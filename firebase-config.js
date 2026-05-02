// ================================================================
// FIREBASE SETUP — ทำครั้งเดียว ใช้ได้เลย
// ================================================================
// 1. ไปที่ https://console.firebase.google.com
// 2. สร้าง Project ใหม่
// 3. เปิด Firestore Database → "Start in production mode"
// 4. เปิด Authentication → Sign-in method → เปิด "Google"
// 5. ไปที่ Project Settings → เลื่อนลงหา "Your apps" → Add app → Web
// 6. Copy ค่า firebaseConfig แล้วแทนที่ด้านล่าง
// ================================================================

const firebaseConfig = {
  apiKey:            "AIzaSyDQMNmQbOTSuTTAwdhYigcwxPX0HcL1sm0",
  authDomain:        "gwan-bad-storage.firebaseapp.com",
  projectId:         "gwan-bad-storage",
  storageBucket:     "gwan-bad-storage.firebasestorage.app",
  messagingSenderId: "685232288598",
  appId:             "1:685232288598:web:47241ad59e255c8a041cf7",
  measurementId:     "G-T81KRG5MJH"
};

firebase.initializeApp(firebaseConfig);
