#!/usr/bin/env node
/**
 * Verify generated MEs workbook structure.
 * Usage: npx tsx scripts/verify-mes-workbook.ts [path-to.xlsx]
 * Env: MES_REFERENCE_XLSX_PATH — optional reference workbook for sheet-order comparison
 */
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateMesWorkbookStructure,
  compareSheetOrderToReference,
  mesReferenceXlsxPath,
} from '../server/services/mesWorkbookContract.js';

async function main() {
  const target = process.argv[2] ?? path.join(process.cwd(), 'test-output/NFRS_Test_Output.xlsx');
  if (!fs.existsSync(target)) {
    console.error(`File not found: ${target}`);
    console.error('Generate a workbook first or pass a path argument.');
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(target);
  const result = validateMesWorkbookStructure(wb);

  console.log(`Validating: ${target}`);
  console.log(`Sheets (${result.sheetNames.length}):`, result.sheetNames.join(' → '));

  if (result.warnings.length) {
    console.warn('Warnings:');
    result.warnings.forEach((w) => console.warn(`  - ${w}`));
  }

  if (!result.ok) {
    console.error('Structure errors:');
    result.errors.forEach((e) => console.error(`  ✗ ${e}`));
    process.exit(1);
  }

  console.log('✓ MEs workbook structure OK');

  const refPath = mesReferenceXlsxPath();
  if (refPath && fs.existsSync(refPath)) {
    const refWb = new ExcelJS.Workbook();
    await refWb.xlsx.readFile(refPath);
    const orderErrors = compareSheetOrderToReference(
      result.sheetNames,
      refWb.worksheets.map((ws) => ws.name),
    );
    if (orderErrors.length) {
      console.error('Reference sheet-order differences:');
      orderErrors.forEach((e) => console.error(`  ✗ ${e}`));
      process.exit(1);
    }
    console.log(`✓ Sheet order matches reference: ${refPath}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
