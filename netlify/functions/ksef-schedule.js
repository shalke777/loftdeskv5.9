// KSeF availability schedule checker
// Test/Demo environment: Mon-Fri 8:00-18:00 Warsaw time
// Production: 24/7 (assumed)

// Polish public holidays (fixed dates) — 2024-2030
const FIXED_HOLIDAYS = [
  '01-01', // Nowy Rok
  '01-06', // Trzech Króli
  '05-01', // Święto Pracy
  '05-03', // Święto Konstytucji 3 Maja
  '08-15', // Wniebowzięcie NMP
  '11-01', // Wszystkich Świętych
  '11-11', // Święto Niepodległości
  '12-25', // Boże Narodzenie I
  '12-26', // Boże Narodzenie II
];

// Easter Sunday dates (pre-computed 2024-2030)
const EASTER_SUNDAYS = {
  2024: '03-31',
  2025: '04-20',
  2026: '04-05',
  2027: '03-28',
  2028: '04-16',
  2029: '04-01',
  2030: '04-21',
};

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(5, 10);
}

function getMovableHolidays(year) {
  const easter = EASTER_SUNDAYS[year];
  if (!easter) return [];
  const fullEaster = `${year}-${easter}`;
  return [
    addDays(fullEaster, 1),  // Poniedziałek Wielkanocny
    addDays(fullEaster, 49), // Zielone Świątki (Zesłanie Ducha Św.)
    addDays(fullEaster, 60), // Boże Ciało
  ];
}

function isPolishHoliday(date) {
  const mmdd = (date.getMonth() + 1).toString().padStart(2, '0') + '-' + date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  if (FIXED_HOLIDAYS.includes(mmdd)) return true;
  const movable = getMovableHolidays(year);
  return movable.includes(mmdd);
}

/**
 * Check if KSeF test/demo environment is available right now.
 * Production is assumed 24/7.
 * @param {string} env - 'demo' | 'test' | 'prod'
 * @returns {{ available: boolean, reason?: string, nextAvailable?: string }}
 */
function checkKsefAvailability(env) {
  if (env === 'prod') {
    return { available: true };
  }

  // Get current Warsaw time
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value])
  );

  const hour = parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);
  const weekday = parts.weekday; // Mon, Tue, Wed, Thu, Fri, Sat, Sun

  // Reconstruct date in Warsaw timezone for holiday check
  const warsawDate = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00`);

  // Weekend check
  if (weekday === 'Sat' || weekday === 'Sun') {
    return {
      available: false,
      reason: 'Środowisko testowe KSeF jest wyłączone w weekendy.',
      nextAvailable: getNextAvailableTime(warsawDate, weekday),
    };
  }

  // Holiday check
  if (isPolishHoliday(warsawDate)) {
    return {
      available: false,
      reason: 'Środowisko testowe KSeF jest wyłączone w święta państwowe.',
      nextAvailable: getNextAvailableTime(warsawDate, weekday),
    };
  }

  // Hours check: 8:00-18:00
  if (hour < 8) {
    return {
      available: false,
      reason: `Środowisko testowe KSeF dostępne od 8:00 (teraz ${hour}:${minute.toString().padStart(2, '0')}).`,
      nextAvailable: `dziś o 8:00`,
    };
  }

  if (hour >= 18) {
    return {
      available: false,
      reason: `Środowisko testowe KSeF zamknięte po 18:00 (teraz ${hour}:${minute.toString().padStart(2, '0')}).`,
      nextAvailable: getNextAvailableTime(warsawDate, weekday),
    };
  }

  return { available: true };
}

function getNextAvailableTime(warsawDate, weekday) {
  const dayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const dayNum = dayMap[weekday];

  if (dayNum === 5) return 'poniedziałek 8:00'; // Friday evening → Monday
  if (dayNum === 6) return 'poniedziałek 8:00'; // Saturday → Monday
  if (dayNum === 0) return 'poniedziałek 8:00'; // Sunday → Monday
  return 'jutro o 8:00'; // Mon-Thu evening → next day
}

module.exports = { checkKsefAvailability, isPolishHoliday };
