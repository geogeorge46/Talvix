import { MockRegistryProvider } from './mockRegistryProvider.js';

const providers = new Map();

// Register default mock provider
const mockProvider = new MockRegistryProvider();
providers.set(mockProvider.name, mockProvider);
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
