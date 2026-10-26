CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public."IncidentReport"
ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

CREATE INDEX IF NOT EXISTS incident_report_location_gist_idx
ON public."IncidentReport"
USING GIST (location);

CREATE OR REPLACE FUNCTION public.set_incident_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        IF NEW.latitude BETWEEN -90 AND 90
           AND NEW.longitude BETWEEN -180 AND 180 THEN
            NEW.location := ST_SetSRID(
                ST_MakePoint(NEW.longitude, NEW.latitude),
                4326
            )::geography;
        ELSE
            RAISE EXCEPTION 'Invalid latitude or longitude coordinates';
        END IF;
    ELSE
        NEW.location := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_incident_location
ON public."IncidentReport";

CREATE TRIGGER trg_set_incident_location
BEFORE INSERT OR UPDATE OF latitude, longitude
ON public."IncidentReport"
FOR EACH ROW
EXECUTE FUNCTION public.set_incident_location();
