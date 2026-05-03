'use client';

import { type CSSProperties, useState } from 'react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';
const COMMUNITY_ID = 'C01';

const units = Array.from({ length: 20 }, (_, index) =>
  `U${String(index + 1).padStart(2, '0')}`
);

const devices = [
  { key: 'ac', label: 'AC', accent: '#f97316' },
  { key: 'lamp', label: 'Lamp', accent: '#facc15' },
  { key: 'washing_machine', label: 'Washing Machine', accent: '#38bdf8' },
  { key: 'tv', label: 'TV', accent: '#a78bfa' },
  { key: 'charger', label: 'Charger', accent: '#34d399' },
] as const;

type DeviceKey = (typeof devices)[number]['key'];
type UnitDeviceState = Record<DeviceKey, boolean>;
type UnitsState = Record<string, UnitDeviceState>;

const initialUnitState: UnitDeviceState = {
  ac: false,
  lamp: false,
  washing_machine: false,
  tv: false,
  charger: false,
};

function buildInitialUnitsState(): UnitsState {
  return Object.fromEntries(
    units.map((unitId) => [unitId, { ...initialUnitState }])
  ) as UnitsState;
}

export default function ControlPage() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [unitStates, setUnitStates] = useState<UnitsState>(buildInitialUnitsState);

  async function sendControl(unitId: string, device: DeviceKey, state: boolean) {
    const deviceLabel = devices.find((item) => item.key === device)?.label ?? device;
    const key = `${unitId}-${device}-${state ? 'on' : 'off'}`;

    setLoadingKey(key);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          community_id: COMMUNITY_ID,
          unit_id: unitId,
          device,
          state,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail ?? 'Failed to send control command');
      }

      setUnitStates((current) => ({
        ...current,
        [unitId]: {
          ...current[unitId],
          [device]: state,
        },
      }));
      setMessage(`${deviceLabel} ${state ? 'ON' : 'OFF'} sent to ${unitId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoadingKey(null);
    }
  }

  async function sendBulkControl(device: DeviceKey, state: boolean) {
    const deviceLabel = devices.find((item) => item.key === device)?.label ?? device;
    const key = `bulk-${device}-${state ? 'on' : 'off'}`;

    setLoadingKey(key);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/control-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          community_id: COMMUNITY_ID,
          device,
          state,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail ?? 'Failed to send bulk control command');
      }

      setUnitStates((current) =>
        Object.fromEntries(
          units.map((unitId) => [
            unitId,
            {
              ...current[unitId],
              [device]: state,
            },
          ])
        ) as UnitsState
      );
      setMessage(`${deviceLabel} ${state ? 'ON' : 'OFF'} sent to all units`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoadingKey(null);
    }
  }

  function getUnitEnabledCount(unitId: string) {
    return devices.filter((device) => unitStates[unitId][device.key]).length;
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.heroPanel}>
            <p style={styles.eyebrow}>Simulation Control</p>
            <h1 style={styles.title}>Generator Control Panel</h1>
            <p style={styles.subtitle}>
              Control each device inside every unit. Commands go through FastAPI,
              then get published to MQTT for the running simulator.
            </p>
          </div>

          <div style={styles.heroStats}>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Community</span>
              <strong style={styles.statValue}>{COMMUNITY_ID}</strong>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Visible Units</span>
              <strong style={styles.statValue}>{units.length}</strong>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Devices / Unit</span>
              <strong style={styles.statValue}>{devices.length}</strong>
            </div>
          </div>
        </section>

        <section style={styles.bulkPanel}>
          <div style={styles.bulkHeader}>
            <div>
              <p style={styles.sectionLabel}>Bulk Control</p>
              <h2 style={styles.sectionTitle}>Turn a specific device ON/OFF for all units</h2>
            </div>
          </div>

          <div style={styles.bulkGrid}>
            {devices.map((device) => (
              <article key={device.key} style={styles.bulkCard}>
                <div>
                  <p style={styles.bulkDeviceLabel}>Device</p>
                  <h3 style={styles.bulkDeviceTitle}>{device.label}</h3>
                </div>
                <div style={styles.bulkButtons}>
                  <button
                    type="button"
                    onClick={() => sendBulkControl(device.key, true)}
                    disabled={loadingKey !== null}
                    style={{
                      ...styles.button,
                      ...styles.onButton,
                      background: device.accent,
                    }}
                  >
                    {loadingKey === `bulk-${device.key}-on` ? 'Sending...' : 'ON All'}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendBulkControl(device.key, false)}
                    disabled={loadingKey !== null}
                    style={{ ...styles.button, ...styles.offButton }}
                  >
                    {loadingKey === `bulk-${device.key}-off` ? 'Sending...' : 'OFF All'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {message ? <p style={styles.message}>{message}</p> : null}

        <section style={styles.unitsGrid}>
          {units.map((unitId) => (
            <article key={unitId} style={styles.unitCard}>
              <div style={styles.unitHeader}>
                <div>
                  <p style={styles.unitLabel}>Unit</p>
                  <h2 style={styles.unitTitle}>{unitId}</h2>
                </div>
                <div style={styles.unitMeta}>
                  <span style={styles.metaPill}>{getUnitEnabledCount(unitId)} active</span>
                  <span style={styles.metaPillMuted}>{COMMUNITY_ID}</span>
                </div>
              </div>

              <div style={styles.deviceList}>
                {devices.map((device) => {
                  const isOn = unitStates[unitId][device.key];
                  return (
                    <div key={device.key} style={styles.deviceRow}>
                      <div style={styles.deviceInfo}>
                        <span
                          style={{
                            ...styles.deviceDot,
                            background: isOn ? device.accent : '#475569',
                          }}
                        />
                        <div>
                          <p style={styles.deviceName}>{device.label}</p>
                          <p style={styles.deviceState}>{isOn ? 'ON' : 'OFF'}</p>
                        </div>
                      </div>

                      <div style={styles.deviceActions}>
                        <button
                          type="button"
                          onClick={() => sendControl(unitId, device.key, true)}
                          disabled={loadingKey !== null}
                          style={{
                            ...styles.miniButton,
                            ...(isOn ? styles.miniButtonActive : styles.miniButtonMuted),
                          }}
                        >
                          {loadingKey === `${unitId}-${device.key}-on` ? '...' : 'ON'}
                        </button>
                        <button
                          type="button"
                          onClick={() => sendControl(unitId, device.key, false)}
                          disabled={loadingKey !== null}
                          style={{
                            ...styles.miniButton,
                            ...(!isOn ? styles.miniButtonDanger : styles.miniButtonMuted),
                          }}
                        >
                          {loadingKey === `${unitId}-${device.key}-off` ? '...' : 'OFF'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, rgba(249, 115, 22, 0.22) 0%, rgba(249, 115, 22, 0) 24%), linear-gradient(180deg, #0b1120 0%, #111827 52%, #1f2937 100%)',
    padding: '32px 18px 56px',
    color: '#e5e7eb',
  },
  shell: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '18px',
    marginBottom: '20px',
  },
  heroPanel: {
    padding: '28px',
    borderRadius: '28px',
    background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.3)',
  },
  eyebrow: {
    margin: 0,
    fontSize: '12px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#fbbf24',
    fontWeight: 800,
  },
  title: {
    margin: '10px 0 12px',
    fontSize: 'clamp(34px, 4vw, 56px)',
    lineHeight: 1,
    color: '#fff7ed',
  },
  subtitle: {
    margin: 0,
    color: 'rgba(255, 247, 237, 0.82)',
    lineHeight: 1.7,
    maxWidth: '760px',
  },
  heroStats: {
    display: 'grid',
    gap: '14px',
  },
  statCard: {
    borderRadius: '24px',
    padding: '20px',
    background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    color: '#7c2d12',
    border: '1px solid rgba(251, 146, 60, 0.25)',
  },
  statLabel: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '12px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  statValue: {
    fontSize: '28px',
  },
  bulkPanel: {
    marginBottom: '18px',
    padding: '22px',
    borderRadius: '24px',
    background: 'rgba(15, 23, 42, 0.58)',
    border: '1px solid rgba(255,255,255,0.09)',
  },
  bulkHeader: {
    marginBottom: '16px',
  },
  sectionLabel: {
    margin: 0,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    color: '#fbbf24',
  },
  sectionTitle: {
    margin: '8px 0 0',
    color: '#f8fafc',
    fontSize: '24px',
  },
  bulkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
  },
  bulkCard: {
    padding: '18px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gap: '14px',
  },
  bulkDeviceLabel: {
    margin: 0,
    fontSize: '12px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(226, 232, 240, 0.6)',
  },
  bulkDeviceTitle: {
    margin: '8px 0 0',
    fontSize: '24px',
    color: '#fff',
  },
  bulkButtons: {
    display: 'flex',
    gap: '10px',
  },
  message: {
    margin: '0 0 18px',
    padding: '14px 16px',
    borderRadius: '14px',
    color: '#fed7aa',
    background: 'rgba(251, 146, 60, 0.12)',
    border: '1px solid rgba(251, 146, 60, 0.3)',
  },
  unitsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '18px',
  },
  unitCard: {
    padding: '20px',
    borderRadius: '24px',
    background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 50px rgba(2, 6, 23, 0.22)',
  },
  unitHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '18px',
  },
  unitLabel: {
    margin: 0,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'rgba(226, 232, 240, 0.65)',
  },
  unitTitle: {
    margin: '8px 0 0',
    fontSize: '30px',
    color: '#fff',
  },
  unitMeta: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  metaPill: {
    padding: '8px 12px',
    borderRadius: '999px',
    background: 'rgba(249, 115, 22, 0.14)',
    border: '1px solid rgba(249, 115, 22, 0.3)',
    color: '#fdba74',
    fontSize: '12px',
    fontWeight: 700,
  },
  metaPillMuted: {
    padding: '8px 12px',
    borderRadius: '999px',
    background: 'rgba(148, 163, 184, 0.1)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    color: '#cbd5e1',
    fontSize: '12px',
    fontWeight: 700,
  },
  deviceList: {
    display: 'grid',
    gap: '10px',
  },
  deviceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '16px',
    background: 'rgba(15, 23, 42, 0.44)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  deviceInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  deviceDot: {
    width: '12px',
    height: '12px',
    borderRadius: '999px',
    flexShrink: 0,
    boxShadow: '0 0 14px rgba(255,255,255,0.14)',
  },
  deviceName: {
    margin: 0,
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
  },
  deviceState: {
    margin: '4px 0 0',
    color: 'rgba(226, 232, 240, 0.72)',
    fontSize: '12px',
  },
  deviceActions: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    border: 'none',
    borderRadius: '14px',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    color: '#fff',
    flex: 1,
  },
  onButton: {
    boxShadow: '0 10px 22px rgba(15, 23, 42, 0.22)',
  },
  offButton: {
    background: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    color: '#e2e8f0',
  },
  miniButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '9px 12px',
    minWidth: '56px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    color: '#fff',
  },
  miniButtonActive: {
    background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
  },
  miniButtonDanger: {
    background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
  },
  miniButtonMuted: {
    background: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
  },
};
