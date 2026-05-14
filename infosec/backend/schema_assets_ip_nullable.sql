-- Make ip_address optional — not every asset type has a network address
-- (ISO 27001 Annex A 5.9 covers people, facilities, information, and services too)
ALTER TABLE assets ALTER COLUMN ip_address DROP NOT NULL;
DROP INDEX IF EXISTS assets_ip_address_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_ip_unique ON assets(ip_address) WHERE ip_address IS NOT NULL;
