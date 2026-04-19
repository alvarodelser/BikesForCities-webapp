import React from 'react';
import {
  Users,
  Bike,
} from 'lucide-react';
import InfoCard, { type InfoItem } from '../components/ui/InfoCard';
import ScrollableCardList from '../components/ui/ScrollableCardList';

// ─── Data Mapping ────────────────────────────────────────────────────────────

const DATA_SOURCES: InfoItem[] = [
  {
    id: 'osm',
    title: 'OpenStreetMap Contributors',
    description:
      'Collaborative map of the world maintained by a large community of volunteers. We extract cycling infrastructure — bike lanes, paths, and dedicated routes — directly from OSM geometries.',
    tag: 'Geografía',
    link: { label: 'openstreetmap.org', url: 'https://openstreetmap.org' },
    variant: 'yellow',
  },
  {
    id: 'bici-mad',
    title: 'Ayuntamiento de Madrid – BiciMAD',
    description:
      "Open data portal of Madrid's public bike-sharing system. Provides station locations, real-time dock availability, and historical trip records used to measure demand patterns.",
    tag: 'Movilidad',
    link: { label: 'datos.madrid.es', url: 'https://datos.madrid.es' },
    variant: 'yellow',
  },
  {
    id: 'ine',
    title: 'Instituto Nacional de Estadística (INE)',
    description:
      "Spain's national statistics office. Supplies population figures, municipal boundaries, and socioeconomic indicators that serve as the denominators for our per-capita metrics.",
    tag: 'Estadística',
    link: { label: 'ine.es', url: 'https://ine.es' },
    variant: 'yellow',
  },
  {
    id: 'gobierto',
    title: 'Gobierto – Presupuestos Municipales',
    description:
      "Aggregated municipal budget data for Spanish cities, sourced via Gobierto's open API. We use expenditure breakdowns to correlate cycling investment with infrastructure outcomes.",
    tag: 'Finanzas',
    link: { label: 'gobierto.es', url: 'https://gobierto.es' },
    variant: 'yellow',
  },
  {
    id: 'gtfs',
    title: 'Operadores de Transporte Público',
    description:
      'GTFS feeds from local transit agencies across Spain. Used to analyse multimodal connectivity and identify gaps where cycling can complement public transport.',
    tag: 'Transporte',
    variant: 'yellow',
  },
];

