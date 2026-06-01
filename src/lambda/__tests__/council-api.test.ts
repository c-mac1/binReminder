import { CouncilApiService } from '../services/council-api';
import { ApiResponse } from '../types';

// Matches the real API response shape we discovered
const mockResponse: ApiResponse = {
  status: 'CollectionDatesFound',
  message: '1 collection date(s) found',
  lastWeek: [],
  thisWeek: [],
  nextWeek: [
    {
      date: '2026-06-08T00:00:00',
      dayOfWeekName: 'Monday',
      bins: [
        { colour: 'Blue', name: 'Recycling bin', colourLabel: 'Blue', capacity: '240L', type: 'BIN', uprn: '123456' },
      ],
    },
  ],
};

function mockFetch(data: unknown, ok = true) {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => Promise.resolve(data),
  } as unknown as Response);
}

afterEach(() => jest.restoreAllMocks());

describe('CouncilApiService', () => {
  it('returns the nextWeek collection', async () => {
    mockFetch(mockResponse);

    const collection = await new CouncilApiService('123456').getNextCollection();

    expect(collection.bins).toHaveLength(1);
    expect(collection.bins[0]).toEqual({ name: 'Recycling bin', colour: 'Blue' });
    expect(collection.date).toEqual(new Date('2026-06-08T00:00:00'));
  });

  it('falls back to thisWeek when nextWeek is empty', async () => {
    mockFetch({
      ...mockResponse,
      thisWeek: [
        {
          date: '2026-06-01T00:00:00',
          dayOfWeekName: 'Monday',
          bins: [{ colour: 'Grey', name: 'General waste bin', colourLabel: 'Grey', capacity: '240L', type: 'BIN', uprn: '123456' }],
        },
      ],
      nextWeek: [],
    });

    const collection = await new CouncilApiService('123456').getNextCollection();

    expect(collection.bins[0].colour).toBe('Grey');
  });

  it('throws when the API returns a non-ok status', async () => {
    mockFetch(null, false);

    await expect(new CouncilApiService('123456').getNextCollection())
      .rejects.toThrow('Council API returned 500');
  });

  it('throws when there are no upcoming collections', async () => {
    mockFetch({ ...mockResponse, nextWeek: [], thisWeek: [] });

    await expect(new CouncilApiService('123456').getNextCollection())
      .rejects.toThrow('No upcoming collection dates found');
  });

  it('maps all four bin colours correctly', async () => {
    mockFetch({
      ...mockResponse,
      nextWeek: [{
        date: '2026-06-08T00:00:00',
        dayOfWeekName: 'Monday',
        bins: [
          { colour: 'Blue',   name: 'Recycling bin',           colourLabel: 'Blue',       capacity: '240L', type: 'BIN',       uprn: '123456' },
          { colour: 'Brown',  name: 'Garden and food waste bin',colourLabel: 'Brown/green',capacity: '240L', type: 'BIN',       uprn: '123456' },
          { colour: 'Yellow', name: 'Glass container',          colourLabel: '',           capacity: '240L', type: 'CONTAINER', uprn: '123456' },
          { colour: 'Grey',   name: 'General waste bin',        colourLabel: 'Grey',       capacity: '240L', type: 'BIN',       uprn: '123456' },
        ],
      }],
    });

    const collection = await new CouncilApiService('123456').getNextCollection();

    expect(collection.bins.map(b => b.colour)).toEqual(['Blue', 'Brown', 'Yellow', 'Grey']);
  });
});
