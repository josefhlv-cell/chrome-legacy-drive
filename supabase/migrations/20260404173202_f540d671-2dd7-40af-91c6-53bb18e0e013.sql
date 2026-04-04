
-- Delete old scraper records with bad data (year=2026, mileage=0)
DELETE FROM vehicle_images WHERE vehicle_id IN (
  SELECT id FROM vehicles WHERE year = 2026 AND mileage = 0
);
DELETE FROM vehicles WHERE year = 2026 AND mileage = 0;
