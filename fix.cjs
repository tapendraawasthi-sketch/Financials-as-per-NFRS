const fs = require('fs');
let content = fs.readFileSync('src/data/nfrsCategories.ts', 'utf8');

const map = {
  'bank_charges': 'finance_cost_bank_charges',
  'other_finance_costs': 'finance_cost_interest', // merge into interest for now, or use admin_other
  'impairment_loss': 'impairment_expense',
  'rent_expense': 'admin_rent',
  'electricity_expense': 'admin_electricity',
  'telephone_internet': 'admin_communication',
  'printing_stationery': 'admin_printing',
  'repairs_maintenance': 'admin_repairs',
  'audit_fee_expense': 'admin_audit_fee',
  'legal_professional': 'admin_legal_professional',
  'selling_distribution': 'admin_other', // map to admin_other
  'travel_conveyance': 'admin_traveling',
  'insurance_expense': 'admin_insurance',
  'miscellaneous_expense': 'admin_other', // map to admin_other
  'admin_expense_other': 'admin_other',
  'current_tax_expense': 'income_tax_expense',
  'deferred_tax_expense': 'income_tax_expense', // map to income tax for now
};

for (const [key, val] of Object.entries(map)) {
  const regex = new RegExp("value: '" + key + "'", 'g');
  content = content.replace(regex, "value: '" + val + "'");
}

fs.writeFileSync('src/data/nfrsCategories.ts', content);
console.log('nfrsCategories updated');
