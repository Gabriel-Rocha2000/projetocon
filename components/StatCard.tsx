export default function StatCard({ label, value, note, onClick }: { label: string; value: string; note?: string; onClick?: () => void }) {
  const className = onClick ? "card statCardButton" : "card";
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <span className="muted">{label}</span>
        <strong className="big">{value}</strong>
        {note && <small className="muted">{note}</small>}
        <small className="statHint">Ver detalhes →</small>
      </button>
    );
  }
  return <div className={className}><span className="muted">{label}</span><strong className="big">{value}</strong>{note && <small className="muted">{note}</small>}</div>;
}
