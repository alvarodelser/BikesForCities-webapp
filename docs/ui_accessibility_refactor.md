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
| `accidents` | Accidentes | Siniestralidad |
| `stations` | Servicios Bici / Servicios de Bici | Servicio Bici |

### Mobile short names (modeShortNames)

| Mode key | Before | After |
|----------|--------|-------|
| `traffic` | Tráfico | Movilidad |
| `accidents` | Accid. | Siniest. |
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
| `od` | Origen-Destino | Desplazamientos (O-D) |

---

## 4. File-by-file changes

### `frontend/src/components/city/MapFilters.tsx`
- Section `<h2>`: `Herramientas de Análisis` → `Capas de análisis`
- Section `<p>`: subtitle text (see §1)
- `MODE_META` name fields: Tráfico → Modelo de Movilidad, Accidentes → Siniestralidad, Servicios Bici → Servicio Bici
- `VIZ_SUBMODES[stations]` labels: Viajes → Demanda, Tiempo → Disponibilidad, Alcance → Cobertura
- `VIZ_SUBMODES[traffic]` labels: Rutas → Trayectos, Origen-Destino → Desplazamientos (O-D)
- **[Timeline refactor]** Remove `CompactYearTimeline` component and its `{showAccidentsTimeline && ...}` JSX block; remove `period` and `onPeriodChange` from `ExpandingPill` params; remove `setPeriod` from `useMapState` destructuring

### `frontend/src/components/city/MapDesktop.tsx`
- `modeNames` map: Tráfico → Modelo de Movilidad, Accidentes → Siniestralidad, Servicios de Bici → Servicio Bici

### `frontend/src/components/city/MapMobile.tsx`
- `modeNames` map: Tráfico → Modelo de Movilidad, Servicios de Bici → Servicio Bici, Accidentes → Siniestralidad
- `modeShortNames` map: Tráfico → Movilidad, Accid. → Siniest.

### `frontend/src/components/city/CityMap.tsx`
- Mode label map: `Tráfico Ciclista` → `Modelo de Movilidad`

### `frontend/src/components/city/map/CityLegend.tsx`
- Submode label map: `trips: 'Viajes'` → `Demanda`, `downtime: 'Tiempo'` → `Disponibilidad`, `reach: 'Alcance'` → `Cobertura`

### `frontend/src/components/city/map/SelectionPanel.tsx`
- `reach: 'Alcance'` → `reach: 'Cobertura'`

### `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx`
- `<h2>Tráfico Ciclista</h2>` → `<h2>Modelo de Movilidad</h2>`
- `isODMode` description referencing `Origen-Destino` → `Desplazamientos (O-D)`
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
- Accidents label: `'Accidentes'` → `'Siniestralidad'`

### `frontend/src/stories/city/SubmodeSelector_E4_PartitionedPill.stories.tsx`
- Submode labels: Viajes → Demanda, Tiempo → Disponibilidad, Alcance → Cobertura

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

Both modes have stub layer files (`// TODO`) and are never surfaced in live data. Strip all UI references — keep the layer/legend files untouched.

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

**What**: a title + body text block that appears when a mode (and submode where applicable) is selected. Explains what the user is looking at and why it matters, written for civic audiences — associations quoting data, government acting on evidence.

**Placement**: inside `MapFilters` return, below the pills grid (desktop). On mobile, below the horizontal pill strip. Not shown when no mode is active.

**Copy principles**:
1. Last sentence is always a civic argument — something an association can quote or a government can act on.
2. No jargon — "pares origen-destino" appears once with immediate explanation; nothing else is technical.
3. Disponibilidad names the failure moment explicitly (*cuando un usuario llega y no encuentra bici*) — the most actionable sentence on the page.

---

### Infraestructura

**Título**: La infraestructura ciclista de la ciudad

**Texto**: Explora los carriles bici, vías ciclistas y zonas de velocidad reducida. El mapa muestra el tipo y estado de cada tramo de la red. Compara qué barrios están bien conectados y cuáles quedan fuera de la red.

---

### Modelo de Movilidad / Trayectos

**Título**: Cómo se mueve la gente en bici por la ciudad

**Texto**: Visualiza los trayectos más frecuentes sobre la red ciclista. Cada tramo muestra la intensidad de uso: cuántas personas pasan por ahí y por qué rutas. Útil para identificar qué corredores concentran más tráfico ciclista y cuáles están infrautilizados.

---

### Modelo de Movilidad / Desplazamientos (O-D)

**Título**: De dónde vienen y adónde van los ciclistas

**Texto**: Muestra los pares origen-destino de los viajes: qué zonas generan más desplazamientos y hacia dónde se dirigen. Las líneas representan la demanda real de movilidad — donde hay una línea gruesa, hay necesidad de infraestructura.

