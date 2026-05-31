# UI Accessibility Refactor — CityPage

Single-pass rename and copy improvements across the city analysis interface.

---

## 1. Map section header (MapFilters.tsx)

| Before | After |
|--------|-------|
| `Herramientas de Análisis` | `Capas de análisis` |
| `Selecciona un modo para analizar la infraestructura ciclista de {city.name}` | `Selecciona un modo para visualizar {city.name} desde diferentes perspectivas` |

---

## 2. Mode renames

| Mode key | Before | After |
|----------|--------|-------|
| `traffic` | Tráfico | Modelo de Movilidad |
| `stations` | Servicios Bici / Servicios de Bici | Servicio Bici |

> `accidents` mode name stays **Accidentes** — internal copy uses *siniestros/siniestralidad* (see §5, §10, §12), but the pill label and all mode name maps are unchanged.

### Mobile short names (modeShortNames)

| Mode key | Before | After |
|----------|--------|-------|
| `traffic` | Tráfico | Movilidad |
| `stations` | Est. | Est. *(unchanged)* |

---

## 3. Submode renames

### Servicio Bici (stations)

| Submode id | Before | After |
|------------|--------|-------|
| `trips` | Viajes | Demanda |
| `downtime` | Tiempo | Disponibilidad |
| `reach` | Alcance | Cobertura |

### Modelo de Movilidad (traffic)

| Submode id | Before | After |
|------------|--------|-------|
| `rutas` | Rutas | Trayectos |
| `od` | Origen-Destino | Desplazamientos |

---

## 4. File-by-file changes

### `frontend/src/components/city/MapFilters.tsx`
- Section `<h2>`: `Herramientas de Análisis` → `Capas de análisis`
- Section `<p>`: subtitle text (see §1)
- `MODE_META` name fields: Tráfico → Modelo de Movilidad, Servicios Bici → Servicio Bici *(Accidentes unchanged)*
- `VIZ_SUBMODES[stations]` labels: Viajes → Demanda, Tiempo → Disponibilidad, Alcance → Cobertura
- `VIZ_SUBMODES[traffic]` labels: Rutas → Trayectos, Origen-Destino → Desplazamientos (O-D)
- **[Timeline refactor]** Remove `CompactYearTimeline` component and its `{showAccidentsTimeline && ...}` JSX block; remove `period` and `onPeriodChange` from `ExpandingPill` params; remove `setPeriod` from `useMapState` destructuring
- **[Submode revert]** Do NOT add `VIZ_SUBMODES[accidents]` — the bike/all toggle is NOT a URL submode; it lives as a local `FilterCard` inside `AccidentsStats.tsx` (see §12)
- **[Mode context panel]** After the pills grid, add the inline text block from §7 keyed on `(mode, submode)` — no new component, just a derived `title + body` lookup rendered as two `<p>` elements (see §7)

### `frontend/src/components/city/MapDesktop.tsx`
- `modeNames` map: Tráfico → Modelo de Movilidad, Servicios de Bici → Servicio Bici *(Accidentes unchanged)*

### `frontend/src/components/city/MapMobile.tsx`
- `modeNames` map: Tráfico → Modelo de Movilidad, Servicios de Bici → Servicio Bici *(Accidentes unchanged)*
- `modeShortNames` map: Tráfico → Movilidad *(Accid. unchanged)*

### `frontend/src/components/city/CityMap.tsx`
- Mode label map: `Tráfico Ciclista` → `Modelo de Movilidad`

### `frontend/src/components/city/map/CityLegend.tsx`
- Submode label map: `trips: 'Viajes'` → `Demanda`, `downtime: 'Tiempo'` → `Disponibilidad`, `reach: 'Alcance'` → `Cobertura`

### `frontend/src/components/city/map/SelectionPanel.tsx`
- `reach: 'Alcance'` → `reach: 'Cobertura'`

### `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx`
- `<h2>Tráfico Ciclista</h2>` → `<h2>Modelo de Movilidad</h2>`
- `isODMode` description referencing `Origen-Destino` → `Desplazamientos (O-D)`
- MetricPill `sublabel="Rutas estimadas en el período"` → `"Trayectos estimados en el período"` (see §10)
- Update all `MetricPill` callsites with three-section help copy from §10
- Comment `{/* ── Row 1: Viajes + Tráfico en carril */}` — cosmetic only, skip
- **[Timeline refactor]** Replace `PeriodDropdown` with `PeriodRangeTimeline` spanning full width (or `col-span-3`); reads `periodFrom` (range start) and `period` (range end) from `useMapState`; uses `unit="mes"` and a `formatLabel` that shows only the year at January boundaries

### `frontend/src/components/city/map/modes/accidents/AccidentsLegend.tsx`
- `'Accidentes Ciclistas'` → `'Siniestros Ciclistas'`
- `'Todos los Accidentes'` → `'Todos los Siniestros'`
- Footer text: replace `accidentes` → `siniestros` in both branches

### `frontend/src/components/city/map/modes/traffic/TrafficRoutesLayer.tsx`
- Tooltip `rows: [{ label: 'Rutas', value: ... }]` → `'Trayectos'`

### `frontend/src/components/compare/CityLeaderboard.tsx`
- `name: 'Tráfico'` → `'Modelo de Movilidad'`

### `frontend/src/pages/ComparePage.tsx`
- `label: 'Tráfico'` → `'Modelo de Movilidad'`

### `frontend/src/stories/city/_harness.tsx`
- `label: 'Tráfico'` → `'Modelo de Movilidad'`
- Stations submodes: Viajes → Demanda, Tiempo → Disponibilidad, Alcance → Cobertura
- Accidents label: `'Accidentes'` — **unchanged**

### `frontend/src/stories/city/SubmodeSelector_E4_PartitionedPill.stories.tsx`
- Submode labels: Viajes → Demanda, Tiempo → Disponibilidad, Alcance → Cobertura

### `frontend/src/components/city/map/modes/accidents/AccidentsStats.tsx`
- Labels: Total accidentes → Total siniestros, Accidentes con bici → Siniestros ciclistas (see §5)
- Remove `YearTimeline` component definition; replace with `PeriodRangeTimeline` (see §12)
- Remove `submode`/`setSubmode` reads — bike/all is now local `useState` (see §12)
- Update MetricPill callsites with three-section copy from §10
- Reduce MetricPill grid from 4 → 3 columns; remove "Año de datos" pill

### `frontend/src/components/city/CityStats.tsx` and `frontend/src/components/city/map/modes/infrastructure/InfraStats.tsx`
- Update MetricPill callsites with three-section copy from §10
- Update `BuildingsDensityHistogram` help copy from §10

