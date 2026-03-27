import React, { useState, useEffect, useRef } from 'react';
import {
  Users, GitBranch, Map, MessageSquare, Share2, BookOpen, ChevronDown,
} from 'lucide-react';

/* ─────────────────────────── data ─────────────────────────── */

const FAQ_ITEMS = [
  {
    q: '¿Qué es Bikes for Cities?',
    a: 'Bikes for Cities es una plataforma de datos abiertos que analiza la infraestructura ciclista de las ciudades españolas, combinando datos de OpenStreetMap, GBFS y estadísticas municipales.',
  },
  {
    q: '¿De dónde provienen los datos?',
    a: 'Utilizamos fuentes abiertas: OpenStreetMap para la red ciclista, sistemas públicos de bicicleta compartida (GBFS), y datos del Instituto Nacional de Estadística.',
  },
  {
    q: '¿Con qué frecuencia se actualizan?',
    a: 'Los datos de carril bici se actualizan mensualmente desde OSM. Los datos de estaciones de bicicletas compartidas se sincronizan cada hora.',
  },
  {
    q: '¿Puedo usar los datos en mi proyecto?',
    a: 'Sí. Los datos derivados de OSM se publican bajo licencia ODbL. Los análisis y visualizaciones propias del proyecto están bajo CC BY 4.0.',
  },
  {
    q: '¿Cómo puedo reportar un error en los datos?',
    a: 'Puedes abrir un issue en nuestro repositorio de GitHub o contactarnos directamente a través del formulario de la web.',
  },
];

const INVOLVEMENT_ITEMS = [
  {
    icon: Map,
    label: 'Mapea',
    color: 'var(--green-dark)',
    bg: 'rgba(2,122,118,0.12)',
    description:
      'Contribuye a OpenStreetMap trazando carriles bici, aparcamientos y señales en tu ciudad. Cada trazo mejora nuestros análisis automáticamente.',
  },
  {
    icon: GitBranch,
    label: 'Contribuye',
    color: 'var(--blue)',
    bg: 'rgba(58,108,127,0.12)',
    description:
      'El código es abierto y está en GitHub. Acepta retos abiertos, mejora la API o añade visualizaciones nuevas. Cualquier pull request es bienvenido.',
  },
  {
    icon: MessageSquare,
    label: 'Opina',
    color: 'var(--orange)',
    bg: 'rgba(255,127,80,0.12)',
    description:
      'Comparte tu experiencia ciclista con GIS abierto. Tus comentarios sobre qué datos faltan dirigen nuestras próximas iteraciones.',
  },
  {
    icon: Share2,
    label: 'Difunde',
    color: 'var(--yellow)',
    bg: 'rgba(244,162,76,0.12)',
    description:
      'Menciona el proyecto en redes, blogs o en tu ayuntamiento. Cuanta más visibilidad tenga, más ciudades podremos incorporar.',
  },
  {
    icon: BookOpen,
    label: 'Aprende',
    color: 'var(--red)',
    bg: 'rgba(175,71,73,0.12)',
    description:
      'Consulta nuestra documentación y tutoriales para entender cómo analizar datos de movilidad con Python, QGIS o directamente desde la API.',
  },
  {
    icon: Users,
    label: 'Únete',
    color: 'var(--green)',
    bg: 'rgba(123,164,146,0.12)',
    description:
      'Forma parte de la comunidad de activistas y técnicos que trabajan por ciudades más amigables con la bici. Organizamos meetups online cada mes.',
  },
];