---

### Servicio Bici / Demanda

**Título**: Qué estaciones se usan más y cuándo

**Texto**: Muestra la demanda de cada estación: número de usos, horas pico y diferencias entre días laborables y festivos. Identifica las estaciones más saturadas y las que apenas se utilizan.

---

### Servicio Bici / Disponibilidad

**Título**: Cuándo no hay bicis cuando las necesitas

**Texto**: Analiza los períodos en que las estaciones aparecen vacías o llenas. El momento crítico del servicio es cuando un usuario llega y no encuentra bici — aquí puedes ver cuándo y dónde ocurre con más frecuencia.

---

### Servicio Bici / Cobertura

**Título**: A qué distancia llega cada estación

**Texto**: Calcula el área de influencia de cada punto de la red de bici pública. Muestra qué zonas de la ciudad quedan fuera del radio de acceso a una estación y dónde tendría más impacto añadir una nueva.

---

### Siniestralidad

**Título**: Dónde ocurren los accidentes y por qué

**Texto**: Localiza los puntos de mayor siniestralidad ciclista en la ciudad. Los datos cruzan tipo de vía, infraestructura disponible y condiciones del tramo. Los puntos negros son los cruces y calles donde se concentran los incidentes.

---

**Visual**: white text on the current mode's color background (already present as page background). Title + paragraph, no extra card or border — blends with the existing color-coded section.

---

## 8. Mode icon changes

All four implemented mode icons move from `lucide-react` to `@phosphor-icons/react` (already installed). Terreno and Intersecciones icons (Mountain, CircleDot) are dropped alongside the mode removal in §6.

| Mode | Old icon (lucide) | New icon (phosphor) | Import name |
|------|-------------------|---------------------|-------------|
| infrastructure | `Network` | Road Horizon | `RoadHorizon` |
| traffic | `Car` | Chart Line | `ChartLine` |
| stations | `MapPin` | Bicycle | `Bicycle` |
| accidents | `TriangleAlert` | Warning | `Warning` |

> **Note**: user requested "graph" for traffic. Phosphor has both `Graph` (node network) and `ChartLine` (line chart). `ChartLine` is used here as the more intuitive read for mobility flows — confirm before implementation if `Graph` was intended.

### Files requiring icon import updates

| File | Remove from lucide | Add from phosphor |
|------|--------------------|-------------------|
| `components/city/MapFilters.tsx` | `Car, Network, MapPin, TriangleAlert, Mountain, CircleDot` | `RoadHorizon, ChartLine, Bicycle, Warning` |
| `components/city/MapMobile.tsx` | `Car, Network, MapPin, TriangleAlert, Mountain, CircleDot` | `RoadHorizon, ChartLine, Bicycle, Warning` |
| `components/compare/CityLeaderboard.tsx` | `Car, MapPin` | `ChartLine, Bicycle` |
| `pages/ComparePage.tsx` | `Car, MapPin` | `ChartLine, Bicycle` |
| `stories/city/_harness.tsx` | `Car, Network, MapPin, TriangleAlert, Mountain, CircleDot` | `RoadHorizon, ChartLine, Bicycle, Warning` |

Note: `Network` is also used in `CityStats.tsx`, `InfraStats.tsx`, and `TrafficStats.tsx` for unrelated UI elements (stat icons, not mode selectors) — those imports are left unchanged.

---

## 9. Component update — three-section help structure

The help panel now uses **three** sections instead of two. The MetricPill component props change:

| Old prop | New prop | Section header |
|----------|----------|----------------|
| `helpQuesMide` | `helpQueVes` | Qué estás viendo |
| *(new)* | `helpComoSeRecogieron` | Cómo se recogieron |
| `helpMetodologia` | `helpPorQueEsUtil` | Por qué es útil |

`helpContent` (legacy ReactNode) continues to work as a fallback rendered under "Qué estás viendo".

The same three-section structure applies to all chart components (`LineAreaChart`, `BarHistogram`, `StackedBarMatrix`, `BuildingsDensityHistogram`). Their existing `helpContent?: ReactNode` prop is replaced with three string props using the same names.

---

## 10. Metric and chart copy

Three sections per item: **Qué estás viendo** · **Cómo se recogieron** · **Por qué es útil**.

---

### INFRAESTRUCTURA — Métricas