### `frontend/src/hooks/useMapState.ts`
- Add `yearFrom`, `yearTo`, `setYearFrom`, `setYearTo` (URL params `?yearFrom=`, `?yearTo=`)
- Add `periodFrom`, `setPeriodFrom` (URL param `?periodFrom=`)
- **URL param scoping**: when `setMode` is called with a different mode, clear mode-specific params (`submode`, `yearFrom`, `yearTo`, `periodFrom`). Preserve `period` only if navigating within the same mode across cities. Rationale: stale params from a previous mode (e.g. `submode=rutas` from traffic) must not pollute a new mode's initial state.

### `frontend/src/components/city/map/modes/PeriodRangeTimeline.tsx` *(new)*
- Draggable range widget shared by AccidentsStats and TrafficStats (see `timeline_refactor.md` for full spec)

### `frontend/src/components/city/map/modes/accidents/AccidentsLayer.tsx`
- Remove `year` prop; read `yearFrom`/`yearTo` from `useMapState` directly (see `timeline_refactor.md`)

### `frontend/src/hooks/useLiveStats.ts`
- Pass `periodFrom` to `fetchTrafficResolve` and `fetchTrafficInfraCoverage` (see `timeline_refactor.md`)

---

## 5. AccidentsStats metric label updates

These descriptive labels follow the mode rename:

| Before | After |
|--------|-------|
| `Total accidentes` | `Total siniestros` |
| `Accidentes con bici` | `Siniestros ciclistas` |
| `helpContent` text referencing `accidentes` | replace with `siniestros` |

> **Timeline refactor note**: The "Año de datos" `MetricPill` is **removed** — not renamed. It is superseded by the `PeriodRangeTimeline` unified card header, which displays the selected year range (e.g. `2021 – 2023`). Do not copy-edit it; delete the element and reduce the `AccidentsStats` MetricPill grid from 4 → 3 columns.

---

## 6. Remove unimplemented modes (Terreno & Intersecciones)

Both modes have stub layer files (`// TODO`) and are never surfaced in live data. Strip all UI references — keep the layer/legend files untouched. Also remove any other unused code uncovered by the deletions (dead imports, unreachable switch branches, etc.).

### `frontend/src/constants/mapModes.ts`
- Remove `TERRAIN` and `INTERSECTIONS` keys from `MAP_MODES`

### `frontend/src/components/city/MapFilters.tsx`
- Remove Terreno and Intersecciones entries from `MODE_META`

### `frontend/src/components/city/MapDesktop.tsx`
- Remove `TERRAIN` and `INTERSECTIONS` entries from `modeNames`, `modeColors`, `modeGradients`

### `frontend/src/components/city/MapMobile.tsx`
- Remove `TERRAIN` and `INTERSECTIONS` entries from `modeColors`, `modeShortNames`, `modeNames`, `modeIcons`

### `frontend/src/components/city/CityMap.tsx`
- Remove `Análisis de Terreno` and `Intersecciones Críticas` entries from the mode label map

### `frontend/src/constants/cityStats.ts`
- Remove `case MAP_MODES.TERRAIN` and `case MAP_MODES.INTERSECTIONS` blocks

### `frontend/src/stories/city/_harness.tsx`
- Remove Terreno and Intersecciones entries from the mock mode list

---

## 7. Mode/submode context panel

**What**: two plain `<p>` elements — a short bold title and a body sentence. No card, no border, no new component. Derived from a `(mode, submode)` lookup object inline in `MapFilters.tsx`.

**Placement**:
- **Desktop** — inside `MapFilters` return, below the pills grid.
- **Mobile** — just below the mode name label in the bottom sheet drag handle area (`MapMobile.tsx`). Mobile has no submode controls (submodes are communicated via the legend), so only mode-level copy is shown on mobile; submode variants can be omitted.
- Not shown when no mode is active.

**Implementation**: a single `const CONTEXT_COPY: Partial<Record<string, { title: string; body: string }>>` keyed by `mode` or `${mode}/${submode}` (e.g. `'traffic/rutas'`). Fall through to the mode-level entry when no submode match exists.

**Copy principles**:
1. Last sentence is always a civic argument — something an association can quote or a government can act on.
2. No jargon — "pares origen-destino" appears once with immediate explanation; nothing else is technical.
3. Disponibilidad names the failure moment explicitly (*cuando un usuario llega y no encuentra bici*) — the most actionable sentence on the page.

---

### Infraestructura

**Título**: Carriles bici de la ciudad

**Texto**: Explora los carriles bici, vías ciclistas y zonas de velocidad reducida. El mapa muestra el tipo y estado de cada tramo de la red. Compara qué barrios están bien conectados y cuáles quedan fuera de la red.

---

### Modelo de Movilidad / Trayectos

**Título**: Por dónde circulan los ciclistas

**Texto**: Visualiza las rutas que toman los ciclistas. Cada tramo muestra la intensidad de uso: cuántas personas pasan por ahí. Útil para identificar qué corredores concentran más flujo ciclista y dónde la falta de infraestructura frena el uso.

---

### Modelo de Movilidad / Desplazamientos 

**Título**: Origen y destino de los desplazamientos ciclistas

**Texto**: Muestra los pares origen-destino de los viajes: qué zonas generan más desplazamientos y hacia dónde se dirigen. Las líneas representan la demanda real de movilidad; donde hay una línea intensa, hay necesidad de infraestructura.

---

### Servicio Bici / Demanda

**Título**: Uso y demanda por estación bici

**Texto**: Muestra la demanda de cada estación: número de usos, entradas y salidas. Identifica las estaciones más saturadas; que más necesitan ampliación de flota o nuevos puntos cercanos, y las que apenas se utilizan.

---

### Servicio Bici / Disponibilidad

**Título**: Disponibilidad horaria del servicio

**Texto**: Analiza la disponibilidad de bicicletas por horas, fines de semana y laborables. El momento crítico del servicio es cuando un usuario llega y no encuentra bici: aquí puedes ver cuándo y dónde ocurre con más frecuencia.

---

### Servicio Bici / Cobertura

**Título**: Alcance de cada estación

**Texto**: Calcula el área de alcance de cada estación siguiendo el trazado real y las reglas de circulación. Muestra la diferencia entre la cobertura óptima y la situación real, donde una red viaria diseñada para el coche, especialmente las calles de sentido único, limita el acceso en bici.

---

### Siniestralidad

**Título**: Dónde ocurren los accidentes y por qué

**Texto**: Localiza los puntos de mayor siniestralidad ciclista en la ciudad. Cada incidente muestra el tipo de vehículo implicado, la gravedad y el tipo de vía. Los tramos sin infraestructura ciclista concentran accidentes graves. La severidad repercute en los usuarios vulnerables de la vía.

---

**Visual**: white text on the current mode's color background (already present as page background). Title + paragraph rendered as plain `<p>` elements, no extra card or border — blends with the existing color-coded section.

