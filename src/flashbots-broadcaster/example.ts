
import { Wallet } from "@ethersproject/wallet";
import { providers } from "ethers";
import { ExecutorEvent, FlashbotsBroadcaster } from ".";
import { weiToRoundedGwei } from "../utils";

async function main() {
  const AUTH_SIGNER_PRIVATE_KEY = process.env.AUTH_SIGNER_PRIVATE_KEY;
  const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
  let authSigner = Wallet.createRandom();
  let signer = Wallet.createRandom();

  if (AUTH_SIGNER_PRIVATE_KEY) {
    authSigner = new Wallet(AUTH_SIGNER_PRIVATE_KEY);
    console.log(`Using authSigner from .env: ${authSigner.address}`);
  }
  if (SIGNER_PRIVATE_KEY) {
    signer = new Wallet(SIGNER_PRIVATE_KEY);
    console.log(`Using signer from .env: ${signer.address}`);
  }

  const providerUrl = process.env.PROVIDER_URL;
  const provider = providerUrl ? new providers.JsonRpcProvider(providerUrl) : providers.getDefaultProvider(1);

  const executor = await FlashbotsBroadcaster.create({
    authSigner: {
      privateKey: authSigner.privateKey,
    },
    transactionSigner: {
      privateKey: signer.privateKey,
    },
    provider: provider,
    blocksInFuture: 2,
    priorityFee: 3.5,
    filterSimulationReverts: true,
    allowReverts: false,
  });

  executor.on(ExecutorEvent.Block, (block) => {
    console.log(`Current block: ${block.blockNumber}. Gas price: ${weiToRoundedGwei(block.gasPrice)}`);
  });

  executor.on(ExecutorEvent.Started, (settings) => {
    console.log(
      `Executor started with settings: \n${JSON.stringify(settings, null, 2)}`
    );
  });

  executor.on(ExecutorEvent.Stopping, () => {
    console.log("Executor stopping...");
  });

  executor.on(ExecutorEvent.Stopped, () => {
    console.log("Executor stopped.");
  });

  executor.on(ExecutorEvent.Simulated, (simulation) => {
    /**
     * clients are responsible for removing transactions from the pool
     * if they don't want them to be simulated/submitted again
     */
    console.log(
      `Simulated transactions. Gas Used: ${simulation.totalGasUsed} Gas Price: ${simulation.gasPrice} Successful: ${simulation.successfulTransactions.length} Reverted: ${simulation.revertedTransactions.length}`
    );
    for (const tx of simulation.revertedTransactions) {
      executor.deleteTransactionRequest(tx.id);
    }
  });

  executor.on(ExecutorEvent.SubmittingBundle, (bundle) => {
    console.log(
      `Submitting bundle for ${bundle.transactions.length} transactions to block: ${bundle.blockNumber}`
    );
  });

  executor.on(ExecutorEvent.BundleResult, (result) => {
    if ("reason" in result) {
      console.log(
        `Failed to submit bundle. Block: ${result.blockNumber} Reason: ${result.reason}`
      );
      return;
    }
    console.log(
      `Submitted bundle. Block: ${
        result.blockNumber
      }. Gas Used: ${result.totalGasUsed.toString()} Transactions: ${
        result.transactions.length
      }`
    );
    // handle successful transactions
    for (const tx of result.transactions) {
      executor.deleteTransactionRequest(tx.id);
    }
  });

  executor.on(ExecutorEvent.RelayError, (result) => {
    console.log(`Relay error. Block: ${result.message} Code: ${result.code}`);
  });

  executor.start();

}

main();
