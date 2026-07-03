// src/pages/CompanySetupPage.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import Tabs from '../components/ui/Tabs';
import CompanyInfoForm from '../components/company/CompanyInfoForm';
import AccountingPoliciesForm from '../components/company/AccountingPoliciesForm';
import PreviousYearData from '../components/company/PreviousYearData';
import { companyApi } from '../api/client';
import { getFiscalYear } from '../data/fiscalYears';
import type { CompanyProfile, PreviousYearBalances } from '../types';

type TabId = 'info' | 'policies' | 'previous';

const TABS = [
  { id: 'info', label: 'Company Information' },
  { id: 'policies', label: 'Accounting Policies' },
  { id: 'previous', label: 'Previous Year Data' },
];

export default function CompanySetupPage() {
  const { state, dispatch } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabId>(
    state.currentStep === 'accounting_policies' ? 'policies' : 'info'
  );

  const handleSaveCompanyInfo = async (formData: any) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const fiscalYear = getFiscalYear(formData.fiscalYear || '2081/82') ?? {
        bsYear: '2081/82',
        startDateBS: '1 Shrawan 2081',
        endDateBS: '31 Ashadh 2082',
        startDateAD: 'July 16, 2024',
        endDateAD: 'July 15, 2025',
        startYear: 2024,
        endYear: 2025,
        isLeapYear: false,
      };

      const profileData: Partial<CompanyProfile> = {
        companyName: formData.companyName,
        panVatNumber: formData.panVatNumber,
        registrationNumber: formData.registrationNumber,
        companyType: formData.companyType || 'PrivateLimited',
        entityType: formData.entityType || 'NASForMEs',
        province: formData.province,
        district: formData.district,
        municipality: formData.municipality,
        fullAddress: formData.fullAddress,
        chairperson: formData.chairperson,
        director: formData.director,
        accountsHead: formData.accountsHead,
        fiscalYear,
        auditorInfo: {
          auditorName: formData.auditorName || '',
          auditorFirmName: formData.auditFirmName || '',
          position: formData.auditorPosition || '',
          icanRegNumber: formData.icanRegNumber || '',
        },
        accountingPolicies: state.company?.accountingPolicies ?? {
          depreciationMethod: 'StraightLine',
          inventoryCostMethod: 'WeightedAverage',
          incomeTaxRatePercent: 25,
          roundingLevel: 100,
          bonusRatePercent: 10,
          gratuityDaysPerYear: 15,
          assetCategories: [],
        },
      };

      // ── Step 1: Save to local state immediately so the app advances
      //    regardless of whether the backend is reachable.
      const existingId = state.company?.id;
      const localId    = existingId ?? `local-${Date.now()}`;
      const localCompany: CompanyProfile = {
        ...(state.company ?? {}),
        ...profileData,
        id: localId,
      } as CompanyProfile;

      dispatch({ type: 'SET_COMPANY',    payload: localCompany });
      dispatch({ type: 'COMPLETE_STEP',  payload: 'company_setup' });
      setActiveTab('policies');
      dispatch({ type: 'SET_STEP',       payload: 'accounting_policies' });

      // ── Step 2: Persist to backend in the background (non-blocking)
      try {
        let savedCompany: CompanyProfile;
        if (existingId && !existingId.startsWith('local-')) {
          savedCompany = await companyApi.update(existingId, profileData);
        } else {
          savedCompany = await companyApi.create(profileData);
        }
        // Replace local placeholder id with the real server id
        dispatch({ type: 'SET_COMPANY', payload: savedCompany });
      } catch {
        dispatch({ type: 'SET_ERROR', payload: 'Could not reach the server to save your company profile. Your progress is stored locally only — if you refresh the page or the server restarts, this data will be lost. Please check your connection.' });
      }
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err?.message ?? 'Failed to save company details.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleSavePolicies = async (formData: any) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const policies = {
        depreciationMethod: formData.defaultDepnMethod || 'StraightLine',
        inventoryCostMethod: formData.inventoryMethod || 'WeightedAverage',
        incomeTaxRatePercent: typeof formData.taxRate === 'number' ? formData.taxRate : 25,
        roundingLevel: parseInt(formData.roundingLevel) || 100,
        bonusRatePercent: typeof formData.bonusRate === 'number' ? formData.bonusRate : 10,
        gratuityDaysPerYear: formData.gratuityDays || 15,
        recognizeGratuity: formData.recognizeGratuity ?? true,
        recognizeLeaveEncashment: formData.recognizeLeave ?? true,
        hasGratuityLiability: formData.recognizeGratuity ?? true,
        hasLeaveEncashment: formData.recognizeLeave ?? true,
        assetCategories: formData.categories?.map((c: any) => ({
          id: c.id,
          name: c.name,
          defaultMethod: c.method === 'WDV' ? 'WrittenDownValue' : 'StraightLine',
          defaultUsefulLife: c.usefulLife,
          defaultWDVRate: c.wdvRate,
          defaultResidualPct: c.residualPct,
        })) ?? [],
      };

      // Advance locally first — no API dependency
      const updatedCompany: CompanyProfile = {
        ...state.company!,
        accountingPolicies: policies,
      };
      dispatch({ type: 'SET_COMPANY',   payload: updatedCompany });
      dispatch({ type: 'COMPLETE_STEP', payload: 'accounting_policies' });
      dispatch({ type: 'SET_STEP',      payload: 'trial_balance_upload' });

      // Background persist
      try {
        if (state.company?.id && !state.company.id.startsWith('local-')) {
          await companyApi.update(state.company.id, { accountingPolicies: policies } as any);
        }
      } catch {
        dispatch({ type: 'SET_ERROR', payload: 'Could not reach the server to save your company profile. Your progress is stored locally only — if you refresh the page or the server restarts, this data will be lost. Please check your connection.' });
      }
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err?.message ?? 'Failed to save accounting policies.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleSavePreviousYear = async (data: PreviousYearBalances) => {
    try {
      const updatedCompany: CompanyProfile = {
        ...state.company!,
        previousYearData: data,
      };
      dispatch({ type: 'SET_COMPANY', payload: updatedCompany });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err?.message ?? 'Failed to save previous year data.' });
    }
  };

  return (
    <div className="max-w-4xl">
      <Tabs
        tabs={TABS}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        variant="line"
        className="mb-6"
      />

      <div className="page-enter">
        {activeTab === 'info' && (
          <CompanyInfoForm
            initialData={state.company ? {
              companyName: state.company.companyName,
              panVatNumber: state.company.panVatNumber || '',
              registrationNumber: state.company.registrationNumber || '',
              companyType: state.company.companyType || '',
              entityType: state.company.entityType || 'NASForMEs',
              province: state.company.province || '',
              district: state.company.district || '',
              municipality: state.company.municipality || '',
              fullAddress: state.company.fullAddress || '',
              chairperson: state.company.chairperson || '',
              director: state.company.director || '',
              accountsHead: state.company.accountsHead || '',
              auditorName: state.company.auditorInfo?.auditorName || '',
              auditFirmName: state.company.auditorInfo?.auditorFirmName || '',
              auditorPosition: state.company.auditorInfo?.position || '',
              icanRegNumber: state.company.auditorInfo?.icanRegNumber || '',
              contactPerson: state.company.contactPerson || '',
              designation: state.company.designation || '',
              phone: state.company.phone || '',
              email: state.company.email || '',
              wardNumber: state.company.wardNumber || '',
              tole: state.company.tole || '',
            } : undefined}
            onSave={handleSaveCompanyInfo}
          />
        )}

        {activeTab === 'policies' && (
          <AccountingPoliciesForm
            initialData={state.company?.accountingPolicies}
            onSave={handleSavePolicies}
          />
        )}

        {activeTab === 'previous' && (
          <PreviousYearData
            initialData={state.company?.previousYearData}
            onSave={handleSavePreviousYear}
          />
        )}
      </div>
    </div>
  );
}