---

## 8. Mode icon changes

All four implemented mode icons move from `lucide-react` to `@phosphor-icons/react` (already installed). Terreno and Intersecciones icons (Mountain, CircleDot) are dropped alongside the mode removal in §6.

| Mode | Old icon (lucide) | New icon (phosphor) | Import name |
|------|-------------------|---------------------|-------------|
| infrastructure | `Network` | Road Horizon | `RoadHorizon` |
| traffic | `Car` | Graph | `Graph` |
| stations | `MapPin` | Bicycle | `Bicycle` |
| accidents | `TriangleAlert` | Warning | `Warning` |

### Files requiring icon import updates

| File | Remove from lucide | Add from phosphor |
|------|--------------------|-------------------|
| `components/city/MapFilters.tsx` | `Car, Network, MapPin, TriangleAlert, Mountain, CircleDot` | `RoadHorizon, Graph, Bicycle, Warning` |
| `components/city/MapMobile.tsx` | `Car, Network, MapPin, TriangleAlert, Mountain, CircleDot` | `RoadHorizon, Graph, Bicycle, Warning` |
| `components/compare/CityLeaderboard.tsx` | `Car, MapPin` | `Graph, Bicycle` |
| `pages/ComparePage.tsx` | `Car, MapPin` | `Graph, Bicycle` |
| `stories/city/_harness.tsx` | `Car, Network, MapPin, TriangleAlert, Mountain, CircleDot` | `RoadHorizon, Graph, Bicycle, Warning` |

Note: `Network` is also used in `CityStats.tsx`, `InfraStats.tsx`, and `TrafficStats.tsx` for unrelated UI elements (stat icons, not mode selectors) — those imports are left unchanged.

---

## 9. Three-section help — component update + callsite updates

### Section order and labels (component change)

Update `MetricPill.tsx` `sectionHead()` labels and rendering order:

| Prop | New label | Old label | Position |
|------|-----------|-----------|----------|
| `helpQueVes` | `QUÉ VES` | Qué estás viendo | 1st |
| `helpPorQueEsUtil` | `POR QUÉ IMPORTA` | Por qué es útil | 2nd |
| `helpComoSeRecogieron` | `METODOLOGÍA` | Cómo se recogieron | 3rd |

Render order in the back face changes to: `helpQueVes` → `helpPorQueEsUtil` → `helpComoSeRecogieron`. Prop names unchanged.

No emojis. Section label color stays as-is (current muted opacity on mode accent). The "Metodología" section is intentionally last — most users want to understand and interpret before they want to know how the data was built.

### Callsites to update

`MetricPill` already supports the three-prop API. Update every callsite that still passes `helpContent` as a string:

- `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx` — 4 MetricPills + 1 `LineAreaChart`
- `frontend/src/components/city/map/modes/accidents/AccidentsStats.tsx` — 3 MetricPills + `StackedBarMatrix` ×2 + `BarHistogram` + `CollisionHeatmap`
- `frontend/src/components/city/CityStats.tsx` — infra MetricPills
- `frontend/src/components/city/map/modes/infrastructure/InfraStats.tsx` — infra MetricPills + `BuildingsDensityHistogram`

Chart components (`LineAreaChart`, `BarHistogram`, `StackedBarMatrix`, `BuildingsDensityHistogram`, `CollisionHeatmap`) keep `helpContent?: ReactNode`. Pass a JSX fragment with three labeled paragraphs matching the new section order and labels above.

---

## 10. Metric and chart copy

Three sections per item: **QUÉ VES** · **POR QUÉ IMPORTA** · **METODOLOGÍA** — rendered in this order.

---

### INFRAESTRUCTURA — Métricas

#### Longitud total · *Km de carril bici*
- **QUÉ VES**: El total de kilómetros de carril bici con separación física del tráfico motorizado dentro del área de estudio de la ciudad.
- **POR QUÉ IMPORTA**: La infraestructura segregada es el indicador más directamente relacionado con el incremento del uso de la bici. La longitud total determina la seguridad del ciclista, la conectividad de la red y la variedad de rutas disponibles. Una red corta obliga a los ciclistas a compartir calzada y limita mucho el tipo de usuario que está dispuesto a aceptar esos riesgos.
- **METODOLOGÍA**: Se mapea la red combinando datos de OpenStreetMap y fuentes municipales. Solo se contabilizan tramos con separación física del tráfico motorizado (aceras bici incluidas, carriles sin separación sobre calzada no). El área de estudio se estandariza a un cuadrado de 10 × 10 km para hacer comparables ciudades de tamaños distintos.

#### Cobertura · *% edificios a <150 m del carril*
- **QUÉ VES**: El porcentaje de edificios del área de estudio que tienen al menos un tramo de carril bici a menos de 150 metros.
- **POR QUÉ IMPORTA**: Los kilómetros totales no dicen nada sobre la efectividad de la red. Las ciudades españolas tienden a concentrar kilómetros en áreas dispersas dedicadas al deporte y dejar núcleos urbanos sin opción ciclista segura. Una cobertura baja indica que la red existe pero no llega donde vive la gente.
- **METODOLOGÍA**: Se calcula la distancia entre cada edificio del mapa y el tramo más cercano de la red ciclista. El umbral de 150 metros corresponde a un desplazamiento a pie de menos de dos minutos.

#### Densidad de red · *Km / 100k hab*
- **QUÉ VES**: Los kilómetros de carril bici disponibles por cada 100.000 habitantes de la ciudad.
- **POR QUÉ IMPORTA**: Permite comparar ciudades de tamaño muy diferente en igualdad de condiciones. Una ciudad pequeña con pocos kilómetros puede tener más infraestructura per cápita que una gran ciudad con una red aparentemente extensa. Esta métrica revela el esfuerzo real de cada administración en relación a su población.
- **METODOLOGÍA**: Se divide la longitud total de la red entre la población del municipio según el último padrón disponible.

#### Inversión · *Km / M€*
- **QUÉ VES**: El porcentaje de kilómetros de carril bici que forman parte del fragmento continuo más grande de la red: los tramos que están todos conectados entre sí sin interrupciones.
- **POR QUÉ IMPORTA**: Saber cuánto dinero se destina a movilidad no es suficiente, lo relevante es cuánto de ese dinero se convierte en infraestructura ciclista, evaluando si la inversión en movilidad se centra en carril bici u en otras intervenciones urbanas. Es el indicador más directo de la prioridad política hacia el ciclismo urbano.
- **METODOLOGÍA**: Se cruza la longitud de red con la partida de Vías Públicas  (espedificar aqui supersecciones) del presupuesto municipal publicado, que recoge inversión en infraestructura viaria.

