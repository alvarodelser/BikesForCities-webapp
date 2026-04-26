import psycopg2
from psycopg2.extras import RealDictCursor

def run():
    conn = psycopg2.connect("dbname=bikesforcities user=postgres")
    
    where_clause = "WHERE s.city_id = 1 AND s.station_id = '1' AND r.observed_at >= NOW() - INTERVAL '3 months'"
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            WITH daily_samples AS (
                SELECT DISTINCT ON (
                    DATE(r.observed_at AT TIME ZONE 'UTC'),
                    EXTRACT(hour FROM r.observed_at AT TIME ZONE 'UTC')
                )
                    EXTRACT(hour FROM r.observed_at AT TIME ZONE 'UTC') AS hour_of_day,
                    r.available_bikes
                FROM station_readings r
                JOIN stations s ON s.citybikes_network_id = r.citybikes_network_id AND s.station_id = r.station_id
                {where_clause}
                ORDER BY 
                    DATE(r.observed_at AT TIME ZONE 'UTC'),
                    EXTRACT(hour FROM r.observed_at AT TIME ZONE 'UTC'),
                    r.observed_at DESC
            )
            SELECT 
                hour_of_day,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY available_bikes) AS avg_bikes
            FROM daily_samples
            GROUP BY hour_of_day
            ORDER BY hour_of_day
        """)
        print(cur.fetchall())
        
run()
