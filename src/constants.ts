import { TokenStandard } from '@infinityxyz/lib/types/core';
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

export const WEBHOOK_URL = getEnvVariable('WEBHOOK_URL', false);
export const AUTH_SIGNER_MAINNET = getEnvVariable('AUTH_SIGNER_PRIVATE_KEY_MAINNET', true);
export const SIGNER_MAINNET = getEnvVariable('SIGNER_PRIVATE_KEY_MAINNET', true);
export const AUTH_SIGNER_GOERLI = getEnvVariable('AUTH_SIGNER_PRIVATE_KEY_GOERLI', true);
export const SIGNER_GOERLI = getEnvVariable('SIGNER_PRIVATE_KEY_GOERLI', true);

export enum SupportedTokenStandard {
  ERC721 = TokenStandard.ERC721
}

export const erc721ContractTransferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const erc1155ContractTransferSingleTopic = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';
export const erc1155ContractTransferBatchTopic = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb';
export const transferTopicByTokenStandard: Record<SupportedTokenStandard, string[]> = {
  [SupportedTokenStandard.ERC721]: [erc721ContractTransferTopic]
  // [TokenStandard.ERC1155]: [erc1155ContractTransferSingleTopic, erc1155ContractTransferBatchTopic],
};
export const tokenStandardByTransferTopic: Record<string, SupportedTokenStandard> = {
  [erc721ContractTransferTopic]: SupportedTokenStandard.ERC721
};

export const transferTopics = new Set(Object.values(transferTopicByTokenStandard).flatMap((item) => item));

// TODO handle this programmatically
export const MAX_GAS_LIMIT = 30_000_000;
