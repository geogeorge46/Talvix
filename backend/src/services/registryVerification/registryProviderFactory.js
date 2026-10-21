import { MockRegistryProvider } from './mockRegistryProvider.js';
import { McaRegistryProvider } from './mca.provider.js';
import { GstRegistryProvider } from './gst.provider.js';

const providers = new Map();

// Register default providers
const mockProvider = new MockRegistryProvider();
const mcaProvider = new McaRegistryProvider();
const gstProvider = new GstRegistryProvider();

providers.set(mockProvider.name, mockProvider);
providers.set(mcaProvider.name, mcaProvider);
providers.set(gstProvider.name, gstProvider);
providers.set('default', mockProvider);

export const registerRegistryProvider = (provider) => {
  if (!provider || !provider.name) {
    throw new Error('Registry provider must have a valid name property');
  }
  providers.set(provider.name, provider);
};

export const getRegistryProvider = (name = 'default') => {
  const provider = providers.get(name) || providers.get('default');
  if (!provider) {
    throw new Error(`Registry provider '${name}' not found`);
  }
  return provider;
};

export const getProviderForCheckType = (checkType) => {
  if (checkType === 'gst_registration') {
    return providers.get('gst_registry') || mockProvider;
  }
  if (checkType === 'company_registration') {
    return providers.get('mca_registry') || mockProvider;
  }
  return providers.get('default');
};
