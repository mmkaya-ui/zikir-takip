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

export type DynamicSettings = {
  dhikrName: string;
  target: number;
  resetHour: number;
};

export async function getSettings(doc: GoogleSpreadsheet): Promise<DynamicSettings> {
  const settingsTabTitle = 'Ayarlar';
  let sheet = doc.sheetsByTitle[settingsTabTitle];

  // Default values
  let target = 100000;
  let resetHour = 22;

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
      { 'Ayar Adı': 'Hedef', 'Değer': target, 'Açıklama': 'Günlük zikir hedefi (Sayısal)' },
      { 'Ayar Adı': 'Sıfırlama Saati', 'Değer': resetHour, 'Açıklama': 'Günlük sıfırlanma saati (örn: 22)' }
    ]);
  } else {
    // Olan ayarları oku
    const rows = await sheet.getRows();
    rows.forEach(row => {
      const ayarAdi = row.get('Ayar Adı');
      const deger = row.get('Değer');
      if (ayarAdi === 'Hedef' && deger) {
        const parsedTarget = parseInt(deger, 10);
        if (!isNaN(parsedTarget)) target = parsedTarget;
      }
      if (ayarAdi === 'Sıfırlama Saati' && deger) {
        const parsedHour = parseInt(deger, 10);
        if (!isNaN(parsedHour) && parsedHour >= 0 && parsedHour <= 23) {
          resetHour = parsedHour;
        }
      }
    });
  }

  // Fallback to "Zikir Takip" if doc title is missing or empty
  const dhikrName = doc.title || 'Zikir Takip';

  return { target, resetHour, dhikrName };
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

export async function getSheet(doc: GoogleSpreadsheet, resetHour: number) {
  const effectiveDate = getEffectiveDate(resetHour);

  // Bugünün tarihiyle sheet tab'ı var mı?
  let sheet = doc.sheetsByTitle[effectiveDate];

  if (!sheet) {
    // Yoksa yeni tab oluştur
    sheet = await doc.addSheet({
      title: effectiveDate,
      headerValues: ['Tarih', 'İsim', 'Adet', 'Zaman'],
    });

    // G1'e label, G2'ye SUM formülü ekle
    await sheet.loadCells('G1:G2');
    const g1 = sheet.getCellByA1('G1');
    const g2 = sheet.getCellByA1('G2');
    g1.value = 'Toplam';
    g2.formula = '=SUM(C2:C10000)';
    await sheet.saveUpdatedCells();
  }

  return sheet;
}

export type Reading = {
  name: string;
  count: number;
  date: string; // YYYY-MM-DD
  timestamp: string;
}

export async function addReading(name: string, count: number) {
  const doc = await getDoc();
  const settings = await getSettings(doc);
  const sheet = await getSheet(doc, settings.resetHour);
  const date = getEffectiveDate(settings.resetHour);
  const timestamp = new Date().toISOString();

  await sheet.addRow({
    'Tarih': `'${date}`,
    'İsim': name,
    'Adet': count,
    'Zaman': timestamp,
  });
}

export async function getDailyTotal(): Promise<{ total: number, date: string, userCounts: Record<string, number>, settings: DynamicSettings }> {
  const doc = await getDoc();
  const settings = await getSettings(doc);
  const sheet = await getSheet(doc, settings.resetHour);
  const effectiveDate = getEffectiveDate(settings.resetHour);

  // G2 hücresindeki SUM formülünü oku — bu sheet sadece bugünün verilerini içerir
  await sheet.loadCells('G2');
  const g2Value = sheet.getCellByA1('G2').value;

  let total = 0;
  if (typeof g2Value === 'number') {
    total = g2Value;
  }

  // Kullanıcı bazlı dağılım (Smart Correction için gerekli)
  const rows = await sheet.getRows();
  const userCounts: Record<string, number> = {};
  let calculatedTotal = 0;

  rows.forEach(row => {
    const countVal = row.get('Adet');
    const count = parseInt(countVal || '0', 10);
    const name = row.get('İsim') || 'Anonim';

    if (!isNaN(count)) {
      calculatedTotal += count;
      userCounts[name] = (userCounts[name] || 0) + count;
    }
  });

  // G2 boşsa/geçersizse satırlardan hesapla
  if (typeof g2Value !== 'number') {
    total = calculatedTotal;
  }

  return { total, date: effectiveDate, userCounts, settings };
}

