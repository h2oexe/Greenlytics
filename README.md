# Greenlytics

Greenlytics, sirketlerin surdurulebilirlik verilerini tek panelde yonetebilmesi icin gelistirilen cok kiracili bir SaaS uygulamasidir. Uygulama; enerji, su, atik ve karbon verilerini toplar, dashboard uzerinden ozetler, hedef takibi yapar ve rapor/export akislarini destekler.

Bu repo iki ana parcadan olusur:

- `src/`: .NET 8 tabanli backend
- `frontend/`: React + Vite tabanli frontend

## Proje Yapisi

```text
Greenlytics/
|-- frontend/                      # React + Vite frontend
|-- src/
|   |-- Greenlytics.API            # Web API
|   |-- Greenlytics.Application    # Uygulama katmani
|   |-- Greenlytics.Domain         # Domain modelleri
|   `-- Greenlytics.Infrastructure # Veri erisimi, dis servisler, background jobs
|-- tests/                         # Test projesi
|-- docker-compose.yml             # PostgreSQL, Redis, MinIO, MailHog ve API
`-- FRONTEND_ENTEGRASYON_REHBERI.md
```

## Gereksinimler

Projeyi rahat calistirmak icin sunlarin kurulu olmasi gerekir:

- `Docker Desktop`
- `.NET SDK 8`
- `Node.js 18+`
- `npm`

Surumleri kontrol etmek icin:

```powershell
docker --version
dotnet --version
node --version
npm --version
```

## Hangi Yontemi Kullanayim?

Iki farkli calisma sekli var:

1. `Docker ile tam akış`
Bu en kolay ve tavsiye edilen yontemdir. PostgreSQL, Redis, MinIO, MailHog ve API birlikte ayağa kalkar.

2. `Docker + lokal frontend`
Pratik gelistirme akisi budur. Backend Docker'da, frontend ise `npm run dev` ile lokal calisir.

3. `Docker'siz backend + lokal frontend`
Backend'i dogrudan `dotnet run` ile calistirmak istersen kullanabilirsin. Bunun icin veritabani ve diger servisleri yine ayaga kaldirman gerekir.

Genelde tavsiye edilen akış:

- API ve altyapi: `docker compose up -d`
- Frontend: `cd frontend` sonra `npm run dev`

## Hizli Baslangic

Asagidaki adimlar projeyi ilk kez calistirmak icin yeterlidir.

### 1. Proje klasorune gir

```powershell
cd C:\Users\stajyer_it1\Desktop\Greenlytics
```

### 2. Docker servislerini ayağa kaldir

```powershell
docker compose up -d
```

Bu komut su servisleri baslatir:

- `postgres`
- `redis`
- `minio`
- `mailhog`
- `api`

Servislerin durumunu kontrol et:

```powershell
docker compose ps
```

### 3. Frontend bagimliliklarini kur

```powershell
cd frontend
npm install
```

### 4. Frontend ortam dosyasini hazirla

Istersen `.env.example` dosyasini kopyalayabilirsin:

```powershell
Copy-Item .env.example .env
```

Varsayilan davranis:

- `.env` bos bile olsa frontend, acildigi hostun IP'sini baz alip API'ye gitmeye calisir
- backend Docker ile aciksa API adresi genelde `http://<host-ip>:5000` olur

Tipik `.env` icerigi:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Bu deger lokal makinede calisir. Baska cihazdan acacaksan frontend zaten gerekirse `localhost` yerine o cihazin host IP'sini koymaya calisir.

### 5. Frontend gelistirme sunucusunu baslat

```powershell
npm run dev
```

Frontend artik `0.0.0.0:5173` uzerinde dinler. Bu sayede ayni Wi-Fi'daki baska cihazlar da baglanabilir.

## Lokal Erisim Adresleri

Bu makinede tipik adresler:

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/swagger`
- Health: `http://localhost:5000/health`
- MailHog: `http://localhost:8025`
- MinIO Console: `http://localhost:9001`
- Hangfire: `http://localhost:5000/hangfire`

## Ayni Wi-Fi'daki Baska Bilgisayardan Erisim

Bu makinede tespit edilen Wi-Fi IPv4 adresi:

- `10.99.2.47`

Baska cihazdan su adresi kullan:

- Frontend: `http://10.99.2.47:5173`
- API: `http://10.99.2.47:5000`
- Swagger: `http://10.99.2.47:5000/swagger`

Not:

- Frontend tek basina acilsa bile API'ye erisemiyorsa uygulama tam calismaz
- Hem `5173` hem `5000` portlarinin erisilebilir olmasi gerekir

## Docker ile Calistirma Detayi

Kok klasorde:

