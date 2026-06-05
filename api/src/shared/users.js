function normalizeRoles(roles, fallbackRole) {
  const values = Array.isArray(roles) ? roles : [];
  const normalized = values
    .concat(fallbackRole || [])
    .map(role => String(role || '').trim())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function hasRole(user, role) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  return roles.includes(role);
}

function hasAnyRole(user, rolesToCheck) {
  const roles = normalizeRoles(user && user.roles, user && user.role);
  return rolesToCheck.some(role => roles.includes(role));
}

function assertDesktop(currentUser) {
  if (!currentUser || currentUser.deviceType === 'mobile') {
    throw new Error('此操作僅支援電腦完整模式');
  }
}

function assertSuperAdmin(currentUser) {
  assertDesktop(currentUser);
  if (!currentUser.isSuperAdmin && !hasRole(currentUser, '超級管理者')) {
    throw new Error('只有超級管理者可以操作系統層級設定');
  }
}

function parseUser(req) {
  const raw = req.get('x-current-user');
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch (err) {
    return {};
  }
}

function parseQueryUser(req) {
  const raw = req.query.currentUser;
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
  } catch (err) {
    return {};
  }
}

module.exports = {
  assertDesktop,
  assertSuperAdmin,
  hasAnyRole,
  hasRole,
  normalizeRoles,
  parseQueryUser,
  parseUser
};
