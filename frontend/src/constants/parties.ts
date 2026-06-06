export const PARTY_COLORS: Record<string, string> = {
  // Abbreviations
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
  "ERC": "#F4B33D",
  "CiU": "#003082",
  "JxCat": "#00A3DA",
  "PSC": "#E40035",
  "CUP": "#FFCC00",
  "BNG": "#6BB83A",
  "PNV": "#008000",
  "EH Bildu": "#B5D334",

  // Full Spanish names (from Wikidata)
  "Partido Popular": "#0066CC",
  "Partido Socialista Obrero Español": "#E40035",
  "Partido Liberal": "#E4442A",
  "Partido Conservador": "#003F87",
  "Partido Progresista": "#8B1A1A",
  "Partido Moderado": "#5C3317",
  "Partido Republicano Radical": "#F4A020",
  "Unión de Centro Democrático": "#FFB703",
  "Centro Democrático y Social": "#1E7FB3",
  "Alianza Popular": "#003F87",
  "Coalición Democrática": "#003F87",
  "Reforma Democrática": "#7B6FA0",
  "Acción Republicana": "#CC0000",
  "Acción Popular": "#6B2D8B",
  "Falange Española Tradicionalista y de las JONS": "#1B4D2E",
  "político independiente": "#9ca3af",
};

export function getPartyColor(party: string | null | undefined): string {
  if (!party) return "#9ca3af";
  return PARTY_COLORS[party] ?? "#9ca3af";
}
