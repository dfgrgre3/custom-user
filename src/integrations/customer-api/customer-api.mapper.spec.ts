import { mapExternalUserToSyncedUserData } from './customer-api.mapper';
import { ExternalUser } from './customer-api.types';

describe('mapExternalUserToSyncedUserData', () => {
  const baseExternal: ExternalUser = {
    id: '6aa36e4e719f0fbf8aea3f5b',
    name: 'Kayden Muller',
    email: 'kayden.muller@haleyllc.com',
    phone: '+16425811223',
    status: 'invited',
    company: {
      name: 'Haley LLC',
      industry: 'Healthcare',
      role: 'Compliance Officer',
      website: 'https://haleyllc.com',
      employees: 13038,
    },
    createdAt: '2026-08-24T14:00:55.593Z',
    updatedAt: '2026-08-24T23:17:32.066Z',
  };

  it('maps every external field to its internal counterpart', () => {
    const result = mapExternalUserToSyncedUserData(baseExternal);

    expect(result).toEqual({
      externalUserId: '6aa36e4e719f0fbf8aea3f5b',
      name: 'Kayden Muller',
      email: 'kayden.muller@haleyllc.com',
      phone: '+16425811223',
      status: 'invited',
      companyName: 'Haley LLC',
      companyIndustry: 'Healthcare',
      companyRole: 'Compliance Officer',
      companyWebsite: 'https://haleyllc.com',
      companyEmployees: 13038,
      externalCreatedAt: new Date('2026-08-24T14:00:55.593Z'),
      externalUpdatedAt: new Date('2026-08-24T23:17:32.066Z'),
    });
  });

  it('treats a missing phone as null rather than undefined', () => {
    const result = mapExternalUserToSyncedUserData({
      ...baseExternal,
      phone: undefined,
    });
    expect(result.phone).toBeNull();
  });

  it('treats an empty company website as null, not an empty string', () => {
    const result = mapExternalUserToSyncedUserData({
      ...baseExternal,
      company: { ...baseExternal.company, website: '' },
    });
    expect(result.companyWebsite).toBeNull();
  });

  it('treats a missing company employees count as null', () => {
    const result = mapExternalUserToSyncedUserData({
      ...baseExternal,
      company: { ...baseExternal.company, employees: undefined },
    });
    expect(result.companyEmployees).toBeNull();
  });
});
