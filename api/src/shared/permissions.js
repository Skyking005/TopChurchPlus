const { pool } = require('../db');
const { FEATURE_ACCESS_RANK, SYSTEM_FEATURES } = require('../modules/core/catalog');
const { assertDesktop, normalizeRoles } = require('./users');

function applyAdminReadableAccess(access, roles) {
  if (roles.includes('超級管理者')) {
    SYSTEM_FEATURES.forEach(featureKey => {
      if (!access[featureKey] || FEATURE_ACCESS_RANK[access[featureKey]] < FEATURE_ACCESS_RANK.read) {
        access[featureKey] = 'read';
      }
    });
    return access;
  }

  if (roles.includes('管理員')) {
    SYSTEM_FEATURES
      .filter(featureKey => featureKey !== 'system')
      .forEach(featureKey => {
        if (!access[featureKey] || FEATURE_ACCESS_RANK[access[featureKey]] < FEATURE_ACCESS_RANK.read) {
          access[featureKey] = 'read';
        }
      });
  }
  return access;
}

async function getEffectiveFeaturePermissions(user) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  if (!roles.length) return {};

  const { rows } = await pool.query(
    `SELECT feature_key, access_level
     FROM role_feature_permissions
     WHERE role = ANY($1::text[])`,
    [roles]
  );

  const access = {};
  rows.forEach(row => {
    const current = access[row.feature_key] || 'none';
    if ((FEATURE_ACCESS_RANK[row.access_level] || 0) > (FEATURE_ACCESS_RANK[current] || 0)) {
      access[row.feature_key] = row.access_level;
    }
  });
  return applyAdminReadableAccess(access, roles);
}

async function getFeatureAccess(user, featureKey) {
  if (!SYSTEM_FEATURES.includes(featureKey)) return 'none';
  if (user && user.featurePermissions && user.featurePermissions[featureKey]) {
    return user.featurePermissions[featureKey];
  }
  const access = await getEffectiveFeaturePermissions(user);
  return access[featureKey] || 'none';
}

async function assertFeatureReadable(user, featureKey) {
  if (!user || !user.name) throw new Error('缺少登入者資訊');
  const access = await getFeatureAccess(user, featureKey);
  if (access === 'read' || access === 'edit') return access;
  throw new Error('沒有此系統功能的使用權限');
}

async function assertFeatureEditable(user, featureKey) {
  assertDesktop(user);
  const access = await getFeatureAccess(user, featureKey);
  if (access === 'edit') return true;
  throw new Error('沒有此系統功能的操作權限');
}

module.exports = {
  assertFeatureEditable,
  assertFeatureReadable,
  getEffectiveFeaturePermissions,
  getFeatureAccess
};
