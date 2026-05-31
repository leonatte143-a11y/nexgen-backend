/**
 * MySQL index maintenance for Sequelize sync({ alter: true }) drift.
 *
 * Root cause: inline `unique: true` on columns makes Sequelize emit
 * ALTER ... ADD UNIQUE on every alter pass with auto names (phone, phone_2, ...).
 * MySQL allows max 64 indexes per table — duplicates eventually fail migrations.
 */

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string} tableName
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function listTableIndexes(sequelize, tableName) {
  const [rows] = await sequelize.query(`SHOW INDEX FROM \`${tableName}\``);
  return rows;
}

/**
 * Drop duplicate UNIQUE indexes on one column; keep a single canonical index.
 * @param {import('sequelize').Sequelize} sequelize
 * @param {object} options
 * @param {string} options.tableName
 * @param {string} options.columnName
 * @param {string} options.canonicalIndexName - preferred index name to keep/create
 * @param {boolean} [options.dryRun]
 * @returns {Promise<{ kept: string | null, dropped: string[], created: boolean }>}
 */
export async function dedupeUniqueIndexOnColumn(
  sequelize,
  { tableName, columnName, canonicalIndexName, dryRun = false },
) {
  let rows;
  try {
    rows = await listTableIndexes(sequelize, tableName);
  } catch (e) {
    if (e?.original?.code === 'ER_NO_SUCH_TABLE') {
      return { kept: null, dropped: [], created: false };
    }
    throw e;
  }

  const uniqueIndexes = new Map();
  const columnVariants = new Set([
    columnName,
    columnName.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
    columnName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
  ]);
  for (const row of rows) {
    if (Number(row.Non_unique) !== 0) continue;
    if (row.Key_name === 'PRIMARY') continue;
    if (!columnVariants.has(row.Column_name)) continue;
    if (!uniqueIndexes.has(row.Key_name)) uniqueIndexes.set(row.Key_name, row);
  }

  const names = [...uniqueIndexes.keys()];
  let kept = names.includes(canonicalIndexName) ? canonicalIndexName : names[0] ?? null;
  const dropped = [];

  for (const name of names) {
    if (name === kept) continue;
    dropped.push(name);
    if (!dryRun) {
      await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${name}\``);
    }
  }

  let created = false;
  const physicalColumn =
    rows.find((r) => columnVariants.has(r.Column_name))?.Column_name ?? columnName;

  if (names.length === 0 && !dryRun) {
    await sequelize.query(
      `ALTER TABLE \`${tableName}\` ADD UNIQUE INDEX \`${canonicalIndexName}\` (\`${physicalColumn}\`)`,
    );
    kept = canonicalIndexName;
    created = true;
  }

  return { kept, dropped, created };
}

/** Tables/columns that historically accumulated duplicate Sequelize unique indexes. */
export const INDEX_DEDUPE_TARGETS = [
  { tableName: 'users', columnName: 'phone', canonicalIndexName: 'users_phone_unique' },
  { tableName: 'partners', columnName: 'phone', canonicalIndexName: 'partners_phone_unique' },
  { tableName: 'admin_users', columnName: 'email', canonicalIndexName: 'admin_users_email_unique' },
  { tableName: 'app_settings', columnName: 'setting_key', canonicalIndexName: 'app_settings_setting_key_unique' },
  { tableName: 'coupons', columnName: 'code', canonicalIndexName: 'coupons_code_unique' },
  { tableName: 'reviews', columnName: 'booking_id', canonicalIndexName: 'reviews_booking_id_unique' },
];

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function runIndexDedupePass(sequelize, opts = {}) {
  const results = [];
  for (const target of INDEX_DEDUPE_TARGETS) {
    const result = await dedupeUniqueIndexOnColumn(sequelize, { ...target, dryRun: opts.dryRun });
    results.push({ ...target, ...result });
  }
  return results;
}
