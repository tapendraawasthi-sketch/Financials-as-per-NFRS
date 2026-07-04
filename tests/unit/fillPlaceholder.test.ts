import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fillNumericPlaceholder, fillPlaceholder } from '../../src/utils/fillPlaceholder.js';

describe('fillPlaceholder', () => {
  it('returns bracketed hint when value is empty', () => {
    assert.equal(fillPlaceholder('PAN', ''), '(Fill PAN)');
    assert.equal(fillPlaceholder('PAN', '   '), '(Fill PAN)');
    assert.equal(fillPlaceholder('PAN', null), '(Fill PAN)');
  });

  it('returns the trimmed value when present', () => {
    assert.equal(fillPlaceholder('PAN', ' 123456789 '), '123456789');
  });

  it('preserves numeric zero in fillNumericPlaceholder', () => {
    assert.equal(fillNumericPlaceholder('Number of Employees', 0), 0);
    assert.equal(fillNumericPlaceholder('Number of Employees', null), '(Fill Number of Employees)');
  });
});
