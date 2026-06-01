import { formatMessage } from '../handler';
import { Bin } from '../types';

describe('formatMessage', () => {
  it('formats a single bin', () => {
    const bins: Bin[] = [{ name: 'Recycling bin', colour: 'Blue' }];
    const date = new Date('2026-06-08T00:00:00');

    const message = formatMessage(bins, date);

    expect(message).toContain('♻️ Bin Reminder');
    expect(message).toContain('🔵 Recycling bin');
    expect(message).toContain('Monday');
    expect(message).toContain('8 June');
  });

  it('formats multiple bins', () => {
    const bins: Bin[] = [
      { name: 'Garden and food waste bin', colour: 'Brown' },
      { name: 'Glass container', colour: 'Yellow' },
      { name: 'General waste bin', colour: 'Grey' },
    ];
    const date = new Date('2026-06-01T00:00:00');

    const message = formatMessage(bins, date);

    expect(message).toContain('🟤 Garden and food waste bin');
    expect(message).toContain('🟡 Glass container');
    expect(message).toContain('⚫ General waste bin');
  });

  it('includes the Date: label', () => {
    const bins: Bin[] = [{ name: 'Recycling bin', colour: 'Blue' }];
    const message = formatMessage(bins, new Date('2026-06-08T00:00:00'));

    expect(message).toContain('Date:');
  });
});
