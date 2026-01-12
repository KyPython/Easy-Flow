# ✅ All 7 Culprit Files That Need Fixing

## 🔧 Backend Files (Performance & Auth)

### 1. `rpa-system/backend/app.js` — Line 3900

* **Route:** `GET /api/runs`
* **Problem:**
  Takes **1,364ms–1,785ms** (fetches **100 runs** on every request).
* **Fix:**
  Add pagination (`LIMIT 20`) and proper indexing.

---

### 2. `rpa-system/backend/routes/integrationRoutes.js`

* **Route:** `GET /api/integrations`
* **Problem:**
  Takes **~933ms** (queries the DB on every request).
* **Fix:**
  Implement **Redis or in-memory caching**.

---

### 3. `rpa-system/backend/app.js` — Line 6443

* **Route:** `GET /api/user/preferences`
* **Problem:**
  Takes **510ms–805ms** and is called frequently.
* **Fix:**
  Add caching (high-frequency endpoint).

---

### 4. `rpa-system/backend/app.js` — Line 6908

* **Route:** `POST /api/firebase/token`
* **Problem:**

  * Takes **~964ms**
  * Returns **401 Unauthorized**
  * Firebase **Project ID mismatch**
* **Fix:**

  * Optimize token generation
  * Verify Firebase ↔ Supabase Project ID alignment

---

## 🎨 Frontend Files (Duplicate Calls & Sequential Loading)

### 5. `rpa-system/rpa-dashboard/src/utils/LanguageContext.jsx` — Lines 35, 68

* **Problem:**
  Double-fetches `/api/user/preferences` on page load.
* **Fix:**
  Fetch **once** in a `useEffect` and store in state/context.

---

### 6. `rpa-system/rpa-dashboard/src/pages/IntegrationsPage.jsx` — Line 150

* **Problem:**
  Waterfall loading (API calls happen **sequentially**).
* **Fix:**
  Use `Promise.all()` to fetch integrations and user data **in parallel**.

---

## 🧠 Developer Experience (The “Blindness” Fix)

### 7. `rpa-system/rpa-dashboard/src/main.jsx` — Line 79

* **Problem:**
  Log sampling is enabled (**1/100**).
  You’re missing **99% of error logs**.
* **Fix:**
  Set:

  * `CONSOLE_LOG_SAMPLE_RATE = '1'` in `localStorage`, **or**
  * Hardcode it in this file during debugging

---

## 🚨 Priority Order to Fix

### 🔥 Immediate (Do These First)

1. **`main.jsx` (File 7)**
   Fix log sampling so you can actually *see* the real errors.
2. **`backend/app.js` (File 4)**
   Fix the Firebase **401 Unauthorized** error (hard feature blocker).
3. **`LanguageContext.jsx` (File 5)**
   Eliminate duplicate API calls to reduce backend load.

---

### ⚡ High-Impact Performance

4. **`backend/app.js` (File 1)**
   Add pagination to `GET /api/runs`.

---

## 🔍 Next Steps: Code Inspection

To implement the actual fixes, inspect the current logic using the commands below and paste the output.

### 1️⃣ Inspect `/api/runs`

```bash
sed -n '3890,4020p' rpa-system/backend/app.js
```

### 2️⃣ Inspect LanguageContext double-fetch

```bash
cat rpa-system/rpa-dashboard/src/utils/LanguageContext.jsx
```

### 3️⃣ Inspect Integrations route

```bash
cat rpa-system/backend/routes/integrationRoutes.js
```

### 4️⃣ Inspect log sampler

```bash
sed -n '70,90p' rpa-system/rpa-dashboard/src/main.jsx
```

---
