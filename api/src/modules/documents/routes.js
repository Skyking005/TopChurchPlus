const fs = require('fs/promises');
const path = require('path');

const { Document, Packer, Paragraph, TextRun } = require('docx');

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function registerDocumentRoutes(app) {
  app.get('/documents/test-docx', async (req, res, next) => {
    try {
      const file = await createTestDocx();
      res.setHeader('Content-Type', DOCX_MIME_TYPE);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
      res.setHeader('X-Document-Path', file.filePath);
      res.send(file.buffer);
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

module.exports = { registerDocumentRoutes };