#### Longitud total · *Km de carril bici*
- **Qué estás viendo**: El total de kilómetros de carril bici de uso exclusivo dentro del área de estudio de la ciudad.
- **Cómo se recogieron**: Se mapea la red desde fuentes OpenStreetMap verificadas y datos municipales. Solo se contabilizan tramos con separación física del tráfico — ni pinturas en calzada ni aceras compartidas.
- **Por qué es útil**: Es el indicador más directo del esfuerzo inversor en movilidad ciclista. Ciudades con redes similares en kilómetros pueden tener experiencias muy distintas si la distribución o conectividad difieren.

#### Cobertura · *% edificios a <150 m del carril*
- **Qué estás viendo**: El porcentaje de edificios del área de estudio que tienen al menos un tramo de carril bici a menos de 150 metros.
- **Cómo se recogieron**: Se calcula la distancia entre cada edificio del mapa y el tramo más cercano de la red ciclista. El umbral de 150 metros corresponde a un desplazamiento a pie de menos de dos minutos.
- **Por qué es útil**: Los kilómetros totales no dicen nada sobre dónde están. Esta métrica mide si la red llega a donde vive la gente, no solo si existe.

#### Densidad de red · *Km / 100k hab*
- **Qué estás viendo**: Los kilómetros de carril bici disponibles por cada 100.000 habitantes de la ciudad.
- **Cómo se recogieron**: Se divide la longitud total de la red entre la población del municipio según el último padrón disponible.
- **Por qué es útil**: Permite comparar ciudades de tamaño muy diferente en igualdad de condiciones. Una ciudad pequeña con pocos kilómetros puede tener más infraestructura per cápita que una gran ciudad con una red aparentemente extensa.

#### Inversión · *Km / M€*
- **Qué estás viendo**: Los kilómetros de carril bici construidos por cada millón de euros de presupuesto municipal destinado a Vías Públicas.
- **Cómo se recogieron**: Se cruza la longitud de red con la partida de Vías Públicas del presupuesto municipal publicado, que recoge inversión en infraestructura viaria.
- **Por qué es útil**: No todas las ciudades invierten igual de bien. Esta métrica identifica si el dinero llega a la calle o se queda en gestión y proyecto.

#### Cobertura GCC · *Conectividad*
- **Qué estás viendo**: El porcentaje de kilómetros de carril que forman parte del mayor fragmento continuo de la red — la Gran Componente Conexa.
- **Cómo se recogieron**: Se aplica análisis de grafos sobre la red ciclista mapeada. La GCC es el subconjunto más grande de tramos que están todos interconectados sin interrupciones.
- **Por qué es útil**: Un carril aislado no es una red. Esta métrica distingue entre infraestructura real —que te lleva de un sitio a otro— y fragmentos que no van a ningún lado.

---

### INFRAESTRUCTURA — Gráficos

#### Efectividad de la red ciclista *(BuildingsDensityHistogram)*
- **Qué estás viendo**: Un histograma que agrupa los tramos de carril bici según cuántos edificios tienen cerca, separados por tipo de infraestructura.
- **Cómo se recogieron**: Para cada tramo se cuentan los edificios en un radio de 150 metros usando datos de catastro o equivalente OSM. Los tipos de infraestructura proceden del etiquetado de la red.
- **Por qué es útil**: Revela si la inversión se dirige hacia zonas densamente pobladas o si el carril bici existe principalmente en periferias con poco uso potencial.

---

### MODELO DE MOVILIDAD — Métricas

#### Viajes / mes · *Trayectos estimados en el período*
- **Qué estás viendo**: El número total de trayectos en bicicleta estimados para el período y la configuración del modelo seleccionados.
- **Cómo se recogieron**: Se aplica un modelo de generación de viajes —GPS real, estaciones de bici pública o distribución poblacional— y se asignan las rutas sobre la red ciclista real usando el algoritmo elegido.
- **Por qué es útil**: Da escala al problema: cuántos desplazamientos reales hay que servir y dónde concentrarlos.

#### Tráfico en carril · *% trayectos sobre infra. ciclista*
- **Qué estás viendo**: El porcentaje de los trayectos estimados que discurren sobre tramos con carril bici protegido.
- **Cómo se recogieron**: Se superpone la geometría de cada ruta generada con el trazado de la red ciclista. Si una ruta atraviesa tramo protegido, contribuye al numerador.
- **Por qué es útil**: Un porcentaje bajo significa que la mayoría de ciclistas modelados circulan por calzadas sin protección. Es el argumento más directo para justificar dónde construir el siguiente tramo.

#### Uso relativo · *Trayectos / 1.000 hab.*
- **Qué estás viendo**: Los trayectos estimados en el período por cada 1.000 habitantes.
- **Cómo se recogieron**: Se divide el total de viajes generados por el modelo entre la población del municipio.
- **Por qué es útil**: Normalizar por población es lo que permite comparar ciudades de distinto tamaño. Una ciudad con el doble de viajes y el triple de habitantes tiene en realidad menos uso relativo.

