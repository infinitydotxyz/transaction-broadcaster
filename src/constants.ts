import { BigNumber } from 'ethers/lib/ethers';

export const ETHER = BigNumber.from(10).pow(18);
export const GWEI = BigNumber.from(10).pow(9);

export function getEnvVariable(name: string, required: false, defaultValue?: string): string | undefined;
export function getEnvVariable(name: string, required: true, defaultValue?: string): string;
export function getEnvVariable(name: string, required: boolean, defaultValue?: string) {
  const value = process.env[name] ?? defaultValue;

  if (value) {
    return value;
  }

  if (required) {
    throw new Error(`Failed to find environment variable: ${name}`);
  }
}

export const AUTH_SIGNER_MAINNET = getEnvVariable('AUTH_SIGNER_PRIVATE_KEY_MAINNET', true);
export const SIGNER_MAINNET = getEnvVariable('SIGNER_PRIVATE_KEY_MAINNET', true);
export const AUTH_SIGNER_GOERLI = getEnvVariable('AUTH_SIGNER_PRIVATE_KEY_GOERLI', true);
export const SIGNER_GOERLI = getEnvVariable('SIGNER_PRIVATE_KEY_GOERLI', true);
