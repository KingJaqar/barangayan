export type IdDetails = { fullName: string; idNumber: string; birthDate: string; address: string };

/** Conservative label-based extraction: unknown values remain blank for review.
 * No profile data is substituted for text actually present on the front photo. */
export function parseIdText(text: string): IdDetails {
  const details = extractIdFields(text);
  return { fullName: details.fullName.slice(0, 200), idNumber: details.idNumber.slice(0, 200), birthDate: normalizeBirthDate(details.birthDate), address: details.address.slice(0, 1000) };
}

/** Web suggestions reject excessive/uncertain values without changing old clients. */
export function parseIdTextSuggestions(text: string): { details: IdDetails; warnings: string[] } {
  const details = extractIdFields(text);
  const warnings: string[] = [];
  for (const [key, label, limit] of [['fullName', 'Full name', 200], ['idNumber', 'ID number', 200], ['address', 'Address', 1000]] as const) {
    if (details[key].length > limit) { details[key] = ''; warnings.push(`${label} could not be suggested within its field limit. Enter it manually.`); }
  }
  const numeric = details.birthDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  const ambiguous = numeric && Number(numeric[1]) <= 12 && Number(numeric[2]) <= 12 && Number(numeric[1]) !== Number(numeric[2]);
  const monthName = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const recognizable = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(details.birthDate) || numeric || new RegExp(`^(?:\\d{1,2} ${monthName}|${monthName} \\d{1,2}),? \\d{4}$`, 'i').test(details.birthDate);
  const birth = !recognizable || ambiguous ? '' : normalizeBirthDate(details.birthDate);
  if (details.birthDate && !birth) warnings.push('Birthday could not be read reliably. Choose it manually if shown on your ID.');
  details.birthDate = birth;
  return { details, warnings };
}

function extractIdFields(text: string): IdDetails {
  const lines = text.split(/\r?\n/).map(line => line.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const labels = {
    fullName: /^(?:full name|name|pangalan|pangalan\s*\/\s*name)\s*[:.-]?\s*/i,
    surname: /^(?:last name|surname|apelyido)(?:\s*\/\s*(?:last name|surname|apelyido))?\s*[:.-]?\s*/i,
    given: /^(?:first name|given names?|mga pangalan)(?:\s*\/\s*(?:first name|given names?|mga pangalan))?\s*[:.-]?\s*/i,
    middle: /^(?:middle name|gitnang apelyido|gitnang pangalan)(?:\s*\/\s*(?:middle name|gitnang apelyido|gitnang pangalan))?\s*[:.-]?\s*/i,
    birthDate: /^(?:date of birth|birth date|birthday|dob|petsa ng kapanganakan)(?:\s*\/\s*(?:date of birth|petsa ng kapanganakan))?\s*[:.-]?\s*/i,
    address: /^(?:address|tirahan)(?:\s*\/\s*(?:address|tirahan))?\s*[:.-]?\s*/i,
    idNumber: /^(?:passport (?:no\.?|number)|licen[sc]e (?:no\.?|number)|id (?:no\.?|number)|card (?:no\.?|number)|(?:philhealth|tin|sss|gsis|psn|pcn|crn)(?:\s*(?:no\.?|number))?)\s*[:.-]?\s*/i,
  };
  const anyLabel = (line: string) => Object.values(labels).some(pattern => pattern.test(line)) || /^(?:sex|gender|nationality|citizenship|expiry|expiration|date of issue|place of birth|signature|blood type)\b/i.test(line);
  function field(pattern: RegExp, multiline = false) {
    const index = lines.findIndex(line => pattern.test(line));
    if (index < 0) return '';
    const inline = lines[index]!.replace(pattern, '').trim();
    const values = inline ? [inline] : [];
    for (let i = index + 1; i < lines.length && values.length < (multiline ? 3 : 1); i++) {
      const line = lines[i]!;
      if (anyLabel(line)) break;
      values.push(line);
    }
    return values.join(' ');
  }
  // Driver's licenses commonly print one combined name label, then surname,
  // first name and middle name together on the following line.
  const groupedName = lines.findIndex(line => /^last name,?\s*first name,?\s*middle name/i.test(line));
  const grouped = groupedName >= 0 && !anyLabel(lines[groupedName + 1] ?? '') ? lines[groupedName + 1] ?? '' : '';
  const structured = [field(labels.given), field(labels.middle), field(labels.surname)].filter(Boolean).join(' ');
  let idNumber = field(labels.idNumber);
  if (!idNumber) idNumber = lines.find(line => /^\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}$/.test(line)) ?? '';
  return {
    fullName: grouped || field(labels.fullName) || structured,
    idNumber,
    birthDate: field(labels.birthDate),
    address: field(labels.address, true),
  };
}

export function normalizeBirthDate(value: string): string {
  let year: number, month: number, day: number;
  const iso = value.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  const numeric = value.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  const named = value.match(/\b(?:(\d{1,2})\s+([a-z]+)|([a-z]+)\s+(\d{1,2})),?\s+(\d{4})\b/i);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (numeric) { month = Number(numeric[1]); day = Number(numeric[2]); year = Number(numeric[3]); }
  else if (named) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    month = months.indexOf((named[2] || named[3] || '').slice(0, 3).toLowerCase()) + 1;
    day = Number(named[1] || named[4]); year = Number(named[5]);
  } else return '';
  if (year! < 1 || month! < 1 || month! > 12 || day! < 1 || day! > 31) return '';
  const date = new Date(`${String(year!).padStart(4, '0')}-${String(month!).padStart(2, '0')}-${String(day!).padStart(2, '0')}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.getUTCMonth() + 1 !== month! || date.getUTCDate() !== day!) return '';
  const result = date.toISOString().slice(0, 10);
  return result <= new Date().toISOString().slice(0, 10) ? result : '';
}
