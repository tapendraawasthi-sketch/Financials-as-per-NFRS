import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import ExcelJS from 'exceljs';
import trialBalanceRouter from '../../server/routes/trialBalance.js';
import { sessionStore } from '../../server/store/sessionStore.js';
import { generateTrialBalanceTemplate } from '../../server/services/tbTemplateWriter.js';
import { HEADER_ROW_INDEX } from '../../server/services/tbStandardSchema.js';
import { errorMiddleware } from '../../server/middleware/errorHandler.js';

const COMPANY_ID = 'test-upload-company';

function buildMultipartBody(filename: string, buffer: Buffer, boundary: string): Buffer {
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="trialbalance"; filename="${filename}"\r\n` +
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([prefix, buffer, suffix]);
}

describe('tbStandardUpload integration', () => {
  let server: Server;
  let baseUrl = '';

  before(async () => {
    sessionStore.set(COMPANY_ID, {
      company: { id: COMPANY_ID, companyName: 'Test Co Ltd' },
    });

    const app = express();
    app.use(express.json());
    app.use('/api/trial-balance', trialBalanceRouter);
    app.use(errorMiddleware);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('accepts a valid standard template upload', async () => {
    const templateBuffer = await generateTrialBalanceTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);
    const ws = workbook.getWorksheet('Trial Balance')!;
    let filled = 0;
    for (let rowNum = HEADER_ROW_INDEX + 2; rowNum <= ws.rowCount && filled < 2; rowNum++) {
      const label = String(ws.getRow(rowNum).getCell(1).value ?? '');
      if (!label || label.toUpperCase() === label) continue;
      if (filled === 0) {
        ws.getRow(rowNum).getCell(9).value = 100000;
        ws.getRow(rowNum).getCell(10).value = 0;
      } else {
        ws.getRow(rowNum).getCell(10).value = 100000;
        ws.getRow(rowNum).getCell(9).value = 0;
      }
      filled++;
    }
    const filledBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const boundary = '----testboundary001';
    const body = buildMultipartBody('standard.xlsx', filledBuffer, boundary);

    const response = await fetch(`${baseUrl}/api/trial-balance/${COMPANY_ID}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    assert.equal(response.status, 200);
    const json = await response.json() as { success: boolean; data?: { rows?: unknown[] } };
    assert.equal(json.success, true);
    assert.ok(json.data?.rows?.length);
  });

  it('passes standardFormatWarnings through manual parse-preview and confirm-normalized', async () => {
    const templateBuffer = await generateTrialBalanceTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);
    const ws = workbook.getWorksheet('Trial Balance')!;
    let filled = 0;
    for (let rowNum = HEADER_ROW_INDEX + 2; rowNum <= ws.rowCount && filled < 2; rowNum++) {
      const label = String(ws.getRow(rowNum).getCell(1).value ?? '');
      if (!label || label.toUpperCase() === label) continue;
      if (filled === 0) {
        ws.getRow(rowNum).getCell(9).value = 100000;
        ws.getRow(rowNum).getCell(10).value = 0;
      } else {
        ws.getRow(rowNum).getCell(10).value = 100000;
        ws.getRow(rowNum).getCell(9).value = 0;
      }
      filled++;
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const boundary = '----testboundary003';
    const body = buildMultipartBody('warnings.xlsx', buffer, boundary);

    const previewRes = await fetch(
      `${baseUrl}/api/trial-balance/${COMPANY_ID}/parse-preview?mode=manual`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
      },
    );
    assert.equal(previewRes.status, 200);
    const previewJson = await previewRes.json() as {
      success: boolean;
      data?: { rows?: unknown[]; standardFormatWarnings?: unknown[] };
    };
    assert.equal(previewJson.success, true);
    assert.ok(previewJson.data?.standardFormatWarnings?.length);

    const confirmRes = await fetch(`${baseUrl}/api/trial-balance/${COMPANY_ID}/confirm-normalized`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: previewJson.data?.rows }),
    });
    assert.equal(confirmRes.status, 200);
    const confirmJson = await confirmRes.json() as {
      success: boolean;
      data?: { standardFormatWarnings?: unknown[] };
    };
    assert.equal(confirmJson.success, true);
    assert.ok(confirmJson.data?.standardFormatWarnings?.length);
  });

  it('rejects a malformed template with NOT_STANDARD_FORMAT', async () => {
    const templateBuffer = await generateTrialBalanceTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);
    const ws = workbook.getWorksheet('Trial Balance')!;
    ws.getRow(HEADER_ROW_INDEX).getCell(4).value = 'Debit';
    const malformedBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const boundary = '----testboundary002';
    const body = buildMultipartBody('bad.xlsx', malformedBuffer, boundary);

    const response = await fetch(`${baseUrl}/api/trial-balance/${COMPANY_ID}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    assert.equal(response.status, 422);
    const json = await response.json() as {
      success: boolean;
      code?: string;
      diagnostics?: { issues: unknown[] };
    };
    assert.equal(json.success, false);
    assert.equal(json.code, 'NOT_STANDARD_FORMAT');
    assert.ok(json.diagnostics?.issues?.length);
  });
});
