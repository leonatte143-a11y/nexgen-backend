-- Adds a generic custom_fields JSON column to services so admins can attach
-- arbitrary label/value pairs to a service from the Admin Panel "Add New Service"
-- form, replacing the removed Global Base Price / Platform Commission Fee inputs
-- on that specific form (basePrice/commissionPercent columns are unchanged and
-- still editable via the separate Edit Service Pricing dialog).

ALTER TABLE services ADD COLUMN IF NOT EXISTS custom_fields JSON NULL;
