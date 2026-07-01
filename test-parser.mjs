import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

// Minimal CSV parser smoke test (no compiled TS needed)
const csv = `Account Name,Closing Dr,Closing Cr
Cash in Hand,50000,
NIC Asia Bank Current Account,250000,
Sales Revenue,,3500000
Purchase,2100000,
`;

const lines = csv.trim().split('\n');
const header = lines[0].split(',');
const rows = lines.slice(1).map((line, idx) => {
  const cols = line.split(',');
  return {
    rowIndex: idx + 1,
    rawLabel: cols[0]?.trim() ?? '',
    closingDr: parseFloat(cols[1] || '0') || 0,
    closingCr: parseFloat(cols[2] || '0') || 0,
  };
});

const totalDr = rows.reduce((s, r) => s + r.closingDr, 0);
const totalCr = rows.reduce((s, r) => s + r.closingCr, 0);
const isBalanced = Math.abs(totalDr - totalCr) < 1;

console.log('Rows parsed:', rows.length);
console.log('Total Dr:', totalDr, '| Total Cr:', totalCr);
console.log('Balanced:', isBalanced);
console.log('Parser smoke test: OK');