```powershell
docker compose up -d
```

Kapatmak icin:

```powershell
docker compose down
```

Log izlemek icin:

```powershell
docker compose logs -f api
```

Tum servis loglari:

```powershell
docker compose logs -f
```

API yeniden build alip kaldirmak icin:

```powershell
docker compose up -d --build api
```

## Docker'siz Backend Calistirma

Eger API'yi dogrudan makinede calistirmak istersen:

```powershell
dotnet run --project src\Greenlytics.API\Greenlytics.API.csproj --launch-profile http
```

Bu durumda backend su adreste dinler:

- `http://localhost:5000`
- LAN icin: `http://10.99.2.47:5000`

Sonra frontend'i ayri terminalde ac:

```powershell
cd frontend
npm run dev
```

## Ilk Acilista Beklenenler

Her sey dogruysa sira sira sunlari gormelisin:

1. `docker compose ps` ciktisinda `api`, `postgres`, `redis`, `minio`, `mailhog` ayakta olmalı
2. `http://localhost:5000/health` acilmalı
3. `http://localhost:5000/swagger` acilmali
4. `npm run dev` sonrasi `http://localhost:5173` acilmali
5. Ayni Wi-Fi'daki cihazdan `http://10.99.2.47:5173` acilabilmeli

## Sık Kullanilan Komutlar

### Tum servisleri baslat

```powershell
docker compose up -d
```

### Servisleri durdur

```powershell
docker compose down
```

### Frontend gelistirme sunucusu

```powershell
cd frontend
npm run dev
```

### Frontend production build

```powershell
cd frontend
npm run build
```

### Backend solution build

```powershell
dotnet build Greenlytics.sln
```

### Testleri calistir

```powershell
dotnet test Greenlytics.sln --no-build
```

## Sık Karsilasilan Sorunlar

### 1. `http://localhost:5173` acilmiyor

Kontrol et:

- `npm install` calisti mi
- `npm run dev` terminalde hala acik mi
- 5173 portunu baska bir uygulama kullaniyor mu

Gerekirse:

```powershell
cd frontend
npm run build
```

Build geciyorsa kod genelde sagliklidir; sorun dev server tarafindadir.

### 2. `http://localhost:5000/health` acilmiyor

Kontrol et:

- `docker compose ps`
- API container ayakta mi
- Ya da `dotnet run` ile backend baslatildi mi

Docker loglari:

```powershell
docker compose logs -f api
```

### 3. Baska bilgisayar IP ile acamiyor

Ornek acman gereken adres:

```text
http://10.99.2.47:5173
```

Asagilari kontrol et:

- Iki cihaz ayni Wi-Fi'da mi
- VPN acik mi
- Misafir agina bagli misin
- Windows Firewall `5173` ve `5000` portlarini engelliyor mu
- Ag profili `Private` mi

Windows Firewall icin yonetici PowerShell'de:

```powershell
netsh advfirewall firewall add rule name="Greenlytics Frontend 5173" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="Greenlytics API 5000" dir=in action=allow protocol=TCP localport=5000
```

Wi-Fi agini `Private` yapmak icin:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
```

### 4. Docker permission hatasi aliyorum

Docker Desktop'in acik oldugundan emin ol. Sonra:

```powershell
docker info
```

Eger pipe veya permission hatasi aliyorsan:

- Docker Desktop'i yeniden baslat
- Gerekirse PowerShell'i yeniden ac

### 5. Frontend aciliyor ama veri gelmiyor

Bu genelde API baglantisidir. Sunlari test et:

```powershell
Invoke-WebRequest http://localhost:5000/health
Invoke-WebRequest http://10.99.2.47:5000/health
```

Frontend, API'ye baglanamiyorsa ekran yuklenir ama veri kartlari bos veya hatali kalir.

## Veritabani ve Seed Notu

Uygulama baslangicinda gerekli tablolar ve temel plan seed verileri backend tarafindan olusturulur. Lokal gelistirmede ayri bir migration komutu cogu durumda gerekmez.

## Gorsel Dosyalar

`frontend/public/` altinda UI tarafindan beklenen iki gorsel vardir:

- `login-forest.jpg`
- `dashboard-spotlight.png`

Detaylar icin:
[frontend/public/README.md](/c:/Users/stajyer_it1/Desktop/Greenlytics/frontend/public/README.md)

## Frontend Entegrasyon Rehberi

Frontend modulleri, endpoint yapisi ve auth akisi icin:
[FRONTEND_ENTEGRASYON_REHBERI.md](/c:/Users/stajyer_it1/Desktop/Greenlytics/FRONTEND_ENTEGRASYON_REHBERI.md)
