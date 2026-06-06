const fs = require('fs/promises');
const path = require('path');

const {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} = require('docx');

const { pool } = require('../../db');
const { assertFeatureReadable } = require('../../shared/permissions');
const { formatDate } = require('../../shared/format');
const { parseUser } = require('../../shared/users');

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function registerDocumentRoutes(app) {
  app.get('/documents/test-docx', async (req, res, next) => {
    try {
      const file = await createTestDocx();
      res.setHeader('Content-Type', DOCX_MIME_TYPE);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
      res.setHeader('X-Document-Path', encodeURIComponent(file.filePath));
      res.send(file.buffer);
    } catch (err) {
      next(err);
    }
  });

  app.get('/documents/finance/payment-requests/:paymentId.docx', async (req, res, next) => {
    try {
      await assertFeatureReadable(parseUser(req), 'finance');
      const file = await createPaymentRequestDocx(req.params.paymentId);
      sendDocx(res, file);
    } catch (err) {
      next(err);
    }
  });
}

async function createTestDocx() {
  const now = new Date();
  const stamp = formatStamp(now);
  const fileName = `topchurchplus-test-${stamp}.docx`;
  const outputDir = getDocumentOutputDir();
  const filePath = path.join(outputDir, fileName);

  await fs.mkdir(outputDir, { recursive: true });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: '卓越行道會測試文件',
              bold: true,
              size: 32
            })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun(`產生時間：${now.toISOString()}`)
          ]
        }),
        new Paragraph({
          children: [
            new TextRun('此檔案由 TopChurchPlus NAS API 使用 docx 套件產生。')
          ]
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(filePath, buffer);
  return { fileName, filePath, buffer };
}

async function createPaymentRequestDocx(paymentId) {
  const detail = await getPaymentRequestDetail(paymentId);
  const now = new Date();
  const stamp = formatStamp(now);
  const safePaymentId = sanitizeFileName(paymentId);
  const fileName = `${safePaymentId}_請款申請單_${stamp}.docx`;
  const outputDir = path.join(getDocumentOutputDir(), 'finance', 'payment-requests');
  const filePath = path.join(outputDir, fileName);

  await fs.mkdir(outputDir, { recursive: true });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,
            right: 720,
            bottom: 720,
            left: 720
          }
        }
      },
      children: [
        centeredText('請款申請單', { bold: true, size: 36 }),
        rightText(`匯出時間：${formatLocalDateTime(now)}`),
        spacer(),
        sectionTitle('一、請款基本資料'),
        keyValueTable([
          ['請款編號', detail.paymentId],
          ['請購編號', detail.purchaseId || '獨立請款'],
          ['採購摘要', detail.purchaseSummary],
          ['請款會堂', detail.hall],
          ['請款人', detail.claimant],
          ['申請日期', formatDate(detail.requestDate)],
          ['請款總金額', formatCurrency(detail.totalAmount)]
        ]),
        sectionTitle('二、請款詳細內容'),
        rowsTable(
          ['項目', '數量', '單價', '總價', '備註'],
          detail.items.map(item => [
            item.item,
            formatNumber(item.quantity),
            formatCurrency(item.unitPrice),
            formatCurrency(item.subtotal),
            item.note
          ])
        ),
        sectionTitle('三、支付方式'),
        keyValueTable([
          ['是否有預借', detail.hasAdvance ? '是' : '否'],
          ['支付方式', detail.paymentMethod],
          ['預借編號', detail.advanceId],
          ['前已預借金額', formatCurrency(detail.advanceAmount)],
          ['轉正', formatCurrency(detail.offsetAmount)],
          ['代支', formatCurrency(detail.behalfAmount)],
          ['繳回', formatCurrency(detail.returnAmount)],
          ['匯款銀行', detail.bank],
          ['分行', detail.branch],
          ['帳戶名稱', detail.accountName],
          ['帳號', detail.accountNo]
        ]),
        sectionTitle('四、簽核'),
        signatureTable()
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(filePath, buffer);
  return { fileName, filePath, buffer };
}