#### Cobertura GCC · *Conectividad*
- **QUÉ VES**: El porcentaje de kilómetros de carril que forman parte del mayor fragmento continuo de la red.
- **POR QUÉ IMPORTA**: Puedes tener muchos kilómetros de carril y aun así no tener una red utilizable. Un tramo que empieza y termina sin conectar con nada obliga al ciclista a incorporarse al tráfico para continuar, rompiendo el viaje y la seguridad. Los ciclistas tienen un umbral del riesgo que se alcanzará o no con el peor tramo de su trayecto. Esta métrica revela si la infraestructura existente forma un sistema coherente o una colección de tramos inconexos.
- **METODOLOGÍA**: Se aplica análisis de grafos sobre la red ciclista mapeada para identificar la Gran Componente Conexa (GCC): el subconjunto más grande de tramos interconectados sin interrupciones. El porcentaje se calcula sobre el total de kilómetros de red.
REVISAR AQUI SI REALMENTE EL CALCULO ES EL PROCENTAJE DE LA RED

---

### INFRAESTRUCTURA — Gráficos

#### Efectividad de la red ciclista *(BuildingsDensityHistogram)*
- **QUÉ VES**: Un histograma que agrupa los tramos de carril bici según la densidad de edificios en su entorno inmediato, diferenciando por tipo de infraestructura. Cada barra representa cuántos kilómetros de carril existen en zonas con más o menos edificios cerca.
- **POR QUÉ IMPORTA**: No toda la red ciclista tiene el mismo impacto. Un carril en una zona de baja densidad tiene mucho menos potencial de uso que uno en el centro de un barrio residencial. Este gráfico revela si la inversión se dirige hacia donde vive la gente o si la red existe principalmente en periferias y ensanches con poco uso potencial. Las ciudades españolas tienden a construir carriles en ensanches o de uso deportivo; extender la red hacia los núcleos urbanos consolidados es más complicado pero es donde más efectividad en movilidad urbana tiene.
- **METODOLOGÍA**: Para cada tramo de la red se cuentan los edificios en un radio de 150 metros usando datos de OpenStreetMap. Los tramos se agrupan por intervalos de densidad.

---

### MODELO DE MOVILIDAD — Métricas

#### Viajes · *Trayectos estimados en el período*
- **QUÉ VES**: El número total de trayectos en bicicleta estimados para el período y la configuración del modelo seleccionados.
- **POR QUÉ IMPORTA**: Da escala real a la movilidad ciclista: cuántos desplazamientos hay que servir. Es el punto de partida para cualquier planificación de infraestructura o servicio.
- **METODOLOGÍA**: Se aplica el modelo de generación activo (GPS real, estaciones o población) y se asignan las rutas sobre la red. Los detalles de cada modelo están en la ayuda de los controles Generación y Enrutamiento.

#### Trayectos en carril · *% trayectos sobre infra. ciclista*
- **QUÉ VES**: El porcentaje de los trayectos estimados que discurren sobre tramos con carril bici con separación física del tráfico.
- **POR QUÉ IMPORTA**: Un porcentaje bajo significa que la mayoría de los ciclistas circulan por calzadas sin ninguna protección. Esta métrica traduce la brecha entre la red existente y la demanda real en un único número. Es el argumento más directo para justificar dónde construir el siguiente tramo de carril.
- **METODOLOGÍA**: Se superpone la geometría de cada ruta generada con el trazado de la red ciclista. Un trayecto contribuye al porcentaje en proporción a los kilómetros que transcurren sobre infraestructura protegida respecto a su longitud total.

#### Incidencia Ciclista · *Trayectos / 1.000 hab.*
- **QUÉ VES**: Los trayectos estimados en el período por cada 1.000 habitantes.
- **POR QUÉ IMPORTA**: La incidencia ciclista refleja la implantación del modo bici en la ciudad; no solo cuántos ciudadanos usan la bici, sino con qué frecuencia. Permite comparar ciudades con poblaciones muy distintas.
- **METODOLOGÍA**: Se divide el total de viajes generados por el modelo entre la población del municipio según el padrón.

#### Tramo más cargado
- **QUÉ VES**: El número de trayectos que pasan por el tramo de mayor intensidad de uso en la red, con su nombre identificado.
- **POR QUÉ IMPORTA**: Identifica el tramo más crítico de toda la red y el que más ganaría con una mejora de infraestructura. Una concentración muy alta señala un cuello de botella que aumenta la exposición al riesgo.
- **METODOLOGÍA**: Una vez asignados todos los viajes sobre la red, se acumula el volumen en cada tramo y se identifica el máximo. El tramo se localiza en el mapa y se etiqueta con su nombre o identificador de vía.

---

### MODELO DE MOVILIDAD — Gráficos

#### Evolución mensual de trayectos *(LineAreaChart)*
- **QUÉ VES**: El número total de trayectos del modelo para la configuración activa, representado mes a mes.
- **POR QUÉ IMPORTA**: Detecta estacionalidad y tendencia de uso. Un crecimiento sostenido valida la inversión en infraestructura; la estacionalidad habitual muestra pico en septiembre y caídas moderadas en verano e invierno.
- **METODOLOGÍA**: Para cada mes disponible se agregan todos los trayectos generados por la combinación activa de generación + enrutamiento. Los meses sin datos no se interpolan — la discontinuidad refleja ausencia real de registros.

#### Distribución de longitud de trayectos *(BarHistogram)*
- **QUÉ VES**: Un histograma de los trayectos agrupados por longitud en kilómetros. El eje horizontal muestra la distancia y el eje vertical el número de trayectos.
- **POR QUÉ IMPORTA**: Define la tipología de los viajes. La bici es el modo más rápido hasta los 7 km; por encima de 10 km le supera el vehículo privado. Una distribución desplazada hacia distancias cortas señala red fragmentada que impide viajes más largos.
- **METODOLOGÍA**: Para cada trayecto se calcula la longitud total de la ruta asignada sobre la red. En `station_based` la longitud emerge de la distribución real de pares OD de estaciones; en `buildings_population` la calcula el modelo de gravedad pero se calibra contra la distribución real de BiciMAD (Madrid). En `real` se usa la longitud GPS después del ajuste de nodo más cercano.

#### Fracción de trayecto en carril protegido *(BarHistogram)*
- **QUÉ VES**: La distribución de los trayectos según qué fracción de su recorrido discurre sobre carril con separación física. El eje horizontal va de 0 % (ningún metro en carril) a 100 % (todo el recorrido protegido).
- **POR QUÉ IMPORTA**: Si la mayoría de barras se acumulan en la franja baja, la red actual no protege a los ciclistas en sus desplazamientos habituales, independientemente de cuántos kilómetros totales de carril existan en el mapa.
- **METODOLOGÍA**: Para cada ruta se calcula la fracción de longitud que cae sobre tramos clasificados como infraestructura ciclista protegida. La ponderación es por viaje: `SUM(length × trip_count WHERE highway LIKE '%cycleway%') / SUM(length × trip_count)`.

