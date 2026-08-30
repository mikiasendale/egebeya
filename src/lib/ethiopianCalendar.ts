import { toEthiopian, toGregorian } from 'ethiopian-date';

export function gregorianToEthiopian(date: Date) {
  const [year, month, day] = toEthiopian(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return { year, month, day };
}

export function ethiopianToGregorian(year: number, month: number, day: number) {
  const [gYear, gMonth, gDay] = toGregorian(year, month, day);
  return new Date(gYear, gMonth - 1, gDay);
}

export const ETHIOPIAN_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yakatit',
  'Maggabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehasse', 'Pagume'
];

/** Amharic month names — single source (F5: was duplicated in QueueStatus + ReceiptTicket). */
export const ETHIOPIAN_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን',
];
