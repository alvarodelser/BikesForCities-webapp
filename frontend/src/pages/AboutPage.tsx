import React from 'react';
import {
  Users,
  Bike,
} from 'lucide-react';
import InfoCard, { type InfoItem } from '../components/ui/InfoCard';
import ScrollableCardList from '../components/ui/ScrollableCardList';

// ─── Data Mapping ────────────────────────────────────────────────────────────

import DATA_SOURCES_JSON from '../constants/dataSources.json';
import RESEARCH_ITEMS_JSON from '../constants/researchItems.json';
import OFFICIAL_DOCS_JSON from '../constants/officialDocuments.json';
import BOOKS_JSON from '../constants/books.json';

const DATA_SOURCES = DATA_SOURCES_JSON as InfoItem[];
const RESEARCH_ITEMS = RESEARCH_ITEMS_JSON as InfoItem[];
const OFFICIAL_DOCS = OFFICIAL_DOCS_JSON as InfoItem[];
const BOOKS = BOOKS_JSON as InfoItem[];


// ─── Component ────────────────────────────────────────────────────────────────

const AboutPage: React.FC = () => {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--cream)', fontFamily: 'var(--body)' }}
    >
      <div className="max-w-[var(--container-max)] mx-auto px-[var(--space-gutter)] pt-32 pb-[var(--space-section-y)] md:py-[var(--space-section-y)] space-y-24">

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
              className="text-4xl md:text-5xl font-bold leading-tight mb-6 max-w-2xl"
              style={{ color: 'var(--black)' }}
            >
              Datos abiertos al servicio de la bicicleta
            </h1>
            <div className="max-w-xl space-y-4">
              <p className="text-base leading-relaxed" style={{ color: 'color-mix(in srgb, var(--black) 75%, transparent)' }}>
                <strong>BikesForCities</strong> es un proyecto de investigación independiente que reúne,
                procesa y visualiza datos públicos sobre movilidad ciclista en ciudades españolas.
                Queremos construir un punto de encuentro entre ciudadanos, asociaciones, técnicos municipales e investigadores para promover el uso de la bicicleta como medio de transporte mediante la identificación de las dificultades actuales y la propuesta de soluciones efectivas.
              </p>
              <p className="text-base leading-relaxed" style={{ color: 'color-mix(in srgb, var(--black) 75%, transparent)' }}>
                Combinamos datos geoespaciales de OpenStreetMap, datos abiertos de ayuntamientos españoles, estadísticas del INE y presupuestos municipales para construir métricas
                comparables y reproducibles. Toda la metodología es abierta y está documentada.
              </p>
              <p className="text-base leading-relaxed" style={{ color: 'color-mix(in srgb, var(--black) 75%, transparent)' }}>
                Soy Álvaro, investigador apasionado por la movilidad urbana.
                Creé <strong>BikesForCities</strong> convencido de que la bicicleta tiene el potencial de transformar completamente
                nuestras ciudades, y de que eso empieza por invertir en infraestructura basada en datos. Cuento con el apoyo
                de una red de investigadores, creativos y urbanistas que comparten esa visión y
                contribuyen a que el proyecto crezca.
              </p>
            </div>
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
                WIP.
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

        {/* ── Official Documents carousel ──────────────────────────────────── */}
        <section>
          <div className="mb-10">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
              style={{
                color: 'var(--green-dark)',
                backgroundColor: 'color-mix(in srgb, var(--green-light) 40%, transparent)',
              }}
            >
              Marco normativo
            </span>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--black)' }}>
              Documentos oficiales
            </h2>
            <p className="text-sm mt-2" style={{ color: 'color-mix(in srgb, var(--black) 60%, transparent)' }}>
              Leyes, estrategias e informes institucionales que enmarcan la política ciclista en España.
            </p>
          </div>

          <ScrollableCardList>
            {OFFICIAL_DOCS.map((item) => (
              <InfoCard key={item.id} item={item} />
            ))}
          </ScrollableCardList>
        </section>

        {/* ── Research carousel ───────────────────────────────────────────── */}
        <section id="library">
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

        {/* ── Books carousel ──────────────────────────────────────────────── */}
        <section className="pb-12">
          <div className="mb-10">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
              style={{
                color: '#b71c1c',
                backgroundColor: 'rgba(183, 28, 28, 0.08)',
              }}
            >
              Biblioteca
            </span>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--black)' }}>
              Libros recomendados
            </h2>
            <p className="text-sm mt-2" style={{ color: 'color-mix(in srgb, var(--black) 60%, transparent)' }}>
              Lecturas esenciales sobre urbanismo ciclista, movilidad sostenible y diseño de ciudades.
            </p>
          </div>

          <ScrollableCardList>
            {BOOKS.map((item) => (
              <InfoCard key={item.id} item={item} />
            ))}
          </ScrollableCardList>
        </section>

      </div>
    </div>
  );
};

export default AboutPage;