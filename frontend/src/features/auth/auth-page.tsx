import { useState } from "react";
import { LoginPage } from "./login-page";
import { RegisterPage } from "./register-page";

type AuthMode = "login" | "register";

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <div className="auth-shell">
      <section className="auth-hero">
        <p className="eyebrow">Greenlytics</p>
        <h1>Surdurulebilirlik verilerini yoneten modern kontrol paneli.</h1>
        <p className="muted auth-copy">
          Bu uygulama enerji, su, atik ve karbon verilerini tek yerde toplamak, raporlamak ve
          hedeflere gore izlemek icin tasarlaniyor.
        </p>

        <div className="hero-points">
          <div className="hero-point">
            <strong>Multi-tenant yapi</strong>
            <span>Her sirket kendi verisini izole sekilde gorur.</span>
          </div>
          <div className="hero-point">
            <strong>Hazir raporlar</strong>
            <span>Dashboard, trendler, kategori kirilimlari ve export akislari hazir.</span>
          </div>
          <div className="hero-point">
            <strong>SaaS omurgasi</strong>
            <span>Planlar, bildirimler, API key ve webhook taraflari icin zemin var.</span>
          </div>
        </div>
      </section>

      <section className="card auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Kimlik dogrulama ekranlari">
          <button
            type="button"
            className={mode === "login" ? "auth-tab active" : "auth-tab"}
            onClick={() => setMode("login")}
          >
            Giris yap
          </button>
          <button
            type="button"
            className={mode === "register" ? "auth-tab active" : "auth-tab"}
            onClick={() => setMode("register")}
          >
            Kayit ol
          </button>
        </div>

        {mode === "login" ? (
          <LoginPage onSwitchMode={() => setMode("register")} />
        ) : (
          <RegisterPage onSwitchMode={() => setMode("login")} />
        )}
      </section>
    </div>
  );
}