#### Tramo más cargado
- **Qué estás viendo**: El número de trayectos que pasan por el tramo de mayor intensidad de uso en la red, con su nombre identificado.
- **Cómo se recogieron**: Una vez asignados todos los viajes sobre la red, se suma el volumen de cada tramo y se selecciona el máximo.
- **Por qué es útil**: Identifica el cuello de botella de la red — el punto que más sufre sin protección y que más ganaría con una mejora.

---

### MODELO DE MOVILIDAD — Gráficos

#### Evolución de trayectos *(LineAreaChart)*
- **Qué estás viendo**: La evolución mensual del número total de trayectos estimados para la configuración seleccionada.
- **Cómo se recogieron**: Se repite el modelo de asignación de rutas para cada período disponible y se representa el total de viajes generados.
- **Por qué es útil**: Detecta estacionalidad y tendencias. Un crecimiento sostenido valida la inversión; una caída brusca puede señalar un cambio en la red o en los datos de origen.

#### Distribución de longitud de trayectos *(BarHistogram)*
- **Qué estás viendo**: La distribución de los trayectos estimados según su longitud en kilómetros.
- **Cómo se recogieron**: Para cada ruta generada se calcula la longitud total del trayecto asignado sobre la red.
- **Por qué es útil**: La mayoría de los desplazamientos en bici son cortos. Si la distribución está sesgada hacia distancias largas, el modelo puede no estar captando bien la demanda real.

#### Distribución de cobertura de infraestructura *(BarHistogram)*
- **Qué estás viendo**: La distribución de los trayectos según qué fracción de su recorrido discurre sobre carril protegido.
- **Cómo se recogieron**: Para cada ruta se calcula el porcentaje de su longitud que coincide con infraestructura ciclista.
- **Por qué es útil**: Si la mayoría de trayectos tienen cobertura baja, la red actual no protege a los ciclistas en sus desplazamientos habituales — independientemente de cuántos kilómetros de carril existan en total.

---

### SERVICIO BICI — Métricas

#### Bicicletas totales · *Flota del servicio público*
- **Qué estás viendo**: El número total de bicicletas que forman la flota del servicio de bici pública de la ciudad.
- **Cómo se recogieron**: Dato declarado por el operador del servicio o publicado por el ayuntamiento en el contrato de concesión.
- **Por qué es útil**: La flota es el techo del servicio. Una red bien diseñada con flota insuficiente siempre estará saturada en hora punta.

#### Estaciones activas · *Puntos de anclaje operativos*
- **Qué estás viendo**: El número de estaciones de anclaje que se encuentran operativas en el período seleccionado.
- **Cómo se recogieron**: Se cuentan las estaciones con actividad registrada en el período. Las estaciones fuera de servicio por obras, avería o retirada temporal no se incluyen.
- **Por qué es útil**: Una red extensa con muchas estaciones inactivas da una falsa sensación de cobertura. Este número refleja la realidad del servicio disponible.

#### Densidad · *Bicis / 1.000 hab.*
- **Qué estás viendo**: El número de bicicletas disponibles por cada 1.000 habitantes de la ciudad.
- **Cómo se recogieron**: Se divide el total de bicicletas de la flota entre la población del municipio.
- **Por qué es útil**: Permite comparar la generosidad del servicio entre ciudades de distinto tamaño. La densidad de flota es el principal predictor del nivel de servicio que experimentan los usuarios.

#### Uso diario · *Trayectos / bici / día*
- **Qué estás viendo**: El número medio de trayectos que realiza cada bicicleta de la flota en un día.
- **Cómo se recogieron**: Se dividen los viajes totales del mes entre el número de bicicletas y los días del período.
- **Por qué es útil**: Un valor alto indica alta rotación — las bicis trabajan mucho. Un valor bajo puede señalar baja demanda o problemas de disponibilidad que desincentivan el uso.

#### Cobertura · *% edificios a <150 m*
- **Qué estás viendo**: El porcentaje de edificios del área de estudio que tienen al menos una estación de bici pública a menos de 150 metros.
- **Cómo se recogieron**: Se calcula la distancia entre cada edificio y la estación más cercana. El umbral de 150 metros equivale a menos de dos minutos a pie.
- **Por qué es útil**: Una estación que no se puede alcanzar andando en menos de dos minutos no existe para la mayoría de usuarios. Esta métrica mide la accesibilidad real del servicio, no su presencia en el mapa.