---

### SERVICIO BICI — Métricas

#### Bicicletas totales · *Flota del servicio público*
- **QUÉ VES**: El número total de bicicletas que forman la flota del servicio de bici pública de la ciudad.
- **POR QUÉ IMPORTA**: La flota es el techo del servicio. Una red bien diseñada con flota insuficiente siempre estará saturada en hora punta; ninguna mejora operativa puede compensar la escasez de vehículos.
- **METODOLOGÍA**: Dato declarado por el operador del servicio o publicado por el ayuntamiento en el contrato de concesión o el portal de datos abiertos municipal.

#### Estaciones activas · *Puntos de anclaje operativos*
- **QUÉ VES**: El número de estaciones de anclaje que se encuentran operativas en el período seleccionado.
- **POR QUÉ IMPORTA**: Una red extensa con muchas estaciones inactivas da una falsa sensación de cobertura. Este número refleja la realidad del servicio disponible.
- **METODOLOGÍA**: Se cuentan las estaciones con al menos un evento de unlock o lock registrado en el período. Las estaciones sin actividad —por obras, avería o retirada temporal— no se incluyen. La fuente es el log de operaciones del sistema de bici pública.

#### Densidad · *Bicis / 1.000 hab.*
- **QUÉ VES**: El número de bicicletas disponibles por cada 1.000 habitantes de la ciudad.
- **POR QUÉ IMPORTA**: Permite comparar la generosidad del servicio entre ciudades de distinto tamaño. La densidad de flota es el principal predictor del nivel de servicio que experimentan los usuarios — ciudades con alta densidad muestran tasas de uso mucho mayores.
- **METODOLOGÍA**: Cociente entre la flota total y la población municipal según el último padrón disponible. No distingue entre bicis mecánicas y eléctricas (EPAC).

#### Uso diario · *Trayectos / bici*
- **QUÉ VES**: El número medio de trayectos que realiza cada bicicleta de la flota en un día.
- **POR QUÉ IMPORTA**: Un valor alto indica rotación intensiva — las bicis trabajan mucho —. Un valor bajo puede reflejar baja demanda, problemas de disponibilidad que desincentivan el uso, o vandalismo y averías que inmovilizan parte de la flota.
- **METODOLOGÍA**: Se divide el total de viajes del período entre el producto del número de bicicletas de la flota por los días del período. Solo se cuentan los viajes con duración entre 1 y 180 minutos para excluir registros de mantenimiento o sesiones abiertas por error.

#### Cobertura · *% edificios a <150 m*
- **QUÉ VES**: El porcentaje de edificios del área de estudio que tienen al menos una estación de bici pública a menos de 150 metros.
- **POR QUÉ IMPORTA**: Una estación a más de dos minutos a pie no existe para la mayoría de usuarios. Este número revela la accesibilidad real del servicio, más allá del número de estaciones o su distribución en el mapa.
- **METODOLOGÍA**: Para cada edificio del catastro/OSM se calcula la distancia euclidiana a la estación activa más cercana en el período. El umbral de 150 metros equivale a aproximadamente 90 segundos a pie. El área de estudio se estandariza a 10 × 10 km centrado en el municipio.

#### Disponibilidad · *Min. sin servicio / día*
- **QUÉ VES**: El tiempo medio diario, en minutos, que una estación permanece sin bicicletas disponibles o sin anclajes libres.
- **POR QUÉ IMPORTA**: El momento crítico del servicio es cuando un usuario llega y no encuentra bici — o no puede dejarla —. Este número cuantifica exactamente ese fallo; estaciones con alta indisponibilidad son las que más necesitan redistribución urgente.
- **METODOLOGÍA**: A partir del log de ocupación de cada estación se identifican los intervalos en que el estado es `empty` (sin bicis) o `full` (sin anclajes libres). Se suman esos intervalos para cada día y se promedia sobre el período. Una estación con indisponibilidad > 30 min/día se considera crítica.

---

### SERVICIO BICI — Gráficos

#### Trayectos y estaciones por mes *(StationMonthlyChart / LineAreaChart)*
- **QUÉ VES**: Dos series superpuestas: la evolución mes a mes de los trayectos estimados y el número de estaciones activas en el mismo período.
- **POR QUÉ IMPORTA**: Las dos líneas juntas revelan la causa de cada variación. Si caen los viajes pero no las estaciones, el problema es de demanda o meteorología. Si caen las dos, es operativo — cierre de estaciones, reducción de flota —.
- **METODOLOGÍA**: Los trayectos se agregan por mes de unlock a partir del log del sistema. Las estaciones activas se cuentan como las que tienen al menos un trayecto en el mes. Las dos series se normalizan sobre sus propios ejes para hacerlas visualmente comparables aunque tengan escalas distintas.

#### Trayectos por estación *(StationHistograms / BarHistogram)*
- **QUÉ VES**: La distribución de las estaciones según su volumen de trayectos mensuales estimados, agrupadas en rangos.
- **POR QUÉ IMPORTA**: Revela si la demanda está concentrada en unas pocas estaciones o bien repartida. Una distribución muy sesgada indica desequilibrios estructurales de red que la redistribución de flota no puede resolver por sí sola.
- **METODOLOGÍA**: Se agregan los viajes por estación de origen y destino. El período activo en `PeriodRangeTimeline` determina qué meses se incluyen en la agregación.

#### Entorno construido de las estaciones *(StationHistograms / BarHistogram)*
- **QUÉ VES**: La distribución de las estaciones según cuántos edificios tienen en su radio inmediato de 150 metros.
- **POR QUÉ IMPORTA**: Una estación rodeada de pocos edificios tiene demanda estructuralmente baja, independientemente de cómo funcione el servicio. Este gráfico muestra si la red está bien posicionada donde vive y trabaja la gente.
- **METODOLOGÍA**: Para cada estación se cuenta el número de polígonos de edificio dentro de un radio de 150 metros usando datos de catastro o equivalente OSM. Las estaciones con menos de 5 edificios en ese radio se consideran fuera del tejido urbano consolidado.

---

### SINIESTRALIDAD — Métricas

> **Note (timeline refactor)**: The MetricPill grid uses **3 columns** (Total siniestros · Siniestros ciclistas · Incidencia ciclista). The former "Año de datos" 4th pill is removed — the active period now appears in the `PeriodRangeTimeline` card header above the grid.

