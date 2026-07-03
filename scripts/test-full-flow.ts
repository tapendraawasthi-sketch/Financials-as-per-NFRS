#!/usr/bin/env tsx
// scripts/test-full-flow.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Path resolution for ESM ───────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Colour helpers ────────────────────────────────────────────────────────
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan   = (s: string) => `\x1b[36m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

const pass = (msg: string) => console.log(`   ${green('✅')} ${msg}`);
const fail = (msg: string) => console.log(`   ${red('❌')} ${msg}`);
const info = (msg: string) => console.log(`   ${cyan('ℹ')}  ${msg}`);

// ── Error collector ───────────────────────────────────────────────────────
const errors: string[] = [];
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    errors.push(message);
    fail(message);
    throw new Error(message);
  }
}

// ── Imports (dynamic to catch missing modules cleanly) ────────────────────
async function loadModules() {
  const [
    { SAMPLE_COMPANY, SAMPLE_TRIAL_BALANCE_CSV },
    { parseTrialBalance },
    { matchAllAccounts },
    { calculateDepreciationSummary },
    { computeAllFinancials },
    { generateNFRSWorkbook },
    { buildNotesData },
  ] = await Promise.all([
    import('../src/data/sampleData.js'),
    import('../server/services/tbParser.js'),
    import('../server/services/accountMatcher.js'),
    import('../server/services/depreciationEngine.js'),
    import('../server/services/financialEngine.js'),
    import('../server/services/excelWriter.js'),
    import('../server/services/notesEngine.js'),
  ]);
  return {
    SAMPLE_COMPANY, SAMPLE_TRIAL_BALANCE_CSV,
    parseTrialBalance, matchAllAccounts,
    calculateDepreciationSummary, computeAllFinancials,
    generateNFRSWorkbook, buildNotesData,
  };
}

// ── Sample assets ─────────────────────────────────────────────────────────
const SAMPLE_ASSETS = [
  {
    id:                      '1',
    assetName:               'Office Building',
    categoryId:              'buildings',
    purchaseDateBS:          '15 Baisakh 2075',
    originalCost:            2_500_000,
    additionalCost:          0,
    usefulLifeYears:         25,
    residualValue:           0,
    depreciationMethod:      'StraightLine' as const,
    wdvRate:                 0,
    accumDepreciationOpening: 450_000,
    isFullyDepreciated:      false,
    isMortgaged:             false,
    disposed:                false,
  },
  {
    id:                      '2',
    assetName:               'Toyota Hiace Van',
    categoryId:              'vehicles',
    purchaseDateBS:          '15 Poush 2079',
    originalCost:            1_200_000,
    additionalCost:          0,
    usefulLifeYears:         24,
    residualValue:           0,
    depreciationMethod:      'StraightLine' as const,
    wdvRate:                 25,
    accumDepreciationOpening: 200_000,
    isFullyDepreciated:      false,
    isMortgaged:             false,
    disposed:                false,
  },
];

// ── Sample asset categories config ────────────────────────────────────────
const SAMPLE_ASSET_CATEGORIES = [
  { id: 'buildings', name: 'Buildings', defaultMethod: 'StraightLine', defaultUsefulLife: 40, defaultWDVRate: 5,  defaultResidualPct: 0  },
  { id: 'vehicles',  name: 'Vehicles',  defaultMethod: 'WrittenDownValue', defaultUsefulLife: 5, defaultWDVRate: 25, defaultResidualPct: 10 },
  { id: 'computers', name: 'Computers', defaultMethod: 'StraightLine', defaultUsefulLife: 5, defaultWDVRate: 25, defaultResidualPct: 0  },
  { id: 'furniture', name: 'Furniture', defaultMethod: 'WrittenDownValue', defaultUsefulLife: 10, defaultWDVRate: 15, defaultResidualPct: 0  },
];

// ═════════════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═════════════════════════════════════════════════════════════════════════
async function runTest() {
  console.log('\n' + bold('═'.repeat(55)));
  console.log(bold('  🇳🇵  NFRS Financial Reporter — End-to-End Test'));
  console.log(bold('═'.repeat(55)) + '\n');

  const startTime = Date.now();
  let step = 0;

  // ── Load modules ─────────────────────────────────────────────────────
  step++;
  console.log(bold(`[${step}] Loading modules...`));
  const {
    SAMPLE_COMPANY, SAMPLE_TRIAL_BALANCE_CSV,
    parseTrialBalance, matchAllAccounts,
    calculateDepreciationSummary, computeAllFinancials,
    generateNFRSWorkbook, buildNotesData,
  } = await loadModules();
  pass('All modules imported successfully');

  // ── Step 1: Parse Trial Balance ──────────────────────────────────────
  step++;
  console.log(bold(`\n[${step}] Parsing trial balance from SAMPLE_TRIAL_BALANCE_CSV...`));
  const csvBuffer = Buffer.from(SAMPLE_TRIAL_BALANCE_CSV, 'utf-8');
  const parsed    = await parseTrialBalance(csvBuffer, 'sample.csv');

  assert(parsed.rows.length >= 10, `Expected ≥10 rows, got ${parsed.rows.length}`);
  pass(`Parsed ${parsed.rows.length} rows`);

  const { totalClosingDr, totalClosingCr } = parsed;
  const imbalance = parsed.difference;
  if (parsed.isBalanced) {
    pass(`Trial balance balanced (Dr: ${totalClosingDr.toLocaleString()}, Cr: ${totalClosingCr.toLocaleString()}, Δ: ${imbalance})`);
  } else {
    fail(`Trial balance imbalance: NPR ${imbalance.toLocaleString()} — check SAMPLE_TRIAL_BALANCE_CSV`);
  }
  info(`Auto-mapped in parser: ${parsed.rows.filter(r => r.confidence >= 80).length}/${parsed.rows.length}`);

  // ── Step 2: Account Matching ─────────────────────────────────────────
  step++;
  console.log(bold(`\n[${step}] Running deterministic account matching...`));
  const matched      = matchAllAccounts(parsed.rows);
  const autoMatched  = matched.filter(m => m.confidence >= 80).length;
  const needsReview  = matched.filter(m => m.confidence > 0 && m.confidence < 80).length;
  const unmatched    = matched.filter(m => m.confidence === 0).length;

  assert(autoMatched > 0, 'Expected at least 1 auto-matched account');
  pass(`Auto-matched (≥80%): ${autoMatched}/${matched.length}`);
  info(`Needs review (1-79%): ${needsReview}`);
  info(`Unmatched (0%): ${unmatched}`);

  if (unmatched > 0) {
    console.log(yellow('\n   ⚠ Unmatched accounts (these will need manual assignment):'));
    matched.filter(m => m.confidence === 0).forEach(m => {
      console.log(yellow(`     • ${m.rawLabel}`));
    });
  }

  // ── Step 3: Depreciation Calculation ─────────────────────────────────
  step++;
  console.log(bold(`\n[${step}] Calculating depreciation for ${SAMPLE_ASSETS.length} sample assets...`));
  const { results: assetResults, summary: depnSummary } = calculateDepreciationSummary(
    SAMPLE_ASSETS,
    SAMPLE_ASSET_CATEGORIES,
    SAMPLE_COMPANY.fiscalYear.bsFY
  );

  const totalDepreciation = depnSummary.reduce((s, c) => s + c.depnForYear, 0);
  assert(totalDepreciation > 0, 'Expected depreciation > 0');
  pass(`Total depreciation: NPR ${totalDepreciation.toLocaleString('en-IN')}`);

  assetResults.forEach(r => {
    info(`${r.assetName}: NPR ${r.depnForYear.toLocaleString('en-IN')} (NBV: ${r.netBookValueClosing.toLocaleString('en-IN')})`);
  });

  // ── Step 4: Build YearEndAdjustments object ───────────────────────────
  step++;
  console.log(bold(`\n[${step}] Building year-end adjustments object...`));
  const adj = {
    companyId:            SAMPLE_COMPANY.id,
    fiscalYear:           SAMPLE_COMPANY.fiscalYear.bsFY,
    assets:               SAMPLE_ASSETS as any,
    depreciationResults:  assetResults,
    depreciationSummary:  depnSummary,
    taxDepreciationPools: [],
    inventoryAdjustments: [],
    investmentAdjustments: [],
    provisions:           [],
    journalEntries:       [],
    totalDepreciationExpense: totalDepreciation,
    totalInventoryImpairment: 0,
    totalInvestmentFVAdjustment: 0,
    totalProvisions:      0,
    gainOnDisposals:      0,
    lossOnDisposals:      0,
    profitBeforeTax:      0, // will be computed in financials
    priorYearTax:         0,
    deferredTaxExpense:   0,
    taxDepreciation:      Math.round(totalDepreciation * 0.9), // approximate for test
    advanceTax1:          0,
    advanceTax2:          0,
    advanceTax3:          0,
    tdsCredit:            0,
    taxPools:             [],
    otherAdjustments:     [],
    company:              SAMPLE_COMPANY,
  };
  pass('Year-end adjustments object built');

  // ── Step 5: Compute Financial Statements ─────────────────────────────
  step++;
  console.log(bold(`\n[${step}] Computing financial statements...`));

  // Build the parsed TB object with matched categories
  const mappedRows = parsed.rows.map((raw, i) => {
    const match = matched[i];
    return {
      ...raw,
      nfrsCategory: match?.nfrsCategory ?? 'unclassified',
      matchedLabel: match?.matchedLabel ?? null,
      confidence: match?.confidence ?? 0,
      matchMethod: match?.method ?? 'unmatched',
      needsReview: match?.needsReview ?? true,
      candidates: match?.candidates ?? [],
      userOverride: false,
    };
  });

  const parsedTB = {
    ...parsed,
    rows: mappedRows,
  };

  const financials = computeAllFinancials(parsedTB, adj, SAMPLE_COMPANY);
  const { balanceSheet, incomeStatement, changesInEquity, cashFlow } = financials;

  // Net profit check
  info(`Net Profit: NPR ${incomeStatement.netProfit.toLocaleString('en-IN')}`);
  info(`Total Assets: NPR ${balanceSheet.totalAssets.toLocaleString('en-IN')}`);
  info(`Total Equity + Liabilities: NPR ${balanceSheet.totalEquityAndLiabilities.toLocaleString('en-IN')}`);

  const bsCheck = Math.abs(balanceSheet.checkDifference ?? (balanceSheet.totalAssets - balanceSheet.totalEquityAndLiabilities));
  if (bsCheck <= SAMPLE_COMPANY.accountingPolicies.roundingLevel) {
    pass(`Balance Sheet balanced — difference: ${bsCheck} (within rounding tolerance)`);
  } else {
    fail(`Balance Sheet imbalance: NPR ${bsCheck.toLocaleString()} (expected ≤ ${SAMPLE_COMPANY.accountingPolicies.roundingLevel})`);
    errors.push(`Balance sheet check failed: difference = ${bsCheck}`);
  }

  // Revenue sanity check
  assert(incomeStatement.revenue >= 0, 'Revenue should be non-negative');
  pass(`Revenue: NPR ${incomeStatement.revenue.toLocaleString('en-IN')}`);

  // ── Step 6: Build Notes Data ──────────────────────────────────────────
  step++;
  console.log(bold(`\n[${step}] Building notes data...`));
  const notes = buildNotesData({
    company:     SAMPLE_COMPANY,
    tb:          parsedTB,
    adj:         adj,
    bs:          balanceSheet,
    is:          incomeStatement,
  });
  assert(notes !== null && typeof notes === 'object', 'Notes data should be an object');
  pass(`Notes data built (${Object.keys(notes).length} note sections)`);

  // ── Step 7: Generate Excel Workbook ───────────────────────────────────
  step++;
  console.log(bold(`\n[${step}] Generating NFRS Excel workbook...`));
  const workbookParams = {
    company:      SAMPLE_COMPANY,
    trialBalance: parsedTB,
    balanceSheet,
    incomeStatement,
    changesInEquity,
    cashFlow,
    notes,
    adjustments:  adj,
  };

  const buffer = await generateNFRSWorkbook(workbookParams);

  assert(Buffer.isBuffer(buffer), 'generateNFRSWorkbook should return a Buffer');
  assert(buffer.length > 5000, `Workbook too small (${buffer.length} bytes) — likely empty`);
  pass(`Excel workbook generated (${(buffer.length / 1024).toFixed(1)} KB)`);

  // ── Step 8: Save to disk ──────────────────────────────────────────────
  step++;
  console.log(bold(`\n[${step}] Saving output to disk...`));
  const outputDir  = path.join(ROOT, 'test-output');
  const outputFile = path.join(outputDir, 'NFRS_Test_Output.xlsx');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, buffer);

  const stats = fs.statSync(outputFile);
  assert(stats.size > 5000, `Output file too small: ${stats.size} bytes`);
  pass(`Saved: test-output/NFRS_Test_Output.xlsx (${(stats.size / 1024).toFixed(1)} KB)`);

  // Also save a JSON summary for debugging
  const summaryFile = path.join(outputDir, 'test-summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify({
    generatedAt:       new Date().toISOString(),
    company:           SAMPLE_COMPANY.companyName,
    fiscalYear:        SAMPLE_COMPANY.fiscalYear.bsFY,
    tbRows:            parsed.rows.length,
    autoMatchedRows:   autoMatched,
    unmatchedRows:     unmatched,
    totalDepreciation,
    revenue:           incomeStatement.revenue,
    netProfit:         incomeStatement.netProfit,
    totalAssets:       balanceSheet.totalAssets,
    balanceSheetCheck: bsCheck,
    xlsxSizeKB:        (stats.size / 1024).toFixed(1),
  }, null, 2));
  pass(`Summary saved: test-output/test-summary.json`);

  // ── Step 9: Verify Excel ZIP structure (XLSX is a ZIP) ───────────────
  step++;
  console.log(bold(`\n[${step}] Verifying XLSX file integrity...`));
  const XLSX_MAGIC = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
  const fileMagic  = buffer.slice(0, 4);
  assert(
    fileMagic.equals(XLSX_MAGIC),
    `XLSX magic bytes mismatch (got: ${fileMagic.toString('hex')})`
  );
  pass('XLSX file has valid ZIP/XLSX magic bytes');
  info('Open test-output/NFRS_Test_Output.xlsx in Excel/LibreOffice to verify all sheets');

  // ── Final Report ──────────────────────────────────────────────────────
  const elapsedMs = Date.now() - startTime;
  console.log('\n' + bold('═'.repeat(55)));

  if (errors.length === 0) {
    console.log(green(bold('  🎉 ALL TESTS PASSED!')));
  } else {
    console.log(red(bold(`  ❌ ${errors.length} ERROR(S) FOUND:`)));
    errors.forEach(e => console.log(red(`     • ${e}`)));
  }

  console.log(`  ⏱  Completed in ${(elapsedMs / 1000).toFixed(2)}s`);
  console.log(bold('═'.repeat(55)));
  console.log('\n📂 Output files:');
  console.log(`   ${cyan('test-output/NFRS_Test_Output.xlsx')} — Open in Excel to verify`);
  console.log(`   ${cyan('test-output/test-summary.json')}     — Machine-readable summary\n`);

  if (errors.length > 0) process.exit(1);
}

// ── Entry point ───────────────────────────────────────────────────────────
runTest().catch(err => {
  console.error(red('\n❌ Test runner crashed:'), err.message ?? err);
  if (err.stack) {
    console.error(yellow('\nStack trace:'));
    err.stack.split('\n').slice(0, 8).forEach((l: string) => console.error('  ', l));
  }
  process.exit(1);
});
