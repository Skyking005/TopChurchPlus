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

async function buildSpecDocx(spec) {
  const children = [
    centeredText(spec.title, { bold: true, size: 36 }),
    rightText(`匯出時間：${formatLocalDateTime(new Date())}`),
    spacer()
  ];

  (spec.sections || []).forEach(section => {
    children.push(sectionTitle(section.title));
    if (section.type === 'keyValue') children.push(keyValueTable(section.rows || []));
    if (section.type === 'rows') children.push(rowsTable(section.headers || [], section.rows || []));
    if (section.type === 'html') children.push(...htmlLikeContent(section.content));
  });

  if (spec.includeSignature !== false) {
    children.push(sectionTitle('簽核'));
    children.push(signatureTable(spec.signatureHeaders));
  }

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
      children
    }]
  });

  return Packer.toBuffer(doc);
}

function centeredText(text, options = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 180 },
    children: [new TextRun(Object.assign({ text: displayValue(text) }, options))]
  });
}

function rightText(text) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 180 },
    children: [new TextRun({ text: displayValue(text), size: 20 })]
  });
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text: displayValue(text), bold: true, size: 24 })]
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
        tableCell(left[1], { width: 32 }),
        tableCell(right[0], { bold: true, shading: true, width: 18 }),
        tableCell(right[1], { width: 32 })
      ]
    }));
  }
  if (!tableRows.length) {
    tableRows.push(new TableRow({ children: [tableCell(''), tableCell(''), tableCell(''), tableCell('')] }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows
  });
}

function rowsTable(headers, rows) {
  const bodyRows = rows.length ? rows : [headers.map(() => '')];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map(header => tableCell(header, { bold: true, shading: true })) }),
      ...bodyRows.map(row => new TableRow({
        children: headers.map((header, index) => tableCell(readRowValue(row, header, index)))
      }))
    ]
  });
}

function signatureTable(headers = ['主任牧師/決行', '複核', '財務', '部門主管/申請人']) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map(header => tableCell(header, { bold: true, shading: true })) }),
      new TableRow({
        height: { value: 900, rule: HeightRule.ATLEAST },
        children: headers.map(() => tableCell('', { verticalAlign: VerticalAlign.BOTTOM }))
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
        children: [new TextRun({ text: displayValue(value), bold: Boolean(options.bold), size: 20 })]
      })
    ]
  });
}

function htmlLikeContent(html) {
  const content = String(html || '').trim();
  if (!content) return [new Paragraph(' ')];

  const children = [];
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  let lastIndex = 0;
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    children.push(...htmlTextBlock(content.slice(lastIndex, match.index)));
    const table = htmlTable(match[0]);
    if (table) children.push(table);
    lastIndex = match.index + match[0].length;
  }
  children.push(...htmlTextBlock(content.slice(lastIndex)));
  return children.length ? children : [new Paragraph(' ')];
}

function htmlTextBlock(html) {
  return htmlToLines(html).map(line => new Paragraph(line || ' '));
}

function htmlTable(tableHtml) {
  const rows = [];
  const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  rowMatches.forEach(rowHtml => {
    const cells = [];
    const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
    cellMatches.forEach(cellHtml => cells.push(stripHtmlForDoc(cellHtml)));
    if (cells.length) rows.push(cells);
  });
  if (!rows.length) return null;
  const maxCells = Math.max(...rows.map(row => row.length));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(row => new TableRow({
      children: Array.from({ length: maxCells }, (_, index) => tableCell(row[index] || ''))
    }))
  });
}

function htmlToLines(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .split(/\n+/)
    .map(line => stripHtmlForDoc(line))
    .filter(line => line !== '');
}

function stripHtmlForDoc(value) {
  return decodeDocEntities(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeDocEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function defaultBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' }
  };
}

function readRowValue(row, header, index) {
  if (Array.isArray(row)) return row[index];
  if (row && typeof row === 'object') return row[header];
  return '';
}

function displayValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function formatLocalDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

module.exports = { buildSpecDocx };
