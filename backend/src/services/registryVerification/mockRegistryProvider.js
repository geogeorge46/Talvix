import { BaseRegistryProvider } from './registryProvider.interface.js';

export class MockRegistryProvider extends BaseRegistryProvider {
  constructor() {
    super('mock_registry');
  }

  async verifyRegistration({ company, checkType, options = {} }) {
    const cin = (company.cin || '').toUpperCase();
    const gstin = (company.gstin || '').toUpperCase();
    const udyam = (company.udyamRegistrationNumber || '').toUpperCase();

    // Check for explicit test/mock signals in inputs
    if (cin.startsWith('UNAVAILABLE') || gstin.startsWith('UNAVAILABLE') || udyam.startsWith('UNAVAILABLE') || options.simulateUnavailable) {
      return {
        provider: this.name,
        checkType,
        outcome: 'unavailable',
        referenceId: `MOCK-UNAVAIL-${Date.now()}`,
        matchedFields: [],
        mismatchedFields: [],
        registryData: null,
        message: 'External registry service is temporarily unavailable'
      };
    }

    if (cin.startsWith('NOTFOUND') || gstin.startsWith('NOTFOUND') || udyam.startsWith('NOTFOUND') || options.simulateNotFound) {
      return {
        provider: this.name,
        checkType,
        outcome: 'not_found',
        referenceId: `MOCK-NF-${Date.now()}`,
        matchedFields: [],
        mismatchedFields: [],
        registryData: null,
        message: 'Registration details not found in official business registry'
      };
    }

    if (checkType === 'company_registration') {
      if (cin.startsWith('MISMATCH') || options.simulateMismatch) {
        return {
          provider: this.name,
          checkType,
          outcome: 'mismatch',
          referenceId: `MOCK-MISMATCH-${Date.now()}`,
          registryData: {
            legalName: 'Registry Confirmed Shell Corp Inc',
            entityType: 'public_limited',
            cin: cin || 'U72200MH2020PTC123456',
            status: 'active',
            incorporationDate: '2020-01-01'
          }
        };
      }

      // Default: Matching response
      return {
        provider: this.name,
        checkType,
        outcome: 'match',
        referenceId: `MOCK-MATCH-${Date.now()}`,
        registryData: {
          legalName: company.legalName || company.name,
          entityType: company.entityType || 'private_limited',
          cin: company.cin || 'U72200MH2020PTC999999',
          status: 'active',
          incorporationDate: company.foundedYear ? `${company.foundedYear}-01-01` : '2020-01-01'
        }
      };
    }

    if (checkType === 'gst_registration') {
      if (gstin.startsWith('MISMATCH') || options.simulateMismatch) {
        return {
          provider: this.name,
          checkType,
          outcome: 'mismatch',
          referenceId: `MOCK-GST-MISMATCH-${Date.now()}`,
          registryData: {
            legalName: 'Different GST Legal Entity Name',
            gstin: gstin || '27AAPCU12341ZV',
            status: 'Active'
          }
        };
      }

      return {
        provider: this.name,
        checkType,
        outcome: 'match',
        referenceId: `MOCK-GST-MATCH-${Date.now()}`,
        registryData: {
          legalName: company.legalName || company.name,
          gstin: company.gstin || '27AAPCU12341ZV',
          status: 'Active'
        }
      };
    }

    if (checkType === 'msme_registration') {
      if (udyam.startsWith('MISMATCH') || options.simulateMismatch) {
        return {
          provider: this.name,
          checkType,
          outcome: 'mismatch',
          referenceId: `MOCK-MSME-MISMATCH-${Date.now()}`,
          registryData: {
            legalName: 'Different MSME Registered Name',
            udyamRegistrationNumber: udyam || 'UDYAM-MH-01-0012345',
            category: 'Micro'
          }
        };
      }

      return {
        provider: this.name,
        checkType,
        outcome: 'match',
        referenceId: `MOCK-MSME-MATCH-${Date.now()}`,
        registryData: {
          legalName: company.legalName || company.name,
          udyamRegistrationNumber: company.udyamRegistrationNumber || 'UDYAM-MH-01-0012345',
          category: 'Small'
        }
      };
    }

    // Default fallback checkType
    return {
      provider: this.name,
      checkType,
      outcome: 'match',
      referenceId: `MOCK-GEN-${Date.now()}`,
      registryData: {
        legalName: company.legalName || company.name,
        status: 'active'
      }
    };
  }
}
