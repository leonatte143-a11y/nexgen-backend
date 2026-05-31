-- Inspect indexes on users (and related tables)
-- Run in MySQL client / Railway console

SHOW INDEX FROM users;

-- Count distinct index names on users
SELECT Key_name, Non_unique, GROUP_CONCAT(Column_name ORDER BY Seq_in_index) AS columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
GROUP BY Key_name, Non_unique
ORDER BY Key_name;

-- Find duplicate UNIQUE indexes on phone (more than one unique index touching phone)
SELECT Key_name, Column_name, Non_unique, Index_type
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND Column_name = 'phone'
  AND Non_unique = 0;

-- Same for partners
SHOW INDEX FROM partners;

SELECT Key_name, Column_name, Non_unique
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'partners'
  AND Column_name = 'phone'
  AND Non_unique = 0;

-- Example: drop a duplicate (replace phone_7 with actual duplicate name; keep ONE unique on phone)
-- ALTER TABLE users DROP INDEX phone_7;
