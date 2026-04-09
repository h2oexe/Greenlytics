import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { EnergyPage } from "../features/energy/energy-page";
import { WaterPage } from "../features/water/water-page";
import { PlaceholderPage } from "../features/shared/placeholder-page";

type NavigationKey =
  | "dashboard"
  | "energy"
  | "water"
  | "waste"
  | "carbon"
  | "goals"
  | "exports"
  | "settings";

interface NavigationItem {
  key: NavigationKey;
  label: string;
  caption: string;
}

const navigationItems: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", caption: "Genel gorunum" },
  { key: "energy", label: "Energy", caption: "Enerji kayitlari" },
  { key: "water", label: "Water", caption: "Su kayitlari" },
  { key: "waste", label: "Waste", caption: "Atik kayitlari" },
  { key: "carbon", label: "Carbon", caption: "Karbon girdileri" },
  { key: "goals", label: "Goals", caption: "Hedef ve ilerleme" },
  { key: "exports", label: "Exports", caption: "Rapor indirmeleri" },
  { key: "settings", label: "Settings", caption: "Plan ve ekip" }
];

function formatRoleLabel(role: string | number | undefined) {
  switch (role) {
    case 0:
    case "Admin":
      return "Admin";
    case 1:
    case "Manager":
      return "Manager";
    case 2:
    case "Viewer":
      return "Viewer";
    default:
      return "User";
  }
}

function renderPage(activePage: NavigationKey) {
  switch (activePage) {
    case "dashboard":
      return <DashboardPage />;
    case "energy":
      return <EnergyPage />;
    case "water":
      return <WaterPage />;
    case "waste":
      return (
        <PlaceholderPage
          title="Waste management"
          description="Atik listesi, geri donusum takibi ve kategori kirilimlarini burada toplayacagiz."
          endpoint="GET /api/waste"
        />
      );
    case "carbon":
      return (
        <PlaceholderPage
          title="Carbon inputs"
          description="Karbon kaynaklari, hesaplanan CO2e degerleri ve footprint ekranlari icin alan."
          endpoint="GET /api/carbon"
        />
      );
    case "goals":
      return (
        <PlaceholderPage
          title="Goals"
          description="Hedefleri listeleme, olusturma ve ilerleme yuzdelerini gosterme akisi."
          endpoint="GET /api/goals"
        />
      );
    case "exports":
      return (
        <PlaceholderPage
          title="Exports"
          description="PDF, Excel ve CSV export akislari ile indirme gecmisi burada yer alacak."
          endpoint="GET /api/export/history"
        />
      );
    case "settings":
      return (
        <PlaceholderPage
          title="Settings"
          description="Abonelik, API key, webhook ve ekip yonetimi taraflarini bu alanda toplayabiliriz."
          endpoint="GET /api/subscriptions/current"
        />
      );
    default:
      return null;
  }
}

export function AppShell() {
  const { session, signOut } = useAuth();
  const [activePage, setActivePage] = useState<NavigationKey>("dashboard");
  const activeItem = navigationItems.find((item) => item.key === activePage) ?? navigationItems[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Greenlytics</p>
          <h2>Control Center</h2>
          <p className="muted">Sustainability SaaS paneli</p>
        </div>

        <nav className="nav-list">
          {navigationItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === activePage ? "nav-item active" : "nav-item"}
              onClick={() => setActivePage(item.key)}
            >
              <strong>{item.label}</strong>
              <span>{item.caption}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{activeItem.label}</p>
            <h1>{activeItem.caption}</h1>
          </div>

          <div className="workspace-actions">
            <div className="user-chip">
              <strong>
                {session?.user.firstName} {session?.user.lastName}
              </strong>
              <span>
                {formatRoleLabel(session?.user.role)} - {session?.user.email}
              </span>
            </div>
            <button type="button" className="secondary-button" onClick={signOut}>
              Cikis yap
            </button>
          </div>
        </header>

        {renderPage(activePage)}
      </main>
    </div>
  );
}
