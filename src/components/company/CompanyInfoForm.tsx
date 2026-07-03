// src/components/company/CompanyInfoForm.tsx
import React, { useState } from 'react';
import Card           from '../ui/Card';
import Alert          from '../ui/Alert';
import InputField     from '../ui/InputField';
import NumberInput    from '../ui/NumberInput';
import SelectDropdown from '../ui/SelectDropdown';
import Textarea       from '../ui/Textarea';
import Button         from '../ui/Button';
import { useToast }   from '../ui/Toast';
import { CompanyProfile } from '../../types/company';
import { SAMPLE_COMPANY } from '../../data/sampleData';

// ── Option lists ───────────────────────────────────────────────────────────
const COMPANY_TYPE_OPTIONS = [
  { value: 'PrivateLimited',   label: 'Private Limited Company' },
  { value: 'PublicLimited',    label: 'Public Limited Company'  },
  { value: 'Partnership',      label: 'Partnership Firm'        },
  { value: 'Proprietorship',   label: 'Proprietorship'          },
  { value: 'NGO',              label: 'NGO / INGO'              },
  { value: 'Cooperative',      label: 'Cooperative'             },
  { value: 'Other',            label: 'Other'                   },
];

const FRAMEWORK_OPTIONS = [
  { value: 'NASForMEs', label: 'NAS for Micro Entities (default)' },
  { value: 'FullNFRS',  label: 'Full NFRS'                        },
];

const PROVINCE_OPTIONS = [
  { value: 'Koshi',         label: 'Koshi'         },
  { value: 'Madhesh',       label: 'Madhesh'        },
  { value: 'Bagmati',       label: 'Bagmati'        },
  { value: 'Gandaki',       label: 'Gandaki'        },
  { value: 'Lumbini',       label: 'Lumbini'        },
  { value: 'Karnali',       label: 'Karnali'        },
  { value: 'Sudurpashchim', label: 'Sudurpashchim'  },
];

const AUDITOR_POSITION_OPTIONS = [
  { value: 'EngagementPartner', label: 'Engagement Partner' },
  { value: 'Proprietor',        label: 'Proprietor'         },
  { value: 'Qualified',         label: 'Qualified'          },
];

// ── Form state ─────────────────────────────────────────────────────────────
interface FormValues {
  companyName:        string;
  panVatNumber:       string;
  registrationNumber: string;
  companyType:        string;
  entityType:         string;
  province:           string;
  district:           string;
  municipality:       string;
  wardNumber:         string;
  tole:               string;
  fullAddress:        string;
  contactPerson:      string;
  designation:        string;
  phone:              string;
  email:              string;
  chairperson:        string;
  director:           string;
  accountsHead:       string;
  numberOfEmployees:  number;
  dividendDeclaredPercent: number;
  shareIssuedDuringYear: number;
  auditorName:        string;
  auditFirmName:      string;
  icanRegNumber:      string;
  auditorPosition:    string;
  annualTurnover:     number;
  bankBorrowings:     number;
  balanceSheetTotal:  number;
  fiduciaryAssets:    number;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

const EMPTY: FormValues = {
  companyName: '', panVatNumber: '', registrationNumber: '', companyType: '',
  entityType: 'NASForMEs', province: '', district: '', municipality: '',
  wardNumber: '', tole: '', fullAddress: '', contactPerson: '', designation: '',
  phone: '', email: '', chairperson: '', director: '', accountsHead: '',
  numberOfEmployees: 0, dividendDeclaredPercent: 0, shareIssuedDuringYear: 0,
  auditorName: '', auditFirmName: '', icanRegNumber: '', auditorPosition: '',
  annualTurnover: 0, bankBorrowings: 0, balanceSheetTotal: 0, fiduciaryAssets: 0,
};

interface CompanyInfoFormProps {
  initialData?: Partial<FormValues>;
  onSave:       (data: FormValues) => Promise<void> | void;
}

// ── Validation ─────────────────────────────────────────────────────────────
function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};
  if (!v.companyName.trim())
    e.companyName = 'Company name is required';
  if (!v.panVatNumber.trim())
    e.panVatNumber = 'PAN / VAT number is required';
  else if (!/^\d{9}$/.test(v.panVatNumber.trim()))
    e.panVatNumber = 'Must be exactly 9 digits';
  if (!v.registrationNumber.trim())
    e.registrationNumber = 'Registration number is required';
  if (!v.companyType)
    e.companyType = 'Select a company type';
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
    e.email = 'Enter a valid email address';
  return e;
}

