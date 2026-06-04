function exportPostgresSeedJsonToDrive() {
  const payload = {
    exportedAt: new Date().toISOString(),
    sheets: {
      projects: getSheetObjects(SHEETS.PROJECTS),
      people: getSheetObjects(SHEETS.PEOPLE),
      budget: getSheetObjects(SHEETS.BUDGET),
      income: getSheetObjects(SHEETS.INCOME),
      meetings: getSheetObjects(SHEETS.MEETINGS),
      projectPermissions: getSheetObjects(SHEETS.PROJECT_PERMISSIONS),
      params: getSheetObjects(SHEETS.PARAMS),
      accounts: getSheetObjects(SHEETS.ACCOUNTS)
    }
  };

  const blob = Utilities.newBlob(
    JSON.stringify(payload, null, 2),
    'application/json',
    `project-management-export-${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')}.json`
  );

  const file = DriveApp.createFile(blob);
  return file.getUrl();
}