#### Siniestros totales
- **QUÉ VES**: El número total de accidentes con víctimas registrados en el municipio para el período seleccionado, de todos los modos de transporte.
- **POR QUÉ IMPORTA**: Es la magnitud global del problema vial. Comparar este número con años anteriores o con ciudades similares es el primer paso para evaluar si las políticas de seguridad vial tienen efecto real.
- **METODOLOGÍA**: Datos del registro oficial de accidentalidad de la DGT o equivalente municipal, georreferenciados al tramo donde ocurrió el siniestro. Se cuentan únicamente los partes con al menos una víctima — se excluyen accidentes con solo daños materiales —.

#### Siniestros ciclistas
- **QUÉ VES**: El número de accidentes en los que al menos un vehículo implicado era una bicicleta o vehículo de movilidad personal (VMP).
- **POR QUÉ IMPORTA**: Los ciclistas son el colectivo más vulnerable de la vía. Este número es el que deben reducir las políticas de infraestructura ciclista — y el que mide directamente si lo consiguen.
- **METODOLOGÍA**: Se filtra el registro general de accidentes por el campo de tipo de vehículo implicado. Los VMP (patinetes eléctricos, etc.) se incluyen cuando la fuente de datos los distingue.

#### Incidencia ciclista · *%*
- **QUÉ VES**: El porcentaje de todos los accidentes con víctimas del período en los que hay al menos un ciclista o VMP implicado.
- **POR QUÉ IMPORTA**: Pone en contexto la exposición del ciclista frente a otros modos. Si la incidencia es alta pero el número absoluto es pequeño, puede indicar que hay pocos ciclistas expuestos — no que la infraestructura esté bien —. Si la incidencia es alta y el número absoluto también crece, hay un problema estructural de seguridad que la infraestructura puede corregir.
- **METODOLOGÍA**: `siniestros_ciclistas / siniestros_totales × 100`. Ambos valores se calculan sobre el mismo período y área de estudio.

---

### SINIESTRALIDAD — Gráficos

#### Colisiones ciclistas por tipo de vehículo *(StackedBarMatrix)*
- **QUÉ VES**: Para cada tipo de vehículo contrario (turismo, camión, moto, etc.), la distribución de los siniestros ciclistas por nivel de gravedad: ileso, leve, grave y fatal.
- **POR QUÉ IMPORTA**: No todos los choques son iguales. Las colisiones con camiones y autobuses concentran la mortalidad aunque sean menos frecuentes. Este gráfico identifica con qué tipo de vehículo hay que separar físicamente el carril para reducir fatalidades.
- **METODOLOGÍA**: Se cruzan el tipo de vehículo contrario (campo `vehicle_type` del parte) y la severidad de las víctimas ciclistas. La altura de cada barra es el número total de siniestros; los colores apilados representan las cuatro categorías de gravedad según la clasificación oficial de la DGT.

#### Colisiones peatonales por tipo de vehículo *(StackedBarMatrix)*
- **QUÉ VES**: Para cada tipo de vehículo, la distribución de los siniestros con víctimas peatonales según gravedad: ileso, leve, grave y fatal.
- **POR QUÉ IMPORTA**: Muestra qué tipo de tráfico pone en riesgo a los peatones. La gravedad media de los atropellos varía mucho según el vehículo. Sirve para priorizar zonas de coexistencia o de velocidad reducida junto a la red ciclista.
- **METODOLOGÍA**: Mismo registro que la matriz ciclista, filtrado por `victim_type = 'pedestrian'`. El vehículo contrario puede ser motorizado, bicicleta o VMP.

#### Efecto meteorológico sobre caídas *(BarHistogram)*
- **QUÉ VES**: La comparación del número de siniestros ciclistas en condiciones de buen tiempo frente a lluvia, separado por bicicletas convencionales y EPACs (bicicletas eléctricas de pedaleo asistido).
- **POR QUÉ IMPORTA**: Si los siniestros en lluvia son desproporcionadamente graves, puede indicar problemas de adherencia en el pavimento o de visibilidad. Si son más frecuentes en seco, el patrón apunta a sobreexposición por mayor volumen de uso en buen tiempo.
- **METODOLOGÍA**: Se filtra el registro de accidentes por tipo de vehículo (bicicleta / EPAC) y por la condición meteorológica declarada en el parte oficial: `dry` (seco) vs `rain` (lluvia). Las demás condiciones (nieve, niebla) se agrupan en "otras". La clasificación EPAC depende de que la fuente distinga el subtipo de bicicleta; si no lo hace, todos se agrupan en bicicleta.

#### Gravedad media entre tipos de vehículo *(CollisionHeatmap)*
- **QUÉ VES**: Una matriz donde filas y columnas representan tipos de vehículo. El color de cada celda indica la gravedad media de los accidentes entre ese par, escalado de verde (ileso promedio) a rojo (mortal promedio).
- **POR QUÉ IMPORTA**: De un vistazo, muestra qué combinaciones de vehículos producen los peores resultados. Es el argumento más visual para justificar la separación física entre bicicletas y tráfico motorizado pesado — y para entender por qué el límite de velocidad importa tanto.
- **METODOLOGÍA**: Para cada par de tipos de vehículo se promedian los valores de gravedad (`0 = ileso, 1 = leve, 2 = grave, 3 = fatal`) de todos los accidentes del registro. Solo se muestran celdas con al menos 5 siniestros en el período para evitar ruido estadístico.

---

## 11. Map help overlay

### Component

A new `MapHelpPanel` component — glass card overlaid on the map, positioned top-right or centered. Triggered by a new `?` button added to `MapControls` alongside the existing Zoom/Reset/Layers buttons.

State is managed via a `MapHelpContext` (or a simple boolean + target anchor in the existing `MapContext`) so that legend elements can open the panel and pass a target anchor ID.

**Props / API**:
```ts
// in MapControls: new button
<MapHelpButton onClick={() => openMapHelp()} />

// legend element deep-link
<button onClick={() => openMapHelp('gcc-section')}>?</button>

// the panel
<MapHelpPanel
  open={helpOpen}
  targetAnchor={helpAnchor}   // scrolls to + pulses this section ID
  onClose={() => closeMapHelp()}
/>
```

**Highlight animation**: when `targetAnchor` is set, the panel scrolls to the section and applies a short CSS `@keyframes` pulse on the background — 300 ms fade-in yellow tint, then 500 ms fade out. Cleared after animation ends.

**Placement**: `MapCanvas.tsx` renders the panel as a sibling to `ActiveLayer` and `CityLegend`, absolutely positioned top-right of the map container with the same glass style as the legend.

---

### Map help copy — per mode/submode

Three standard sections + optional extra sections for specific legend elements.

---

#### Infraestructura

**QUÉ VES**: Los tramos de la red ciclista de la ciudad, coloreados por tipo de infraestructura. Cada color representa un nivel diferente de protección: el carril bici segregado físicamente, la vía ciclista en calzada compartida, o la zona de velocidad reducida.

