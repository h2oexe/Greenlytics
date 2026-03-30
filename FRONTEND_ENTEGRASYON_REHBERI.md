# Greenlytics - Frontend Entegrasyon Rehberi

Merhaba! Bu doküman, Greenlytics projesinin (uygulamasının) backend API'sini frontend tarafına (React/Vue/Angular vs.) entegre etmeniz için hazırlanmıştır. 

Proje, Clean Architecture prensipleriyle **.NET 8** kullanılarak yazılmış, **RESTful** standartlarına tamamen uyan modern bir backend yapısına sahiptir.

---

## 🚀 Projeyi (Backend'i) Kendi Bilgisayarında Çalıştırma

Geliştirme yaparken API'ye istek atmak için projeyi ayağa kaldırman gerekecek.
Sistem arka planda **PostgreSQL**, **Redis**, **Hangfire (Cron Jobs)**, **MinIO (Dosya depolama/S3)** ve SMTP (MailHog) kullanmaktadır. Tüm bunları tek tuşla kurabilmen için `docker-compose` eklendi.

### Adım 1: Altyapı servislerini başlat
Bilgisayarında Docker kuruluysa, projenin kök dizininde (Greenlytics klasöründe) şu komutu çalıştır:
```bash
docker-compose up -d
```

### Adım 2: API'yi başlat
Daha sonra backend uygulamasını (.NET 8) çalıştır:
```bash
cd src/Greenlytics.API
dotnet run
```
API varsayılan olarak **`http://localhost:5000`** portunda ayağa kalkacaktır.

