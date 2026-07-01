// ===== src/components/adjustments/ProvisionInputs.tsx =====
import React, { useState } from 'react';
import type { ProvisionEntry, AccountingPolicies } from '../../types';
import { formatNPR } from '../../utils/numberFormat';
import Button from '../ui/Button';
import Card from '../ui/Card';
import InputField from '../ui/InputField';

interface ProvisionInputsProps {
  companyId: string;
  provisions: ProvisionEntry[];
  accountingPolicies: AccountingPolicies;
  onSave: (provisions: ProvisionEntry[]) => void;
}

function makeProvision(type: ProvisionEntry['provisionType'], desc: string): ProvisionEntry {
  return { id: type, provisionType: type, description: desc, openingBalance: 0, additionForYear: 0, utilisedDuringYear: 0, reversedDuringYear: 0, closingBalance: 0, isCurrentLiability: true };
}

export default function ProvisionInputs({ provisions: initialProvisions, accountingPolicies, onSave }: ProvisionInputsProps): React.ReactElement {
  const [provs, setProvs] = useState<ProvisionEntry[]>(
    initialProvisions.length > 0 ? initialProvisions : [
      makeProvision('gratuity',        'Gratuity Provision'),
      makeProvision('leave_encashment','Leave Encashment Provision'),
      makeProvision('bonus',           'Bonus Payable'),
      makeProvision('audit_fee',       'Audit Fee Payable'),
      makeProvision('doubtful_debts',  'Provision for Doubtful Debts'),
    ],
  );

  const updateProv = (id: string, key: keyof ProvisionEntry, val: number) => {
    setProvs((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const updated = { ...p, [key]: val };
      updated.closingBalance = updated.openingBalance + updated.additionForYear - updated.utilisedDuringYear - updated.reversedDuringYear;
      return updated;
    }));
  };

  return (
    <div className="space-y-6">
      {provs.map((prov) => (
        <Card key={prov.id} title={prov.description} padding="md">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['openingBalance', 'additionForYear', 'utilisedDuringYear', 'reversedDuringYear'] as const).map((field) => (
              <InputField key={field} type="number" label={field.replace(/([A-Z])/g, ' $1').trim()} value={String(prov[field])} onChange={(e) => updateProv(prov.id, field, Number(e.target.value))} />
            ))}
          </div>
          <div className="mt-3 p-3 bg-slate-50 rounded-lg flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600">Closing Balance</span>
            <span className="font-mono font-bold text-slate-800">{formatNPR(prov.closingBalance)}</span>
          </div>
        </Card>
      ))}

      <Card title="Summary" padding="md">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200">{['Provision', 'Opening', 'Addition', 'Utilised', 'Reversed', 'Closing'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {provs.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 text-slate-700 font-medium">{p.description}</td>
                {[p.openingBalance, p.additionForYear, p.utilisedDuringYear, p.reversedDuringYear, p.closingBalance].map((v, i) => (
                  <td key={i} className="px-3 py-2 text-right font-mono text-xs">{formatNPR(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => onSave(provs)}>Save Provisions &amp; Continue →</Button>
      </div>
    </div>
  );
}