**POR QUÉ IMPORTA**: Permite ver de un vistazo qué barrios tienen red protegida y cuáles solo tienen vías compartidas. Es el punto de partida para entender la cobertura real de una ciudad y comparar con otras.

**METODOLOGÍA**: La red procede de OpenStreetMap enriquecido con datos municipales y verificación manual. Cada tramo se clasifica según el etiquetado oficial de tipo de vía ciclista en la fuente.

---

*Sección adicional — anclaje id: `gcc-section`*

**Cobertura conectada (GCC)**

Los edificios coloreados al activar esta capa pertenecen al radio de influencia de la **Gran Componente Conexa** — el mayor fragmento continuo de la red ciclista. Los edificios grises están cerca de algún tramo de carril, pero ese tramo está aislado: existe pero no conecta con ningún otro. Solo la GCC permite ir de un punto a otro de la ciudad sin salir del carril. Un porcentaje de GCC bajo significa que gran parte de la infraestructura construida no forma red navegable.

---

#### Modelo de Movilidad / Trayectos

**QUÉ VES**: Los tramos de la red ciclista con un grosor y color proporcional al volumen de trayectos estimados que los utilizan. Los tramos más gruesos y oscuros son los más transitados.

**POR QUÉ IMPORTA**: Muestra dónde se concentra el tráfico ciclista real. Los corredores más cargados son los prioritarios para mejorar con infraestructura y los que más riesgo concentran cuando no tienen carril protegido.

**METODOLOGÍA**: El volumen de cada tramo es la suma de todos los trayectos asignados para la configuración activa. Los detalles de los modelos de generación y enrutamiento están en la ayuda de los controles de filtro.

---

#### Modelo de Movilidad / Desplazamientos (O-D)

**QUÉ VES**: Una malla hexagonal sobre la ciudad donde cada celda representa una zona. El color indica cuántos viajes se generan o atraen. Las líneas entre hexágonos muestran los pares origen-destino más frecuentes — a mayor grosor, mayor flujo entre esas dos zonas.

**POR QUÉ IMPORTA**: Revela qué partes de la ciudad se conectan entre sí por bici y dónde hay demanda real de desplazamiento sin infraestructura que la soporte. Una línea gruesa sin carril debajo es una oportunidad de inversión concreta.

**METODOLOGÍA**: Se agregan los orígenes y destinos de todos los viajes del modelo en una malla hexagonal H3 (resolución 8, celdas de ~0,74 km²). Se muestran los 200.000 pares OD con más viajes; los desplazamientos dentro de la misma celda se excluyen.

---

#### Servicio Bici / Demanda

**QUÉ VES**: Las estaciones del servicio de bici pública representadas como círculos. El tamaño y color son proporcionales al número de trayectos estimados que parten o llegan a cada estación.

**POR QUÉ IMPORTA**: Identifica qué estaciones concentran más actividad y cuáles están infrautilizadas. Las más oscuras y grandes son las que más necesitan flota suficiente y redistribución frecuente.

**METODOLOGÍA**: Se agregan los datos de uso del sistema de bici pública —o el modelo de demanda— por estación y período seleccionado en `PeriodRangeTimeline`.

---

#### Servicio Bici / Disponibilidad

**QUÉ VES**: Las estaciones coloreadas según cuánto tiempo permanecen inoperativas al día — sin bicicletas disponibles o sin anclajes libres. El rojo indica mayor tiempo de fallo.

**POR QUÉ IMPORTA**: El momento que más frustra al usuario es cuando llega a una estación y no hay bici. Este mapa localiza exactamente dónde ocurre eso con más frecuencia y durante cuánto tiempo al día.

**METODOLOGÍA**: Se analiza el log de ocupación de cada estación y se calcula el tiempo acumulado en estado crítico — vacía (`empty`) o llena (`full`) — durante el período seleccionado.

---

#### Servicio Bici / Cobertura

**QUÉ VES**: El área de influencia peatonal de cada estación, representada como un radio de 150 metros. Las zonas de la ciudad sin ningún radio encima quedan descubiertas — no hay ninguna estación accesible a pie en menos de dos minutos.

**POR QUÉ IMPORTA**: Los huecos en la cobertura son las ubicaciones exactas donde una nueva estación tendría más impacto. Este mapa es el argumento geográfico más directo para decidir dónde ampliar la red.

**METODOLOGÍA**: Para cada estación activa se traza un radio de 150 metros y se proyecta sobre el mapa. El umbral equivale a aproximadamente 90 segundos a pie.

---

#### Siniestralidad

**QUÉ VES**: Los accidentes con víctimas registrados en la ciudad, representados como puntos coloreados por nivel de gravedad — azul (ileso), amarillo (leve), rojo (grave) y granate (fatal). El filtro activo (Bicicleta / Todos) determina qué accidentes aparecen.

**POR QUÉ IMPORTA**: Localiza los puntos negros de la ciudad — los cruces y calles donde se acumulan los siniestros. Es el mapa que deberían ver los responsables de planificación antes de decidir dónde invertir en infraestructura ciclista.

**METODOLOGÍA**: Datos del registro oficial de accidentalidad de la DGT o equivalente municipal, georreferenciados al tramo donde ocurrió el accidente. Se representan exactamente tal como están registrados en la fuente.

---

## 12. Controls help

Two tiers of help per control:

1. **Always-visible summary** — one short sentence rendered as muted text directly below the control card body. Describes what the control does in plain language.
2. **Expandable detail** *(Option A — per-control `?` button)* — a `?` button inside the FilterCard header (same size and style as the MetricPill help button). On click, a detail panel expands inline below the summary with three sections (Qué estás viendo / Cómo se recogieron / Por qué es útil). Clicking `?` again or clicking outside collapses it. Applied to **Generación** and **Enrutamiento** only — the methodology controls where understanding the algorithm matters. `PeriodRangeTimeline` and `Tipo de accidente` use the three-section format directly in their always-visible text (no extra expand needed).

---

### Modelo de Movilidad — controles

#### Período *(PeriodRangeTimeline — widget de rango arrastrable)*

El selector de mes se sustituye por `PeriodRangeTimeline` con `unit="mes"`. La tarjeta muestra el rango activo en cabecera (`2024-01 – 2024-06`) y una pista arrastrable debajo; el extremo izquierdo fija el inicio, el derecho fija el fin, arrastrar el centro desplaza el período entero. El componente ocupa el ancho completo de la fila de controles.

> **QUÉ VES**: El rango de meses seleccionado para el modelo. La cabecera muestra los extremos del período activo y cuántos meses abarca.
> **POR QUÉ IMPORTA**: Ampliar el rango suaviza la estacionalidad y muestra la tendencia de uso; reducirlo a un mes concreto permite comparar configuraciones en el mismo período sin ruido.
> **METODOLOGÍA**: Los meses disponibles dependen de los datos cargados para la fuente de generación activa — no todas las combinaciones de fuente y algoritmo tienen datos en todos los períodos.

