# LOCO — لعبة إكس أو أونلاين

مشروع Flask + Flask-SocketIO + Bootstrap 5 + JavaScript عادي (بدون React/Vue).
**DESIGNED BY EL-GRINGO**

## المميزات

- لعب جماعي فوري (غرفة لكل لاعبين، والسيرفر هو الذي يتحقق من كل حركة)
- اللعب ضد الكمبيوتر (سهل / متوسط / صعب لا يُهزم) عندما لا يوجد رفيق
- إعادة اللعبة برسالة تأكيد، وفي اللعب الجماعي تحتاج موافقة الخصم، وتحذير قبل تحديث الصفحة أو الخروج أثناء لعبة جارية
- صوت وإشعار خفيف عند وصول رسالة نصية
- تصميم LOCO: وضع داكن/فاتح، عربي/إنجليزي مع RTL/LTR، متجاوب مع كل الشاشات
- موسيقى خلفية + مؤثرات صوتية اختيارية + التحكم في الصوت
- دردشة نصية فورية (لوحة جانبية على الكمبيوتر، ونافذة سفلية Offcanvas على الجوال)
- دردشة صوتية اختيارية عبر WebRTC (الصوت مباشر بين اللاعبَين، والسيرفر للإشارات فقط)

## هيكل المشروع

```
mywebsite/
├── app.py                 السيرفر (الغرف، الحركات، الدردشة، إشارات الصوت)
├── requirements.txt
├── templates/index.html   الصفحة الوحيدة
└── static/
    ├── css/style.css
    ├── js/app.js          الترجمة، المظهر، اللغة، الصوت
    ├── js/game.js         الاتصال، اللوبي، اللوحة
    ├── js/chat.js         الدردشة النصية
    ├── js/bot.js          الكمبيوتر (الخصم)
    ├── js/voice.js        الدردشة الصوتية (WebRTC)
    └── audio/             background.mp3 / click.mp3 / win.mp3 / message.mp3
```

## التشغيل

```bash
cd mywebsite
python -m venv venv
venv\Scripts\activate          # ويندوز  (لينكس/ماك: source venv/bin/activate)
pip install -r requirements.txt
python app.py
```

افتح: http://localhost:5000

للتجربة بين متصفحين: افتح نافذتين (أو نافذة عادية ونافذة تصفح خفي)، أنشئ غرفة في الأولى وانضم بنفس الرمز في الثانية.

## الدردشة الصوتية: HTTPS و TURN

**1) HTTPS مطلوب.** المتصفحات لا تسمح بالميكروفون إلا في `https://` أو `localhost`.
لذلك على نفس الجهاز يعمل كل شيء عبر `localhost`، لكن من جهاز آخر عبر `http://192.168.x.x:5000` لن يعمل الميكروفون (وسيظهر في اللعبة تنبيه واضح، واللعب والدردشة النصية يستمران).
حلول: نشر الموقع خلف HTTPS (الأفضل)، أو استخدام نفق مثل Cloudflare Tunnel / ngrok للتجربة، أو:

```bash
LOCO_SSL_CERT=cert.pem LOCO_SSL_KEY=key.pem python app.py
```

**2) STUN وحده لا يكفي دائماً.** بعض الشبكات (خصوصاً شبكات الجوال والشبكات المقيِّدة) تمنع الاتصال المباشر،
ولذلك يلزم سيرفر **TURN** حتى يعمل الصوت بين أي شبكتين. اضبطه بمتغيرات البيئة (لا تكتب كلمات السر داخل الكود):

| المتغير | المعنى | مثال |
|---|---|---|
| `LOCO_STUN_URLS` | سيرفرات STUN (بفاصلة) | `stun:stun.l.google.com:19302` (الافتراضي) |
| `LOCO_TURN_URLS` | سيرفرات TURN (بفاصلة) | `turn:turn.example.com:3478,turns:turn.example.com:5349` |
| `LOCO_TURN_USERNAME` | اسم مستخدم TURN | `loco` |
| `LOCO_CF_TURN_KEY_ID` / `LOCO_CF_TURN_API_TOKEN` | Cloudflare TURN (انظر القسم التالي) | |
| `LOCO_METERED_DOMAIN` / `LOCO_METERED_API_KEY` | Metered.ca TURN | |
| `LOCO_TURN_CREDENTIAL` | كلمة سر TURN | `********` |

ويندوز (PowerShell):

```powershell
$env:LOCO_TURN_URLS="turn:turn.example.com:3478"
$env:LOCO_TURN_USERNAME="loco"
$env:LOCO_TURN_CREDENTIAL="كلمة-السر"
python app.py
```

نموذج إعداد **coturn** على سيرفر لينكس (ملف `/etc/turnserver.conf`):

```
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
user=loco:كلمة-سر-قوية
realm=turn.example.com
cert=/etc/letsencrypt/live/turn.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem
min-port=49152
max-port=65535
no-cli
```

افتح في الجدار الناري: `3478` (UDP+TCP) و`5349` (TCP) والنطاق `49152-65535` (UDP).

