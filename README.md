# MJMA 3D World — متجر المنتجات المختارة

متجر إلكتروني متكامل مبني بتقنيات **React** و **Vite** و **Tailwind CSS v4** و **Firebase** و **Google Gemini AI**.
جاهز تماماً للتشغيل المحلي والنشر على منصة **Vercel**.

---

## 📁 هيكلية المشروع (Project Structure)

```text
├── index.html                  # ملف HTML الرئيسي للتطبيق
├── package.json                # تعريف الاعتماديات وأوامر التشغيل والبناء
├── vite.config.js              # إعدادات Vite ومكونات TailwindCSS v4
├── vercel.json                 # إعدادات التوجيه والنشر على منصة Vercel
├── server.js                   # خادم Node / Express المحلي ودعم واجهة الترجمة
├── firebase-applet-config.json # إعدادات Firebase الافتراضية
├── .env.example                # نموذج لمتغيرات البيئة (Gemini & Firebase)
├── .gitignore                  # الملفات المستثناة من مستودع Git
├── api/
│   └── translate.js            # Vercel Serverless Function لترجمة الذكاء الاصطناعي (Gemini)
└── src/
    ├── main.jsx                # نقطة الانطلاق لتطبيق React
    ├── App.jsx                 # المكون الرئيسي للتطبيق وواجهة المتجر
    ├── App.tsx                 # ملف إعادة تصدير لتوافق المسارات
    ├── index.css               # أنماط Tailwind CSS v4 والتنسيقات الأساسية
    ├── components/             # مكونات واجهة المستخدم
    │   ├── CartDrawer.jsx          # سلة المشتريات وإتمام الطلب
    │   ├── ErrorBoundary.jsx       # معالجة الأخطاء غير المتوقعة
    │   ├── Header.jsx              # الترويسة وشريط التنقل والبحث
    │   ├── LanguageSwitcher.jsx    # محول اللغات والترجمة الفورية
    │   ├── MerchantDashboard.jsx   # لوحة تحكم التاجر وإدارة المنتجات والطلبات
    │   ├── OrderTrackerModal.jsx   # نافذة تتبع الطلبات
    │   ├── ProductDetailModal.jsx  # نافذة تفاصيل المنتج والمراجعات
    │   ├── ProductRatingSummary.jsx# ملخص التقييمات والنجوم
    │   ├── ProductReviews.jsx      # مراجعات وتقييمات العملاء
    │   ├── ProductShareMenu.jsx    # قائمة مشاركة المنتجات عبر الشبكات
    │   ├── ResilientImage.jsx      # عرض الصور بمرونة مع بدائل تلقائية
    │   └── ScrollToTopButton.jsx   # زر الصعود لأعلى الصفحة
    ├── data/
    │   └── seedCatalog.js          # بيانات المنتجات والكتالوج المبدئي
    ├── i18n/
    │   ├── messages.js             # قاموس النصوص والرسائل الافتراضية
    │   └── TranslationContext.jsx  # سياق إدارة وتحديث الترجمة بالذكاء الاصطناعي
    ├── lib/
    │   └── firebase.js             # تهيئة خدمات Firebase Auth و Firestore
    ├── services/
    │   └── storeService.js         # خدمات التفاعل مع قواعد البيانات والطلبات
    └── types/
        └── store.js                # معايير التحقق وثوابت المتجر
```

---

## 🚀 التشغيل المحلي (Local Development)

### 1. تثبيت الاعتماديات:
```bash
npm install
```

### 2. إعداد متغيرات البيئة:
قم بنسخ ملف `.env.example` إلى `.env`:
```bash
cp .env.example .env
```
وقم بإضافة مفتاح `GEMINI_API_KEY` الخاص بك من [Google AI Studio](https://aistudio.google.com/).

### 3. تشغيل بيئة التطوير:
```bash
# تشغيل واجهة Vite السريعة:
npm run dev

# أو تشغيل الخادم المتكامل مع واجهة الترجمة:
npm run server
```

### 4. بناء المشروع للإنتاج:
```bash
npm run build
```

---

## 🌐 النشر على Vercel (Deploy to Vercel)

المشروع مُعد بالكامل للنشر الفوري عبر **Vercel**:

### الطريقة الأولى: عبر Vercel CLI
```bash
npm i -g vercel
vercel
```

### الطريقة الثانية: عبر مستودع GitHub / GitLab
1. ارفع المشروع إلى مستودع GitHub.
2. توجه إلى لوحة تحكم [Vercel](https://vercel.com/) واضغط على **Add New Project**.
3. اختر المستودع، وسيتم التعرف تلقائياً على إعدادات **Vite**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `vite build`
   - **Output Directory**: `dist`
4. أضف متغيرات البيئة في قسم **Environment Variables**:
   - `GEMINI_API_KEY`: مفتاح Google Gemini API.
   - `VITE_FIREBASE_API_KEY` (اختياري في حال رغبتك بربط مشروع Firebase خاص).
   - `VITE_FIREBASE_PROJECT_ID` (اختياري).
   - `VITE_FIREBASE_AUTH_DOMAIN` (اختياري).
5. اضغط **Deploy**! سيعمل المتجر وواجهة الترجمة السحابية عبر Serverless Function (`/api/translate`) بدون أي تعديل إضافي.
