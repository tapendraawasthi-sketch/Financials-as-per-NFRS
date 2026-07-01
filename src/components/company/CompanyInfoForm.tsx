// ===== src/components/company/CompanyInfoForm.tsx =====
import React, { useState } from 'react';
import type { CompanyProfile } from '../../types';
import { validateCompanyProfile } from '../../utils/validation';
import Button from '../ui/Button';
import Card from '../ui/Card';
import InputField from '../ui/InputField';
import SelectDropdown from '../ui/SelectDropdown';

interface CompanyInfoFormProps {
  initialData?: Partial<CompanyProfile>;
  onSubmit: (data: Partial<CompanyProfile>) => void;
  isLoading?: boolean;
}

const COMPANY_TYPES = ['Private Limited', 'Public Limited', 'Partnership Firm', 'Proprietorship', 'NGO/INGO', 'Cooperative', 'Other'].map((v) => ({ value: v, label: v }));
const FRAMEWORK_TYPES = [{ value: 'nas_mes', label: 'NAS for MEs (Micro Entities — default)' }, { value: 'nfrs', label: 'Full NFRS (Large Companies)' }];
const NEPAL_PROVINCES = ['Koshi Province', 'Madhesh Province', 'Bagmati Province', 'Gandaki Province', 'Lumbini Province', 'Karnali Province', 'Sudurpashchim Province'].map((v) => ({ value: v, label: v }));
const AUDITOR_POSITIONS = ['Partner', 'Proprietor', 'Qualified'].map((v) => ({ value: v, label: v }));

export default function CompanyInfoForm({ initialData, onSubmit, isLoading }: CompanyInfoFormProps): React.ReactElement {
  const [form, setForm] = useState<Partial<CompanyProfile>>(initialData ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));
  const setNested = (parent: string, key: string, val: unknown) =>
    setForm((p) => ({ ...p, [parent]: { ...(p as any)[parent], [key]: val } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCompanyProfile(form);
    if (!validation.isValid) { setErrors(validation.errors); return; }
    setErrors({});
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      <Card title="Company Details" subtitle="Basic registration information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <InputField label="Company Name (as per registration certificate)" required error={errors.companyName}
              helperText="Must match exactly as in your registration documents"
              value={(form.companyName as string) ?? ''} onChange={(e) => set('companyName', e.target.value)} />
          </div>
          <InputField label="PAN / VAT Number" required placeholder="9-digit PAN number" error={errors.panVatNumber}
            value={(form.panVatNumber as string) ?? ''} onChange={(e) => set('panVatNumber', e.target.value)} />
          <InputField label="Business Registration Number" required error={errors.registrationNumber}
            value={(form.registrationNumber as string) ?? ''} onChange={(e) => set('registrationNumber', e.target.value)} />
          <SelectDropdown label="Company Type" required options={COMPANY_TYPES} error={errors.companyType}
            value={(form.companyType as string) ?? ''} onChange={(e) => set('companyType', e.target.value)} />
          <SelectDropdown label="Accounting Framework" options={FRAMEWORK_TYPES}
            value={(form as any).entityType ?? 'nas_mes'} onChange={(e) => set('entityType', e.target.value)} />
        </div>
      </Card>

      <Card title="Registered Address">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectDropdown label="Province" options={NEPAL_PROVINCES}
            value={(form.address as any)?.province ?? ''} onChange={(e) => setNested('address', 'province', e.target.value)} />
          <InputField label="District" value={(form.address as any)?.district ?? ''} onChange={(e) => setNested('address', 'district', e.target.value)} />
          <InputField label="Municipality" value={(form.address as any)?.municipality ?? ''} onChange={(e) => setNested('address', 'municipality', e.target.value)} />
          <InputField label="Ward Number" value={(form.address as any)?.ward ?? ''} onChange={(e) => setNested('address', 'ward', e.target.value)} />
          <InputField label="Tole / Street" value={(form.address as any)?.tole ?? ''} onChange={(e) => setNested('address', 'tole', e.target.value)} />
          <div className="md:col-span-1">
            <InputField label="Full Address" value={(form.address as any)?.fullAddress ?? ''} onChange={(e) => setNested('address', 'fullAddress', e.target.value)} />
          </div>
        </div>
      </Card>

      <Card title="Contact Person">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="Contact Person Name" value={(form.contactPerson as string) ?? ''} onChange={(e) => set('contactPerson', e.target.value)} />
          <InputField label="Designation" value={(form.designation as string) ?? ''} onChange={(e) => set('designation', e.target.value)} />
          <InputField label="Phone" type="tel" error={errors.phone} value={(form.phone as string) ?? ''} onChange={(e) => set('phone', e.target.value)} />
          <InputField label="Email" type="email" required error={errors.email} value={(form.email as string) ?? ''} onChange={(e) => set('email', e.target.value)} />
          <InputField label="Chairperson" value={(form.chairperson as string) ?? ''} onChange={(e) => set('chairperson', e.target.value)} />
          <InputField label="Director" value={(form.director as string) ?? ''} helperText="Primary director for signature on financial statements" onChange={(e) => set('director', e.target.value)} />
          <InputField label="Accounts Head" value={(form.accountsHead as string) ?? ''} onChange={(e) => set('accountsHead', e.target.value)} />
        </div>
      </Card>

      <Card title="Audit Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="Auditor Name" value={(form.auditorInfo as any)?.auditorName ?? ''} onChange={(e) => setNested('auditorInfo', 'auditorName', e.target.value)} />
          <InputField label="Audit Firm Name" value={(form.auditorInfo as any)?.auditorFirmName ?? ''} onChange={(e) => setNested('auditorInfo', 'auditorFirmName', e.target.value)} />
          <InputField label="ICAN Registration Number" value={(form.auditorInfo as any)?.icaRegistrationNumber ?? ''} onChange={(e) => setNested('auditorInfo', 'icaRegistrationNumber', e.target.value)} />
          <SelectDropdown label="Position" options={AUDITOR_POSITIONS}
            value={(form.auditorInfo as any)?.position ?? ''} onChange={(e) => setNested('auditorInfo', 'position', e.target.value)} />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={isLoading}>Save Company Details &amp; Continue →</Button>
      </div>
    </form>
  );
}