#### Inoperativa · *Min. sin bicis / día*
- **Qué estás viendo**: El tiempo medio diario, en minutos, que una estación permanece sin bicicletas disponibles o sin anclajes libres.
- **Cómo se recogieron**: Se analiza el registro de ocupación de cada estación y se suman los intervalos en que aparece vacía o llena al 100%.
- **Por qué es útil**: El momento crítico del servicio es cuando un usuario llega y no encuentra bici. Este número cuantifica exactamente ese fallo y señala qué estaciones necesitan redistribución urgente.

---

### SERVICIO BICI — Gráficos

#### Evolución mensual *(StationMonthlyChart / LineAreaChart)*
- **Qué estás viendo**: La evolución mes a mes de los trayectos estimados y el número de estaciones activas.
- **Cómo se recogieron**: Se agregan los registros de viajes del sistema de bici pública por mes, cruzados con el estado operativo de las estaciones en cada período.
- **Por qué es útil**: Detecta estacionalidad y el efecto de ampliar la red. La línea de estaciones activas contextualiza cada variación en los viajes — si caen los viajes pero no las estaciones, el problema es de demanda; si caen las dos, es operativo.

#### Uso por estación *(StationHistograms / BarHistogram)*
- **Qué estás viendo**: La distribución de las estaciones según su volumen de trayectos mensuales estimados.
- **Cómo se recogieron**: Se asignan los viajes del modelo a la estación de origen o destino más probable y se agrupan en rangos.
- **Por qué es útil**: Revela si hay unas pocas estaciones que concentran todo el uso o si la demanda está bien repartida. Una distribución muy desigual indica desequilibrios de red que la redistribución de flota no puede resolver por sí sola.

#### Densidad de edificios *(StationHistograms / BarHistogram)*
- **Qué estás viendo**: La distribución de las estaciones según cuántos edificios tienen en su radio de 150 metros.
- **Cómo se recogieron**: Para cada estación se cuentan los edificios en un radio de 150 metros usando datos del catastro o equivalente OSM.
- **Por qué es útil**: Una estación rodeada de pocos edificios tendrá demanda estructuralmente baja, independientemente de cómo funcione el servicio. Este gráfico muestra si la red está bien posicionada donde vive y trabaja la gente.

---

### SINIESTRALIDAD — Métricas

> **Note (timeline refactor)**: The MetricPill grid uses **3 columns** (Total siniestros · Siniestros ciclistas · Incidencia ciclista). The former "Año de datos" 4th pill is removed — the active period now appears in the `PeriodRangeTimeline` card header above the grid.

#### Total siniestros
- **Qué estás viendo**: El número total de accidentes con víctimas registrados en el municipio para el período seleccionado.
- **Cómo se recogieron**: Datos del registro oficial de accidentalidad de la DGT o equivalente municipal, georreferenciados a nivel de tramo o punto kilométrico.
- **Por qué es útil**: Es la magnitud del problema. Comparar este número con años anteriores o con ciudades similares es el primer paso para exigir actuaciones concretas.

#### Siniestros ciclistas
- **Qué estás viendo**: El número de accidentes en los que al menos un vehículo implicado era una bicicleta o vehículo de movilidad personal.
- **Cómo se recogieron**: Se filtra el registro general de accidentes por el campo de tipo de vehículo implicado.
- **Por qué es útil**: Los ciclistas son el colectivo más vulnerable de la vía. Este número es el que deben reducir las políticas de infraestructura ciclista — y el que mide si lo consiguen.

#### Incidencia ciclista · *%*
- **Qué estás viendo**: El porcentaje de todos los accidentes con víctimas del período en los que hay un ciclista implicado.
- **Cómo se recogieron**: Se divide el número de siniestros ciclistas entre el total de siniestros del período.
- **Por qué es útil**: Pone en contexto la exposición del ciclista frente a otros modos. Si la incidencia es alta pero el número de ciclistas es pequeño, hay un problema estructural de seguridad que la infraestructura puede corregir.

---

### SINIESTRALIDAD — Gráficos

#### Severidad ciclista — Por tipo de vehículo implicado *(StackedBarMatrix)*
- **Qué estás viendo**: Para cada tipo de vehículo contrario, la distribución de los siniestros ciclistas por nivel de gravedad: ileso, leve, grave y fatal.
- **Cómo se recogieron**: Se cruzan el tipo de vehículo contrario y la severidad de las víctimas ciclistas del registro oficial de accidentalidad.
- **Por qué es útil**: No todos los choques son iguales. Los siniestros con camiones o autobuses concentran la mortalidad aunque sean menos frecuentes. Este gráfico identifica con qué tipo de vehículo hay que separar físicamente el carril.