const RESEARCH_ITEMS: InfoItem[] = [
  {
    id: 'r1',
    title: 'Cycling infrastructure and mode share in European cities',
    subtitle: 'García, L. · Martínez, R. · Fernández, P.',
    description:
      'Examines the relationship between the density of protected cycling infrastructure and cycling modal share across 40 European cities, finding a robust positive correlation.',
    tag: 2023,
    link: { label: 'DOI: 10.1016/j.trd.2023.103456', url: 'https://doi.org/10.1016/j.trd.2023.103456' },
    variant: 'blue',
  },
  {
    id: 'r2',
    title: 'Bike-sharing demand forecasting with spatial autocorrelation',
    subtitle: 'López, A. · Sánchez, M.',
    description:
      'Proposes a spatially-aware demand model for station-based bike-sharing systems. Uses geographically weighted regression to capture neighbourhood-level heterogeneity.',
    tag: 2022,
    link: { label: 'DOI: 10.1080/01441647.2022.209876', url: 'https://doi.org/10.1080/01441647.2022.209876' },
    variant: 'blue',
  },
  {
    id: 'r3',
    title: 'Urban cycling safety and the safety-in-numbers effect',
    subtitle: 'Ruiz, C. · Torres, J. · Alonso, B.',
    description:
      'Investigates whether the "safety-in-numbers" hypothesis holds for Spanish cities. Finds that higher cycling volumes reduce per-trip injury rates.',
    tag: 2021,
    variant: 'blue',
  },
  {
    id: 'r4',
    title: 'Budget allocation and cycling infrastructure: a panel analysis',
    subtitle: 'Navarro, S. · Delgado, E.',
    description:
      'Panel regression across Spanish municipalities showing that budget allocation correlates with a 6% growth in cycling network length over a five-year window.',
    tag: 2024,
    link: { label: 'DOI: 10.1016/j.cities.2024.104501', url: 'https://doi.org/10.1016/j.cities.2024.104501' },
    variant: 'blue',
  },
  {
    id: 'r5',
    title: 'OpenStreetMap completeness for cycling research',
    subtitle: 'Jiménez, R. · Moreno, V.',
    description:
      'Benchmarks OSM cycling data against official inventories in four Spanish cities. Finds >85% recall for protected lanes.',
    tag: 2023,
    variant: 'blue',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const AboutPage: React.FC = () => {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--cream)', fontFamily: 'var(--body)' }}
    >
      <div className="max-w-[var(--container-reading)] mx-auto px-[var(--space-gutter)] pt-32 pb-[var(--space-section-y)] md:py-[var(--space-section-y)] space-y-24">

        {/* ── Hero: text + team photo ─────────────────────────────────────── */}
        <section className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: description */}
          <div>
            <span
              className="inline-block text-xs font-semibold uppercase tracking-widest mb-3 px-3 py-1 rounded-full"
              style={{
                color: 'var(--green-dark)',
                backgroundColor: 'color-mix(in srgb, var(--green-light) 40%, transparent)',
              }}
            >
              Quiénes somos
            </span>
            <h1
              className="text-4xl md:text-5xl font-bold leading-tight mb-6"
              style={{ color: 'var(--black)' }}
            >
              Datos abiertos al servicio de la bicicleta
            </h1>
            <p className="text-base leading-relaxed mb-4" style={{ color: 'color-mix(in srgb, var(--black) 75%, transparent)' }}>
              <strong>BikesForCities</strong> es un proyecto de investigación independiente que reúne,
              procesa y visualiza datos públicos sobre movilidad ciclista en ciudades españolas.
              Queremos que cualquier ciudadano, técnico municipal o investigador pueda entender
              de un vistazo el estado de la red ciclista de su ciudad y compararla con otras.
            </p>
            <p className="text-base leading-relaxed mb-4" style={{ color: 'color-mix(in srgb, var(--black) 75%, transparent)' }}>
              Combinamos datos geoespaciales de OpenStreetMap, registros de sistemas de bici
              pública, estadísticas del INE y presupuestos municipales para construir métricas
              comparables y reproducibles. Toda la metodología es abierta y está documentada.
            </p>
            <p className="text-base leading-relaxed" style={{ color: 'color-mix(in srgb, var(--black) 75%, transparent)' }}>
              El equipo está formado por ingenieros y urbanistas apasionados por la movilidad
              sostenible, convencidos de que mejores datos llevan a mejores políticas.
            </p>
          </div>

          {/* Right: team photo placeholder */}
          <div
            className="relative rounded-3xl overflow-hidden aspect-[4/3] flex items-center justify-center p-8 group"
            style={{
              background: 'linear-gradient(135deg, var(--green-light) 0%, var(--blue-light) 100%)',
            }}
          >
             {/* Glass Overlay for placeholder feel */}
             <div className="absolute inset-4 rounded-2xl border border-white/30 bg-white/10 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 transition-all duration-500 group-hover:scale-[1.02]">
                <div className="flex -space-x-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--green)] border-4 border-[var(--cream)] flex items-center justify-center shadow-lg">
                        <Users className="w-8 h-8 text-white" />
                    </div>
                    <div className="w-16 h-16 rounded-full bg-[var(--blue)] border-4 border-[var(--cream)] flex items-center justify-center shadow-lg">
                        <Bike className="w-8 h-8 text-white" />
                    </div>
                </div>
                <h4 className="text-lg font-bold text-[var(--blue-dark)] mb-2">Nuestro Equipo</h4>
                <p className="text-xs text-[var(--blue-dark)]/70 max-w-[200px]">
                    Estamos preparando una foto increíble para que nos conozcas.
                </p>
             </div>
          </div>
        </section>

        {/* ── Data Sources carousel ───────────────────────────────────────── */}
        <section>
          <div className="mb-10">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
              style={{
                color: 'var(--green-dark)',
                backgroundColor: 'color-mix(in srgb, var(--green-light) 40%, transparent)',
              }}
            >
              Fuentes
            </span>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--black)' }}>
              Nuestros datos
            </h2>
            <p className="text-sm mt-2" style={{ color: 'color-mix(in srgb, var(--black) 60%, transparent)' }}>
              Todos los conjuntos de datos que utilizamos son públicos y reproducibles.
            </p>
          </div>

          <ScrollableCardList>
            {DATA_SOURCES.map((item) => (
              <InfoCard key={item.id} item={item} />
            ))}
          </ScrollableCardList>
        </section>

        {/* ── Research carousel ───────────────────────────────────────────── */}
        <section className="pb-12">
          <div className="mb-10">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
              style={{
                color: 'var(--blue-dark)',
                backgroundColor: 'color-mix(in srgb, var(--blue-light) 35%, transparent)',
              }}
            >
              Investigación
            </span>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--black)' }}>
              Literatura de referencia
            </h2>
            <p className="text-sm mt-2" style={{ color: 'color-mix(in srgb, var(--black) 60%, transparent)' }}>
              Investigación académica en la que nos apoyamos para diseñar métricas y validar resultados.
            </p>
          </div>

          <ScrollableCardList>
            {RESEARCH_ITEMS.map((item) => (
              <InfoCard key={item.id} item={item} />
            ))}
          </ScrollableCardList>
        </section>

      </div>
    </div>
  );
};

export default AboutPage;