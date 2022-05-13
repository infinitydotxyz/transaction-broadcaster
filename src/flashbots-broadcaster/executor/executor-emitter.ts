import { FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import { BigNumber, providers } from "ethers/lib/ethers";
import { ExecutionSettings } from "./executor.types";

export enum ExecutorEvent {
  /**
   * executor lifecycle
   */
  Started = "started",
  Stopping = "stopping",
  Stopped = "stopped",

  Block = 'block',

  Simulated = "simulated",
  SubmittingBundle = "submitting-bundle",
  BundleResult = "bundle-result",

  RelayError = "relay-error",
}

export interface StartedEvent {
  settings: ExecutionSettings;

  network: providers.Network;

  authSignerAddress: string;

  signerAddress: string;
}

export interface StoppingEvent {}

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
  BlockPassedWithoutInclusion = "block-passed-without-inclusion",
  AccountNonceTooHigh = "account-nonce-too-high",
}

export const getFailedBundleSubmissionReason = {
  [FlashbotsBundleResolution.BlockPassedWithoutInclusion]:
    FailedBundleSubmissionReason.BlockPassedWithoutInclusion,
  [FlashbotsBundleResolution.AccountNonceTooHigh]:
    FailedBundleSubmissionReason.AccountNonceTooHigh,
};

export interface FailedBundleSubmission {
  reason: FailedBundleSubmissionReason;
  blockNumber: number;
}

export type BundleSubmissionResultEvent =
  | SuccessfulBundleSubmission
  | FailedBundleSubmission;

export interface RelayErrorEvent {
  code: number;
  message: string;
}

export interface BlockEvent {
    blockNumber: number;
    gasPrice: BigNumber
}

export type GetEventType = {
    [ExecutorEvent.Block]: BlockEvent,
    [ExecutorEvent.Started]: StartedEvent,
    [ExecutorEvent.Stopping]: StoppingEvent,
    [ExecutorEvent.Stopped]: StoppedEvent,
    [ExecutorEvent.Simulated]: SimulatedEvent,
    [ExecutorEvent.SubmittingBundle]: SubmittingBundleEvent,
    [ExecutorEvent.BundleResult]: BundleSubmissionResultEvent,
    [ExecutorEvent.RelayError]: RelayErrorEvent,
}

export type ExecutorEventTypes =
  | StartedEvent
  | StoppingEvent
  | StoppedEvent
  | SimulatedEvent
  | SubmittingBundleEvent
  | BundleSubmissionResultEvent
  | RelayErrorEvent
  | BlockEvent;
