import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Config variables
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
// Support both variable names to be safe
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

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

// --- Memory Caching to prevent Google Sheets 429 Rate Limits ---
const CACHE_TTL_MS = 60 * 1000; // 1 minute

let cachedDoc: GoogleSpreadsheet | null = null;
let docCacheTime = 0;

let cachedSettings: DynamicSettings | null = null;
let settingsCacheTime = 0;

let cachedSheet: any = null;
let sheetCacheTime = 0;
let lastSheetDate = '';

export async function getDoc() {
  if (cachedDoc && Date.now() - docCacheTime < CACHE_TTL_MS) {
    return cachedDoc;
  }
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
    cachedDoc = doc;
    docCacheTime = Date.now();
    return doc;
  } catch (error) {
    console.error('❌ Google Sheets Connection Failed:', error);
    throw error;
  }
}

export type DhikrDef = {
  id: string;
  name: string;
  target: number;
};

export type DynamicSettings = {
  dhikrs: DhikrDef[];
  resetHour: number;
};

export async function getSettings(doc: GoogleSpreadsheet): Promise<DynamicSettings> {
  if (cachedSettings && Date.now() - settingsCacheTime < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const settingsTabTitle = 'Ayarlar';
  let sheet = doc.sheetsByTitle[settingsTabTitle];

  let resetHour = 22;
  const dhikrsMap = new Map<string, DhikrDef>();

  if (!sheet) {
    // Yoksa yeni tab oluştur
    sheet = await doc.addSheet({
      title: settingsTabTitle,
      headerValues: ['Ayar Adı', 'Değer', 'Açıklama'],
      gridProperties: {
        rowCount: 50,
        columnCount: 3
      }
    });

    await sheet.addRows([
      { 'Ayar Adı': 'Zikir 1 Adı', 'Değer': doc.title || 'Zikir Takip', 'Açıklama': 'Ekranda görünecek 1. zikir adı' },
      { 'Ayar Adı': 'Zikir 1 Hedef', 'Değer': 100000, 'Açıklama': '1. Zikir için günlük hedef' },
      { 'Ayar Adı': 'Sıfırlama Saati', 'Değer': 22, 'Açıklama': 'Günlük sıfırlanma saati (örn: 22)' }
    ]);
  } else {
    // Olan ayarları oku
    const rows = await sheet.getRows();
    rows.forEach((row: any) => {
      const ayarAdi = String(row.get('Ayar Adı') || '').trim();
      const deger = row.get('Değer');
      
      if (ayarAdi === 'Sıfırlama Saati' && deger) {
        const parsedHour = parseInt(deger, 10);
        if (!isNaN(parsedHour) && parsedHour >= 0 && parsedHour <= 23) {
          resetHour = parsedHour;
        }
      } else if (ayarAdi === 'Hedef' && deger) { // Legacy fallback
          const target = parseInt(deger, 10) || 100000;
          if (!dhikrsMap.has('1')) dhikrsMap.set('1', { id: '1', name: 'Zikir Takip', target });
          else dhikrsMap.get('1')!.target = target;
      } else if (ayarAdi === 'Zikir Adı' && deger) { // Legacy fallback
          const name = String(deger);
          if (!dhikrsMap.has('1')) dhikrsMap.set('1', { id: '1', name, target: 100000 });
          else dhikrsMap.get('1')!.name = name;
      } else {
        // Match Zikir X Adı or Zikir X Hedef
        const nameMatch = ayarAdi.match(/Zikir\s+(\d+)\s+Ad[ıi]/i);
        if (nameMatch && deger) {
           const id = nameMatch[1];
           if (!dhikrsMap.has(id)) dhikrsMap.set(id, { id, name: String(deger), target: 100000 });
           else dhikrsMap.get(id)!.name = String(deger);
        }
        
        const targetMatch = ayarAdi.match(/Zikir\s+(\d+)\s+Hedef/i);
        if (targetMatch && deger) {
           const id = targetMatch[1];
           const target = parseInt(deger, 10) || 100000;
           if (!dhikrsMap.has(id)) dhikrsMap.set(id, { id, name: `Zikir ${id}`, target });
           else dhikrsMap.get(id)!.target = target;
        }
      }
    });
  }

  // Ensure at least one dhikr exists if it was empty
  if (dhikrsMap.size === 0) {
    dhikrsMap.set('1', { id: '1', name: doc.title || 'Zikir Takip', target: 100000 });
  }

  const dhikrs = Array.from(dhikrsMap.values()).sort((a, b) => parseInt(a.id) - parseInt(b.id));

  cachedSettings = { dhikrs, resetHour };
  settingsCacheTime = Date.now();

  return cachedSettings;
}

// Helper to get "Effective Date" string YYYY-MM-DD
// Logic: Always use Turkey Time (Europe/Istanbul).
// If TRT hour is >= resetHour, it counts as "tomorrow".
export function getEffectiveDate(resetHour: number): string {
  // 1. Get current time in Turkey
  const trtNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));

  // 2. Check hour in TRT
  const hour = trtNow.getHours();

  // 3. If >= resetHour, move to next day
  if (hour >= resetHour) {
    trtNow.setDate(trtNow.getDate() + 1);
  }

  // 4. Return YYYY-MM-DD format
  const year = trtNow.getFullYear();
  const month = String(trtNow.getMonth() + 1).padStart(2, '0');
  const day = String(trtNow.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export async function getSheet(doc: GoogleSpreadsheet, settings: DynamicSettings) {
  const effectiveDate = getEffectiveDate(settings.resetHour);

  if (cachedSheet && lastSheetDate === effectiveDate && Date.now() - sheetCacheTime < CACHE_TTL_MS) {
    return cachedSheet;
  }

  // Bugünün tarihiyle sheet tab'ı var mı?
  let sheet = doc.sheetsByTitle[effectiveDate];

  if (!sheet) {
    // Yoksa yeni tab oluştur
    sheet = await doc.addSheet({
      title: effectiveDate,
      headerValues: ['Tarih', 'İsim', 'Adet', 'Zaman', 'Zikir Türü'],
    });

    // Add dynamic Toplam formulas starting from column J
    if (settings.dhikrs && settings.dhikrs.length > 0) {
      const cols = ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
      const maxDhikrs = Math.min(settings.dhikrs.length, cols.length);
      const endCol = cols[maxDhikrs - 1];
      
      await sheet.loadCells(`J1:${endCol}2`);
      
      for (let i = 0; i < maxDhikrs; i++) {
        const dhikr = settings.dhikrs[i];
        const colLetter = cols[i];
        const headerCell = sheet.getCellByA1(`${colLetter}1`);
        const formulaCell = sheet.getCellByA1(`${colLetter}2`);
        
        headerCell.value = `Toplam Zikir ${dhikr.id}`;
        // E is Zikir Türü, C is Adet
        formulaCell.formula = `=SUMIF(E2:E10000, "${dhikr.id}", C2:C10000)`;
      }
      await sheet.saveUpdatedCells();
    }
  } else {
    // Eğer sheet zaten varsa (eski sistemden kalmışsa), "Zikir Türü" başlığını kontrol et ve ekle.
    try {
      await sheet.loadHeaderRow();
      if (!sheet.headerValues.includes('Zikir Türü')) {
         const newHeaders = [...sheet.headerValues, 'Zikir Türü'];
         await sheet.setHeaderRow(newHeaders);
      }
    } catch(e) {
       // Ignore if sheet is completely empty and throws header error
    }
  }

  cachedSheet = sheet;
  lastSheetDate = effectiveDate;
  sheetCacheTime = Date.now();

  return sheet;
}

export type Reading = {
  name: string;
  count: number;
  date: string; // YYYY-MM-DD
  timestamp: string;
  dhikrId?: string;
}

export async function addReading(name: string, count: number, dhikrId: string = '1') {
  const doc = await getDoc();
  const settings = await getSettings(doc);
  const sheet = await getSheet(doc, settings);
  const date = getEffectiveDate(settings.resetHour);
  const timestamp = new Date().toISOString();

  await sheet.addRow({
    'Tarih': `'${date}`,
    'İsim': name,
    'Adet': count,
    'Zaman': timestamp,
    'Zikir Türü': dhikrId,
  });
}

export async function getDailyTotal(): Promise<{ 
  totals: Record<string, number>, 
  date: string, 
  userCounts: Record<string, Record<string, number>>, 
  settings: DynamicSettings 
}> {
  const doc = await getDoc();
  const settings = await getSettings(doc);
  const sheet = await getSheet(doc, settings);
  const effectiveDate = getEffectiveDate(settings.resetHour);

  const rows = await sheet.getRows();
  const totals: Record<string, number> = {};
  const userCounts: Record<string, Record<string, number>> = {};

  // Initialize with 0s based on defined dhikrs
  settings.dhikrs.forEach(d => {
      totals[d.id] = 0;
      userCounts[d.id] = {};
  });

  rows.forEach((row: any) => {
    const countVal = row.get('Adet');
    const count = parseInt(countVal || '0', 10);
    const name = row.get('İsim') || 'Anonim';
    let dhikrId = String(row.get('Zikir Türü') || '').trim();
    
    // Default to first dhikr if empty or undefined
    if (!dhikrId) {
        dhikrId = settings.dhikrs.length > 0 ? settings.dhikrs[0].id : '1';
    }

    if (!totals[dhikrId]) totals[dhikrId] = 0;
    if (!userCounts[dhikrId]) userCounts[dhikrId] = {};

    if (!isNaN(count)) {
      totals[dhikrId] += count;
      userCounts[dhikrId][name] = (userCounts[dhikrId][name] || 0) + count;
    }
  });

  return { totals, date: effectiveDate, userCounts, settings };
}

