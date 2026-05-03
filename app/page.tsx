import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(180deg, #f7f4ea 0%, #efe7d1 100%)',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid #e5dcc8',
          borderRadius: 20,
          padding: 28,
          maxWidth: 560,
        }}
      >
        <h1 style={{ marginTop: 0, color: '#1f2937' }}>Nexora Control Panel</h1>
        <p style={{ color: '#4b5563', lineHeight: 1.6 }}>
          Open the simulation control screen to send MQTT-backed control commands
          through the FastAPI backend.
        </p>
        <Link
          href="/control"
          style={{
            display: 'inline-block',
            marginTop: 12,
            background: '#15803d',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 12,
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          Open Control Panel
        </Link>
      </div>
    </main>
  );
}
