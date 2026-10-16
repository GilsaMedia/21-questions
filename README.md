# 21 שאלות

חידון של 21 שאלות בפורמט של "20 שאלות" מהארץ: רואים שאלה, חושבים, חושפים את התשובה ומסמנים "צדקתי" או "טעיתי".
רק המנהלים כותבים שאלות. כל השאר רק עונים, ולא צריך להוסיף אותם לשום מקום: הקישור מספיק.

- **אפליקציה למשתתפים**: אתר React + Vite שמתקינים במסך הבית (PWA). לא צריך להתחבר, וההתקדמות נשמרת רק בטלפון של כל אחד.
- **מסך ניהול**: `‎<כתובת האתר>#/admin`. נכנסים עם חשבון Google. הבעלים (`gilsalinas639@gmail.com`) יכול להוסיף מנהלים נוספים במסך **מנהלים**.
- **אבטחה**: השאלות והתשובות נעולות בשרת עד מועד הפרסום (`firestore.rules`), כך שגם מי שמחטט בקוד לא יראה אותן מראש.
- **התראות**: GitHub Actions בודק כל ~10 דקות אם התפרסם חידון חדש ושולח Push (`scripts/notify.mjs`).
- **עלות**: 0 ₪. משתמשים במסלול החינמי של Firebase (Spark), ב-GitHub Pages וב-GitHub Actions.

## הקמה (פעם אחת, כחצי שעה)

### 1. פרויקט Firebase
1. נכנסים ל-https://console.firebase.google.com ויוצרים פרויקט חדש (אפשר לכבות את Analytics).
2. **Project settings → General → Your apps**: לוחצים על אייקון ה-Web `</>` ורושמים אפליקציה. את הערכים מ-`firebaseConfig` מעתיקים ל-`public/config.js`.
3. **Build → Firestore Database → Create database**: בוחרים מיקום (למשל `me-west1` בתל אביב) ו-Production mode.
4. בלשונית **Rules** מדביקים את כל התוכן של `firestore.rules` ולוחצים Publish.
5. **Build → Authentication → Get started → Sign-in method**: מפעילים את **Google**.
6. **Project settings → Cloud Messaging → Web Push certificates → Generate key pair**: מעתיקים את המפתח ל-`vapidKey` ב-`public/config.js`.
7. שומרים את `public/config.js` ב-GitHub (commit + push). האתר ייבנה מחדש לבד.

### 2. GitHub
ה-repo הוא https://github.com/GilsaMedia/21-questions (ציבורי, כי ב-repo פרטי הדקות החינמיות של Actions לא מספיקות לבדיקה כל 10 דקות).
GitHub Pages כבר מוגדר: כל push ל-`main` בונה ומעלה את האתר ל-https://gilsamedia.github.io/21-questions/ .

1. ב-Firebase, ב-**Authentication → Settings → Authorized domains**, מוסיפים את `gilsamedia.github.io`.

### 3. התראות
1. ב-Firebase, ב-**Project settings → Service accounts → Generate new private key**, מורידים קובץ JSON. **לא מעלים אותו ל-repo!**
2. ב-GitHub, ב-**Settings → Secrets and variables → Actions**:
   - בלשונית **Secrets** יוצרים `FIREBASE_SERVICE_ACCOUNT` ומדביקים בו את כל התוכן של קובץ ה-JSON.
3. בלשונית **Actions** בוחרים `notify` ולוחצים Run workflow כדי לוודא שהוא עובר.

### 4. נעילת מפתח ה-API (מומלץ, 2 דקות)
ב-https://console.cloud.google.com/apis/credentials (בוחרים את הפרויקט) פותחים את **Browser key (auto created by Firebase)**:
- **Application restrictions → Websites**, ומוסיפים:
  `https://gilsamedia.github.io/*`, `https://<PROJECT_ID>.firebaseapp.com/*`, `http://localhost:5173/*`
- שומרים.

## אבטחה: למה מותר שמפתח ה-API יהיה בקוד הציבורי
- **ה-`apiKey` של Firebase הוא לא סיסמה.** הוא רק מזהה את הפרויקט, כל מי שנכנס לאתר מקבל אותו לדפדפן בכל מקרה, ו-Google מתעדת במפורש שמותר לפרסם אותו.
- **מה שמגן על המידע זה `firestore.rules`**, והן נאכפות בשרת:
  - שאלות ותשובות נעולות עד מועד הפרסום.
  - רק מנהלים יכולים לכתוב, ורק הבעלים יכול להוסיף מנהלים.
  - אף אחד לא יכול לקרוא את רשימת המכשירים להתראות.
- **הנעילה בשלב 4** מונעת מאתרים אחרים להשתמש במפתח שלך.
- **אין כרטיס אשראי**, אז גם במקרה הגרוע ביותר (מישהו מציף את הפרויקט) לא יכול להגיע חיוב. לכל היותר האתר יפסיק לעבוד עד סוף היום.
- **הסוד האמיתי היחיד הוא קובץ ה-JSON של ה-service account** משלב 3. הוא נותן גישה מלאה, ולכן הוא נשמר רק ב-GitHub Secrets. לא שולחים אותו בצ'אט ולא מעלים אותו ל-repo.

## מנהלים
- הבעלים נכנס ל-`#/admin`, לוחץ **מנהלים** ומוסיף כתובת Gmail.
- מאותו רגע אותו אדם יכול להיכנס למסך הניהול ולכתוב, לערוך ולפרסם חידונים. הוא לא יכול להוסיף מנהלים אחרים.
- כדי להחליף את הבעלים, מעדכנים את המייל גם ב-`firestore.rules` (ומפרסמים אותם מחדש ב-Firebase) וגם ב-`public/config.js`.

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
