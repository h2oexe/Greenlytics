import { useState, type FormEvent } from "react";
import { ApiError } from "../../lib/http";
import { useAuth } from "../../auth/auth-context";

interface LoginPageProps {
  onSwitchMode: () => void;
}

export function LoginPage({ onSwitchMode }: LoginPageProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signIn({ email, password });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Beklenmeyen bir hata olustu.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-form">
      <p className="eyebrow">Oturum Ac</p>
      <h2>Backend ile ilk baglanti</h2>
      <p className="muted">Swagger veya kayit akisinla olusturdugun kullaniciyla giris yap.</p>

      <form onSubmit={handleSubmit} className="form-stack">
        <label className="field">
          <span>E-posta</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@greenlytics.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span>Sifre</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sifren"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? <p className="error-banner">{error}</p> : null}

        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Giris yapiliyor..." : "Giris yap"}
        </button>
      </form>

      <button type="button" className="text-button" onClick={onSwitchMode}>
        Yeni misin? Sirketini olustur.
      </button>
    </div>
  );
}
