/**
 * GST state codes (the first two digits of every GSTIN).
 *
 * Includes historically deprecated codes so that older GSTINs still validate:
 *  - 25 Daman and Diu was merged into 26 (Dadra & Nagar Haveli and Daman & Diu) in 2020.
 *  - 28 Andhra Pradesh (pre-Telangana) — current AP registrations use 37.
 */
export const GST_STATE_CODES: Readonly<Record<string, string>> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu', // deprecated (merged into 26)
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (old)', // pre-Telangana; current AP is 37
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

/** Returns the state name for a 2-digit GST state code, or undefined if unknown. */
export function stateNameForCode(code: string): string | undefined {
  return GST_STATE_CODES[code];
}

/** True if the 2-digit code is a recognized GST state code. */
export function isValidStateCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(GST_STATE_CODES, code);
}