> كلمة سر TURN تصل إلى متصفح اللاعبَين داخل الغرفة (هذا طبيعي في WebRTC)، فاستخدم حساباً مخصصاً لهذا الغرض فقط.


## الدردشة الصوتية على Render (شبكات ودول مختلفة)

**سبب المشكلة:** الصوت يمر مباشرة بين جهازَي اللاعبَين. إذا كانا على نفس الشبكة يعمل بـ STUN، أما على شبكتين مختلفتين
فغالباً يحتاج الاتصال إلى **سيرفر TURN** يمرّر الصوت بينهما. ولا يمكن تشغيل سيرفر TURN نفسه على Render
(الخدمة لا تفتح منافذ UDP/TCP المطلوبة)، لذلك الحل هو استخدام خدمة TURN جاهزة. التطبيق يدعم اثنتين، وتُضبطان من
**Environment Variables** في Render (ولا تُكتب المفاتيح في الكود أو على GitHub):

### الخيار 1: Cloudflare Realtime TURN (موصى به)

حسب توثيق Cloudflare فالطبقة المجانية هي أول 1000 جيجابايت شهرياً، لكن تأكد من الشروط الحالية في حسابك.

1. داخل حساب Cloudflare افتح **Realtime → TURN** وأنشئ **TURN Key** (ستحصل على `Key ID` و`API Token`).
2. أضف في Render:

| المتغير | القيمة |
|---|---|
| `LOCO_CF_TURN_KEY_ID` | الـ Key ID |
| `LOCO_CF_TURN_API_TOKEN` | الـ API Token |

التطبيق يطلب من Cloudflare بيانات دخول مؤقتة (24 ساعة) من السيرفر ويعطيها للاعبَين فقط داخل الغرفة.

### الخيار 2: Metered.ca

أنشئ حساباً وتطبيقاً ثم أضف: `LOCO_METERED_DOMAIN` (مثل `myapp.metered.live`) و`LOCO_METERED_API_KEY`.
فيه طبقة مجانية، راجع حدودها الحالية في موقعهم.

### بعد الإضافة

أعد النشر (Manual Deploy). إذا فشل الاتصال ولم يكن TURN مضبوطاً سيظهر للاعب تنبيه يشرح السبب.
للتأكد: جرّب مكالمة بين جهازين على شبكتين مختلفتين (واي فاي وبيانات الجوال).
راجع سجلات Render: لو ظهر `TURN provider ... failed` فالمفتاح غير صحيح أو الخدمة غير متاحة.

### إعداد Render المقترح

- **Root Directory:** المجلد الذي فيه `app.py` (مثلاً `el-loco` إن بقي المشروع داخله)
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn --threads 100 -w 1 app:app` (يُكتب في إعدادات Render نفسها؛ Render لا يقرأ ملف `Procfile`). لا تستخدم `-k eventlet` أو `-k gevent` لأن المكتبتين غير موجودتين في `requirements.txt`
- عملية واحدة فقط (`-w 1`) لأن الغرف محفوظة في الذاكرة. الخطة المجانية تنام عند عدم الاستخدام وتُفقد الغرف عند إعادة التشغيل.

## النشر (Production)

- شغّل بدون وضع التطوير: `LOCO_DEBUG=0`، وضع مفتاحاً سرياً ثابتاً: `LOCO_SECRET_KEY=...`
- ضع التطبيق خلف Nginx/Caddy مع HTTPS. إعداد Nginx للـ WebSocket:

```nginx
location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

- الغرف محفوظة في ذاكرة العملية، لذلك استخدم **عملية واحدة (worker واحد)**. مثال حسب توثيق Flask-SocketIO (وضع threading): `pip install gunicorn` ثم
  `gunicorn --threads 100 -w 1 app:app`
- ملفات Bootstrap وSocket.IO تُحمَّل من CDN. لتشغيل بلا إنترنت نزّلها داخل `static/` وغيّر الروابط في `index.html` (و`BS_LTR`/`BS_RTL` في `app.js`).

## حدود وإعدادات الدردشة (في `app.py`)

`CHAT_MAX_LENGTH = 200` حرف، `CHAT_RATE_LIMIT = 5` رسائل كل `CHAT_RATE_WINDOW = 5` ثوانٍ.
الرسائل تُعرض كنص فقط (`textContent`) فلا يمكن حقن HTML.

## قائمة اختبار سريعة

1. لاعبان في متصفحين: لعبة كاملة (فوز، تعادل، إعادة لعب، العودة للوبي).
2. دردشة من الطرفين بالعربي والإنجليزي، ورسالة `<b>test</b>` يجب أن تظهر كنص.
3. عرض الجوال: لا تمرير أفقي، زر الدردشة يفتح النافذة السفلية.
4. تبديل اللغة والمظهر ثم تحديث الصفحة: الاختيار يُحفظ.
5. الصوت: مكالمة، قبول/رفض، كتم الميكروفون والسماعة، إنهاء المكالمة، وإغلاق أحد اللاعبين للصفحة أثناء المكالمة.
6. المكالمة بين شبكتين مختلفتين (مثلاً واي فاي وبيانات الجوال) تحتاج TURN مضبوطاً.
