# Greenlytics

Greenlytics, şirketlerin sürdürülebilirlik verilerini tek panelde yönetebilmesi için geliştirilen çok kiracılı bir SaaS uygulamasıdır. Uygulama; enerji, su, atık ve karbon verilerini toplar, dashboard üzerinden özetler, hedef takibi yapar ve dışa aktarım akışlarını destekler.

Bu repo şu anda iki ana parçadan oluşur:

- `src/`: .NET 8 tabanlı backend
- `frontend/`: React + Vite tabanlı frontend

## Proje Yapısı

```text
Greenlytics/
├── frontend/                      # React + Vite frontend
├── src/
│   ├── Greenlytics.API            # Web API
│   ├── Greenlytics.Application    # Uygulama katmanı
│   ├── Greenlytics.Domain         # Domain modelleri
│   └── Greenlytics.Infrastructure # Veri erişimi, dış servisler, background jobs
├── tests/                         # Test projesi
├── docker-compose.yml             # PostgreSQL, Redis, MinIO, MailHog ve API
└── FRONTEND_ENTEGRASYON_REHBERI.md
```

## Hızlı Başlangıç

### 1. Backend ve altyapıyı ayağa kaldır

Proje kökünde:

```bash
docker compose up -d
```

Bu komut şunları ayağa kaldırır:

- `postgres`
- `redis`
- `minio`
- `mailhog`
- `api`

Not: Uygulama başlangıcında gerekli tablolar ve temel plan seed verileri backend tarafından oluşturulur. Lokal geliştirmede ayrıca migration komutu çalıştırman çoğu durumda gerekmez.

### 2. Frontend bağımlılıklarını kur

```bash
cd frontend
npm install
```

### 3. Frontend ortam değişkenini ayarla

`frontend/.env` dosyasını oluştur:

```bash
VITE_API_BASE_URL=http://localhost:5000
```

### 4. Frontend geliştirme sunucusunu başlat

```bash
npm run dev
```

## Lokal Erişim Adresleri

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/swagger`
- Health: `http://localhost:5000/health`
- MailHog: `http://localhost:8025`
- MinIO Console: `http://localhost:9001`
- Hangfire: `http://localhost:5000/hangfire`

## Uygulamada Şu Anda Olanlar

Frontend tarafında şu modüller çalışır durumda:

- Auth: giriş ve kayıt ol
- Dashboard: KPI kartları, trendler, kırılımlar, akıllı içgörüler
- Energy
- Water
- Waste
- Carbon
- Goals
- Reports / Exports
- Settings
- Global search
- Toast, confirm modal, loading, empty ve error state akışları

Backend tarafında öne çıkan özellikler:

- JWT tabanlı kimlik doğrulama
- Çok kiracılı veri izolasyonu
- Dashboard ve raporlama endpoint’leri
- Plan bazlı yetki ve limit mantığı
- Export geçmişi ve dosya link akışları
- Audit log middleware

## Sık Kullanılan Komutlar

### Tüm servisleri başlat

```bash
docker compose up -d
```

### Servisleri durdur

```bash
docker compose down
```

### Frontend geliştirme sunucusu

```bash
cd frontend
npm run dev
```

### Frontend production build

```bash
cd frontend
npm run build
```

### Backend solution build

```bash
dotnet build Greenlytics.sln
```

### Testleri çalıştır

```bash
dotnet test tests/Greenlytics.Tests/Greenlytics.Tests.csproj
```

## Görsel Dosyalar

`frontend/public/` altında UI tarafından beklenen iki görsel vardır:

- `login-forest.jpg`
- `dashboard-spotlight.png`

Detaylar için:
[README.md](/c:/Users/stajyer_it1/Desktop/Greenlytics/frontend/public/README.md)

## Frontend Entegrasyon Rehberi

Frontend modülleri, endpoint yapısı ve auth akışı için:
[FRONTEND_ENTEGRASYON_REHBERI.md](/c:/Users/stajyer_it1/Desktop/Greenlytics/FRONTEND_ENTEGRASYON_REHBERI.md)