#### Severidad peatonal — Por tipo de vehículo implicado *(StackedBarMatrix)*
- **Qué estás viendo**: Para cada tipo de vehículo, la distribución de los siniestros con víctimas peatonales según gravedad.
- **Cómo se recogieron**: Mismo registro que la matriz ciclista, filtrado por tipo de víctima peatonal.
- **Por qué es útil**: Muestra qué tipo de tráfico pone en riesgo a los peatones. Sirve para priorizar zonas de coexistencia o zonas de velocidad reducida junto a la red ciclista.

#### Bicicleta y EPAC: seco vs lluvia *(BarHistogram)*
- **Qué estás viendo**: La comparación del número de siniestros ciclistas en condiciones de buen tiempo frente a lluvia, separado por bicicletas convencionales y EPACs.
- **Cómo se recogieron**: Se filtra el registro de accidentes por tipo de vehículo y por la condición meteorológica declarada en el parte.
- **Por qué es útil**: Si los siniestros en lluvia son desproporcionadamente graves, puede indicar problemas de adherencia en el pavimento del carril. Si son más frecuentes en seco, apunta a sobreexposición por mayor uso en buen tiempo.

#### Matriz de colisiones *(CollisionHeatmap)*
- **Qué estás viendo**: Una matriz donde filas y columnas representan tipos de vehículo. El color de cada celda indica la gravedad media de los accidentes entre ese par de vehículos.
- **Cómo se recogieron**: Se agrega la gravedad media de todos los accidentes entre cada par de tipos de vehículo del registro oficial.
- **Por qué es útil**: De un vistazo, muestra qué combinaciones de vehículos producen los peores resultados. Es el argumento más visual para justificar la separación física entre bicicletas y tráfico motorizado pesado.

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

**Qué estás viendo**: Los tramos de la red ciclista de la ciudad, coloreados por tipo de infraestructura. Cada color representa un nivel diferente de protección: el carril bici segregado físicamente, la vía ciclista en calzada compartida, o la zona de velocidad reducida.

**Cómo se recogieron**: La red procede de OpenStreetMap enriquecido con datos municipales y verificación manual. Cada tramo se clasifica según el etiquetado oficial de tipo de vía ciclista en la fuente.

**Por qué es útil**: Permite ver de un vistazo qué barrios tienen red protegida y cuáles solo tienen vías compartidas. Es el punto de partida para entender la cobertura real de una ciudad y comparar con otras.

---

*Sección adicional — anclaje id: `gcc-section`*

**Cobertura conectada (GCC)**

Los edificios coloreados al activar esta capa pertenecen al radio de influencia de la **Gran Componente Conexa** — el mayor fragmento continuo de la red ciclista. Los edificios grises están cerca de algún tramo de carril, pero ese tramo está aislado: existe pero no conecta con ningún otro. Solo la GCC permite ir de un punto a otro de la ciudad sin salir del carril. Un porcentaje de GCC bajo significa que gran parte de la infraestructura construida no forma red navegable.

---

#### Modelo de Movilidad / Trayectos

**Qué estás viendo**: Los tramos de la red ciclista con un grosor y color proporcional al volumen de trayectos estimados que los utilizan. Los tramos más gruesos y oscuros son los más transitados.

**Cómo se recogieron**: Se genera un modelo de viajes según la fuente seleccionada —GPS, estaciones o población— y se asignan a la red real usando el algoritmo de enrutamiento elegido. El volumen de cada tramo suma todos los trayectos que lo recorren.

**Por qué es útil**: Muestra dónde se concentra el tráfico ciclista real. Los corredores más cargados son los prioritarios para mejorar con infraestructura y los que más riesgo concentran cuando no tienen carril protegido.

---

#### Modelo de Movilidad / Desplazamientos (O-D)

**Qué estás viendo**: Una malla hexagonal sobre la ciudad donde cada celda representa una zona. El color indica cuántos viajes se generan o atraen. Las líneas entre hexágonos muestran los pares origen-destino más frecuentes — a mayor grosor, mayor flujo entre esas dos zonas.

**Cómo se recogieron**: Se agregan los orígenes y destinos de todos los viajes del modelo en una malla hexagonal y se calcula el flujo entre cada par de zonas con datos suficientes.

**Por qué es útil**: Revela qué partes de la ciudad se conectan entre sí por bici y dónde hay demanda real de desplazamiento sin infraestructura que la soporte. Una línea gruesa sin carril debajo es una oportunidad de inversión concreta.

---

#### Servicio Bici / Demanda

**Qué estás viendo**: Las estaciones del servicio de bici pública representadas como círculos. El tamaño y color son proporcionales al número de trayectos estimados que parten o llegan a cada estación.

**Cómo se recogieron**: Se agregan los datos de uso del sistema de bici pública —o el modelo de demanda— por estación y período.

