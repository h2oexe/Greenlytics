import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import { CarbonPage } from "../features/carbon/carbon-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { EnergyPage } from "../features/energy/energy-page";
import { ExportsPage } from "../features/exports/exports-page";
import { GoalsPage } from "../features/goals/goals-page";
import { SettingsPage } from "../features/settings/settings-page";
import { WastePage } from "../features/waste/waste-page";
import { WaterPage } from "../features/water/water-page";
import { formatRoleLabel } from "../lib/formatting";

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
  icon: "dashboard" | "energy" | "water" | "waste" | "carbon" | "goals" | "exports" | "settings";
}

const navigationItems: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", caption: "Operasyon özeti", icon: "dashboard" },
  { key: "energy", label: "Energy", caption: "Enerji kayıtları", icon: "energy" },
  { key: "water", label: "Water", caption: "Su kayıtları", icon: "water" },
  { key: "waste", label: "Waste", caption: "Atık kayıtları", icon: "waste" },
  { key: "carbon", label: "Carbon", caption: "Karbon girdileri", icon: "carbon" },
  { key: "goals", label: "Goals", caption: "Hedef takibi", icon: "goals" },
  { key: "exports", label: "Reports", caption: "Dışa aktarma", icon: "exports" },
  { key: "settings", label: "Settings", caption: "Plan ve ekip", icon: "settings" }
];

function ShellIcon({ name }: { name: NavigationItem["icon"] | "search" | "bell" | "spark" }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="11" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="18" width="7" height="3" />
        </svg>
      );
    case "energy":
      return (
        <svg {...common}>
          <path d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z" />
        </svg>
      );
    case "water":
      return (
        <svg {...common}>
          <path d="M12 3c3.5 4.4 6 7.2 6 10a6 6 0 1 1-12 0c0-2.8 2.5-5.6 6-10Z" />
        </svg>
      );
    case "waste":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M9 7V4h6v3" />
          <path d="m7 7 1 13h8l1-13" />
          <path d="M10 11v5M14 11v5" />
        </svg>
      );
    case "carbon":
      return (
        <svg {...common}>
          <path d="M5 12h6" />
          <path d="M13 8h6" />
          <path d="M13 16h6" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="15" cy="8" r="2" />
          <circle cx="15" cy="16" r="2" />
        </svg>
      );
    case "goals":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "exports":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 19h14" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.7.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7 1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.2-4.2" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M15 17H5.5a1 1 0 0 1-.8-1.6L6 13.5V10a6 6 0 1 1 12 0v3.5l1.3 1.9a1 1 0 0 1-.8 1.6H15" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M12 3v6" />
          <path d="M12 15v6" />
          <path d="M3 12h6" />
          <path d="M15 12h6" />
        </svg>
      );
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
      return <WastePage />;
    case "carbon":
      return <CarbonPage />;
    case "goals":
      return <GoalsPage />;
    case "exports":
      return <ExportsPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return null;
  }
}

function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "GL";
}

function ToolbarButton({ icon, label }: { icon: "bell" | "spark"; label: string }) {
  return (
    <button type="button" className="toolbar-button" aria-label={label}>
      <ShellIcon name={icon} />
    </button>
  );
}

function NavLabel({ item }: { item: NavigationItem }) {
  return (
    <>
      <span className="nav-icon">
        <ShellIcon name={item.icon} />
      </span>
      <span className="nav-copy">
        <strong>{item.label}</strong>
        <span>{item.caption}</span>
      </span>
    </>
  );
}

export function AppShell() {
  const { session, signOut } = useAuth();
  const [activePage, setActivePage] = useState<NavigationKey>("dashboard");
  const activeItem = navigationItems.find((item) => item.key === activePage) ?? navigationItems[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <span />
          </div>
          <div>
            <h2 className="sidebar-brand-title">Greenlytics</h2>
            <p className="sidebar-brand-subtitle" lang="en">
              Sustainability SaaS
            </p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Ana gezinme">
          {navigationItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === activePage ? "nav-item active" : "nav-item"}
              onClick={() => setActivePage(item.key)}
            >
              <NavLabel item={item} />
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-export-button"
            onClick={() => setActivePage("exports")}
            lang="en"
          >
            Export Report
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-topbar">
          <label className="search-shell">
            <span className="search-icon">
              <ShellIcon name="search" />
            </span>
            <input type="search" placeholder="İçgörü ara..." />
          </label>

          <div className="workspace-toolbar">
            <ToolbarButton icon="bell" label="Bildirimler" />
            <ToolbarButton icon="spark" label="Kısa yollar" />

            <div className="user-profile">
              <div className="user-profile-copy">
                <strong>
                  {session?.user.firstName} {session?.user.lastName}
                </strong>
                <span>
                  {formatRoleLabel(session?.user.role)} · {session?.user.email}
                </span>
              </div>
              <div className="user-avatar" aria-hidden="true">
                {getInitials(session?.user.firstName, session?.user.lastName)}
              </div>
            </div>

            <button type="button" className="secondary-button" onClick={signOut}>
              Çıkış yap
            </button>
          </div>
        </header>

        <section className="workspace-content">
          <div className="workspace-header-block">
            <p className="workspace-subtitle" lang="en">
              Organization / {activeItem.label}
            </p>
          </div>
          {renderPage(activePage)}
        </section>
      </main>
    </div>
  );
}
