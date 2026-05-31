import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useMap } from './MapContext';
import { useMapState } from '../../../hooks/useMapState';
import { MAP_MODES } from '../../../constants/mapModes';

interface Section {
  id?: string;
  heading?: string;
  queVes: string;
  porQueImporta: string;
  metodologia: string;
}

const MAP_HELP: Partial<Record<string, { title: string; sections: Section[] }>> = {
  [MAP_MODES.INFRASTRUCTURE]: {
    title: 'Infraestructura Ciclista',
    sections: [
      {
        queVes: 'Los tramos de la red ciclista de la ciudad, coloreados por tipo de infraestructura. Cada color representa un nivel diferente de protección: el carril bici segregado físicamente, la vía ciclista en calzada compartida, o la zona de velocidad reducida.',
        porQueImporta: 'Permite ver de un vistazo qué barrios tienen red protegida y cuáles solo tienen vías compartidas. Es el punto de partida para entender la cobertura real de una ciudad y comparar con otras.',
        metodologia: 'La red procede de OpenStreetMap enriquecido con datos municipales y verificación manual. Cada tramo se clasifica según el etiquetado oficial de tipo de vía ciclista en la fuente.',
      },
      {
        id: 'gcc-section',
        heading: 'Cobertura conectada (GCC)',
        queVes: 'Los edificios coloreados al activar esta capa pertenecen al radio de influencia de la Gran Componente Conexa — el mayor fragmento continuo de la red ciclista. Los edificios grises están cerca de algún tramo de carril, pero ese tramo está aislado: existe pero no conecta con ningún otro.',
        porQueImporta: 'Solo la GCC permite ir de un punto a otro de la ciudad sin salir del carril. Un porcentaje de GCC bajo significa que gran parte de la infraestructura construida no forma red navegable.',
        metodologia: 'Se aplica análisis de grafos para identificar la Gran Componente Conexa: el subconjunto más grande de tramos interconectados sin interrupciones.',
      },
    ],
  },
  [`${MAP_MODES.TRAFFIC}/rutas`]: {
    title: 'Trayectos ciclistas',
    sections: [
      {
        queVes: 'Los tramos de la red ciclista con un grosor y color proporcional al volumen de trayectos estimados que los utilizan. Los tramos más gruesos y oscuros son los más transitados.',
        porQueImporta: 'Muestra dónde se concentra el tráfico ciclista real. Los corredores más cargados son los prioritarios para mejorar con infraestructura y los que más riesgo concentran cuando no tienen carril protegido.',
        metodologia: 'El volumen de cada tramo es la suma de todos los trayectos asignados para la configuración activa. Los detalles de los modelos de generación y enrutamiento están en la ayuda de los controles de filtro.',
      },
    ],
  },
  [`${MAP_MODES.TRAFFIC}/od`]: {
    title: 'Desplazamientos Origen-Destino',
    sections: [
      {
        queVes: 'Una malla hexagonal sobre la ciudad donde cada celda representa una zona. El color indica cuántos viajes se generan o atraen. Las líneas entre hexágonos muestran los pares origen-destino más frecuentes — a mayor grosor, mayor flujo entre esas dos zonas.',
        porQueImporta: 'Revela qué partes de la ciudad se conectan entre sí por bici y dónde hay demanda real de desplazamiento sin infraestructura que la soporte. Una línea gruesa sin carril debajo es una oportunidad de inversión concreta.',
        metodologia: 'Se agregan los orígenes y destinos de todos los viajes del modelo en una malla hexagonal H3 (resolución 8, celdas de ~0,74 km²). Se muestran los 200.000 pares OD con más viajes; los desplazamientos dentro de la misma celda se excluyen.',
      },
    ],
  },
  [`${MAP_MODES.STATIONS}/trips`]: {
    title: 'Demanda por estación',
    sections: [
      {
        queVes: 'Las estaciones del servicio de bici pública representadas como círculos. El tamaño y color son proporcionales al número de trayectos estimados que parten o llegan a cada estación.',
        porQueImporta: 'Identifica qué estaciones concentran más actividad y cuáles están infrautilizadas. Las más oscuras y grandes son las que más necesitan flota suficiente y redistribución frecuente.',
        metodologia: 'Se agregan los datos de uso del sistema de bici pública —o el modelo de demanda— por estación y período seleccionado.',
      },
    ],
  },
  [`${MAP_MODES.STATIONS}/downtime`]: {
    title: 'Disponibilidad por estación',
    sections: [
      {
        queVes: 'Las estaciones coloreadas según cuánto tiempo permanecen inoperativas al día — sin bicicletas disponibles o sin anclajes libres. El rojo indica mayor tiempo de fallo.',
        porQueImporta: 'El momento que más frustra al usuario es cuando llega a una estación y no hay bici. Este mapa localiza exactamente dónde ocurre eso con más frecuencia y durante cuánto tiempo al día.',
        metodologia: 'Se analiza el log de ocupación de cada estación y se calcula el tiempo acumulado en estado crítico — vacía (empty) o llena (full) — durante el período seleccionado.',
      },
    ],
  },
  [`${MAP_MODES.STATIONS}/reach`]: {
    title: 'Cobertura por estación',
    sections: [
      {
        queVes: 'El área de influencia peatonal de cada estación, representada como un radio de 150 metros. Las zonas de la ciudad sin ningún radio encima quedan descubiertas — no hay ninguna estación accesible a pie en menos de dos minutos.',
        porQueImporta: 'Los huecos en la cobertura son las ubicaciones exactas donde una nueva estación tendría más impacto. Este mapa es el argumento geográfico más directo para decidir dónde ampliar la red.',
        metodologia: 'Para cada estación activa se traza un radio de 150 metros y se proyecta sobre el mapa. El umbral equivale a aproximadamente 90 segundos a pie.',
      },
    ],
  },
  [MAP_MODES.ACCIDENTS]: {
    title: 'Siniestralidad Ciclista',
    sections: [
      {
        queVes: 'Los accidentes con víctimas registrados en la ciudad, representados como puntos coloreados por nivel de gravedad — azul (ileso), amarillo (leve), rojo (grave) y granate (fatal). El filtro activo (Bicicleta / Todos) determina qué accidentes aparecen.',
        porQueImporta: 'Localiza los puntos negros de la ciudad — los cruces y calles donde se acumulan los siniestros. Es el mapa que deberían ver los responsables de planificación antes de decidir dónde invertir en infraestructura ciclista.',
        metodologia: 'Datos del registro oficial de accidentalidad de la DGT o equivalente municipal, georreferenciados al tramo donde ocurrió el accidente. Se representan exactamente tal como están registrados en la fuente.',
      },
    ],
  },
};

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[8px] font-black uppercase tracking-widest mb-0.5 text-black/40">{text}</p>
  );
}

