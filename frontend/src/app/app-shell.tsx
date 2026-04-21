import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
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

type SearchKind = "Sayfa" | "İşlem";

interface NavigationItem {
  key: NavigationKey;
  label: string;
  caption: string;
  icon: "dashboard" | "energy" | "water" | "waste" | "carbon" | "goals" | "exports" | "settings";
}

interface SearchItem {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  page: NavigationKey;
  icon: NavigationItem["icon"] | "spark";
  kind: SearchKind;
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

const searchCatalog: SearchItem[] = [
  ...navigationItems.map((item) => ({
    id: `page-${item.key}`,
    label: item.label,
    description: item.caption,
    keywords: [item.label, item.caption, item.key],
    page: item.key,
    icon: item.icon,
    kind: "Sayfa" as const
  })),
  {
    id: "action-energy-new",
    label: "Yeni enerji kaydı",
    description: "Enerji modülüne geç ve yeni kayıt formunu kullan.",
    keywords: ["enerji", "kayıt", "oluştur", "ekle", "form"],
    page: "energy",
    icon: "energy",
    kind: "İşlem"
  },
  {
    id: "action-water-new",
    label: "Yeni su kaydı",
    description: "Su modülüne geç ve yeni tüketim kaydı ekle.",
    keywords: ["su", "kayıt", "oluştur", "ekle", "form"],
    page: "water",
    icon: "water",
    kind: "İşlem"
  },
  {
    id: "action-waste-new",
    label: "Yeni atık kaydı",
    description: "Atık modülüne geç ve yeni kayıt başlat.",
    keywords: ["atık", "geri dönüşüm", "kayıt", "oluştur", "ekle"],
    page: "waste",
    icon: "waste",
    kind: "İşlem"
  },
  {
    id: "action-carbon-new",
    label: "Yeni karbon girdisi",
    description: "Karbon modülüne geç ve yeni emisyon girdisi ekle.",
    keywords: ["karbon", "emisyon", "co2", "girdi", "ekle"],
    page: "carbon",
    icon: "carbon",
    kind: "İşlem"
  },
  {
    id: "action-goal-new",
    label: "Yeni hedef oluştur",
    description: "Goals ekranına geç ve yeni hedef tanımla.",
    keywords: ["hedef", "goals", "oluştur", "ilerleme"],
    page: "goals",
    icon: "goals",
    kind: "İşlem"
  },
  {
    id: "action-export-new",
    label: "Dışa aktarım oluştur",
    description: "Reports ekranına geç ve yeni export hazırla.",
    keywords: ["export", "rapor", "csv", "excel", "pdf", "dışa aktar"],
    page: "exports",
    icon: "exports",
    kind: "İşlem"
  },
  {
    id: "action-settings-plan",
    label: "Plan ve ayarlar",
    description: "Settings ekranına geç ve plan detaylarını görüntüle.",
    keywords: ["ayarlar", "plan", "ekip", "api key", "subscription"],
    page: "settings",
    icon: "settings",
    kind: "İşlem"
  },
  {
    id: "action-quick-overview",
    label: "Hızlı genel bakış",
    description: "Dashboard ekranına dön ve tüm özet kartlarını incele.",
    keywords: ["özet", "dashboard", "genel görünüm", "kpi"],
    page: "dashboard",
    icon: "spark",
    kind: "İşlem"
  }
];

function ShellIcon({ name }: { name: NavigationItem["icon"] | "search" | "bell" | "spark" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

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

function getSearchResults(query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

  return searchCatalog
    .filter((item) => {
      if (!normalizedQuery) {
        return item.kind === "Sayfa" || item.id === "action-goal-new" || item.id === "action-export-new";
      }

      const haystack = [item.label, item.description, ...item.keywords].join(" ").toLocaleLowerCase("tr-TR");
      return haystack.includes(normalizedQuery);
    })
    .slice(0, normalizedQuery ? 8 : 6);
}

function ToolbarButton({
  icon,
  label,
  onClick
}: {
  icon: "bell" | "spark";
  label: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="toolbar-button" aria-label={label} onClick={onClick}>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedResultId, setHighlightedResultId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchResults = getSearchResults(searchQuery);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("tr-TR");

  useEffect(() => {
    setHighlightedResultId(searchResults[0]?.id ?? null);
  }, [searchQuery, activePage]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    function handleSlashShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTypingField = tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable;

      if (!isTypingField && event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleSlashShortcut);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleSlashShortcut);
    };
  }, []);

  function focusSearch() {
    searchInputRef.current?.focus();
    setSearchOpen(true);
  }

  function applySearchItem(item: SearchItem) {
    setActivePage(item.page);
    setSearchQuery("");
    setSearchOpen(false);
    setHighlightedResultId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!searchResults.length) {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
      return;
    }

    const currentIndex = searchResults.findIndex((item) => item.id === highlightedResultId);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = currentIndex >= searchResults.length - 1 ? 0 : currentIndex + 1;
      setHighlightedResultId(searchResults[nextIndex]?.id ?? null);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = currentIndex <= 0 ? searchResults.length - 1 : currentIndex - 1;
      setHighlightedResultId(searchResults[nextIndex]?.id ?? null);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = searchResults.find((item) => item.id === highlightedResultId) ?? searchResults[0];
      if (selected) {
        applySearchItem(selected);
      }
      return;
    }

    if (event.key === "Escape") {
      setSearchOpen(false);
    }
  }

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
          <div className="search-area" ref={searchRef}>
            <label className="search-shell">
              <span className="search-icon">
                <ShellIcon name="search" />
              </span>
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                placeholder="Sayfa, modül veya işlem ara..."
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                aria-expanded={searchOpen}
                aria-label="Global arama"
              />
            </label>

            {searchOpen ? (
              <div className="search-panel" role="listbox" aria-label="Arama sonuçları">
                <div className="search-panel-header">
                  <strong>{normalizedQuery ? "Eşleşen sonuçlar" : "Hızlı erişim"}</strong>
                  <span>{normalizedQuery ? `${searchResults.length} sonuç` : "Kısayol: /"}</span>
                </div>

                {searchResults.length ? (
                  <div className="search-results">
                    {searchResults.map((item) => {
                      const isActive = item.id === highlightedResultId;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          className={isActive ? "search-result active" : "search-result"}
                          onMouseEnter={() => setHighlightedResultId(item.id)}
                          onClick={() => applySearchItem(item)}
                        >
                          <span className="search-result-icon">
                            <ShellIcon name={item.icon} />
                          </span>
                          <span className="search-result-copy">
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </span>
                          <span className="search-result-kind">{item.kind}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="search-empty">
                    <strong>Sonuç bulunamadı</strong>
                    <span>Daha genel bir terim dene ya da modül adıyla ara.</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="workspace-toolbar">
            <ToolbarButton icon="bell" label="Bildirimler" />
            <ToolbarButton icon="spark" label="Kısa yollar" onClick={focusSearch} />

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

        <section className="workspace-content">{renderPage(activePage)}</section>
      </main>
    </div>
  );
}
