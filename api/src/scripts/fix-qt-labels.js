const { pool } = require('../db');

const productTypes = [
  ['adult_student', '成人/學生 QT'],
  ['eaglet', '小飛鷹 QT']
];

const pricePlans = [
  [1, '成人-單本購買'],
  [2, '成人-半年訂購'],
  [3, '成人-一年訂購'],
  [4, '學生-單本購買(大專)'],
  [5, '學生-半年訂購(大專)'],
  [6, '學生-一年訂購(大專)'],
  [7, '小飛鷹-單本購買'],
  [8, '小飛鷹-半年訂購'],
  [9, '小飛鷹-一年訂購'],
  [10, '學生-單本購買(國高)'],
  [11, '學生-半年購買(國高)'],
  [12, '學生-一年購買(國高)']
];

async function main() {
  for (const [productType, productName] of productTypes) {
    await pool.query(
      'UPDATE qt_product_types SET product_name = $2, updated_at = now() WHERE product_type = $1',
      [productType, productName]
    );
  }

  for (const [planId, planName] of pricePlans) {
    await pool.query(
      'UPDATE qt_price_plans SET plan_name = $2, updated_at = now() WHERE plan_id = $1',
      [planId, planName]
    );
  }

  await pool.query(
    `UPDATE qt_inventory_movements
     SET note = $1
     WHERE source_system = 'legacy_quiet_time'
       AND note LIKE '%?%'`,
    ['舊系統庫存匯入']
  );

  console.log('QT labels fixed');
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