export default function MapHelpPanel() {
  const { helpOpen, helpAnchor, closeMapHelp } = useMap();
  const { mode, submode } = useMapState();
  const [pulsingAnchor, setPulsingAnchor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const helpKey = submode ? `${mode}/${submode}` : mode;
  const entry = MAP_HELP[helpKey] ?? MAP_HELP[mode];

  useEffect(() => {
    if (!helpOpen || !helpAnchor || !entry) return;
    const timer = setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-section-id="${helpAnchor}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setPulsingAnchor(helpAnchor);
        setTimeout(() => setPulsingAnchor(null), 900);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [helpOpen, helpAnchor, entry]);

  if (!helpOpen || !entry) return null;

  return (
    <div
      className="absolute top-20 left-4 z-30 w-80 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0,0,0,0.10)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        maxHeight: 'calc(100% - 6rem)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 flex-shrink-0">
        <p className="text-sm font-bold text-black/85 leading-snug">{entry.title}</p>
        <button
          onClick={closeMapHelp}
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 bg-black/5 hover:bg-black/10 text-black/40 hover:text-black/75 transition-all"
          aria-label="Cerrar ayuda"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Scrollable sections */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {entry.sections.map((section, i) => (
          <div
            key={i}
            data-section-id={section.id}
            className={`flex flex-col gap-2 rounded-xl p-2 -m-2 transition-colors ${
              pulsingAnchor === section.id ? 'help-anchor-pulse' : ''
            }`}
          >
            {section.heading && (
              <p className="text-xs font-bold text-black/80 border-t border-black/10 pt-2 mt-1">{section.heading}</p>
            )}
            <div>
              <SectionLabel text="QUÉ VES" />
              <p className="text-[10.5px] leading-relaxed text-black/65">{section.queVes}</p>
            </div>
            <div>
              <SectionLabel text="POR QUÉ IMPORTA" />
              <p className="text-[10.5px] leading-relaxed text-black/65">{section.porQueImporta}</p>
            </div>
            <div>
              <SectionLabel text="METODOLOGÍA" />
              <p className="text-[10.5px] leading-relaxed text-black/65">{section.metodologia}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