#### Generación *(+ `?` expandable)*

**Summary (always visible)**: Define cómo se estiman los orígenes y destinos de los viajes — GPS real, bici pública o distribución por población.

**Expanded detail:**

> **QUÉ VES**: La fuente de datos que determina dónde se originan y terminan los viajes del modelo. Cada opción usa un origen de datos diferente: **Real** usa trayectos GPS del sistema de bici pública; **Estaciones** estima los viajes a partir de los flujos de entrada y salida de cada estación; **Población** genera demanda sintética a partir de la densidad de edificios y la distribución de población.
> **POR QUÉ IMPORTA**: La elección de la fuente cambia radicalmente el resultado. Real capta la movilidad observada de los usuarios actuales del servicio; Estaciones amplía la estimación a todo el sistema de bici pública; Población estima la demanda potencial de la ciudad entera, incluyendo quienes podrían usar la bici pero aún no lo hacen. Comparar los tres revela qué parte de la demanda se cubre y cuánta queda sin infraestructura.
> **METODOLOGÍA**: **Real** (`real`): los trayectos del sistema de bici pública (BiciMAD en Madrid) se cargan como pares origen-destino GPS. Cada extremo se proyecta al nodo de la red más cercano mediante `osmnx.distance.nearest_nodes`; los viajes cuyos extremos superan 150 m del nodo más próximo se descartan. **Estaciones** (`station_based`): se sintetizan viajes a partir de los flujos de entrada y salida registrados en cada estación. Los pares OD se asignan entre estaciones según proximidad y horario. **Población** (`buildings_population`): modelo de gravedad donde la probabilidad de viaje entre dos zonas es proporcional a la densidad de edificios del origen, la densidad de población del destino, e inversamente proporcional a la distancia. Los orígenes y destinos se distribuyen sobre los nodos de la red dentro de cada zona.

#### Enrutamiento *(+ `?` expandable)*

**Summary (always visible)**: Determina por qué camino de la red discurre cada viaje — trazas reales, ruta más corta o ruta más segura.

**Expanded detail:**

> **QUÉ VES**: El algoritmo que decide por qué tramos de la red ciclista discurre cada viaje. Define si los ciclistas modelados priorizan distancia, seguridad o siguen trazas GPS registradas.
> **POR QUÉ IMPORTA**: La diferencia de volumen entre Ruta corta y Ruta segura identifica qué corredores están forzando a los ciclistas a circular por calzada — y cuánto tráfico captaría un nuevo tramo de carril en ese punto. Ambas opciones son escenarios de simulación que permiten evaluar el impacto de cualquier mejora de infraestructura antes de construirla.
> **METODOLOGÍA**: **Map-matched** (`map_matched`): cada viaje GPS del sistema BiciMAD se ancla a los nodos de la red más cercanos a su inicio y fin, usando `osmnx.distance.nearest_nodes` (tolerancia 150 m). La ruta entre ambos nodos se resuelve por distancia mínima — no es ajuste tramo a tramo (HMM). **Ruta corta** (`shortest`): Dijkstra con peso `length` en metros — `nx.shortest_path(graph, origin, dest, weight='length')`. Sin penalización por tipo de vía. **Ruta segura** (`safest`): Dijkstra con peso `route_cost = length × (1 + peligrosidad × ln(max(length, 1)) / 144)`. La `peligrosidad` de cada tramo [0–~60] depende de: tipo de vía (primary=40, secondary=30, residential=10, cycleway=0), presencia de carril bici en la fuente municipal (override a 0), límite de velocidad (>50 km/h: +15; >70 km/h: +30), número de carriles (>2: +10), y suelo mínimo de 20 para puentes y túneles. Calibración: 100 m de carril bici → coste ~100; 100 m de vía principal 4 carriles a 50 km/h → coste ~150.

---

### Siniestralidad — controles (estandarización)

El `YearTimeline` inline y el toggle de cabecera se sustituyen por dos `FilterCard` estándar en `AccidentsStats.tsx`.

**Bike/All toggle — `FilterCard` con estado local (NO URL param)**

The `submode` URL param is **not used** for accidents. The bike/all selection is purely local component state (`useState`) inside `AccidentsStats.tsx`. Remove any read/write of `submode` from `AccidentsStats.tsx`; the current `AccidentsStats` toggle header becomes this card.

```
Título: Tipo de accidente
Descripción: Siniestros con ciclista / todos los accidentes
Opciones: [Bicicleta] [Todos]
```
> Selecciona si ver solo los siniestros donde hay un ciclista implicado o todos los accidentes registrados en la ciudad. El filtro **Bicicleta** es el más relevante para evaluar el impacto de la infraestructura ciclista en la seguridad vial.

**Período *(PeriodRangeTimeline — widget de rango arrastrable)***

El control de año se implementa como `PeriodRangeTimeline` con `unit="año"`. Reemplaza tanto el `YearTimeline` inline de `AccidentsStats` como la burbuja de año que había en `MapFilters`. El MetricPill "Año de datos" desaparece — la información del período activo vive en la cabecera de esta tarjeta (e.g. `2021 – 2023 · 3 años`).

> **QUÉ VES**: El rango de años del registro de accidentalidad que se muestra en el mapa y las estadísticas. La cabecera indica inicio, fin y duración del período seleccionado.
> **POR QUÉ IMPORTA**: Comparar un año con otro revela si la siniestralidad mejora, empeora o se mantiene. Ampliar el rango a varios años da una tendencia más robusta que un solo año, especialmente en ciudades con pocos accidentes registrados.
> **METODOLOGÍA**: Los años disponibles proceden del registro oficial de accidentalidad cargado para cada ciudad. Algunos municipios solo tienen datos de los últimos años.

**Archivo afectado**: `AccidentsStats.tsx` — toggle inline del header → `FilterCard` local-state; `YearTimeline` → `PeriodRangeTimeline` encima del grid de pills (ahora de 3 columnas).

---

## 13. Out of scope

- `AccidentsStats.tsx` h2 `Siniestralidad Vial` — already correct, no change
- API error messages and internal hook strings (e.g. `'Error al cargar los datos de tráfico'`) — internal, not user-facing UI
- `cityStats.ts` mock data strings — static placeholder data, not connected to live UI
- File/directory names (`TrafficStats`, `AccidentsLayer`, etc.) — identifiers only, no rename
- Stub layer files `TerrainLayer.tsx`, `TerrainLegend.tsx`, `IntersectionsLayer.tsx`, `IntersectionsLegend.tsx` — kept for future use, just removed from UI routing
