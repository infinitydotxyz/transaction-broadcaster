import { FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { BigNumber, providers } from 'ethers/lib/ethers';
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

  RelayError = 'relay-error'
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

export interface SimulatedEvent {
  successfulTransactions: { id: string; tx: providers.TransactionRequest }[];
  revertedTransactions: { id: string; tx: providers.TransactionRequest }[];
  gasPrice: BigNumber;
  totalGasUsed: number;
}

export interface SubmittingBundleEvent {
  blockNumber: number;
  minTimestamp: number;
  maxTimestamp: number;
  transactions: { id: string; tx: providers.TransactionRequest }[];
}

export interface SuccessfulBundleSubmission {
  transactions: {
    receipt: providers.TransactionReceipt;
    id: string;
    tx: providers.TransactionRequest;
    successful: boolean;
  }[];

  blockNumber: number;

  totalGasUsed: BigNumber;
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
  code: number;
  message: string;
}

export interface BlockEvent {
  blockNumber: number;
  gasPrice: BigNumber;
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
};

export type FlashbotsBroadcasterEventTypes =
  | StartedEvent
  | StoppingEvent
  | StoppedEvent
  | SimulatedEvent
  | SubmittingBundleEvent
  | BundleSubmissionResultEvent
  | RelayErrorEvent
  | BlockEvent;
