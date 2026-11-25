# 🚀 Instagram Reel Comment-to-DM Auto-Reply Bot (ManyChat Alternative)

यह बॉट आपकी इंस्टाग्राम रील्स (Instagram Reels) पर किसी भी खास शब्द (जैसे **`LINK`**) के कमेंट होते ही यूजर को उनके **Instagram DM (Direct Message)** में ऑटोमैटिकली आपका लिंक भेज देता है और कमेंट के नीचे भी रिप्लाई कर देता है।

---

## 📁 प्रोजेक्ट स्ट्रक्चर

- `app.py`: मुख्य Webhook सर्वर जो Instagram से कमेंट इवेंट्स कैप्चर करके DM सेंड करता है।
- `.env`: आपकी सीक्रेट सेटिंग्स (टोकन, ट्रिगर कीवर्ड, लिंक, मैसेज टेम्पलेट)।
- `requirements.txt`: ज़रूरी Python लाइब्रेरीज़ (`flask`, `requests`, `python-dotenv`).

---

## 🛠️ स्टेप-बाय-स्टेप सेटअप गाइड (5 आसान स्टेप्स)

### स्टेप 1: इंस्टाग्राम अकाउंट की तैयारी
1. आपका इंस्टाग्राम अकाउंट **Professional (Creator या Business)** होना चाहिए।
   - मोबाइल ऐप में: *Settings -> Account -> Switch to Professional Account*.
2. अपने इंस्टाग्राम अकाउंट को अपने किसी **Facebook Page** से लिंक करें।
3. इंस्टाग्राम सेटिंग्स में जाएं: *Settings -> Messages and story replies -> Message controls* -> **Allow access to messages** को **ON** रखें।

---

### स्टेप 2: Meta for Developers पर ऐप बनाएं (Free)
1. **[developers.facebook.com](https://developers.facebook.com/)** पर जाएं और लॉगिन करें।
2. **My Apps -> Create App** पर क्लिक करें।
3. **Use case / Type** में **"Other"** या **"Authenticate and request data from users with Facebook Login"** चुनें।
4. ऐप का नाम रखें (जैसे: `MyReelBot`).
5. डैशबोर्ड में जाकर **Instagram** और **Messenger / Webhooks** प्रोडक्ट्स जोड़ें।
6. **Graph API Explorer** या **App Roles** में जाकर अपने फेसबुक पेज और इंस्टाग्राम अकाउंट को परमिशन दें:
   - `instagram_basic`
   - `instagram_manage_comments`
   - `instagram_manage_messages`
   - `pages_read_engagement`
   - `pages_manage_metadata`
7. यहाँ से **Page Access Token** जनरेट करें और कॉपी कर लें।

---

### स्टेप 3: अपनी `.env` फ़ाइल सेट करें
`.env` फ़ाइल खोलें और अपनी डिटेल्स भरें:
```env
VERIFY_TOKEN=insta_bot_secret_token_123
PAGE_ACCESS_TOKEN=यहाँ_अपना_Meta_Page_Access_Token_पेस्ट_करें
TRIGGER_KEYWORD=LINK
LINK_TO_SEND=https://yourwebsite.com/special-offer
```

---

### स्टेप 4: बॉट को रन करें
टर्मिनल / कमांड प्रॉम्प्ट में:
```bash
# लाइब्रेरीज़ इनस्टॉल करें
pip install -r requirements.txt

# बॉट चालू करें
python app.py
```
यह लोकल पोर्ट **5000** पर चालू हो जाएगा (`http://localhost:5000`).

---

### स्टेप 5: Webhook को लाइव करें (ngrok या Live Server)
चूँकि Meta को एक पब्लिक HTTPS URL चाहिए होता है, टेस्टिंग के लिए **ngrok** इस्तेमाल करें:
```bash
ngrok http 5000
```
ngrok आपको एक लिंक देगा (जैसे `https://abcd-1234.ngrok-free.app`).

1. Meta Developer Portal पर अपने ऐप के **Webhooks** सेक्शन में जाएं।
2. **Instagram** सेलेक्ट करें और **Subscribe to this object** दबाएं।
3. **Callback URL** में डालें: `https://abcd-1234.ngrok-free.app/webhook`
4. **Verify Token** में डालें: `insta_bot_secret_token_123` (जो `.env` में रखा है).
5. **Verify and Save** पर क्लिक करें।
6. नीचे फ़ील्ड्स में **`comments`** और **`messages`** को **Subscribe** कर दें!

---

## 🎯 टेस्टिंग कैसे करें?
1. अपने किसी दूसरे इंस्टाग्राम अकाउंट से अपनी किसी Reel पर कमेंट करें: **`LINK`**
2. आपके टर्मिनल पर तुरंत लॉग दिखेगा:
   `New comment from @username: 'LINK'`
3. और उस यूजर के Instagram इनबॉक्स में तुरंत आपका लिंक पहुँच जाएगा! 🚀
