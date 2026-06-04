require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool, tx } = require('../src/db');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npm run import:json -- ./export.json');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
const sheets = raw.sheets || raw;

const PARAM_COLUMNS = [
  ['projectTypes', '專案類型'],
  ['duties', '職責'],
  ['units', '會堂'],
  ['differenceMethods', '收支差額處理方式'],
  ['meetingStatus', '會議狀態'],
  ['projectStatus', '專案狀態'],
  ['projectPermissions', '專案權限']
];

function val(row, key) {
  return row[key] ?? '';
}

function splitCsv(value) {
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function num(value) {
  return Number(value || 0);
}

async function main() {
  await tx(async client => {
    await client.query('TRUNCATE meetings, project_permissions, project_budget, project_income, project_people, projects, params, accounts RESTART IDENTITY CASCADE');

    for (const row of sheets.accounts || []) {
      await client.query(
        `INSERT INTO accounts (staff_id, email, name, position, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (staff_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, position = EXCLUDED.position, role = EXCLUDED.role`,
        [val(row, '人員序號'), String(val(row, '電子信箱')).toLowerCase(), val(row, '姓名'), val(row, '職位'), val(row, '權限')]
      );
    }

    const paramsRows = sheets.params || [];
    for (let rowIndex = 0; rowIndex < paramsRows.length; rowIndex += 1) {
      const row = paramsRows[rowIndex];
      for (const [category, header] of PARAM_COLUMNS) {
        const value = String(val(row, header)).trim();
        if (!value) continue;
        await client.query(
          `INSERT INTO params (category, value, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (category, value) DO NOTHING`,
          [category, value, rowIndex + 1]
        );
      }
    }
    await client.query(`INSERT INTO params (category, value, sort_order) VALUES ('chargeOptions', '是', 1), ('chargeOptions', '否', 2) ON CONFLICT DO NOTHING`);

    for (const row of sheets.projects || []) {
      await client.query(
        `INSERT INTO projects (
          project_id, login_user, project_name, project_type, start_date, end_date, units, content,
          is_charged, total_income, total_budget, difference_method, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          val(row, '計畫編號'),
          val(row, '專案登入人'),
          val(row, '專案名稱'),
          val(row, '專案類型'),
          val(row, '專案執行開始時間') || null,
          val(row, '專案執行結束時間') || null,
          splitCsv(val(row, '專案執行單位')),
          val(row, '專案內容'),
          val(row, '專案是否收費') || '否',
          num(val(row, '專案總收入')),
          num(val(row, '專案總支出')),
          val(row, '收支差額處理方式'),
          val(row, '專案狀態') || '規劃中'
        ]
      );
    }

    for (const [index, row] of (sheets.people || []).entries()) {
      await client.query(
        `INSERT INTO project_people (project_id, duty, person, item, note, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [val(row, '專案編號'), val(row, '職責'), val(row, '主責人'), val(row, '主責項目'), val(row, '備註'), index + 1]
      );
    }

    for (const [index, row] of (sheets.income || []).entries()) {
      await client.query(
        `INSERT INTO project_income (project_id, unit, item, quantity, unit_price, subtotal, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [val(row, '專案編號'), val(row, '會堂'), val(row, '收入項目'), num(val(row, '數量')), num(val(row, '單價')), num(val(row, '小計')), index + 1]
      );
    }

    for (const [index, row] of (sheets.budget || []).entries()) {
      await client.query(
        `INSERT INTO project_budget (project_id, unit, item, quantity, unit_price, subtotal, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [val(row, '專案編號'), val(row, '會堂'), val(row, '支出項目'), num(val(row, '數量')), num(val(row, '單價')), num(val(row, '小計')), index + 1]
      );
    }

    for (const row of sheets.projectPermissions || []) {
      await client.query(
        `INSERT INTO project_permissions (project_id, staff_id, name, permission)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (project_id, staff_id) DO NOTHING`,
        [val(row, '計畫編號'), val(row, '人員序號'), val(row, '姓名'), val(row, '權限')]
      );
    }

    for (const row of sheets.meetings || []) {
      await client.query(
        `INSERT INTO meetings (meeting_id, project_id, meeting_time, topic, agenda, decision, attendees, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (meeting_id) DO NOTHING`,
        [
          val(row, '會議編號'),
          val(row, '計畫編號'),
          val(row, '會議時間') || null,
          val(row, '會議主題'),
          val(row, '討論議題'),
          val(row, '會議決議'),
          splitCsv(val(row, '與會者')),
          val(row, '會議狀態') || '預約中'
        ]
      );
    }
  });

  console.log('Import completed.');
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
