export const PARTY_COLORS: Record<string, string> = {
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
};

export function getPartyColor(party: string | null | undefined): string {
  if (!party) return "#9ca3af";
  return PARTY_COLORS[party] ?? "#9ca3af";
}