### Adım 3: Swagger'ı Ziyaret Et (Tüm Uç Noktalar)
Projeyi çalıştırdıktan sonra tarayıcından şu adrese git:
👉 **[http://localhost:5000/swagger](http://localhost:5000/swagger)**

Burada, backend'de bulunan tüm endpointlerin listesini, ne gönderip ne alacağını (RequestBody, Path, Query vs.) etkileşimli olarak görüp test edebilirsin.

---

## 🔐 Kimlik Doğrulama (Authentication) ve Token Yönetimi

Sistem **JWT (JSON Web Token)** kullanmaktadır. Proje tamamen **Multi-Tenant** bir yapıya sahiptir. Yani her şirket kendi verisini görür. Ancak frontend'in backend'e "Bu x şirketidir" demesine gerek yoktur: Bu bilgi kullanıcının login olduktan sonra aldığı JWT Token'ın içine backend tarafından gizlice yerleştirilir.

1. **Giriş / Kayıt Ol**
   - Kayıt İçin: `POST /api/auth/register`
   - Giriş İçin: `POST /api/auth/login`
   👉 İşlem başarılı olduğunda backend sana `{ "accessToken": "ey...", "refreshToken": "...", "expiresAt": "..." }` dönecektir.

2. **İsteklere Token Ekleme**
   Giriş yaptıktan sonra diğer tüm uç noktalara (endpoints) istek atarken HTTP Header'ına token'ı eklemelisin:
   ```http
   Authorization: Bearer <SENIN_ACCESS_TOKENIN>
   ```

3. **Token Yenileme (Refresh Token)**
   Access Token'ın ömrü 15 dakikadır. Süresi bittiğinde kullanıcıyı çıkış (logout) yaptırmak **yerine**, `POST /api/auth/refresh` endpoint'ine elindeki Expire olmuş access token ve refresh token'ı göndererek yeni bir token çifti almalısın. (Bunu axios interceptors araya girerek otomatize edebilirsin).

---

## 📡 Temel API Yapısı (Endpoints)

Daha detaylı tüm endpoint'leri Swagger üzerinden görebilirsin ancak ana yapı şu şekildedir:

### 1. Veri Girişleri (Core Business)
Her bir modül için CRUD (Ekle, Sil, Güncelle, Oku) uç noktaları mevcuttur.

* **Enerji Tüketimi**: `/api/energy` => (`GET`, `POST`, `PUT /{id}`, `DELETE /{id}`)
* **Su Tüketimi**: `/api/water` => (`GET`, `POST`, `PUT /{id}`, `DELETE /{id}`)
* **Atık (Waste) Yönetimi**: `/api/waste` => (`GET`, `POST`, `PUT /{id}`, `DELETE /{id}`)
* **Karbon Salınım Girdileri**: `/api/carbon` => (`GET`, `POST`, `PUT /{id}`, `DELETE /{id}`)

**(Not: Bu uç noktalardan veri çekerken tarih aralığı filtrelemesi yapabilirsin: `?from=2024-01-01&to=2024-03-01`)**

### 2. Raporlar ve Dashboard Grafikleri
API senin için bütün toplamları, hesaplamaları (Örn: IPCC'ye göre Karbon ayak izi katsayı çarpımları) ve grafikleri hesaplar. Grafikler için sadece şu uç noktaları çağırman yeterlidir:

* `GET /api/reports/dashboard` : Ana ekrandaki Dashboard kartları için (Bu ayki Toplam KWH enerji, toplam Su vs.) ve grafik dataları her şeyiyle hazır gelir.
* `GET /api/reports/summary` : Seçilen tarih aralığına ait salt özet toplamı verir.
* `GET /api/reports/trends` : Aydan aya (veya yıldan yıla) değişim oranlarını (%15 Karbon azaldı vs.) sana hazır döner. Dashboard trend oklarında kullanabilirsin.

### 3. Hedefler (Goals)
Şirketler örneğin "%20 daha az su kullanacağız" diyebilir.
* `GET /api/goals/{id}/progress` : Belirtilen hedefin güncel ilerleme yüzdesini (%85 vs) hesaplayıp döner. Progress Bar'larda kullanabilirsin.

### 4. Dışa Aktarma (Export)
Backend Pro/Enterprise plana sahip kullanıcılar için PDF, CSV, ve Excel (XLSX) raporları basar.
* `POST /api/export/pdf`
* `POST /api/export/excel`
Bu endpoint'leri çağırdığında sana Base64/ByteArray **dönmez**. Arka planda dosyayı üretir, AWS S3 (lokaldeki MinIO) sunucusuna yükler ve sana **tek kullanımlık imzalı bir indirme bağlantısı (downloadUrl)** döner. Frontend'de a/href ya da `window.open(url)` diyerek direkt dosyayı indirtebilirsin. 

---

## ⚠️ Hata Yönetimi (Error Handling) ve HTTP Kodları

Sistem RFC Data standartlarında sana hata döner:

* `400 Bad Request` : Geçersiz veri girdin (Örn Email formatı yanlış veya zorunlu bir alan unutuldu). Sana bir dizi hatası (Validasyon hataları) ile birlikte geri gönderilir.
* `401 Unauthorized` : Token eksik, süresi geçmiş veya hatalı.
* `402 Payment Required` : Seçilen plan limiti aşıldı (Örn: Standart paketlisiniz, artık veri giremezsiniz veya Export yapamazsınız). UI tarafında "Paketinizi Yükseltin" modal'ı çıkartabilirsin.
* `403 Forbidden` : Kullanıcının bunu yapmaya yetkisi yok (O role sahip değil).
* `404 Not Found` : Aranan kayıt (Id vb.) şirkette bulunamadı.
* `500 Server Error` : Bizden kaynaklanıyor :) Bize bildirin.

---
**Özetle:** Sana iş bırakmamak için tüm zor veri mantığını, filtrelemeyi, ve veri yetkilendirme katmanını backend kendi çözüyor. Senin tek yapman gereken Swagger'daki Endpointleri takip ederek ilgili Payload'ları (verileri) backend'e atmak ve dönen listeyi/veriyi ekrana React/Vue vb. kullanarak çizmek! 

Kolay gelsin 🎉
