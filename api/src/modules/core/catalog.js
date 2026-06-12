const PARAM_CATEGORIES = {
  projectTypes: 'projectTypes',
  duties: 'duties',
  positions: 'positions',
  units: 'units',
  differenceMethods: 'differenceMethods',
  meetingStatus: 'meetingStatus',
  projectStatus: 'projectStatus',
  projectPermissions: 'projectPermissions',
  chargeOptions: 'chargeOptions',
  purchaseStatus: 'purchaseStatus',
  purchaseTypes: 'purchaseTypes',
  paymentMethods: 'paymentMethods',
  departments: 'departments',
  churchTypes: 'churchTypes',
  assetTypes: 'assetTypes',
  assetVendors: 'assetVendors',
  assetStatuses: 'assetStatuses'
};

const SYSTEM_FEATURES = [
  'project',
  'meeting',
  'finance',
  'admin_supply',
  'asset',
  'venue',
  'zoom',
  'sunday_message',
  'forms',
  'counter',
  'qrcode',
  'qt',
  'linebot',
  'pastoral',
  'education',
  'media',
  'worship',
  'attendance',
  'serving',
  'workflow',
  'dev_management',
  'system'
];

const FEATURE_ACCESS_RANK = { none: 0, read: 1, edit: 2 };

module.exports = {
  PARAM_CATEGORIES,
  SYSTEM_FEATURES,
  FEATURE_ACCESS_RANK
};
