import React from 'react';
import InfoCard, { type InfoItem } from '../components/ui/InfoCard';
import ScrollableCardList from '../components/ui/ScrollableCardList';
import Reveal from '../components/ui/Reveal';

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
        <Reveal delay={0}>
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

          {/* Right: team video presentation */}
          <div className="flex flex-col gap-4">
            <div className="relative rounded-3xl overflow-hidden aspect-[4/3] w-full">
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/90wljM8UF1U"
                title="Presentación de BikesForCities"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <p className="text-sm text-[var(--blue-dark)]/70 text-left ml-2">Presentación de la plataforma</p>
          </div>
        </section>
        </Reveal>

        {/* ── Data Sources carousel ───────────────────────────────────────── */}
        <Reveal delay={90}>
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
        </Reveal>

        {/* ── Official Documents carousel ──────────────────────────────────── */}
        <Reveal delay={90}>
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
        </Reveal>

        {/* ── Research carousel ───────────────────────────────────────────── */}
        <Reveal delay={90}>
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
        </Reveal>

        {/* ── Books carousel ──────────────────────────────────────────────── */}
        <Reveal delay={90}>
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
        </Reveal>

      </div>
    </div>
  );
};

export default AboutPage;