**Por qué es útil**: Identifica qué estaciones concentran más actividad y cuáles están infrautilizadas. Las más oscuras y grandes son las que más necesitan flota suficiente y redistribución frecuente.

---

#### Servicio Bici / Disponibilidad

**Qué estás viendo**: Las estaciones coloreadas según cuánto tiempo permanecen inoperativas al día — sin bicicletas disponibles o sin anclajes libres. El rojo indica mayor tiempo de fallo.

**Cómo se recogieron**: Se analiza el registro de ocupación de cada estación y se calcula el porcentaje de tiempo en estado crítico —vacía o llena— durante el período seleccionado.

**Por qué es útil**: El momento que más frustra al usuario es cuando llega a una estación y no hay bici. Este mapa localiza exactamente dónde ocurre eso con más frecuencia y durante cuánto tiempo al día.

---

#### Servicio Bici / Cobertura

**Qué estás viendo**: El área de influencia peatonal de cada estación, representada como un radio de 150 metros. Las zonas de la ciudad sin ningún radio encima quedan descubiertas — no hay ninguna estación accesible a pie en menos de dos minutos.

**Cómo se recogieron**: Para cada estación se traza un radio de 150 metros y se proyecta sobre el mapa. El umbral de 150 metros equivale a un desplazamiento a pie de aproximadamente 90 segundos.

**Por qué es útil**: Los huecos en la cobertura son las ubicaciones exactas donde una nueva estación tendría más impacto. Este mapa es el argumento geográfico más directo para decidir dónde ampliar la red.

---

#### Siniestralidad

**Qué estás viendo**: Los accidentes con víctimas registrados en la ciudad, representados como puntos coloreados por nivel de gravedad — azul (ileso), amarillo (leve), rojo (grave) y granate (fatal). El filtro activo (Bicicleta / Todos) determina qué accidentes aparecen.

**Cómo se recogieron**: Datos del registro oficial de accidentalidad de la DGT o equivalente municipal, georreferenciados al tramo donde ocurrió el accidente. Se representan exactamente tal como están registrados en la fuente.

**Por qué es útil**: Localiza los puntos negros de la ciudad — los cruces y calles donde se acumulan los siniestros. Es el mapa que deberían ver los responsables de planificación antes de decidir dónde invertir en infraestructura ciclista.

---

## 12. Controls help

Two tiers of help per control:

1. **Always-visible summary** — one short sentence rendered as muted text directly below the control card body. Describes what the control does in plain language.
2. **Expandable detail** *(Option A — per-control `?` button)* — a `?` button inside the FilterCard header (same size and style as the MetricPill help button). On click, a detail panel expands inline below the summary with three sections (Qué estás viendo / Cómo se recogieron / Por qué es útil). Clicking `?` again or clicking outside collapses it. Applied to **Generación** and **Enrutamiento** only — the methodology controls where understanding the algorithm matters. `PeriodRangeTimeline` and `Tipo de accidente` use the three-section format directly in their always-visible text (no extra expand needed).

---

### Modelo de Movilidad — controles

#### Período *(PeriodRangeTimeline — widget de rango arrastrable)*

El selector de mes se sustituye por `PeriodRangeTimeline` con `unit="mes"`. La tarjeta muestra el rango activo en cabecera (`2024-01 – 2024-06`) y una pista arrastrable debajo; el extremo izquierdo fija el inicio, el derecho fija el fin, arrastrar el centro desplaza el período entero. El componente ocupa el ancho completo de la fila de controles.

> **Qué estás viendo**: El rango de meses seleccionado para el modelo. La cabecera muestra los extremos del período activo y cuántos meses abarca.
> **Cómo se recogieron**: Los meses disponibles dependen de los datos cargados para la fuente de generación activa — no todas las combinaciones de fuente y algoritmo tienen datos en todos los períodos.
> **Por qué es útil**: Ampliar el rango suaviza la estacionalidad y muestra la tendencia de uso; reducirlo a un mes concreto permite comparar configuraciones en el mismo período sin ruido.

#### Generación *(+ `?` expandable)*

**Summary (always visible)**: Define cómo se estiman los orígenes y destinos de los viajes — GPS real, bici pública o distribución por población.

**Expanded detail:**

