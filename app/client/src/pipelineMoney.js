export const MAX_MINOR = 9007199254740991n;
export function parseMoneyToMinor(value) {
 if (typeof value !== 'string') throw new Error('Enter an amount as decimal text.');
 const text = value.trim(); if (!text) return null;
 if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) throw new Error('Use a nonnegative amount with at most two decimal places, such as 1250.50.');
 const [whole, fraction = ''] = text.split('.');
 const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
 if (amount > MAX_MINOR) throw new Error('Amount exceeds the supported maximum of 90071992547409.91.');
 return amount.toString();
}
export function minorToDecimal(value) {
 if (value === null || value === undefined || value === '') return '';
 if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value) || BigInt(value) > MAX_MINOR) throw new Error('Invalid minor-unit amount.');
 const amount = BigInt(value); return `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
}
export function formatMinor(value, currency = 'USD') {
 const decimal = minorToDecimal(value);
 if (!decimal) return 'Value not set';
 const [whole, fraction] = decimal.split('.');
 const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
 return `${currency} ${grouped}.${fraction}`;
}
