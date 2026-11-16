import { parseAmountToCents } from '@subtracker/contracts';
import { centsToInput, formatMoney } from '../format';

describe('format', () => {
  it('convertit les montants saisis en centimes et inversement', () => {
    expect(parseAmountToCents('12,99')).toBe(1299);
    expect(parseAmountToCents('12.5')).toBe(1250);
    expect(parseAmountToCents('abc')).toBeNull();
    expect(centsToInput(1099)).toBe('10,99');
  });

  it('formate en euros à la française', () => {
    expect(formatMoney(1099).replace(/\s/g, ' ')).toBe('10,99 €');
  });
});
