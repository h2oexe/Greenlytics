# 🌱 Greenlytics - Sustainability Management SaaS

Greenlytics is an enterprise-grade, multi-tenant Sustainability Management SaaS platform. It allows companies to track, manage, and report their environmental impact, including Energy, Water, Waste, and Carbon emissions.

The project is structured as a monorepo containing both the Frontend and the Backend applications.

## 📁 Repository Structure

```
Greenlytics/
├── frontend/               # (To be added) Frontend application
├── src/                    # Backend Source Code (.NET 8 Clean Architecture)
│   ├── Greenlytics.API
│   ├── Greenlytics.Application
│   ├── Greenlytics.Domain
│   └── Greenlytics.Infrastructure
├── docker-compose.yml      # Local development infrastructure (PostgreSQL, Redis, MinIO, MailHog)
└── FRONTEND_ENTEGRASYON_REHBERI.md  # Detailed API integration guide for the frontend team
```

---

## ⚙️ Backend Setup & Execution

The backend is built with **.NET 8** following Clean Architecture principles. It uses PostgreSQL, Redis, Hangfire, and MinIO for robust and scalable operations.

### 1. Start Infrastructure Services
You need Docker installed. Run the following command in the root folder to start all required external services (Database, Redis, S3 Storage, SMTP):
```bash
docker-compose up -d
```

### 2. Apply Database Migrations
Before running the backend, ensure the database schema is created:
```bash
dotnet ef database update --project src/Greenlytics.Infrastructure --startup-project src/Greenlytics.API
```

### 3. Run the API
```bash
cd src/Greenlytics.API
dotnet run
```
The application will start on `http://localhost:5000`. 
👉 **Swagger UI:** [http://localhost:5000/swagger](http://localhost:5000/swagger)

*(For detailed frontend integration, authentication flows, and endpoint usage, please refer to the `FRONTEND_ENTEGRASYON_REHBERI.md` file.)*

---

## 🎨 Frontend Setup & Execution

The frontend starter now lives in the `frontend/` directory.

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Configure API base URL
Create a `frontend/.env` file with:
```bash
VITE_API_BASE_URL=http://localhost:5000
```

### 3. Run the frontend
```bash
npm run dev
```

The Vite dev server starts on `http://localhost:5173`.

---

## ✨ Key Backend Features
* **Multi-Tenant Architecture:** Securely isolates data per company using EF Core Global Query Filters.
* **Complex Reporting Engine:** Aggregates and calculates metrics (Trend calculations, CO2e estimation using emission factors).
* **Automated Exports:** Generates PDF and Excel reports in background jobs (Hangfire) and uploads to MinIO, providing pre-signed URLs.
* **SaaS Billing Ready:** Integrated with Stripe for Subscription limit enforcement and feature gating. 
* **API Documentation:** Fully documented via Swagger and OpenAPI standards.
