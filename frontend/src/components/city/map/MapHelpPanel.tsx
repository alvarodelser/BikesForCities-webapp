import { useEffect, useRef, useState } from 'react';
import { X, MousePointerClick, ToggleLeft } from 'lucide-react';
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
        heading: 'Cobertura conectada (GCC) — activa con el interruptor en la leyenda',
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
      {
        heading: 'Trayectos que usan el tramo — haz clic en un tramo',
        queVes: 'Al seleccionar un tramo se resalta en ámbar y el resto desaparece. Un panel muestra el volumen mensual y la posición del tramo en la distribución global mediante una barra de color. Debajo se dibujan todos los trayectos que lo recorren, ya sea como líneas individuales (modo Trayecto) o como mapa de calor de densidad (modo Calor). Puedes alternar entre ambas vistas desde el propio panel.',
        porQueImporta: 'Ver los trayectos completos de quienes usan ese tramo revela de dónde vienen y adónde van — información clave para decidir qué extensiones de red añadir aguas arriba o aguas abajo del punto problemático.',
        metodologia: 'Se recuperan hasta los primeros 100 trayectos que incluyen ese tramo, paginados. El mapa de calor acumula los orígenes y destinos de todos ellos para mostrar densidad sin saturar la pantalla con líneas individuales.',
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
      {
        heading: 'Flujos de una zona — haz clic en un nodo',
        queVes: 'Haz clic en un nodo (círculo morado) para seleccionar esa zona. Al hacerlo, todos los flujos conectados a ella se iluminan en ámbar y el resto se atenúa, permitiendo ver de un vistazo qué otras zonas se relacionan con la seleccionada. Un panel lateral muestra el número de conexiones y el total de viajes vinculados. Haz clic en el fondo del mapa o en otro nodo para cambiar la selección.',
        porQueImporta: 'Permite analizar el rol de cada zona en la red de movilidad — si es un origen fuerte, un destino, o un nodo intermediario — y comparar la intensidad de sus conexiones con las de otras zonas.',
        metodologia: 'Al seleccionar un nodo, se filtran los 500 pares OD principales que tienen esa celda como origen o destino. El grosor de cada línea iluminada es proporcional (escala logarítmica) al flujo del par respecto al máximo de esa selección.',
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
      {
        heading: 'Curva de demanda horaria — haz clic en una estación',
        queVes: 'Al seleccionar una estación aparece un panel con el nombre, la demanda mensual total y el desglose de entradas y salidas. Debajo se muestra la curva de demanda horaria: dos líneas superpuestas que representan la tasa de llegadas (azul) y salidas (naranja) a lo largo del día.',
        porQueImporta: 'La forma de la curva revela el patrón de uso — un pico matutino de salidas seguido de uno vespertino de entradas es la firma de una estación de ida al trabajo. Identifica cuándo la estación necesita ser recargada o vaciada.',
        metodologia: 'La curva horaria es el perfil de demanda del modelo de generación de viajes para esa estación: λ (tasa de salida) y μ (tasa de llegada) estimadas para cada hora del día.',
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
      {
        heading: 'Perfil de disponibilidad horaria — haz clic en una estación',
        queVes: 'Al seleccionar una estación aparece un panel con el tiempo de inactividad diario medio y una gráfica de bicis disponibles por hora. Las horas marcadas en rojo (< 3 bicis) son las franjas con mayor riesgo de encontrar la estación vacía. Un filtro permite ver el perfil en días laborables, fin de semana, o el promedio global.',
        porQueImporta: 'Cruzar el mapa con el gráfico horario responde a la pregunta más concreta: ¿a qué hora del día falla esta estación? Con eso se puede afinar el plan de redistribución de flota.',
        metodologia: 'La curva es el promedio de bicis disponibles por hora según el log histórico de ocupación para el período seleccionado. La línea de referencia es la capacidad mediana de todas las estaciones de la ciudad.',
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
      {
        heading: 'Alcance peatonal real — haz clic en una estación',
        queVes: 'Al seleccionar una estación se despliegan tres capas: el área real de alcance peatonal (polígono de red viaria, no vuelo de pájaro), un círculo de referencia de 150 m en trazo discontinuo, y los tramos de calle coloreados por distancia en gradiente viridis (morado → azul → verde). El panel lateral muestra el porcentaje de cobertura real sobre el radio teórico.',
        porQueImporta: 'El polígono revela cómo la geometría de las manzanas y la existencia de barreras (vías rápidas, parques cerrados, ríos) reduce o amplía el alcance real frente al radio teórico.',
        metodologia: 'El polígono se calcula con análisis de red peatonal: desde la estación seleccionada se expande un isócrono de 150 m recorriendo la red de calles. El porcentaje de cobertura es el área del polígono como fracción del radio circular teórico.',
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
  [MAP_MODES.TRANSPARENCY]: {
    title: 'Presupuesto Municipal',
    sections: [
      {
        queVes: 'Un gráfico de anillos que desglosa el presupuesto municipal por áreas de gasto. El tamaño de cada arco es proporcional a su importe. Los segmentos en verde destacan las partidas de movilidad urbana. Haz clic en cualquier segmento para profundizar en sus subcategorías; vuelve atrás pulsando el centro.',
        porQueImporta: 'Permite ver de un vistazo cómo distribuye el ayuntamiento su presupuesto y qué peso tiene la inversión en movilidad sostenible frente al total. Es la base para comparar prioridades presupuestarias entre ciudades.',
        metodologia: 'Datos de presupuestos municipales oficiales, clasificados por función económica. Las partidas de movilidad se identifican por sus códigos funcionales: 133 Tráfico, 134 Movilidad urbana, 44 Transporte público, 153 Vías públicas y 442 Infraestructura de transporte.',
      },
    ],
  },
};

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="mb-0.5">
      <span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07]">
        {text}
      </span>
    </div>
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
      className="absolute z-30 rounded-2xl overflow-hidden"
      style={{
        left: 'calc(1.5rem + 240px + 1rem)',
        right: '1rem',
        top: '50%',
        transform: 'translateY(-50%)',
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
            {section.heading && (() => {
              const [title, hint] = section.heading!.split(' — ');
              const isToggle = hint && !hint.includes('clic');
              return (
                <div className="border-t border-black/10 pt-2 mt-1 flex flex-col gap-0.5">
                  <p className="text-xs font-bold text-black/80">{title}</p>
                  {hint && (
                    <div className="flex items-center gap-1">
                      {isToggle
                        ? <ToggleLeft className="w-3 h-3 text-black/30 flex-shrink-0" />
                        : <MousePointerClick className="w-3 h-3 text-black/30 flex-shrink-0" />}
                      <span className="text-[10px] text-black/35 font-medium">{hint}</span>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="grid grid-cols-3 gap-4">
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
          </div>
        ))}
      </div>
    </div>
  );
}
