const { pool, tx } = require('../db');
const { recordAuditLog } = require('./audit');

async function findIdentityProvider(providerType, providerUserId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, pastoral_member_id, provider_type, provider_user_id, display_name,
       picture_url, email, status, linked_at, last_login_at, created_at, updated_at
     FROM identity_providers
     WHERE provider_type = $1
       AND provider_user_id = $2
       AND status = 'ACTIVE'
     LIMIT 1`,
    [normalizeProviderType(providerType), normalizeText(providerUserId)]
  );
  return rows[0] || null;
}

async function linkIdentityProvider(payload, currentUser = {}) {
  const identity = normalizeIdentityPayload(payload);
  return tx(async client => {
    const member = await client.query(
      'SELECT id, name FROM pastoral_members WHERE id = $1 AND is_active LIMIT 1',
      [identity.pastoral_member_id]
    );
    if (!member.rowCount) throw new Error('找不到可綁定的會友資料');

    const before = await findIdentityProvider(identity.provider_type, identity.provider_user_id, client);
    if (before && Number(before.pastoral_member_id) !== Number(identity.pastoral_member_id)) {
      throw new Error('此外部身份已綁定其他會友');
    }

    const result = await client.query(
      `INSERT INTO identity_providers (
         pastoral_member_id, provider_type, provider_user_id, display_name, picture_url,
         email, status, linked_at, last_login_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',now(),now(),now())
       ON CONFLICT (provider_type, provider_user_id) DO UPDATE SET
         pastoral_member_id = EXCLUDED.pastoral_member_id,
         display_name = EXCLUDED.display_name,
         picture_url = EXCLUDED.picture_url,
         email = EXCLUDED.email,
         status = 'ACTIVE',
         last_login_at = now(),
         updated_at = now()
       RETURNING *`,
      [
        identity.pastoral_member_id,
        identity.provider_type,
        identity.provider_user_id,
        identity.display_name,
        identity.picture_url,
        identity.email
      ]
    );

    await recordAuditLog({
      systemKey: 'identity_provider',
      entityType: 'identity_providers',
      entityId: result.rows[0].id,
      action: before ? 'UPDATE' : 'BIND',
      currentUser,
      memberId: identity.pastoral_member_id,
      beforeData: before || null,
      afterData: result.rows[0]
    }, client);

    return result.rows[0];
  });
}

function normalizeIdentityPayload(payload) {
  const pastoralMemberId = Number(payload.pastoralMemberId || payload.pastoral_member_id);
  if (!Number.isInteger(pastoralMemberId)) throw new Error('pastoralMemberId is required.');
  const providerType = normalizeProviderType(payload.providerType || payload.provider_type);
  const providerUserId = normalizeText(payload.providerUserId || payload.provider_user_id);
  if (!providerType) throw new Error('providerType is required.');
  if (!providerUserId) throw new Error('providerUserId is required.');
  return {
    pastoral_member_id: pastoralMemberId,
    provider_type: providerType,
    provider_user_id: providerUserId,
    display_name: normalizeText(payload.displayName || payload.display_name),
    picture_url: normalizeText(payload.pictureUrl || payload.picture_url),
    email: normalizeText(payload.email)
  };
}

function normalizeProviderType(value) {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9_]/g, '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

module.exports = {
  findIdentityProvider,
  linkIdentityProvider
};
