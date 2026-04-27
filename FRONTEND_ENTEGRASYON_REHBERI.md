# Greenlytics Frontend Entegrasyon Rehberi

Bu doküman, Greenlytics frontend tarafında çalışan biri için backend API yüzeyini ve geliştirme akışını hızlıca anlamak amacıyla güncellenmiştir.

## Geliştirme Akışı

### Backend ve servisleri başlat

Proje kökünde:

```bash
docker compose up -d
```

Bu komut API ile birlikte veritabanı ve yardımcı servisleri de başlatır. Normal frontend geliştirme akışında ayrıca `dotnet run` açman gerekmez.

### Frontend’i başlat

```bash
cd frontend
npm install
npm run dev
```

Not:
Vite artık `0.0.0.0` üzerinden dinler. Aynı yerel ağdaki başka cihazlar frontend'e host makinenin IP adresiyle bağlanabilir.

### Gerekli adresler

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/swagger`
- Health: `http://localhost:5000/health`

Yerel ağ örneği:

- Frontend: `http://<host-ip>:5173`
- API: `http://<host-ip>:5000`

## Ortam Değişkeni

`frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:5000
```

## Kimlik Doğrulama

Sistem JWT kullanır.

Temel endpoint’ler:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

Başarılı giriş sonrası tüm korumalı isteklerde:

```http
Authorization: Bearer <access_token>
```

Refresh akışı frontend içinde hazırdır; `401` alınırsa refresh endpoint’i üzerinden token yenileme denenir.

## Uygulamadaki Ana Modüller

### Dashboard

- `GET /api/reports/dashboard`

Dashboard şu verileri kullanır:

- aylık özet
- kategori kırılımı
- karbon trendi
- aktif hedefler
- bildirim sayısı

### Energy

- `GET /api/energy`
- `POST /api/energy`
- `PUT /api/energy/{id}`
- `DELETE /api/energy/{id}`

Desteklenen yaygın query parametreleri:

- `page`
- `pageSize`
- `from`
- `to`
- `category`

### Water

- `GET /api/water`
- `POST /api/water`
- `PUT /api/water/{id}`
- `DELETE /api/water/{id}`

### Waste

- `GET /api/waste`
- `POST /api/waste`
- `PUT /api/waste/{id}`
- `DELETE /api/waste/{id}`

Ek filtreler:

- `category`
- `recyclable`
- `from`
- `to`

### Carbon

- `GET /api/carbon`
- `POST /api/carbon`
- `PUT /api/carbon/{id}`
- `DELETE /api/carbon/{id}`

### Goals

- `GET /api/goals`
- `POST /api/goals`
- `GET /api/goals/progress/all`
- `GET /api/goals/{id}/progress`

### Reports / Exports

- `GET /api/export/history`
- `POST /api/export/pdf`
- `POST /api/export/excel`
- `POST /api/export/csv`

Not:
Export endpoint’leri byte array dönmez. Backend dosyayı üretir ve indirilebilir bir link döner.

### Settings / Plan / Yönetim

- `GET /api/subscriptions/current`
- `GET /api/subscriptions/plans`
- `GET /api/apikeys`
- `POST /api/apikeys`
- `GET /api/notifications`
- `GET /api/notifications/webhooks`

Bazı endpoint’ler plan seviyesine göre `403` dönebilir. Bu hata değil, ürün kısıtıdır.

## Frontend Tarafında Şu Anda Hazır Olanlar

- Auth ekranları
- App shell
- Sidebar ve topbar
- Global search
- Dashboard
- Energy / Water / Waste / Carbon CRUD ekranları
- Goals
- Exports
- Settings
- Toast sistemi
- Confirm modal
- Loading / empty / error state bileşenleri

## UI ve Yetki Notları

- `Admin` ve `Manager` rolleri kayıt ekleme, güncelleme ve silme yapabilir.
- `Viewer` rolü ekranları görebilir ama veri yazamaz.
- Bazı plan özellikleri backend tarafından kapatılır; frontend’de buna göre açıklayıcı durum göstermek gerekir.

## Hata Kodları

Genel olarak şu davranışlar beklenir:

- `400`: doğrulama veya iş kuralı hatası
- `401`: token yok veya geçersiz
- `403`: yetki ya da plan kısıtı
- `404`: kayıt bulunamadı
- `500`: beklenmeyen sunucu hatası

## Önerilen Günlük Akış

1. `docker compose up -d`
2. `cd frontend && npm run dev`
3. `http://localhost:5000/swagger` ile endpoint doğrula
4. `http://localhost:5173` üzerinden ekranı geliştir

## Not

Repo içinde bazı eski dosyalarda geçmişten kalma encoding bozulmaları olabilir. Yeni eklenen veya güncellenen dokümanlar UTF-8 olarak düzenlenmiştir.
