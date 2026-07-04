import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasCompanyName,
  normalizeCompanyProfile,
  resolveCompanyName,
} from '../../src/utils/companyProfile.js';

describe('companyProfile', () => {
  it('resolves company name from legacy name field', () => {
    assert.equal(resolveCompanyName({ name: 'Acme Ltd' } as any), 'Acme Ltd');
    assert.equal(hasCompanyName({ name: 'Acme Ltd' } as any), true);
  });

  it('prefers companyName over legacy name', () => {
    assert.equal(
      resolveCompanyName({ companyName: 'Primary', name: 'Legacy' } as any),
      'Primary',
    );
  });

  it('normalizes both name fields together', () => {
    const normalized = normalizeCompanyProfile({ id: '1', name: 'Acme Ltd' } as any);
    assert.equal(normalized.companyName, 'Acme Ltd');
    assert.equal(normalized.name, 'Acme Ltd');
  });
});