/* ─────────────────────────── FAQ accordion ─────────────────── */

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-3">
      {FAQ_ITEMS.map((item, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden"
          style={{
            background: open === i ? 'rgba(2,122,118,0.07)' : 'rgba(255,255,255,0.55)',
            border: `1.5px solid ${open === i ? 'rgba(2,122,118,0.35)' : 'rgba(0,0,0,0.07)'}`,
            backdropFilter: 'blur(8px)',
            transition: 'background 0.3s, border-color 0.3s',
          }}
        >
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left gap-3"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span
              className="text-base font-semibold"
              style={{ color: open === i ? 'var(--green-dark)' : 'var(--black)' }}
            >
              {item.q}
            </span>
            <ChevronDown
              size={18}
              style={{
                color: 'var(--green-dark)',
                transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
                flexShrink: 0,
              }}
            />
          </button>
          <div
            style={{
              maxHeight: open === i ? '200px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: 'var(--blue-dark)' }}>
              {item.a}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── 3-D ellipse carousel ──────────────────── */

const ELLIPSE_RX = 220; // horizontal radius
const ELLIPSE_RY = 100; // vertical radius
const N = INVOLVEMENT_ITEMS.length;
const ICON_D = 100;      // icon circle diameter

interface OrbitItem {
  item: typeof INVOLVEMENT_ITEMS[0];
  index: number;
  x: number;
  y: number;
  z: number; // -1 … 1  (depth)
  scale: number;
  opacity: number;
  angleRad: number;
}

function computeOrbit(baseAngle: number): OrbitItem[] {
  return INVOLVEMENT_ITEMS.map((item, i) => {
    const a = baseAngle + (2 * Math.PI * i) / N;
    const x = ELLIPSE_RX * Math.cos(a);
    const y = ELLIPSE_RY * Math.sin(a);
    const z = Math.sin(a); // 1 = front, -1 = back
    const scale = 0.6 + 0.4 * ((z + 1) / 2);
    const opacity = 0.35 + 0.65 * ((z + 1) / 2);
    return {
      item,
      index: i,
      x,
      y,
      z,
      scale,
      opacity,
      angleRad: a,
    };
  }).sort((a, b) => a.z - b.z); // paint back-to-front
}

function OrbitCarousel({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (i: number) => void;
}) {
  // Use a state for the current display angle to allow smooth rotation along the path
  const [displayAngle, setDisplayAngle] = useState(Math.PI / 2 - (2 * Math.PI * selected) / N);
  const rafRef = useRef<number>(0);
  const targetRef = useRef<number>(displayAngle);

  useEffect(() => {
    // Target angle to bring selected item to front-center (PI/2)
    const newTarget = Math.PI / 2 - (2 * Math.PI * selected) / N;

    // Shortest path logic: ensure we don't rotate 300 degrees when 60 would do
    let adjustedTarget = newTarget;
    const diff = newTarget - targetRef.current;

    // Normalize difference to [-PI, PI]
    const wrappedDiff = ((((diff + Math.PI) % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI)) - Math.PI;
    adjustedTarget = targetRef.current + wrappedDiff;

    targetRef.current = adjustedTarget;

    const animate = () => {
      setDisplayAngle(prev => {
        const delta = targetRef.current - prev;
        // Smoother LERP: 0.001 factor for a less aggressive response
        if (Math.abs(delta) < 0.001) return targetRef.current;

        rafRef.current = requestAnimationFrame(animate);
        return prev + delta * 0.001;
      });
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [selected]);

  const items = computeOrbit(displayAngle);
  const W = ELLIPSE_RX * 2 + ICON_D + 60;
  const H = ELLIPSE_RY * 2 + ICON_D + 60;

  return (
    <div
      style={{
        width: W,
        height: H,
        position: 'relative',
        margin: '0 auto',
      }}
    >
      {items.map(({
        item, index, x, y, z, scale, opacity,
      }) => {
        const isSelected = selected === index;
        const Icon = item.icon;

        const cx = W / 2 + x - ICON_D / 2;
        const cy = H / 2 + y - ICON_D / 2;

        return (
          <div
            key={index}
            onClick={() => onSelect(index)}
            style={{
              position: 'absolute',
              left: cx,
              top: cy,
              width: ICON_D,
              height: ICON_D,
              // When selected, scale it up significantly (1.5x)
              transform: `scale(${isSelected ? 1.5 : scale})`,
              opacity: isSelected ? 1 : opacity,
              zIndex: isSelected ? 1000 : Math.round((z + 1) * 100),
              cursor: 'pointer',
              // We remove transitions on left/top to let requestAnimationFrame handle trajectory
              // but keep them on scale/opacity/rotation for extra smoothness
              transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s ease',
            }}
          >
            <div
              style={{
                width: ICON_D,
                height: ICON_D,
                borderRadius: '50%',
                background: isSelected ? item.color : item.bg,
                border: `2.5px solid ${isSelected ? item.color : 'rgba(0,0,0,0.08)'}`,
                boxShadow: isSelected
                  ? `0 0 0 8px ${item.color}22, 0 16px 40px ${item.color}55`
                  : '0 4px 16px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            >
              <Icon
                size={isSelected ? 36 : 28}
                style={{
                  color: isSelected ? '#fff' : item.color,
                  transition: 'size 0.3s, color 0.3s',
                }}
              />
              <span
                style={{
                  fontSize: isSelected ? '0.8rem' : '0.65rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isSelected ? '#fff' : item.color,
                  lineHeight: 1,
                  transition: 'font-size 0.3s, color 0.3s',
                }}
              >
                {item.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────── main section ─────────────────────── */

const GetInvolvedSection: React.FC = () => {
  const [selected, setSelected] = useState(0);
  const active = INVOLVEMENT_ITEMS[selected];

  return (
    <section
      id="get-involved"
      className="w-full px-6 py-20"
      style={{ background: 'var(--cream)' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section title */}
        <h2
          className="text-5xl lg:text-6xl font-heading font-bold mb-12 tracking-tight"
          style={{
            background: 'linear-gradient(135deg, var(--blue-dark), var(--green-dark))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Cómo participar
        </h2>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* ── Left: FAQ ── */}
          <div className="flex-1 w-full">
            <p
              className="text-lg mb-6 leading-relaxed"
              style={{ color: 'var(--blue-dark)', opacity: 0.8 }}
            >
              Preguntas frecuentes
            </p>
            <FaqAccordion />
          </div>

          {/* ── Right: orbit carousel ── */}
          <div className="flex-1 flex flex-col items-center gap-6">
            <OrbitCarousel selected={selected} onSelect={setSelected} />
            {/* Description card */}
            <div
              key={selected}
              style={{
                width: '100%',
                borderRadius: '1.25rem',
                background: 'rgba(255,255,255,0.65)',
                border: `2px solid ${active.color}44`,
                backdropFilter: 'blur(12px)',
                padding: '1.5rem',
                animation: 'fadeSlideUp 0.35s ease',
                boxShadow: `0 8px 32px ${active.color}22`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: active.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <active.icon size={18} color="#fff" />
                </div>
                <h3
                  className="text-xl font-heading font-bold"
                  style={{ color: active.color }}
                >
                  {active.label}
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--blue-dark)' }}>
                {active.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* keyframe definition */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
};

export default GetInvolvedSection;