async function getPaymentRequestDetail(paymentId) {
  const { rows } = await pool.query(
    `SELECT pr.*, p.summary AS purchase_summary
     FROM purchase_payment_requests pr
     LEFT JOIN purchases p ON p.purchase_id = pr.purchase_id
     WHERE pr.payment_id = $1`,
    [paymentId]
  );
  if (!rows[0]) throw new Error('找不到請款資料');

  const itemsResult = await pool.query(
    `SELECT item, quantity, unit_price, subtotal, note
     FROM purchase_payment_items
     WHERE payment_id = $1
     ORDER BY sort_order, id`,
    [paymentId]
  );
  const row = rows[0];
  return {
    paymentId: row.payment_id,
    purchaseId: row.purchase_id,
    purchaseSummary: row.purchase_summary,
    hall: row.hall,
    claimant: row.claimant,
    requestDate: row.request_date,
    totalAmount: row.total_amount,
    hasAdvance: row.has_advance,
    paymentMethod: row.payment_method,
    advanceId: row.advance_id,
    advanceAmount: row.advance_amount,
    offsetAmount: row.offset_amount,
    behalfAmount: row.behalf_amount,
    returnAmount: row.return_amount,
    bank: row.bank,
    branch: row.branch,
    accountName: row.account_name,
    accountNo: row.account_no,
    items: itemsResult.rows.map(item => ({
      item: item.item,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
      note: item.note
    }))
  };
}

function sendDocx(res, file) {
  res.setHeader('Content-Type', DOCX_MIME_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  res.setHeader('X-Document-Path', encodeURIComponent(file.filePath));
  res.send(file.buffer);
}

function getDocumentOutputDir() {
  return process.env.DOCUMENT_OUTPUT_DIR || '/app/files/documents';
}

function formatStamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${sec}`;
}

function centeredText(text, options = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 180 },
    children: [new TextRun(Object.assign({ text: String(text || '') }, options))]
  });
}

function rightText(text) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 180 },
    children: [new TextRun({ text: String(text || ''), size: 20 })]
  });
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text: String(text || ''), bold: true, size: 24 })]
  });
}

function spacer() {
  return new Paragraph({ text: '', spacing: { after: 80 } });
}

function keyValueTable(rows) {
  const tableRows = [];
  for (let i = 0; i < rows.length; i += 2) {
    const left = rows[i] || ['', ''];
    const right = rows[i + 1] || ['', ''];
    tableRows.push(new TableRow({
      children: [
        tableCell(left[0], { bold: true, shading: true, width: 18 }),
        tableCell(displayValue(left[1]), { width: 32 }),
        tableCell(right[0], { bold: true, shading: true, width: 18 }),
        tableCell(displayValue(right[1]), { width: 32 })
      ]
    }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows
  });
}

function rowsTable(headers, rows) {
  const bodyRows = rows.length ? rows : [['', '', '', '', '']];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map(header => tableCell(header, { bold: true, shading: true })) }),
      ...bodyRows.map(row => new TableRow({ children: row.map(value => tableCell(displayValue(value))) }))
    ]
  });
}

function signatureTable() {
  const headers = ['主任牧師/決行', '複核', '財務', '部門主管/申請人'];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map(header => tableCell(header, { bold: true, shading: true })) }),
      new TableRow({
        height: { value: 900, rule: HeightRule.ATLEAST },
        children: headers.map(() => tableCell('', {
          verticalAlign: VerticalAlign.BOTTOM
        }))
      })
    ]
  });
}

function tableCell(value, options = {}) {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.shading ? { fill: 'F3F4F6' } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: defaultBorders(),
    verticalAlign: options.verticalAlign,
    children: [
      new Paragraph({
        spacing: { after: 0 },
        children: [new TextRun({ text: String(value || ''), bold: Boolean(options.bold), size: 20 })]
      })
    ]
  });
}

function defaultBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' }
  };
}

function displayValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : String(number);
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return number.toLocaleString('zh-TW');
}

function formatLocalDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

function sanitizeFileName(value) {
  return String(value || 'document').replace(/[\\/:*?"<>|]/g, '_');
}

module.exports = { registerDocumentRoutes };
