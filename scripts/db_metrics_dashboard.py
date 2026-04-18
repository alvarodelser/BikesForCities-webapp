"""
DB Metrics Dashboard – self-contained HTML generator.

Run with your normal environment loaded:

    python -m backend.db_metrics_dashboard > metrics_dashboard.html
    open metrics_dashboard.html
"""
from __future__ import annotations

import datetime as dt
import math
from typing import Any

from dotenv import load_dotenv

from backend.database.db_io import (
    connect_db,
    get_all_cities,
    count_nodes,
    count_edges,
    count_routes,
    has_traffic,
    get_latest_traffic_month,
    get_city_months_with_station_data,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _html_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _get_feature_counts(conn, city_id: int) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT feature_type, COUNT(*) FROM features WHERE city_id = %s GROUP BY feature_type",
            (city_id,),
        )
        return {row[0]: int(row[1]) for row in cur.fetchall()}


def _get_traffic_months(conn, city_id: int) -> list[dt.date]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT month FROM edge_traffic WHERE city_id = %s ORDER BY month",
            (city_id,),
        )
        return [row[0] for row in cur.fetchall()]


def _get_all_ingestion_statuses(conn) -> list[tuple]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.name, i.process_name, i.status, i.updated_at
            FROM ingestion_status i
            JOIN cities c ON c.id = i.city_id
            WHERE i.time_period IS NULL
            ORDER BY i.updated_at DESC
            """
        )
        return cur.fetchall()


# ---------------------------------------------------------------------------
# SVG generators
# ---------------------------------------------------------------------------

def _month_int(m: Any) -> int:
    return m.year * 12 + m.month


def _svg_scatter(points: list[tuple[str, int, int]]) -> str:
    """Scatter plot: X = nodes, Y = edges. points = [(name, nodes, edges)]."""
    if not points:
        return "<p style='color:#94a3b8'>No graph data.</p>"

    W, H = 700, 420
    mt, mr, mb, ml = 40, 160, 55, 75
    pw, ph = W - ml - mr, H - mt - mb

    max_n = max(p[1] for p in points) or 1
    max_e = max(p[2] for p in points) or 1

    def tx(n: int) -> float:
        return ml + (n / max_n) * pw

    def ty(e: int) -> float:
        return mt + ph - (e / max_e) * ph

    parts: list[str] = [
        f'<svg viewBox="0 0 {W} {H}" style="width:100%;background:#0f172a;border-radius:8px">',
        # Title
        f'<text x="{W//2}" y="22" text-anchor="middle" font-size="13" fill="#cbd5e1" font-weight="600">Nodes vs Edges per City</text>',
    ]

    # Grid lines
    for i in range(5):
        gx = ml + i * pw / 4
        gy = mt + i * ph / 4
        n_val = int(max_n * i / 4)
        e_val = int(max_e * (4 - i) / 4)
        parts.append(f'<line x1="{gx:.1f}" y1="{mt}" x2="{gx:.1f}" y2="{mt+ph}" stroke="#1e293b" stroke-width="1"/>')
        parts.append(f'<line x1="{ml}" y1="{gy:.1f}" x2="{ml+pw}" y2="{gy:.1f}" stroke="#1e293b" stroke-width="1"/>')
        parts.append(f'<text x="{gx:.1f}" y="{mt+ph+14}" text-anchor="middle" font-size="10" fill="#64748b">{n_val:,}</text>')
        parts.append(f'<text x="{ml-6}" y="{gy+4:.1f}" text-anchor="end" font-size="10" fill="#64748b">{e_val:,}</text>')

    # Axes
    parts.append(f'<line x1="{ml}" y1="{mt}" x2="{ml}" y2="{mt+ph}" stroke="#475569" stroke-width="1.5"/>')
    parts.append(f'<line x1="{ml}" y1="{mt+ph}" x2="{ml+pw}" y2="{mt+ph}" stroke="#475569" stroke-width="1.5"/>')
    parts.append(f'<text x="{ml+pw/2}" y="{H-4}" text-anchor="middle" font-size="11" fill="#94a3b8">Nodes</text>')
    parts.append(f'<text x="12" y="{mt+ph/2}" text-anchor="middle" font-size="11" fill="#94a3b8" transform="rotate(-90,12,{mt+ph/2})">Edges</text>')

    # Dots + labels
    COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fb923c", "#a78bfa", "#facc15"]
    for idx, (name, nodes, edges) in enumerate(points):
        x, y = tx(nodes), ty(edges)
        c = COLORS[idx % len(COLORS)]
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="{c}" stroke="#0f172a" stroke-width="1.5" opacity="0.9"/>')
        parts.append(f'<text x="{x+10:.1f}" y="{y+4:.1f}" font-size="11" fill="#e2e8f0">{_html_escape(name)} ({nodes:,}/{edges:,})</text>')

    parts.append("</svg>")
    return "\n".join(parts)


def _svg_timelines(city_timelines: list[tuple[str, list, list]]) -> str:
    """Horizontal timeline dots per city. Each tuple: (name, station_months, traffic_months)."""
    all_months = []
    for _, sm, tm in city_timelines:
        all_months.extend([_month_int(m) for m in sm])
        all_months.extend([_month_int(m) for m in tm])

    if not all_months:
        return "<p style='color:#94a3b8'>No temporal data.</p>"

    min_mi = min(all_months)
    max_mi = max(all_months)
    total_months = max_mi - min_mi + 1

    W = 800
    ml, mr, mt = 130, 20, 40
    row_h = 44
    pw = W - ml - mr
    H = mt + row_h * len(city_timelines) + 30

    def mx(mi: int) -> float:
        return ml + (mi - min_mi) / max(total_months - 1, 1) * pw

    parts: list[str] = [
        f'<svg viewBox="0 0 {W} {H}" style="width:100%;background:#0f172a;border-radius:8px">',
        f'<text x="{W//2}" y="20" text-anchor="middle" font-size="13" fill="#cbd5e1" font-weight="600">Temporal Coverage</text>',
    ]

    # Year tick marks on top
    start_year = (min_mi // 12)
    end_year = (max_mi // 12) + 1
    for y in range(start_year, end_year + 1):
        mi = y * 12 + 1
        if mi < min_mi or mi > max_mi + 12:
            continue
        x = mx(mi)
        parts.append(f'<line x1="{x:.1f}" y1="{mt}" x2="{x:.1f}" y2="{H-20}" stroke="#1e293b" stroke-width="1"/>')
        parts.append(f'<text x="{x:.1f}" y="{mt-6}" text-anchor="middle" font-size="10" fill="#64748b">{y}</text>')

    # City rows
    for i, (name, sm, tm) in enumerate(city_timelines):
        row_y = mt + i * row_h + row_h // 2
        parts.append(f'<text x="{ml-8}" y="{row_y+4:.1f}" text-anchor="end" font-size="11" fill="#cbd5e1">{_html_escape(name)}</text>')
        # Horizontal base line
        parts.append(f'<line x1="{ml}" y1="{row_y:.1f}" x2="{ml+pw}" y2="{row_y:.1f}" stroke="#1e293b" stroke-width="1"/>')
        for m in sm:
            x = mx(_month_int(m))
            parts.append(f'<circle cx="{x:.1f}" cy="{row_y-6:.1f}" r="4.5" fill="#3b82f6" stroke="#0f172a" stroke-width="0.5" opacity="0.9"/>')
        for m in tm:
            x = mx(_month_int(m))
            parts.append(f'<circle cx="{x:.1f}" cy="{row_y+6:.1f}" r="4.5" fill="#f97316" stroke="#0f172a" stroke-width="0.5" opacity="0.9"/>')

    # Legend
    ly = H - 8
    lx = ml
    parts.append(f'<circle cx="{lx}" cy="{ly}" r="5" fill="#3b82f6"/>')
    parts.append(f'<text x="{lx+10}" y="{ly+4}" font-size="10" fill="#94a3b8">Station data</text>')
    parts.append(f'<circle cx="{lx+110}" cy="{ly}" r="5" fill="#f97316"/>')
    parts.append(f'<text x="{lx+120}" y="{ly+4}" font-size="10" fill="#94a3b8">Traffic data</text>')
    parts.append("</svg>")
    return "\n".join(parts)




# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------

def build_dashboard() -> str:
    load_dotenv()
    conn = connect_db()
    try:
        now = dt.datetime.now(tz=dt.timezone.utc)
        cities = get_all_cities(conn)

        # Collect data per city
        city_data: list[dict] = []
        KNOWN_FEAT = ["bike_lane", "building"]

        for city in cities:
            city_id = city[0]
            name    = city[1]
            wikidata_id = city[3]
            center_lat, center_lon = city[4], city[5]
            radius = city[6]

            emojis = ""
            if city[16]: emojis += "🛣️"
            if city[17]: emojis += "🚗"
            if city[18]: emojis += "⚠️"
            if city[19]: emojis += "⛰️"
            if city[20]: emojis += "🚦"
            if city[21]: emojis += "🅿️"
            if city[22]: emojis += "💬"

            stations = city[26] or 0
            est_trips = city[27] or 0

            nodes  = count_nodes(conn, city_id)
            edges  = count_edges(conn, city_id)
            routes = count_routes(conn, city_id)

            station_months = get_city_months_with_station_data(conn, city_id)
            traffic_months = _get_traffic_months(conn, city_id)
            feat           = _get_feature_counts(conn, city_id)

            city_data.append(dict(
                id=city_id, name=name, wikidata_id=wikidata_id,
                center_lat=center_lat, center_lon=center_lon, radius=radius,
                nodes=nodes, edges=edges, routes=routes,
                stations=stations, est_trips=est_trips,
                station_months=station_months, traffic_months=traffic_months,
                feat=feat, modes_emojis=emojis,
            ))

        ingestion_rows = _get_all_ingestion_statuses(conn)

    finally:
        conn.close()

    # ── Section 1: Main Table ────────────────────────────────────────────────
    all_feat_types = sorted({ft for cd in city_data for ft in cd["feat"]})
    feat_cols = [ft for ft in KNOWN_FEAT if ft in all_feat_types]
    other_types = [ft for ft in all_feat_types if ft not in feat_cols]

    th_feat = "".join(f"<th>{ft.replace('_',' ')}</th>" for ft in feat_cols)
    if other_types:
        th_feat += "<th>other features</th>"

    table_rows: list[str] = []
    for cd in city_data:
        feat_cells = "".join(
            f"<td>{cd['feat'].get(ft, 0):,}</td>" for ft in feat_cols
        )
        if other_types:
            other_sum = sum(cd['feat'].get(ft, 0) for ft in other_types)
            feat_cells += f"<td>{other_sum:,}</td>"

        table_rows.append(
            "<tr>"
            f"<td>{cd['id']}</td>"
            f"<td><b>{_html_escape(cd['name'])}</b></td>"
            f"<td style='letter-spacing: 2px;'>{cd['modes_emojis']}</td>"
            f"<td>{cd['nodes']:,}</td>"
            f"<td>{cd['edges']:,}</td>"
            f"<td>{cd['routes']:,}</td>"
            f"<td>{cd['stations']:,}</td>"
            f"<td>{int(cd['est_trips']):,}</td>"
            f"{feat_cells}"
            "</tr>"
        )
    table_body = "\n".join(table_rows)

    # ── Section 2: Timeline SVG ──────────────────────────────────────────────
    timelines = [(cd["name"], cd["station_months"], cd["traffic_months"]) for cd in city_data]
    svg_timeline = _svg_timelines(timelines)

    # ── Section 3: Scatter SVG ───────────────────────────────────────────────
    scatter_pts = [(cd["name"], cd["nodes"], cd["edges"]) for cd in city_data]
    svg_scatter = _svg_scatter(scatter_pts)


    # ── Section 4: Ingestion Status Table ────────────────────────────────────
    STATUS_COLORS = {
        "SUCCESS": ("rgba(34,197,94,0.12)", "#86efac", "rgba(34,197,94,0.5)"),
        "RUNNING": ("rgba(234,179,8,0.12)",  "#fde047", "rgba(234,179,8,0.5)"),
        "FAILED":  ("rgba(239,68,68,0.12)",  "#fca5a5", "rgba(239,68,68,0.5)"),
    }
    
    unique_cities = sorted({row[0] for row in ingestion_rows})
    unique_types = sorted({row[1] for row in ingestion_rows})
    
    city_options = "".join(f'<option value="{_html_escape(c)}">{_html_escape(c)}</option>' for c in unique_cities)
    type_options = "".join(f'<option value="{_html_escape(t)}">{_html_escape(t)}</option>' for t in unique_types)
    
    filter_html = f"""
    <div class="filters">
      <select id="filter-city" onchange="applyFilters()">
        <option value="">All Cities</option>
        {city_options}
      </select>
      <select id="filter-type" onchange="applyFilters()">
        <option value="">All Data Types</option>
        {type_options}
      </select>
    </div>
    """

    ingestion_rows_html: list[str] = []
    for city_name, data_type, status, updated_at in ingestion_rows:
        bg, fg, border = STATUS_COLORS.get(status, ("rgba(100,116,139,0.1)", "#94a3b8", "rgba(100,116,139,0.4)"))
        pill = (
            f'<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.75rem;'
            f'background:{bg};color:{fg};border:1px solid {border}">{_html_escape(status)}</span>'
        )
        ts = updated_at.strftime("%Y-%m-%d %H:%M") if updated_at else "—"
        ingestion_rows_html.append(
            f'<tr data-city="{_html_escape(city_name)}" data-type="{_html_escape(data_type)}">'
            f"<td>{_html_escape(city_name)}</td>"
            f"<td><code>{_html_escape(data_type)}</code></td>"
            f"<td>{pill}</td>"
            f"<td style='color:#64748b;font-size:0.82rem'>{ts}</td>"
            "</tr>"
        )
    ingestion_body = "\n".join(ingestion_rows_html) or "<tr><td colspan='4' style='color:#475569'>No ingestion records.</td></tr>"

    generated_at = now.isoformat()

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>BikesForCities – DB Metrics Dashboard</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; }}
    body {{
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      margin: 0; padding: 2rem;
      background: #0b1020; color: #f5f7ff;
    }}
    h1 {{ margin-bottom: 0.25rem; font-size: 1.6rem; }}
    h2 {{ font-size: 1.05rem; color: #94a3b8; text-transform: uppercase;
          letter-spacing: .08em; margin: 2rem 0 0.75rem; }}
    .subtitle {{ color: #a0a4c0; font-size: 0.9rem; margin-bottom: 2rem; }}
    table {{
      border-collapse: collapse; width: 100%;
      background: rgba(15,23,42,0.9); border-radius: 8px;
      overflow: hidden; box-shadow: 0 18px 45px rgba(0,0,0,.5);
      margin-bottom: 2rem;
    }}
    th, td {{ padding: 0.55rem 0.75rem; text-align: left; font-size: 0.88rem; }}
    th {{
      background: linear-gradient(90deg,#1e293b,#020617);
      font-weight: 600; letter-spacing: .04em;
      text-transform: uppercase; font-size: 0.7rem; color: #9ca3af;
    }}
    tbody tr:nth-child(even) {{ background: rgba(15,23,42,.85); }}
    tbody tr:nth-child(odd)  {{ background: rgba(15,23,42,.65); }}
    tbody tr:hover {{ background: rgba(59,130,246,.12); }}
    .pill {{
      display: inline-flex; align-items: center;
      padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.75rem;
      background: rgba(34,197,94,.1); color: #bbf7d0;
      border: 1px solid rgba(34,197,94,.4);
    }}
    .chart-wrap {{ margin-bottom: 2rem; }}
    code {{ font-size: 0.82rem; color: #93c5fd; }}
    .filters {{ display: flex; gap: 1rem; margin-bottom: 1rem; }}
    select {{
      background: #1e293b; color: #f1f5f9; border: 1px solid #334155;
      padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.85rem;
      cursor: pointer; outline: none;
    }}
    select:hover {{ border-color: #475569; }}
  </style>
  <script>
    function applyFilters() {{
      const city = document.getElementById('filter-city').value;
      const type = document.getElementById('filter-type').value;
      const rows = document.querySelectorAll('#ingestion-table tbody tr');
      rows.forEach(row => {{
          const rowCity = row.getAttribute('data-city');
          const rowType = row.getAttribute('data-type');
          const matchCity = !city || rowCity === city;
          const matchType = !type || rowType === type;
          row.style.display = (matchCity && matchType) ? '' : 'none';
      }});
    }}
  </script>
</head>
<body>
  <h1>BikesForCities – DB Metrics</h1>
  <div class="subtitle">Generated at <code>{_html_escape(generated_at)}</code></div>

  <h2>📋 City Overview</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>City</th><th>Modes</th>
        <th>Nodes</th><th>Edges</th><th>Routes</th>
        <th>Stations</th><th>Est. Trips (30d)</th>
        {th_feat}
      </tr>
    </thead>
    <tbody>{table_body}</tbody>
  </table>

  <h2>⏱️ Temporal Coverage</h2>
  <div class="chart-wrap">{svg_timeline}</div>

  <h2>📈 Nodes vs Edges</h2>
  <div class="chart-wrap">{svg_scatter}</div>

  <h2>⚙️ Ingestion Status</h2>
  {filter_html}
  <table id="ingestion-table">
    <thead>
      <tr><th>City</th><th>Data Type</th><th>Status</th><th>Updated At</th></tr>
    </thead>
    <tbody>{ingestion_body}</tbody>
  </table>
</body>
</html>
"""


def main() -> None:
    print(build_dashboard())


if __name__ == "__main__":
    main()
