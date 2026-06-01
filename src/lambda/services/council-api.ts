import { ApiResponse, BinColour, Collection } from '../types';

const API_BASE_URL = 'https://ardsandnorthdownbincalendar.azurewebsites.net/api/collectiondates';

export class CouncilApiService {
  constructor(private readonly uprn: string) {}

  async getNextCollection(): Promise<Collection> {
    const response = await fetch(`${API_BASE_URL}/${this.uprn}`);

    if (!response.ok) {
      throw new Error(`Council API returned ${response.status}: ${response.statusText}`);
    }

    const data: ApiResponse = await response.json();

    // Lambda runs Sunday evening — nextWeek is Monday's collection (the one we're reminding about).
    // Fall back to thisWeek if nextWeek is empty.
    const upcoming = data.nextWeek[0] ?? data.thisWeek[0];

    if (!upcoming) {
      throw new Error('No upcoming collection dates found');
    }

    return {
      date: new Date(upcoming.date),
      bins: upcoming.bins.map(b => ({
        name: b.name,
        colour: parseBinColour(b.colour),
      })),
    };
  }
}

function parseBinColour(colour: string): BinColour {
  const lower = colour.toLowerCase();
  if (lower.includes('blue')) return 'Blue';
  if (lower.includes('brown')) return 'Brown';
  if (lower.includes('yellow')) return 'Yellow';
  return 'Grey';
}
