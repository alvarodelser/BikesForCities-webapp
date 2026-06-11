export const PARTY_COLORS: Record<string, string> = {
  // ── Modern abbreviations ──────────────────────────────────────────────────
  "PP": "#0066CC",
  "PSOE": "#E40035",
  "Ciudadanos": "#FF6600",
  "Cs": "#FF6600",
  "Más Madrid": "#00A86B",
  "Ahora Madrid": "#6A0DAD",
  "Vox": "#63BE21",
  "IU": "#B5261E",
  "Podemos": "#6A2E8C",
  "Unidas Podemos": "#6A2E8C",
  "Compromís": "#F5A623",
  "ERC": "#FFB232",
  "CiU": "#002782",
  "JxCat": "#00A3DA",
  "PSC": "#E40035",
  "CUP": "#FFCC00",
  "BNG": "#6BB83A",
  "PNV": "#4AAE4A",
  "EH Bildu": "#B5D334",
  "PDECat": "#002782",

  // ── Full names — modern parties ───────────────────────────────────────────
  "Partido Popular": "#0066CC",
  "Partido Popular de la Región de Murcia": "#0066CC",
  "Partido Socialista Obrero Español": "#E40035",
  "Partido Socialista de la Región de Murcia-PSOE": "#E40035",
  "Partido Socialista del País Valenciano-PSOE": "#E40035",
  "Partido de los Socialistas de Cataluña": "#E40035",
  "Partido Socialista Unificado de Cataluña": "#EF2B2D",
  "Partido Comunista de España": "#EF2B2D",
  "Izquierda Unida": "#EF2B2D",
  "Izquierda Unida Los Verdes-Convocatoria por Andalucía": "#4CAF50",
  "Partido Nacionalista Vasco": "#4AAE4A",
  "Esquerra Republicana de Catalunya": "#FFB232",
  "Esquerra Republicana Balear": "#FFB232",
  "Acció Catalana Republicana": "#C41E3A",
  "Convergència Democràtica de Catalunya": "#002782",
  "Partit Demòcrata Europeu Català": "#002782",
  "Unió Catalanista": "#002782",
  "Barcelona en comú": "#E65C56",
  "Guanyem Girona": "#E65C56",
  "Zaragoza en Común": "#BA1227",
  "Marea Atlántica": "#E65C56",
  "Compromís": "#F5A623",
  "Partido Andalucista": "#228B22",
  "Foro Asturias": "#0082CA",
  "Federación Socialista Asturiana": "#E40035",
  "Partido Regionalista de Mallorca": "#1F4473",
  "Unió Valenciana": "#F5A623",
  "Unió Regional Valenciana": "#0098C8",
  "Partido de Unión Republicana Autonomista": "#E74C3C",
  "Centro Democrático y Social": "#1E7FB3",
  "Unión de Centro Democrático": "#FFB703",
  "Reforma Democrática": "#7B6FA0",
  "Progresistas Vigueses": "#EF2B2D",
  "Unidade Galega": "#6BB83A",
  "Iniciativa Ciudadana Vasca": "#003DA5",

  // ── Full names — historical (19th–20th century) ───────────────────────────
  "Partido Liberal": "#E4442A",
  "Partido Conservador": "#003F87",
  "Partido Progresista": "#8B1A1A",
  "Partido Moderado": "#4A3728",
  "Partido Maurista": "#1F4473",
  "maurismo": "#1F4473",
  "Partido Reformista": "#6B8EAD",
  "Partido Demócrata Posibilista": "#4B0082",
  "Partido Republicano Radical": "#A871A8",
  "Partido Republicano Radical Socialista": "#EF2B2D",
  "Partido Republicano Democrático Federal": "#9370DB",
  "Izquierda Republicana": "#E74C3C",
  "Unión Republicana": "#E74C3C",
  "Acción Republicana": "#CC0000",
  "Acción Popular": "#1F4473",
  "Solidaridad Catalana": "#002782",
  "Liga Regionalista": "#1F4473",
  "Comunión Nacionalista Vasca": "#003DA5",
  "Unión Vasco-Navarra": "#003DA5",
  "Unión Liberal": "#D4A017",
  "Unión Monárquica Nacional": "#1F4473",
  "Liga de Acción Monárquica": "#1F4473",
  "Renovación Española": "#002060",
  "Confederación Española de Derechas Autónomas": "#1F4473",
  "Derecha de Cataluña": "#1F4473",
  "Comunión Tradicionalista": "#8B0000",
  "Falange Española": "#1C3A6E",
  "Falange Española de las JONS": "#1C3A6E",
  "Falange Española Tradicionalista y de las JONS": "#1C3A6E",
  "Juntas de Ofensiva Nacional-Sindicalista": "#1C3A6E",
  "Movimiento Nacional": "#1C3A6E",
  "Unión Patriótica": "#374151",

  // ── Misc ─────────────────────────────────────────────────────────────────
  "político independiente": "#9ca3af",
};

