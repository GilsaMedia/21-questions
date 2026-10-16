# 21 שאלות

חידון של 21 שאלות בפורמט של "20 שאלות" מהארץ: רואים שאלה, חושבים, חושפים את התשובה ומסמנים "צדקתי" או "טעיתי".
רק המנהל כותב שאלות. כל השאר רק עונים.

- **אפליקציה למשתתפים**: אתר React + Vite שמתקינים במסך הבית (PWA). לא צריך להתחבר, וההתקדמות נשמרת רק בטלפון של כל אחד.
- **מסך ניהול**: `‎<כתובת האתר>#/admin`. נכנסים עם חשבון Google, ורק כתובת המייל של המנהל יכולה לכתוב.
- **אבטחה**: השאלות והתשובות נעולות בשרת עד מועד הפרסום (`firestore.rules`), כך שגם מי שמחטט בקוד לא יראה אותן מראש.
- **התראות**: GitHub Actions בודק כל ~10 דקות אם התפרסם חידון חדש ושולח Push (`scripts/notify.mjs`).
- **עלות**: 0 ₪. משתמשים במסלול החינמי של Firebase (Spark), ב-GitHub Pages וב-GitHub Actions.

## הקמה (פעם אחת, כחצי שעה)

### 1. פרויקט Firebase
1. נכנסים ל-https://console.firebase.google.com ויוצרים פרויקט חדש (אפשר לכבות את Analytics).
2. **Project settings → General → Your apps**: לוחצים על אייקון ה-Web `</>` ורושמים אפליקציה. את הערכים מ-`firebaseConfig` מעתיקים ל-`public/config.js`.
3. **Build → Firestore Database → Create database**: בוחרים מיקום (למשל `me-west1` בתל אביב) ו-Production mode.
4. בלשונית **Rules** מדביקים את התוכן של `firestore.rules`, אחרי שמחליפים את `replace_me@gmail.com` במייל שלכם (באותיות קטנות), ולוחצים Publish.
5. **Build → Authentication → Get started → Sign-in method**: מפעילים את **Google**.
6. **Project settings → Cloud Messaging → Web Push certificates → Generate key pair**: מעתיקים את המפתח ל-`vapidKey` ב-`public/config.js`.
7. ב-`public/config.js` מעדכנים גם את `adminEmail` לאותו מייל.

### 2. GitHub
1. מעלים את התיקייה ל-repository **ציבורי**. הקוד לא מכיל סודות, והשאלות נמצאות רק ב-Firebase.
   ב-repo פרטי, הדקות החינמיות של Actions לא מספיקות לבדיקה כל 10 דקות.
2. **Settings → Pages → Source**: בוחרים **GitHub Actions**. מעכשיו כל push ל-`main` בונה ומעלה את האתר אוטומטית (`.github/workflows/deploy.yml`).
   כתובת האתר תהיה `https://<USER>.github.io/<REPO>/`.
3. ב-Firebase, ב-**Authentication → Settings → Authorized domains**, מוסיפים את `<USER>.github.io`.

### 3. התראות
1. ב-Firebase, ב-**Project settings → Service accounts → Generate new private key**, מורידים קובץ JSON. **לא מעלים אותו ל-repo!**
2. ב-GitHub, ב-**Settings → Secrets and variables → Actions**:
   - בלשונית **Secrets** יוצרים `FIREBASE_SERVICE_ACCOUNT` ומדביקים בו את כל התוכן של קובץ ה-JSON.
   - בלשונית **Variables** יוצרים `SITE_URL` עם כתובת האתר המלאה.
3. בלשונית **Actions** בוחרים `notify` ולוחצים Run workflow כדי לוודא שהוא עובר.

## שימוש שוטף
1. נכנסים ל-`<כתובת האתר>#/admin` ולוחצים **+ חידון חדש**. מועד הפרסום ממולא מראש לשבועיים אחרי החידון הקודם.
2. ממלאים 21 שאלות ותשובות, ואפשר להוסיף תמונה לכל שאלה. התמונה מוקטנת אוטומטית.
3. **שמירה** עם מועד פרסום מתזמנת את החידון, ושמירה בלי מועד שומרת אותו כטיוטה. **פרסום עכשיו** מפרסם מיד.
4. במועד הפרסום השאלות נפתחות לכולם, וההתראה יוצאת תוך כ-10–15 דקות.
   לפעמים GitHub מתעכב, ואז זה יכול לקחת קצת יותר.

## למשתתפים (כדאי לשלוח עם הקישור)
- **אייפון**: פותחים את הקישור ב-Safari ולוחצים שיתוף ← "הוספה למסך הבית". פותחים את האפליקציה ממסך הבית ולוחצים "תודיעו לי כשיש חידון חדש".
  באייפון, התראות עובדות רק מאפליקציה שהותקנה במסך הבית (iOS 16.4 ומעלה).
- **אנדרואיד**: פותחים ב-Chrome, מתקינים מהכפתור או מהתפריט, ומאשרים התראות.

## פיתוח מקומי
```
npm install
npm run dev      # שרת פיתוח
npm run build    # בנייה לתיקיית dist
```

## מבנה
```
src/
  App.jsx           ניתוב (hash) בין המסכים
  pages/Home.jsx    דף הבית: החידון האחרון, ספירה לאחור, ארכיון, התראות
  pages/Quiz.jsx    משחק החידון ומסך התוצאות
  pages/Admin.jsx   מסך הניהול (נטען רק כשנכנסים אליו)
  lib/              עזרים: התקדמות, פורמט תאריכים, התראות, ניתוב
public/
  config.js         ההגדרות של Firebase (משותף לאתר ול-service worker)
  sw.js             Service worker: עבודה בלי רשת והצגת התראות
firestore.rules     הרשאות: מי יכול לקרוא ולכתוב מה
scripts/notify.mjs  שליחת ההתראות (רץ ב-GitHub Actions)
```
