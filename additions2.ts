interface AccountingPoliciesForNote {
  depreciationMethod?: string;         // 'SLM' | 'WDV'
  inventoryCostFormula?: string;       // 'FIFO' | 'WeightedAverage' | 'SpecificIdentification'
  hasGratuityLiability?: boolean;
  hasLeaveEncashment?: boolean;
  incomeTaxRatePercent?: number;
  roundingLevel?: number;
  dateOfAuthorizationForIssue?: string;
  companyName?: string;
  fiscalYear?: string;
}

/**
 * Note 1 — Significant Accounting Policies
 * Writes a full-text policies sheet using standard Nepal CA language.
 */
export function writeNote1_AccountingPolicies(
  wb: import('exceljs').Workbook,
  policies: AccountingPoliciesForNote,
): import('exceljs').Worksheet {
  const ws = wb.addWorksheet('Note 1 - Policies');
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };

  ws.getColumn(1).width = 5;   // margin column
  ws.getColumn(2).width = 100; // text column

  let r = 1;

  const addHeading = (text: string, level: 1 | 2 | 3) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = text;
    if (level === 1) {
      cell.font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF4FF' } };
      row.height = 22;
    } else if (level === 2) {
      cell.font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };
      row.height = 18;
    } else {
      cell.font = { bold: true, size: 10 };
    }
    cell.alignment = { wrapText: true, vertical: 'middle' };
  };

  const addPara = (text: string, indent = 0) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = ' '.repeat(indent * 4) + text;
    cell.font = { size: 10 };
    cell.alignment = { wrapText: true, vertical: 'top' };
    row.height = Math.max(15, Math.ceil(text.length / 110) * 14);
  };

  const addBlank = () => { ws.getRow(r++).height = 6; };

  const depMethod = policies.depreciationMethod === 'WDV'
    ? 'Written-Down Value (WDV) method'
    : 'Straight-Line Method (SLM)';

  const inventoryMethod =
    policies.inventoryCostFormula === 'FIFO' ? 'First-In, First-Out (FIFO)'
    : policies.inventoryCostFormula === 'SpecificIdentification' ? 'Specific Identification'
    : 'Weighted Average Cost';

  const taxRate = policies.incomeTaxRatePercent ?? 25;
  const rounding = policies.roundingLevel ?? 100;
  const company = policies.companyName ?? '[Company Name]';
  const fy = policies.fiscalYear ?? '[Fiscal Year]';
  const authDate = policies.dateOfAuthorizationForIssue ?? '[Date]';

  // ── Document Header ──
  addHeading(`${company}`, 1);
  addPara(`Notes to the Financial Statements for the Year Ended ${fy}`);
  addBlank();

  // ── Note 1 ──
  addHeading('NOTE 1: SIGNIFICANT ACCOUNTING POLICIES', 1);
  addBlank();

  // 1.1 Statement of Compliance
  addHeading('1.1 Statement of Compliance', 2);
  addPara(
    `These financial statements have been prepared in accordance with Nepal Accounting Standards for Micro Entities (NAS for MEs) issued by the Accounting Standards Board Nepal (AASB) under authority of the Institute of Chartered Accountants of Nepal (ICAN). Where NAS for MEs does not address a particular transaction or event, appropriate Nepal Accounting Standards (NAS), Nepal Financial Reporting Standards (NFRS), or internationally accepted accounting principles have been applied.`
  );
  addBlank();

  // 1.2 Basis of Preparation
  addHeading('1.2 Basis of Preparation', 2);
  addPara(
    `These financial statements are prepared on the historical cost basis, except for certain financial instruments and investment properties that are measured at fair value as described in the relevant policies below. The financial statements are presented in Nepalese Rupees (NPR) and rounded to the nearest NPR ${rounding.toLocaleString('en-IN')}.`
  );
  addPara(
    `The financial statements are prepared on the going concern basis. The management has assessed the company's ability to continue as a going concern for the foreseeable future and is not aware of any material uncertainties that may cast significant doubt on this assessment.`
  );
  addBlank();

  // 1.3 Fiscal Year
  addHeading('1.3 Reporting Period', 2);
  addPara(
    `The financial statements cover the fiscal year ${fy} in Bikram Sambat (BS) calendar, as mandated for companies registered in Nepal under the Companies Act 2063 and the Income Tax Act 2058. Comparative figures presented are for the immediately preceding fiscal year.`
  );
  addBlank();

  // 1.4 Revenue Recognition
  addHeading('1.4 Revenue Recognition', 2);
  addPara(
    `Revenue is recognised when it is probable that the economic benefits associated with the transaction will flow to the company and the amount of revenue can be measured reliably.`
  );
  addPara(`(a) Sales of Goods: Revenue from the sale of goods is recognised when the significant risks and rewards of ownership have been transferred to the buyer, the company retains neither continuing managerial involvement nor effective control over the goods sold, the amount of revenue can be measured reliably, and it is probable that the economic benefits associated with the transaction will flow to the entity.`, 1);
  addPara(`(b) Revenue from Services: Revenue from services is recognised when services are rendered, by reference to the stage of completion of the service transaction at the end of the reporting period.`, 1);
  addPara(`(c) Interest Income: Interest income is accrued on a time basis by reference to the principal outstanding and the effective interest rate applicable.`, 1);
  addPara(`(d) Dividend Income: Dividend income is recognised when the company's right to receive payment is established.`, 1);
  addBlank();

  // 1.5 PPE
  addHeading('1.5 Property, Plant & Equipment (PPE)', 2);
  addPara(
    `Property, Plant and Equipment are stated at cost less accumulated depreciation and any accumulated impairment losses. Cost includes the purchase price, import duties, non-refundable purchase taxes, and any directly attributable costs of bringing the asset to the location and condition necessary for it to be capable of operating in the manner intended by management.`
  );
  addPara(
    `Depreciation is provided on all PPE, other than freehold land, using the ${depMethod} over the estimated useful lives of the assets. Depreciation commences when the assets are ready for their intended use.`
  );
  addPara(
    `The estimated useful lives and depreciation rates applied are consistent with the rates prescribed under Schedule 2 of the Nepal Income Tax Act 2058 (as amended) and are reviewed annually by management.`
  );
  addPara(
    `An item of PPE is derecognised upon disposal or when no future economic benefits are expected from its use or disposal. Any gain or loss arising on derecognition of the asset (calculated as the difference between the net disposal proceeds and the carrying amount of the asset) is included in the income statement in the period the item is derecognised.`
  );
  addBlank();

  // 1.6 Inventories
  addHeading('1.6 Inventories', 2);
  addPara(
    `Inventories are stated at the lower of cost and net realisable value. Cost is determined using the ${inventoryMethod} method. Net realisable value is the estimated selling price in the ordinary course of business less the estimated costs of completion and the estimated costs necessary to make the sale.`
  );
  addBlank();

  // 1.7 Financial Instruments
  addHeading('1.7 Financial Instruments', 2);
  addPara(
    `Financial assets comprise primarily trade receivables, other receivables, and cash and cash equivalents. They are initially measured at fair value plus transaction costs. Subsequent measurement is at amortised cost using the effective interest method.`
  );
  addPara(
    `Trade receivables are measured at amortised cost, which is their face amount less any allowance for impairment. An allowance for impairment is created when there is objective evidence that the company will be unable to collect the amounts due, based on a review of all outstanding receivables at the balance sheet date.`
  );
  addBlank();

  // 1.8 Investments
  addHeading('1.8 Investments', 2);
  addPara(
    `Investments in listed equity securities are measured at fair value through profit or loss. Investments in unlisted securities and long-term investments are carried at cost less any provision for impairment in value, where no reliable fair value can be estimated.`
  );
  addBlank();

  // 1.9 Employee Benefits
  addHeading('1.9 Employee Benefits', 2);
  addPara(
    `(a) Short-term employee benefits: Salaries, wages, annual leave and other short-term employee benefits are accrued in the period in which the associated services are rendered by employees.`, 1
  );
  if (policies.hasGratuityLiability) {
    addPara(
      `(b) Gratuity: The company recognises a liability for gratuity payable under the Labour Act 2074. The gratuity liability is calculated based on the last drawn monthly salary multiplied by the number of completed years of service, as prescribed under the Act. The charge for the year represents the movement in the liability during the year.`, 1
    );
  }
  if (policies.hasLeaveEncashment) {
    addPara(
      `(c) Leave Encashment: The company accrues a liability for leave encashment based on the accumulated entitled leave balance of employees at the balance sheet date, calculated at the salary rates prevailing at the year end.`, 1
    );
  }
  addPara(
    `(d) Staff Bonus: Provision for staff bonus is made in accordance with the Bonus Act 2030 at the rate of 10% of net profit before tax and before charging such bonus.`, 1
  );
  addPara(
    `(e) Provident Fund and Social Security Fund: The company contributes to the Employee Provident Fund and Social Security Fund as required by law. Contributions are charged to the income statement as incurred.`, 1
  );
  addBlank();

  // 1.10 Income Tax
  addHeading('1.10 Income Tax', 2);
  addPara(
    `Income tax expense represents the sum of current tax and deferred tax. Current tax is the amount of income tax payable in respect of the taxable income for the year, calculated using tax rates enacted or substantially enacted at the balance sheet date. The applicable corporate income tax rate is ${taxRate}% as per the Nepal Income Tax Act 2058 (for the applicable category of company).`
  );
  addPara(
    `Deferred tax is recognised on all temporary differences between the carrying amounts of assets and liabilities for financial reporting purposes and the amounts used for taxation purposes. Deferred tax assets are recognised to the extent that it is probable that future taxable profit will be available against which the temporary differences can be utilised.`
  );
  addBlank();

  // 1.11 Foreign Currency
  addHeading('1.11 Foreign Currency Transactions', 2);
  addPara(
    `Transactions in foreign currencies are recorded at the rate of exchange prevailing on the date of the transaction. Monetary assets and liabilities denominated in foreign currencies are retranslated at the rate of exchange prevailing at the balance sheet date. Exchange differences arising from the settlement of monetary items or from translating monetary items at rates different from those at which they were translated at initial recognition during the period or in previous financial statements are recognised in profit or loss in the period in which they arise.`
  );
  addBlank();

  // 1.12 Authorization
  addHeading('1.12 Authorization for Issue', 2);
  addPara(
    `These financial statements were authorized for issue by the Board of Directors of ${company} on ${authDate}.`
  );
  addBlank();

  return ws;
}

