import { useEffect, useState } from "react";
import { LoginPage } from "./login-page";
import { RegisterPage } from "./register-page";

type AuthMode = "login" | "register";

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [hasForestImage, setHasForestImage] = useState(false);

  useEffect(() => {
    const image = new Image();

    image.onload = () => setHasForestImage(true);
    image.onerror = () => setHasForestImage(false);
    image.src = "/login-forest.jpg";
  }, []);

  return (
    <div className={hasForestImage ? "auth-portal auth-portal--has-forest" : "auth-portal"}>
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-backdrop-glow auth-backdrop-glow--left" />
        <div className="auth-backdrop-glow auth-backdrop-glow--right" />
        {!hasForestImage ? (
          <>
            <div className="auth-backdrop-tree auth-backdrop-tree--one" />
            <div className="auth-backdrop-tree auth-backdrop-tree--two" />
            <div className="auth-backdrop-tree auth-backdrop-tree--three" />
          </>
        ) : null}
      </div>

      <section className="auth-shell auth-shell--immersive">
        <aside className="auth-story">
          <div className="auth-brand-lockup">
            <div className="brand-mark brand-mark--large">
              <span />
            </div>
            <div>
              <p className="auth-kicker">Greenlytics</p>
              <h1 className="auth-title">Sürdürülebilirlik zekasını tek merkezden yönet.</h1>
              <p className="auth-lead">
                Enerji, su, atık ve karbon verilerini tek akışta topla; hedefleri canlı izle,
                kararları veriyle besle.
              </p>
            </div>
          </div>

          <div className="auth-story-grid">
            <article className="auth-footnote-card">
              <strong>Tek panel</strong>
              <span>Operasyonel veriler, hedefler ve dışa aktarımlar aynı ürün dilinde birleşir.</span>
            </article>
            <article className="auth-footnote-card">
              <strong>Çok kiracılı yapı</strong>
              <span>Her şirket kendi verisini izole görür; ekip ve plan yönetimi buna göre akar.</span>
            </article>
            <article className="auth-footnote-card">
              <strong>Yönetici içgörüleri</strong>
              <span>Trendler, açık hedefler ve riskli alanlar ilk bakışta görülebilir olur.</span>
            </article>
          </div>

          <div className="auth-story-foot">
            <span className="auth-story-quote-mark">01</span>
            <p>
              “Sürdürülebilirlik operasyonunu gösterge paneli gibi değil, yaşayan bir karar sistemi
              gibi hissettiren arayüz.”
            </p>
          </div>
        </aside>

        <section className="auth-panel">
          <div className="card auth-panel-card">
            <div className="auth-panel-header">
              <div>
                <p className="eyebrow" lang="en">
                  Sustainability Intelligence
                </p>
                <h2>{mode === "login" ? "Tekrar hoş geldin" : "Kurulumla başlayalım"}</h2>
                <p className="muted">
                  {mode === "login"
                    ? "Paneline erişmek için kurumsal hesabınla giriş yap."
                    : "İlk şirket hesabını oluştur, yönetici kullanıcıyı ekle ve paneli başlat."}
                </p>
              </div>

              <div className="auth-tabs" role="tablist" aria-label="Kimlik doğrulama ekranları">
                <button
                  type="button"
                  className={mode === "login" ? "auth-tab active" : "auth-tab"}
                  onClick={() => setMode("login")}
                >
                  Giriş yap
                </button>
                <button
                  type="button"
                  className={mode === "register" ? "auth-tab active" : "auth-tab"}
                  onClick={() => setMode("register")}
                >
                  Kayıt ol
                </button>
              </div>
            </div>

            <div className="auth-form-wrap">
              {mode === "login" ? (
                <LoginPage onSwitchMode={() => setMode("register")} />
              ) : (
                <RegisterPage onSwitchMode={() => setMode("login")} />
              )}
            </div>

            <div className="auth-legal">
              <span>Gizlilik politikası</span>
              <span>Hizmet koşulları</span>
              <span>Destek</span>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
