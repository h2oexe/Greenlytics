import { AppShell } from "./app/app-shell";
import { AuthPage } from "./features/auth/auth-page";
import { useAuth } from "./auth/auth-context";

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="shell">
        <div className="card centered">
          <p className="eyebrow">Greenlytics</p>
          <h1>Oturum kontrol ediliyor</h1>
          <p className="muted">Kaydedilen token varsa yenileniyor.</p>
        </div>
      </div>
    );
  }

  return <div className="shell">{session ? <AppShell /> : <AuthPage />}</div>;
}