// ── Required fields note component ────────────────────────────────────────
// item 50: "Fields marked * are required" note at top of each section
function RequiredNote() {
  return (
    <p className="text-xs text-slate-400 mb-4">
      Fields marked <span className="text-red-500">*</span> are required
    </p>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CompanyInfoForm({
  initialData,
  onSave,
}: CompanyInfoFormProps) {
  const [values,  setValues]  = useState<FormValues>({ ...EMPTY, ...initialData });
  const [errors,  setErrors]  = useState<FormErrors>({});
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const { show } = useToast();   // item 52: toast hook
  const hasEligibilityInput = values.annualTurnover > 0 || values.bankBorrowings > 0 || values.balanceSheetTotal > 0 || values.fiduciaryAssets > 0;
  const isMicroEntityEligible = values.annualTurnover <= 100000000 && values.bankBorrowings <= 50000000 && values.balanceSheetTotal <= 100000000 && values.fiduciaryAssets <= 50000000;

  const loadDummyData = () => {
    setValues(prev => ({
      ...prev,
      companyName: SAMPLE_COMPANY.companyName,
      panVatNumber: SAMPLE_COMPANY.panVatNumber || '',
      registrationNumber: SAMPLE_COMPANY.registrationNumber || '',
      companyType: SAMPLE_COMPANY.companyType || 'PrivateLimited',
      entityType: SAMPLE_COMPANY.entityType || 'NASForMEs',
      fullAddress: SAMPLE_COMPANY.fullAddress || '',
      chairperson: SAMPLE_COMPANY.chairperson || '',
      director: SAMPLE_COMPANY.director || '',
      accountsHead: SAMPLE_COMPANY.accountsHead || '',
      auditorName: SAMPLE_COMPANY.auditorInfo?.auditorName || '',
      auditFirmName: SAMPLE_COMPANY.auditorInfo?.auditorFirmName || '',
      auditorPosition: SAMPLE_COMPANY.auditorInfo?.position || '',
    }));
  };

  const set = <K extends keyof FormValues>(key: K, val: FormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.getElementById(`field-${Object.keys(errs)[0]}`)?.scrollIntoView({
        behavior: 'smooth', block: 'center',
      });
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      await onSave(values);
      // item 52: show "Changes saved" toast after successful save
      show('Company details saved successfully.', 'success', 2500);
    } catch (err: any) {
      setSaveErr(err?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="max-w-3xl space-y-5"
      aria-label="Company information"
    >
      {/* ── Section 1: Company Registration Details ──── */}
      {/* item 47: each section in a Card component */}
      <Card title="Company Registration Details" padding="md">
        <RequiredNote />
        {/* item 50: gap-4 via inline style — form-grid uses gap-4 in updated CSS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2" id="field-companyName">
            <InputField
              label="Company Name"
              value={values.companyName}
              onChange={e => set('companyName', e.target.value)}
              error={errors.companyName}
              required
              placeholder="e.g. Himalayan Trading Pvt. Ltd."
            />
          </div>

          <div id="field-panVatNumber">
            <InputField
              label="PAN / VAT Number"
              value={values.panVatNumber}
              onChange={e => set('panVatNumber', e.target.value.replace(/\D/g, '').slice(0, 9))}
              error={errors.panVatNumber}
              required
              placeholder="123456789"
              helperText="9-digit PAN registered with IRD"
              inputMode="numeric"
              maxLength={9}
            />
          </div>

          <div id="field-registrationNumber">
            <InputField
              label="Registration Number"
              value={values.registrationNumber}
              onChange={e => set('registrationNumber', e.target.value)}
              error={errors.registrationNumber}
              required
              placeholder="e.g. 12345/074/075"
            />
          </div>

          <div id="field-companyType">
            <SelectDropdown
              label="Company Type"
              value={values.companyType}
              onChange={e => set('companyType', e.target.value)}
              options={COMPANY_TYPE_OPTIONS}
              error={errors.companyType}
              required
              placeholder="Select type…"
            />
          </div>

          <div id="field-entityType">
            <SelectDropdown
              label="Accounting Framework"
              value={values.entityType}
              onChange={e => set('entityType', e.target.value)}
              options={FRAMEWORK_OPTIONS}
            />
          </div>
        </div>
      </Card>

      <Card title="Micro Entity Eligibility Check" padding="md">
        <div className="grid grid-cols-2 gap-4">
          <NumberInput
            label="Annual Turnover"
            value={values.annualTurnover}
            onChange={v => set('annualTurnover', v)}
            prefix="NPR"
          />

          <NumberInput
            label="Bank/BFI Borrowings"
            value={values.bankBorrowings}
            onChange={v => set('bankBorrowings', v)}
            prefix="NPR"
          />

          <NumberInput
            label="Balance Sheet Total"
            value={values.balanceSheetTotal}
            onChange={v => set('balanceSheetTotal', v)}
            prefix="NPR"
          />

          <NumberInput
            label="Fiduciary Assets"
            value={values.fiduciaryAssets}
            onChange={v => set('fiduciaryAssets', v)}
            prefix="NPR"
          />

          {hasEligibilityInput && (
            <div className="col-span-2">
              <Alert
                type={isMicroEntityEligible ? 'success' : 'warning'}
                message={
                  isMicroEntityEligible
                    ? 'This entity qualifies as a Micro Entity under NAS for MEs.'
                    : 'This entity may exceed Micro Entity thresholds. NAS for MEs may not be the appropriate reporting standard — please verify with your engagement partner.'
                }
              />
            </div>
          )}
        </div>
      </Card>

      {/* ── Section 2: Registered Address ─────────────── */}
      <Card title="Registered Address" padding="md">
        <RequiredNote />
        <div className="grid grid-cols-3 gap-4">
          <SelectDropdown
            label="Province"
            value={values.province}
            onChange={e => set('province', e.target.value)}
            options={PROVINCE_OPTIONS}
            placeholder="Select province…"
          />

          <InputField
            label="District"
            value={values.district}
            onChange={e => set('district', e.target.value)}
            placeholder="e.g. Kathmandu"
          />

          <InputField
            label="Municipality"
            value={values.municipality}
            onChange={e => set('municipality', e.target.value)}
            placeholder="e.g. Kathmandu Metropolitan"
          />

          <InputField
            label="Ward Number"
            value={values.wardNumber}
            onChange={e => set('wardNumber', e.target.value)}
            placeholder="e.g. 10"
          />

          <InputField
            label="Tole / Street"
            value={values.tole}
            onChange={e => set('tole', e.target.value)}
            placeholder="e.g. New Baneshwor"
          />

          <div className="col-span-3">
            <Textarea
              label="Full Address"
              value={values.fullAddress}
              onChange={e => set('fullAddress', e.target.value)}
              placeholder="Enter the complete registered address as it appears on official documents"
              rows={2}
            />
          </div>
        </div>
      </Card>

      {/* ── Section 3: Management & Signatories ──────── */}
      <Card title="Management & Signatories" padding="md">
        <RequiredNote />
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Contact Person Name"
            value={values.contactPerson}
            onChange={e => set('contactPerson', e.target.value)}
            placeholder="e.g. Ram Bahadur Shrestha"
          />

          <InputField
            label="Designation"
            value={values.designation}
            onChange={e => set('designation', e.target.value)}
            placeholder="e.g. Finance Manager"
          />

          <InputField
            label="Phone"
            value={values.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="e.g. 01-4567890"
            type="tel"
          />

          <div id="field-email">
            <InputField
              label="Email"
              value={values.email}
              onChange={e => set('email', e.target.value)}
              error={errors.email}
              placeholder="e.g. accounts@company.com.np"
              type="email"
            />
          </div>

          <InputField
            label="Chairperson"
            value={values.chairperson}
            onChange={e => set('chairperson', e.target.value)}
            placeholder="Full name"
            helperText="For signing authority on financial statements"
          />

          <InputField
            label="Director"
            value={values.director}
            onChange={e => set('director', e.target.value)}
            placeholder="Full name"
          />

          <div className="col-span-2">
            <InputField
              label="Accounts Head"
              value={values.accountsHead}
              onChange={e => set('accountsHead', e.target.value)}
              placeholder="Full name of the person responsible for accounts"
            />
          </div>

          <div className="col-span-2 grid grid-cols-3 gap-4">
            <NumberInput
              label="Number of Employees"
              value={values.numberOfEmployees}
              onChange={v => set('numberOfEmployees', v)}
            />

            <NumberInput
              label="Dividend Declared (%)"
              value={values.dividendDeclaredPercent}
              onChange={v => set('dividendDeclaredPercent', v)}
              suffix="%"
            />

            <NumberInput
              label="Shares Issued During Year"
              value={values.shareIssuedDuringYear}
              onChange={v => set('shareIssuedDuringYear', v)}
            />
          </div>
        </div>
      </Card>

      {/* ── Section 4: Audit Information ─────────────── */}
      <Card title="Audit Information" padding="md">
        <RequiredNote />
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Auditor Name"
            value={values.auditorName}
            onChange={e => set('auditorName', e.target.value)}
            placeholder="Full name of the engagement auditor"
          />

          <InputField
            label="Audit Firm Name"
            value={values.auditFirmName}
            onChange={e => set('auditFirmName', e.target.value)}
            placeholder="e.g. ABC & Associates, Chartered Accountants"
          />

          <InputField
            label="ICAN Registration Number"
            value={values.icanRegNumber}
            onChange={e => set('icanRegNumber', e.target.value)}
            placeholder="e.g. CA-3456"
          />

          <SelectDropdown
            label="Auditor Position"
            value={values.auditorPosition}
            onChange={e => set('auditorPosition', e.target.value)}
            options={AUDITOR_POSITION_OPTIONS}
            placeholder="Select position…"
          />
        </div>
      </Card>

      {/* ── Server error ──────────────────────────────── */}
      {saveErr && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          <svg className="h-4 w-4 flex-shrink-0 text-red-500" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9"  y1="9" x2="15" y2="15" />
          </svg>
          {saveErr}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-slate-400">
          All fields marked <span className="text-red-500">*</span> are required
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="md" onClick={loadDummyData}>
            Load Dummy Data
          </Button>
          <Button type="submit" variant="primary" size="md" loading={saving}>
            Save and Continue
          </Button>
        </div>
      </div>
    </form>
  );
}