/**
 * Note 2 — Critical Accounting Judgments and Key Sources of Estimation Uncertainty
 */
export function writeNote2_CriticalJudgments(
  wb: import('exceljs').Workbook,
  params: {
    companyName?: string;
    fiscalYear?: string;
  }
): import('exceljs').Worksheet {
  const ws = wb.addWorksheet('Note 2 - Judgments');
  ws.pageSetup = { paperSize: 9, orientation: 'portrait' };
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 100;

  let r = 1;

  const addHeading = (text: string, isMain = false) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = text;
    cell.font = isMain
      ? { bold: true, size: 13, color: { argb: 'FF1E3A5F' } }
      : { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };
    if (isMain) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF4FF' } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
    row.height = isMain ? 22 : 18;
  };

  const addPara = (text: string, indent = 0) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = ' '.repeat(indent * 4) + text;
    cell.font = { size: 10 };
    cell.alignment = { wrapText: true, vertical: 'top' };
    row.height = Math.max(15, Math.ceil(text.length / 110) * 14);
  };

  const addBlank = () => { ws.getRow(r++).height = 6; };

  const company = params.companyName ?? '[Company Name]';
  const fy = params.fiscalYear ?? '[Fiscal Year]';

  addHeading(`${company}`, true);
  addPara(`Notes to the Financial Statements for the Year Ended ${fy}`);
  addBlank();

  addHeading('NOTE 2: CRITICAL ACCOUNTING JUDGMENTS AND KEY SOURCES OF ESTIMATION UNCERTAINTY', true);
  addBlank();

  addPara(
    `In the application of the company's accounting policies, management is required to make judgments, estimates and assumptions about the carrying amounts of assets and liabilities that are not readily apparent from other sources. The estimates and associated assumptions are based on historical experience and other factors that are considered to be relevant. Actual results may differ from these estimates.`
  );
  addBlank();

  addPara('The estimates and underlying assumptions are reviewed on an ongoing basis. Revisions to accounting estimates are recognised in the period in which the estimate is revised if the revision affects only that period, or in the period of the revision and future periods if the revision affects both current and future periods.');
  addBlank();

  // Critical Judgments
  addHeading('2.1 Critical Judgments in Applying Accounting Policies', false);
  addBlank();

  addHeading('Useful Lives of PPE', false);
  addPara(
    `Management determines the estimated useful lives and related depreciation charges for the company's PPE. This estimate is based on the expected physical and technical obsolescence of assets, industry norms, and the condition of the assets. Depreciation methods and estimated useful lives are reviewed annually and adjusted if appropriate.`
  );
  addBlank();

  addHeading('Impairment of Trade Receivables', false);
  addPara(
    `Management assesses the recoverability of trade receivables based on a review of individual debtor balances, past experience, and current economic conditions. A provision for impairment is created for receivables where there is objective evidence of impairment. The assessment involves significant judgment as to the likelihood and timing of recovery.`
  );
  addBlank();

  addHeading('Inventory Valuation', false);
  addPara(
    `The company estimates net realisable value for slow-moving and obsolete inventory items. These estimates take into account anticipated selling prices, costs to completion, and selling costs. Actual realisable values may differ from estimates.`
  );
  addBlank();

  // Key Sources of Estimation Uncertainty
  addHeading('2.2 Key Sources of Estimation Uncertainty', false);
  addBlank();

  addHeading('Income Tax', false);
  addPara(
    `The company is subject to income tax in Nepal. Significant judgment is required in determining the provision for income taxes. There are transactions and calculations for which the ultimate tax determination is uncertain. Where the final tax outcome of these matters is different from the amounts initially recorded, such differences will impact the income tax and deferred tax provisions in the period in which such determination is made.`
  );
  addBlank();

  addHeading('Employee Benefit Provisions', false);
  addPara(
    `The cost of defined benefit obligations (gratuity and leave encashment) is determined using actuarial assumptions. The principal assumptions used in the estimation are salary growth rates, employee attrition rates, and retirement ages. Changes in these assumptions will impact the carrying amount of the obligation.`
  );
  addBlank();

  addHeading('Depreciation and Residual Values', false);
  addPara(
    `The company reviews residual values and useful lives of assets at each reporting date. Estimation of residual values inherently involves uncertainty about future market conditions and the company's future plans for asset disposal.`
  );
  addBlank();

  addHeading('Provisions and Contingencies', false);
  addPara(
    `Provisions are recognised when the company has a present obligation (legal or constructive) as a result of a past event, it is probable that the company will be required to settle the obligation, and a reliable estimate can be made of the amount of the obligation. The amount recognised as a provision is the best estimate of the consideration required to settle the present obligation at the balance sheet date. Contingencies are disclosed in Note 3.16.`
  );
  addBlank();

  return ws;
}

