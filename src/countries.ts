import countryData from 'world-countries';

type CountryRecord = {
  cca2: string;
  name: { common: string };
  flags?: { emoji?: string };
  idd?: { root?: string; suffixes?: string[] };
};

export type CountryOption = {
  code: string;
  name: string;
  flag: string;
  callingCode: string;
};

export const countries: CountryOption[] = (countryData as CountryRecord[])
  .map((country) => ({
    code: country.cca2,
    name: country.name.common,
    flag: country.flags?.emoji ?? '🌐',
    callingCode: `${country.idd?.root ?? ''}${country.idd?.suffixes?.[0] ?? ''}`,
  }))
  .filter((country) => country.callingCode)
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));