// Official ballot abbreviations (siglas) as stored in city_elections, mapped
// to their canonical PARTY_COLORS key. The MIR electoral data uses these
// uppercase coalition names rather than display names.
const PARTY_ALIASES: Record<string, keyof typeof PARTY_COLORS> = {
  "MM-VQ": "Más Madrid",
  "PSC-CP": "PSC",
  "PSOE-A": "PSOE",
  "BARCELONA EN COMÚ - C": "Barcelona en comú",
  "ERC - AM": "ERC",
  "PODEMOS-IU-AV": "Podemos",
  "UNIDAS - IU - PODEMOS": "Podemos",
  "TRIASXBCN-CM": "JxCat",
  "GGI-AMUNT": "Guanyem Girona",
  "CM": "JxCat", // Compromís Municipal (Junts brand in Catalan municipals)
  "CON ANDALUCÍA": "Podemos",
};

// Family patterns for coalition names not seen yet (each city brands its own
// list, e.g. "PSOE-A", "EAJ-PNV", "BNG-ASAMBLEAS ABERTAS"). Checked in order
// after exact/alias lookup fails.
const PARTY_PATTERNS: [RegExp, keyof typeof PARTY_COLORS][] = [
  [/PSOE|\bPSC\b|SOCIALISTA/i, "PSOE"],
  [/\bPP\b|PARTIDO POPULAR/i, "PP"],
  [/\bVOX\b/i, "Vox"],
  [/PODEMOS|UNIDAS|\bIU\b|IZQUIERDA UNIDA/i, "Podemos"],
  [/EN COM[ÚU]/i, "Barcelona en comú"],
  [/\bERC\b|ESQUERRA REPUBLICANA/i, "ERC"],
  [/M[ÁA]S MADRID/i, "Más Madrid"],
  [/JUNTS|JXCAT|CONVERG[ÈE]NCIA/i, "JxCat"],
  [/COMPROM[ÍI]S/i, "Compromís"],
  [/BILDU/i, "EH Bildu"],
  [/\bPNV\b|\bEAJ\b/i, "PNV"],
  [/\bBNG\b/i, "BNG"],
  [/CIUDADANOS|\bC'?S\b/i, "Cs"],
];

// Left-right ideology score (0 = far left, 100 = far right) used to seat
// parties across the hemiciclo: left-wing fills the left arc, right-wing the
// right. Regionalist parties (PNV, …) sit at the 50 center, which is also the
// default for unknown parties. Keyed by canonical PARTY_COLORS names.
export const PARTY_IDEOLOGY: Record<string, number> = {
  "CUP": 10,
  "ERC": 15,
  "EH Bildu": 15,
  "BNG": 15,
  "IU": 20,
  "Podemos": 20,
  "Unidas Podemos": 20,
  "Barcelona en comú": 20,
  "Guanyem Girona": 20,
  "Zaragoza en Común": 20,
  "Marea Atlántica": 20,
  "Más Madrid": 25,
  "Ahora Madrid": 25,
  "Compromís": 25,
  "PSOE": 40,
  "PSC": 40,
  "PNV": 50,
  "Ciudadanos": 60,
  "Cs": 60,
  "CiU": 65,
  "JxCat": 65,
  "PDECat": 65,
  "PP": 80,
  "Vox": 95,
};

const CENTER_IDEOLOGY = 50;

const FALLBACK_GRAY = "#9ca3af";

// Uppercase lookup so "VOX"/"CS" (ballot casing) match "Vox"/"Cs".
const NORMALIZED_COLORS: Record<string, string> = {};
for (const [name, color] of Object.entries(PARTY_COLORS)) {
  NORMALIZED_COLORS[name.toUpperCase()] = color;
}
for (const [alias, canonical] of Object.entries(PARTY_ALIASES)) {
  NORMALIZED_COLORS[alias.toUpperCase()] = PARTY_COLORS[canonical];
}

const NORMALIZED_IDEOLOGY: Record<string, number> = {};
for (const [name, score] of Object.entries(PARTY_IDEOLOGY)) {
  NORMALIZED_IDEOLOGY[name.toUpperCase()] = score;
}
for (const [alias, canonical] of Object.entries(PARTY_ALIASES)) {
  const score = PARTY_IDEOLOGY[canonical];
  if (score !== undefined) NORMALIZED_IDEOLOGY[alias.toUpperCase()] = score;
}

export function getPartyColor(party: string | null | undefined): string {
  if (!party) return FALLBACK_GRAY;
  const exact = PARTY_COLORS[party] ?? NORMALIZED_COLORS[party.trim().toUpperCase()];
  if (exact) return exact;
  for (const [pattern, canonical] of PARTY_PATTERNS) {
    if (pattern.test(party)) return PARTY_COLORS[canonical];
  }
  return FALLBACK_GRAY;
}

export function getPartyIdeology(party: string | null | undefined): number {
  if (!party) return CENTER_IDEOLOGY;
  const exact = NORMALIZED_IDEOLOGY[party.trim().toUpperCase()];
  if (exact !== undefined) return exact;
  for (const [pattern, canonical] of PARTY_PATTERNS) {
    if (pattern.test(party)) return PARTY_IDEOLOGY[canonical] ?? CENTER_IDEOLOGY;
  }
  return CENTER_IDEOLOGY;
}
