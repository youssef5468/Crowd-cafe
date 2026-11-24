const words = ['Coffee', 'People', 'Connection', 'That’s Crowd'];
const run = Array.from({ length: 6 }, () => words).flat();

/** Moving strip above the header (the shop-front awning's counterpart for Crowd). */
export function Ticker({ className = '' }: { className?: string }) {
  return (
    <div className={`ticker ${className}`} aria-hidden="true">
      <div className="ticker-track">
        {[0, 1].map((copy) => (
          <ul key={copy}>
            {run.map((word, index) => (
              <li key={index}>
                {word}
                <i />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
export function Decor({ slim = false }: { slim?: boolean }) {
  return <Ticker className={slim ? 'ticker-slim' : ''} />;
}
