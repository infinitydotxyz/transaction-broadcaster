import { FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { MatchOrderFulfilledEvent } from '@infinityxyz/lib/types/core';
import { BigNumber, BigNumberish, providers } from 'ethers/lib/ethers';
import { Erc20Transfer, NftTransfer } from '../utils/log.types';
import { BundleItem, InvalidTransactionRequest } from './bundle.types';
import { FlashbotsBroadcasterSettings } from './flashbots-broadcaster-options.types';

export enum FlashbotsBroadcasterEvent {
  /**
   * FlashbotsBroadcaster lifecycle
   */
  Started = 'started',
  Stopping = 'stopping',
  Stopped = 'stopped',

  Block = 'block',

  Simulated = 'simulated',
  SubmittingBundle = 'submitting-bundle',
  BundleResult = 'bundle-result',

  InvalidBundleItems = 'invalid-bundle-items',
  ValidBundleItems = 'valid-bundle-items',

  RelayError = 'relay-error'
}

export enum RelayErrorCode {
  InsufficientFunds = -32000
}

export interface StartedEvent {
  settings: FlashbotsBroadcasterSettings;

  network: providers.Network;

  authSignerAddress: string;

  signerAddress: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface StoppingEvent {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface StoppedEvent {}

export enum RevertReason {
  InsufficientAllowance = 'insufficient-allowance'
}

export interface SimulatedEvent {
  blockNumber: number;
  successfulTransactions: providers.TransactionRequest[];
  revertedTransactions: { tx: providers.TransactionRequest; reason: RevertReason | string }[];
  gasPrice: BigNumber;
  totalGasUsed: number;
}

export interface SubmittingBundleEvent {
  blockNumber: number;
  minTimestamp: number;
  maxTimestamp: number;
  transactions: providers.TransactionRequest[];
}

export interface SuccessfulBundleSubmission {
  transactions: {
    receipt: providers.TransactionReceipt;
    tx: providers.TransactionRequest;
    successful: boolean;
  }[];

  nftTransfers: NftTransfer[];

  erc20Transfers: Erc20Transfer[];

  matchOrdersFulfilled: MatchOrderFulfilledEvent[];

  blockNumber: number;

  totalGasUsed: BigNumber;

  matchExecutor: string;
}

export enum FailedBundleSubmissionReason {
  BlockPassedWithoutInclusion = 'block-passed-without-inclusion',
  AccountNonceTooHigh = 'account-nonce-too-high'
}

export const getFailedBundleSubmissionReason = {
  [FlashbotsBundleResolution.BlockPassedWithoutInclusion]: FailedBundleSubmissionReason.BlockPassedWithoutInclusion,
  [FlashbotsBundleResolution.AccountNonceTooHigh]: FailedBundleSubmissionReason.AccountNonceTooHigh
};

export interface FailedBundleSubmission {
  reason: FailedBundleSubmissionReason;
  blockNumber: number;
}

export type BundleSubmissionResultEvent = SuccessfulBundleSubmission | FailedBundleSubmission;

export interface RelayErrorEvent {
  blockNumber: number;
  code: RelayErrorCode | number;
  message: string;
}

export interface InvalidBundleItemsEvent {
  blockNumber: number;
  invalidBundleItems: InvalidTransactionRequest<BundleItem>[];
}

export interface ValidBundleItemsEvent {
  blockNumber: number;
  validBundleItems: BundleItem[];
}

export interface BlockEvent {
  blockNumber: number;
  gasPrice: BigNumberish;
  txPoolSizes: Record<string, number>;
}

export type GetEventType = {
  [FlashbotsBroadcasterEvent.Block]: BlockEvent;
  [FlashbotsBroadcasterEvent.Started]: StartedEvent;
  [FlashbotsBroadcasterEvent.Stopping]: StoppingEvent;
  [FlashbotsBroadcasterEvent.Stopped]: StoppedEvent;
  [FlashbotsBroadcasterEvent.Simulated]: SimulatedEvent;
  [FlashbotsBroadcasterEvent.SubmittingBundle]: SubmittingBundleEvent;
  [FlashbotsBroadcasterEvent.BundleResult]: BundleSubmissionResultEvent;
  [FlashbotsBroadcasterEvent.RelayError]: RelayErrorEvent;
  [FlashbotsBroadcasterEvent.InvalidBundleItems]: InvalidBundleItemsEvent;
  [FlashbotsBroadcasterEvent.ValidBundleItems]: ValidBundleItemsEvent;
};

export type FlashbotsBroadcasterEventTypes =
  | StartedEvent
  | StoppingEvent
  | StoppedEvent
  | SimulatedEvent
  | SubmittingBundleEvent
  | BundleSubmissionResultEvent
  | RelayErrorEvent
  | BlockEvent
  | InvalidBundleItemsEvent
  | ValidBundleItemsEvent;
