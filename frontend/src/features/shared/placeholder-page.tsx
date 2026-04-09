interface PlaceholderPageProps {
  title: string;
  description: string;
  endpoint: string;
}

export function PlaceholderPage({ title, description, endpoint }: PlaceholderPageProps) {
  return (
    <section className="placeholder-card">
      <p className="eyebrow">Siradaki modul</p>
      <h2>{title}</h2>
      <p className="muted">{description}</p>

      <div className="placeholder-grid">
        <article className="mini-card">
          <strong>Ilk endpoint</strong>
          <span>{endpoint}</span>
        </article>
        <article className="mini-card">
          <strong>UI ihtiyaci</strong>
          <span>Liste, filtre, detay ve form akislarini tasarlayabiliriz.</span>
        </article>
        <article className="mini-card">
          <strong>Sonraki hedef</strong>
          <span>Bu modul icin gercek tablo ve form komponentleri olusturmak.</span>
        </article>
      </div>
    </section>
  );
}
