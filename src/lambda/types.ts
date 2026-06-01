export interface ApiBin {
  colour: string;       // e.g. "Blue", "Grey", "Brown", "Yellow"
  name: string;         // e.g. "Recycling bin"
  colourLabel: string;
  capacity: string;
  type: string;
  uprn: string;
}

export interface ApiCollectionDate {
  date: string;         // e.g. "2026-06-08T00:00:00"
  dayOfWeekName: string;
  bins: ApiBin[];
}

export interface ApiResponse {
  status: string;
  message: string;
  lastWeek: ApiCollectionDate[];
  thisWeek: ApiCollectionDate[];
  nextWeek: ApiCollectionDate[];
}

// Our clean internal representation — used throughout the app after parsing.
export interface Collection {
  date: Date;
  bins: Bin[];
}

export interface Bin {
  name: string;
  colour: BinColour;
}

// Union type: TypeScript enforces only these four values are ever used.
export type BinColour = 'Blue' | 'Grey' | 'Brown' | 'Yellow';
