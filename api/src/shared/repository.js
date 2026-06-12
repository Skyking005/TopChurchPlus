const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/i;

class Repository {
  constructor(tableName, options = {}) {
    this.tableName = assertIdentifier(tableName, 'tableName');
    this.primaryKey = assertIdentifier(options.primaryKey || 'id', 'primaryKey');
    this.allowedColumns = new Set((options.allowedColumns || []).map(column => assertIdentifier(column, 'column')));
  }

  async findById(id, client) {
    const result = await this.query(client, `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1 LIMIT 1`, [id]);
    return result.rows[0] || null;
  }

  async findOne(where = {}, client) {
    const { clause, values } = this.buildWhere(where);
    const result = await this.query(client, `SELECT * FROM ${this.tableName}${clause} LIMIT 1`, values);
    return result.rows[0] || null;
  }

  async findMany(options = {}, client) {
    const { clause, values } = this.buildWhere(options.where || {});
    const orderBy = options.orderBy ? ` ORDER BY ${assertOrderBy(options.orderBy)}` : '';
    const limit = normalizePositiveInt(options.limit, 100);
    const offset = normalizePositiveInt(options.offset, 0);
    const result = await this.query(
      client,
      `SELECT * FROM ${this.tableName}${clause}${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      values.concat([limit, offset])
    );
    return result.rows;
  }

  async insert(data, client) {
    const entries = this.normalizeData(data);
    if (!entries.length) throw new Error('No insert data provided.');
    const columns = entries.map(([column]) => column);
    const values = entries.map(([, value]) => value);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    const result = await this.query(
      client,
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async update(id, data, client) {
    const entries = this.normalizeData(data);
    if (!entries.length) throw new Error('No update data provided.');
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([column], index) => `${column} = $${index + 1}`);
    const result = await this.query(
      client,
      `UPDATE ${this.tableName} SET ${assignments.join(', ')} WHERE ${this.primaryKey} = $${values.length + 1} RETURNING *`,
      values.concat([id])
    );
    return result.rows[0] || null;
  }

  async softDelete(id, client) {
    const result = await this.query(
      client,
      `UPDATE ${this.tableName} SET is_active = false, updated_at = now() WHERE ${this.primaryKey} = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  buildWhere(where) {
    const entries = Object.entries(where || {}).filter(([, value]) => value !== undefined);
    if (!entries.length) return { clause: '', values: [] };
    const values = [];
    const parts = entries.map(([column, value]) => {
      const safeColumn = this.assertColumn(column);
      values.push(value);
      return `${safeColumn} = $${values.length}`;
    });
    return { clause: ` WHERE ${parts.join(' AND ')}`, values };
  }

  normalizeData(data) {
    return Object.entries(data || {})
      .filter(([, value]) => value !== undefined)
      .map(([column, value]) => [this.assertColumn(column), value]);
  }

  assertColumn(column) {
    const safeColumn = assertIdentifier(column, 'column');
    if (this.allowedColumns.size && !this.allowedColumns.has(safeColumn)) {
      throw new Error(`Column is not allowed for ${this.tableName}: ${safeColumn}`);
    }
    return safeColumn;
  }

  query(client, sql, values) {
    if (!client || typeof client.query !== 'function') {
      throw new Error('Repository query requires a pg client or pool.');
    }
    return client.query(sql, values);
  }
}

function assertIdentifier(value, label) {
  const text = String(value || '').trim();
  if (!IDENTIFIER_PATTERN.test(text)) throw new Error(`Invalid SQL identifier: ${label}`);
  return text;
}

function assertOrderBy(value) {
  return String(value || '')
    .split(',')
    .map(part => {
      const [column, direction] = part.trim().split(/\s+/);
      const safeColumn = assertIdentifier(column, 'orderBy');
      const safeDirection = String(direction || 'ASC').toUpperCase();
      if (!['ASC', 'DESC'].includes(safeDirection)) throw new Error('Invalid order direction.');
      return `${safeColumn} ${safeDirection}`;
    })
    .join(', ');
}

function normalizePositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

module.exports = { Repository };
