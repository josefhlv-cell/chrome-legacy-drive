
-- Delete non-vehicle records (service descriptions, logos, icons, sale-tags)
DELETE FROM vehicle_images WHERE vehicle_id IN (
  SELECT id FROM vehicles WHERE 
    image_url = '' 
    OR image_url IS NULL 
    OR image_url LIKE '%sale-tag%' 
    OR image_url LIKE '%logo%' 
    OR image_url LIKE '%icon%'
    OR name LIKE '%Dovoz a prodej%'
    OR name LIKE '%Značkový prodejce%'
    OR name LIKE '%Odborný servis%'
    OR name LIKE '%Výkup vozů%'
);

DELETE FROM vehicles WHERE 
  image_url = '' 
  OR image_url IS NULL 
  OR image_url LIKE '%sale-tag%' 
  OR image_url LIKE '%logo%' 
  OR image_url LIKE '%icon%'
  OR name LIKE '%Dovoz a prodej%'
  OR name LIKE '%Značkový prodejce%'
  OR name LIKE '%Odborný servis%'
  OR name LIKE '%Výkup vozů%';