// ── Compliance Statement in Balance Sheet sheet ───────────────────────────────
/**
 * Appends the ICAN compliance statement text block to the bottom of
 * the Balance Sheet sheet, below the main financial data.
 */
export function appendComplianceStatement(
  ws: import('exceljs').Worksheet,
  params: {
    companyName: string;
    fiscalYear: string;
    roundingLevel: number;
    authorizationDate?: string;
  },
  startRow: number,
): void {
  let r = startRow + 2; // leave gap

  const addRow = (text: string, bold = false, italic = false, indent = 0) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(1);
    cell.value = text;
    cell.font = { bold, italic, size: 9, color: { argb: 'FF374151' } };
    cell.alignment = { wrapText: true, vertical: 'top', indent };
    row.height = Math.max(12, Math.ceil(text.length / 120) * 11);
  };

  const divider = ws.getRow(r++);
  const divCell = divider.getCell(1);
  divCell.border = { top: { style: 'medium', color: { argb: 'FF1E3A5F' } } };
  ws.mergeCells(r - 1, 1, r - 1, 5);

  addRow('NOTES TO FINANCIAL STATEMENTS', true, false);
  addRow('');

  addRow('1. STATEMENT OF COMPLIANCE', true);
  addRow(
    `These financial statements of \${params.companyName} have been prepared in accordance with Nepal Accounting Standards for Micro Entities (NAS for MEs) issued by the Institute of Chartered Accountants of Nepal (ICAN).`,
    false, false, 1
  );
  addRow('');

  addRow('2. BASIS OF PREPARATION', true);
  addRow(
    `These financial statements are prepared on the historical cost basis except for certain financial instruments measured at fair values as described in the accounting policies. The financial statements are presented in Nepalese Rupees (NPR) rounded to the nearest NPR \${params.roundingLevel.toLocaleString('en-IN')}.`,
    false, false, 1
  );
  addRow('');

  addRow('3. AUTHORIZATION FOR ISSUE', true);
  addRow(
    `These financial statements for the fiscal year \${params.fiscalYear} were authorized for issue by the Board of Directors of \${params.companyName} on \${params.authorizationDate ?? '[Board Meeting Date]'}.`,
    false, false, 1
  );
  addRow('');

  addRow(
    'Refer to Note 1 (Significant Accounting Policies) and Note 2 (Critical Accounting Judgments) sheets in this workbook for the complete notes to the financial statements.',
    false, true, 0
  );
}