> **Qué estás viendo**: La fuente de datos que determina dónde se originan y terminan los viajes del modelo. Cada opción usa una fuente diferente para estimar quién viaja, desde dónde y hacia dónde: **GPS real** usa trayectos registrados por ciclistas reales anonimizados; **Estaciones** usa los registros de uso del servicio de bici pública; **Población** genera demanda sintética a partir de la densidad de residentes y empleos por zona.
> **Cómo se recogieron**: Los datos GPS proceden de plataformas de ciclismo (Strava, Wikiloc, etc.) con anonimización y agregación mínima de 5 usuarios por tramo. Los datos de estaciones son los registros operativos del sistema de bici pública. Los datos de población proceden del padrón municipal y del catastro de usos del suelo.
> **Por qué es útil**: La elección de la fuente cambia radicalmente el resultado. GPS capta al ciclista habitual; Estaciones mide al usuario del servicio público; Población estima la demanda potencial de quienes podrían usar la bici pero aún no lo hacen. Comparar los tres revela qué parte de la demanda se cubre, cuánta viene de usuarios de bici pública y cuánta queda sin infraestructura que la soporte.

#### Enrutamiento *(+ `?` expandable)*

**Summary (always visible)**: Determina por qué camino de la red discurre cada viaje — trazas reales, ruta más corta o ruta más segura.

**Expanded detail:**

> **Qué estás viendo**: El algoritmo que decide por qué tramos de la red ciclista discurre cada viaje. Define si los ciclistas modelados priorizan velocidad, seguridad o siguen trazas registradas.
> **Cómo se recogieron**: **Map-matched** ajusta las trazas GPS reales a la red viaria tramo a tramo — refleja el comportamiento exacto de los usuarios registrados. **Ruta corta** aplica el algoritmo de camino mínimo en distancia sin penalizar ningún tipo de vía. **Ruta segura** aplica el mismo algoritmo pero con penalización sobre tramos sin carril bici — los ciclistas modelados prefieren dar un rodeo si el camino más corto es una calzada sin protección.
> **Por qué es útil**: Ruta corta y Ruta segura permiten simular escenarios de inversión: si se construye un nuevo tramo de carril, ¿cuántos viajes se desplazarían hacia él? La diferencia en volumen entre ambos algoritmos identifica exactamente qué corredores están forzando a los ciclistas a circular por calzada — y cuánto tráfico captaría una mejora de infraestructura en ese punto.

---

### Siniestralidad — controles (estandarización)

Los controles de Siniestralidad (filtro de vehículo y selector de año) se mueven a un contenedor `FilterCard` estándar idéntico al de Tráfico, sustituyendo el toggle inline del header y el `YearTimeline` a medida.

**Nuevo control: Tipo de accidente**
```
Título: Tipo de accidente
Descripción: Siniestros con ciclista / todos los accidentes
Opciones: [Bicicleta] [Todos]
```
> Selecciona si ver solo los siniestros donde hay un ciclista implicado o todos los accidentes registrados en la ciudad. El filtro **Bicicleta** es el más relevante para evaluar el impacto de la infraestructura ciclista en la seguridad vial.

**Período *(PeriodRangeTimeline — widget de rango arrastrable)***

El control de año se implementa como `PeriodRangeTimeline` con `unit="año"`. Reemplaza tanto el `YearTimeline` inline de `AccidentsStats` como la burbuja de año que había en `MapFilters`. El MetricPill "Año de datos" desaparece — la información del período activo vive en la cabecera de esta tarjeta (e.g. `2021 – 2023 · 3 años`).

> **Qué estás viendo**: El rango de años del registro de accidentalidad que se muestra en el mapa y las estadísticas. La cabecera indica inicio, fin y duración del período seleccionado.
> **Cómo se recogieron**: Los años disponibles proceden del registro oficial de accidentalidad cargado para cada ciudad. Algunos municipios solo tienen datos de los últimos años.
> **Por qué es útil**: Comparar un año con otro revela si la siniestralidad mejora, empeora o se mantiene. Ampliar el rango a varios años da una tendencia más robusta que un solo año, especialmente en ciudades con pocos accidentes registrados.

**Archivo afectado**: `AccidentsStats.tsx` — el toggle inline del header se extrae a `FilterCard` ("Tipo de accidente"); el `YearTimeline` se sustituye por `PeriodRangeTimeline` encima del grid de pills (ahora de 3 columnas).

---

## 13. Out of scope

- `AccidentsStats.tsx` h2 `Siniestralidad Vial` — already correct, no change
- API error messages and internal hook strings (e.g. `'Error al cargar los datos de tráfico'`) — internal, not user-facing UI
- `cityStats.ts` mock data strings — static placeholder data, not connected to live UI
- File/directory names (`TrafficStats`, `AccidentsLayer`, etc.) — identifiers only, no rename
- Stub layer files `TerrainLayer.tsx`, `TerrainLegend.tsx`, `IntersectionsLayer.tsx`, `IntersectionsLegend.tsx` — kept for future use, just removed from UI routing
