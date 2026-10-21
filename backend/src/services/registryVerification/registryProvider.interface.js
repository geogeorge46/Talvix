/**
 * Base interface / contract for Business Registry Verification Providers.
 */
export class BaseRegistryProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Verify company registration details against external registry.
   * @param {Object} params
   * @param {Object} params.company - The company object
   * @param {String} params.checkType - Type of check (company_registration, gst_registration, msme_registration, etc.)
   * @param {Object} [params.options] - Provider-specific options
   * @returns {Promise<Object>} Normalized result object
   */
  async verifyRegistration({ company: _company, checkType: _checkType, options: _options = {} }) {
    throw new Error('verifyRegistration method must be implemented by subclass');
  }
}
