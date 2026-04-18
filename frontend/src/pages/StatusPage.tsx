import React, { useEffect, useState } from 'react';
import { fetchSystemStatus, type SystemStatus } from '../services/api';

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  SUCCESS:     { bg: 'color-mix(in srgb, var(--green-light) 35%, transparent)', text: 'var(--green-dark)', dot: 'var(--green)' },
  RUNNING:     { bg: 'color-mix(in srgb, #fde68a 40%, transparent)',            text: '#92400e',           dot: '#f59e0b' },
  FAILED:      { bg: 'color-mix(in srgb, #fecaca 40%, transparent)',            text: '#991b1b',           dot: '#ef4444' },
  FAILED_MONTH:{ bg: 'color-mix(in srgb, #fed7aa 40%, transparent)',            text: '#9a3412',           dot: '#f97316' },
  SKIPPED:     { bg: 'color-mix(in srgb, #e2e8f0 40%, transparent)',            text: '#475569',           dot: '#94a3b8' },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.SKIPPED;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
      {status}
    </span>
  );
}

function SectionBadge({ color, children }: { color: 'green' | 'blue'; children: React.ReactNode }) {
  const isGreen = color === 'green';
  return (
    <span
      className="inline-block text-xs font-semibold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
      style={{
        color: isGreen ? 'var(--green-dark)' : 'var(--blue-dark)',
        backgroundColor: isGreen
          ? 'color-mix(in srgb, var(--green-light) 40%, transparent)'
          : 'color-mix(in srgb, var(--blue-light) 35%, transparent)',
      }}
    >
      {children}
    </span>
  );
}

const StatusPage: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemStatus()
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
        <p className="text-sm" style={{ color: '#991b1b' }}>Error: {error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
        <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--black) 50%, transparent)' }}>Cargando…</p>
      </div>
    );
  }

  const generatedAt = new Date(status.generated_at).toLocaleString('es-ES', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  const totalNodes = status.cities.reduce((s, c) => s + c.nodes, 0);
  const totalEdges = status.cities.reduce((s, c) => s + c.edges, 0);
  const totalRoutes = status.cities.reduce((s, c) => s + c.routes, 0);

  const failedCount = status.ingestion.filter(r => r.status.startsWith('FAILED')).length;
  const runningCount = status.ingestion.filter(r => r.status === 'RUNNING').length;

  const cities = [...new Set(status.ingestion.map(r => r.city))].sort();

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--cream)', fontFamily: 'var(--body)' }}>
      <div className="max-w-5xl mx-auto px-6 py-24 space-y-20">

        {/* Header */}
        <section>
          <SectionBadge color="green">Sistema</SectionBadge>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-3" style={{ color: 'var(--black)' }}>
            Estado del sistema
          </h1>
          <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--black) 50%, transparent)' }}>
            Actualizado el {generatedAt}
            {failedCount > 0 && (
              <span className="ml-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#991b1b' }}>
                · {failedCount} proceso{failedCount > 1 ? 's' : ''} con error
              </span>
            )}
            {runningCount > 0 && (
              <span className="ml-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#92400e' }}>
                · {runningCount} ejecutándose
              </span>
            )}
          </p>
        </section>

        {/* Summary stats */}
        <section>
          <SectionBadge color="green">Resumen</SectionBadge>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--black)' }}>Datos cargados</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Ciudades', value: status.cities.length },
              { label: 'Nodos', value: totalNodes.toLocaleString('es-ES') },
              { label: 'Aristas', value: totalEdges.toLocaleString('es-ES') },
              { label: 'Rutas', value: totalRoutes.toLocaleString('es-ES') },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl p-5 border"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--green-light) 20%, white)',
                  borderColor: 'color-mix(in srgb, var(--green-light) 60%, transparent)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-1"
                   style={{ color: 'var(--green-dark)' }}>{label}</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--black)' }}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Per-city breakdown */}
        <section>
          <SectionBadge color="blue">Ciudades</SectionBadge>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--black)' }}>Por ciudad</h2>
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'color-mix(in srgb, var(--blue-light) 50%, transparent)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'color-mix(in srgb, var(--blue-light) 25%, white)' }}>
                  {['Ciudad', 'Nodos', 'Aristas', 'Rutas'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--blue-dark)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {status.cities.map((city, i) => (
                  <tr
                    key={city.id}
                    style={{ backgroundColor: i % 2 === 0 ? 'white' : 'color-mix(in srgb, var(--blue-light) 10%, white)' }}
                  >
                    <td className="px-5 py-3 font-semibold" style={{ color: 'var(--black)' }}>{city.name}</td>
                    <td className="px-5 py-3" style={{ color: 'color-mix(in srgb, var(--black) 70%, transparent)' }}>
                      {city.nodes.toLocaleString('es-ES')}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'color-mix(in srgb, var(--black) 70%, transparent)' }}>
                      {city.edges.toLocaleString('es-ES')}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'color-mix(in srgb, var(--black) 70%, transparent)' }}>
                      {city.routes.toLocaleString('es-ES')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ingestion pipeline */}
        <section className="pb-12">
          <SectionBadge color="green">Ingesta</SectionBadge>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--black)' }}>Estado de la ingesta</h2>
          <div className="space-y-8">
            {cities.map(city => {
              const rows = status.ingestion.filter(r => r.city === city);
              return (
                <div key={city}>
                  <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--green-dark)' }}>{city}</h3>
                  <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'color-mix(in srgb, var(--green-light) 50%, transparent)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'color-mix(in srgb, var(--green-light) 20%, white)' }}>
                          {['Proceso', 'Estado', 'Última actualización'].map(h => (
                            <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-widest"
                                style={{ color: 'var(--green-dark)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={row.process_name}
                              style={{ backgroundColor: i % 2 === 0 ? 'white' : 'color-mix(in srgb, var(--green-light) 8%, white)' }}>
                            <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--black)' }}>
                              {row.process_name}
                            </td>
                            <td className="px-5 py-3">
                              <StatusPill status={row.status} />
                            </td>
                            <td className="px-5 py-3 text-xs" style={{ color: 'color-mix(in srgb, var(--black) 50%, transparent)' }}>
                              {row.updated_at
                                ? new Date(row.updated_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
};

export default StatusPage;
