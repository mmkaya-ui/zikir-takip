import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Config variables
// Config variables
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
// Support both variable names to be safe
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

// Robust Private Key Parser
// Robust Private Key Parser
const getPrivateKey = () => {
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!key) return undefined;

  // Strategy 1: Base64 Encoded (Best for Vercel)
  // If it doesn't start with -----BEGIN, try decoding
  if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf-8');
      if (decoded.includes('-----BEGIN PRIVATE KEY-----')) {
        return decoded;
      }
    } catch (e) {
      // Not base64, continue
    }
  }

  // Strategy 2: Clean Multiline
  if (key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('\n')) {
    return key;
  }

  // Strategy 3: Literal \n replacement
  return key.replace(/\\n/g, '\n');
};

const GOOGLE_PRIVATE_KEY = getPrivateKey();

// Initialize auth - using JWT for server-side auth
// Moved inside getDoc to be stateless
// const serviceAccountAuth = ...

// Removed global doc variable to prevent stale data/headers in serverless warm starts
// let doc: GoogleSpreadsheet | null = null;

export async function getDoc() {
  // Always create valid auth
  const serviceAccountAuth = new JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });

  if (!SPREADSHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.error('❌ Google Sheets Credentials Missing!');
    throw new Error('Google Sheets credentials are not set');
  }

  try {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    return doc;
  } catch (error) {
    console.error('❌ Google Sheets Connection Failed:', error);
    throw error;
  }
}

export async function getSheet() {
  const doc = await getDoc();
  return doc.sheetsByIndex[0]; // Assume first sheet
}

// Helper to get "Effective Date" string YYYY-MM-DD
// Logic: Always use Turkey Time (Europe/Istanbul).
// If TRT hour is >= 22:00, it counts as "tomorrow".
export function getEffectiveDate(): string {
  // 1. Get current time in Turkey
  const trtNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));

  // 2. Check hour in TRT
  const hour = trtNow.getHours();

  // 3. If >= 22:00, move to next day
  if (hour >= 22) {
    trtNow.setDate(trtNow.getDate() + 1);
  }

  // 4. Return YYYY-MM-DD format
  // We use reliable formatting to avoid timezone shifts during string conversion
  const year = trtNow.getFullYear();
  const month = String(trtNow.getMonth() + 1).padStart(2, '0');
  const day = String(trtNow.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export type Reading = {
  name: string;
  count: number;
  date: string; // YYYY-MM-DD
  timestamp: string;
}

export async function addReading(name: string, count: number) {
  const sheet = await getSheet();
  const date = getEffectiveDate();
  const timestamp = new Date().toISOString();

  // Using Turkish Headers: Tarih, İsim, Adet, Zaman
  // We prepend a single quote to Date to force Google Sheets to treat it as a string
  await sheet.addRow({
    'Tarih': `'${date}`,
    'İsim': name,
    'Adet': count,
    'Zaman': timestamp,
  });
}

export async function getDailyTotal(): Promise<{ total: number, date: string, userCounts: Record<string, number> }> {
  const sheet = await getSheet();
  const effectiveDate = getEffectiveDate();

  // Load rows for user-specific breakdown (Smart Correction)
  const rows = await sheet.getRows();

  // Load G2 cell for the trustworthy Total (User's Formula)
  await sheet.loadCells('G2');
  const g2Value = sheet.getCellByA1('G2').value;

  let total = 0;
  // If G2 has a valid number, use it as the source of truth for Total
  if (typeof g2Value === 'number') {
    total = g2Value;
  }

  const userCounts: Record<string, number> = {};

  // We still need to parse rows to know "Who added what TODAY" for the safety checks.
  // This logic ensures 'userCounts' is strictly based on the app's filtered date.
  let calculatedTotalFromRows = 0;

  rows.forEach(row => {
    // Get date from 'Tarih' column
    const rowDate = row.get('Tarih');

    let match = false;
    if (rowDate) {
      // Robust date matching
      const cleanRowDate = rowDate.toString().replace(/'/g, '').trim();

      if (cleanRowDate === effectiveDate) match = true;

      if (!match && cleanRowDate.includes('.')) {
        const parts = cleanRowDate.split('.');
        if (parts.length === 3) {
          const reordered = `${parts[2]}-${parts[1]}-${parts[0]}`;
          if (reordered === effectiveDate) match = true;
        }
      }

      if (!match && cleanRowDate.includes('/')) {
        const parts = cleanRowDate.split('/');
        if (parts.length === 3) {
          const reordered = `${parts[2]}-${parts[1]}-${parts[0]}`;
          if (reordered === effectiveDate) match = true;
        }
      }
    }

    if (match) {
      let countVal = row.get('Adet');
      if (!countVal) countVal = row.get('Okunan Sayi');
      if (!countVal) countVal = row.get('Count');

      const count = parseInt(countVal || '0', 10);
      const name = row.get('İsim') || row.get('Name') || 'Anonim';

      if (!isNaN(count)) {
        calculatedTotalFromRows += count;
        // Aggregate per user
        userCounts[name] = (userCounts[name] || 0) + count;
      }
    }
  });

  // Fallback: If G2 was empty/invalid, use the calculated total from rows
  if (typeof g2Value !== 'number') {
    total = calculatedTotalFromRows;
  }

  return { total, date: effectiveDate, userCounts };
}
