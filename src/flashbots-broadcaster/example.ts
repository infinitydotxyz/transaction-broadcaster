import { Wallet } from '@ethersproject/wallet';
import { providers } from 'ethers';
import { ExecutorEvent, FlashbotsBroadcaster } from '.';
import { ETHER } from '../constants';
import { weiToRoundedGwei } from '../utils';

async function main() {
  const AUTH_SIGNER_PRIVATE_KEY = process.env.AUTH_SIGNER_PRIVATE_KEY;
  const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;
  const GOERLI = 5;
  let authSigner = Wallet.createRandom();
  let signer = Wallet.createRandom();

  const providerUrl = process.env.PROVIDER_URL;
  const provider = providerUrl
    ? new providers.JsonRpcProvider(providerUrl, GOERLI)
    : providers.getDefaultProvider(GOERLI);

  if (AUTH_SIGNER_PRIVATE_KEY) {
    authSigner = new Wallet(AUTH_SIGNER_PRIVATE_KEY, provider);
    console.log(`Using authSigner from .env: ${authSigner.address}`);
  }
  if (SIGNER_PRIVATE_KEY) {
    signer = new Wallet(SIGNER_PRIVATE_KEY, provider);
    console.log(`Using signer from .env: ${signer.address}`);
  }

  const executor = await FlashbotsBroadcaster.create({
    authSigner: {
      privateKey: authSigner.privateKey
    },
    transactionSigner: {
      privateKey: signer.privateKey
    },
    provider: provider,
    blocksInFuture: 2,
    priorityFee: 3.5,
    filterSimulationReverts: true,
    allowReverts: false
  });

  executor.on(ExecutorEvent.Block, (block) => {
    console.log(`Current block: ${block.blockNumber}. Gas price: ${weiToRoundedGwei(block.gasPrice)}`);
  });

  executor.on(ExecutorEvent.Started, (settings) => {
    console.log(`Executor started with settings: \n${JSON.stringify(settings, null, 2)}`);
  });

  executor.on(ExecutorEvent.Stopping, () => {
    console.log('Executor stopping...');
  });

  executor.on(ExecutorEvent.Stopped, () => {
    console.log('Executor stopped.');
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
      executor.remove(tx.id);
    }
  });

  executor.on(ExecutorEvent.SubmittingBundle, (bundle) => {
    console.log(`Submitting bundle for ${bundle.transactions.length} transactions to block: ${bundle.blockNumber}`);
  });

  executor.on(ExecutorEvent.BundleResult, (result) => {
    if ('reason' in result) {
      console.log(`Failed to submit bundle. Block: ${result.blockNumber} Reason: ${result.reason}`);
      return;
    }
    console.log(
      `Submitted bundle. Block: ${result.blockNumber}. Gas Used: ${result.totalGasUsed.toString()} Transactions: ${
        result.transactions.length
      }`
    );
    // handle successful transactions
    for (const tx of result.transactions) {
      executor.remove(tx.id);
    }
  });

  executor.on(ExecutorEvent.RelayError, (result) => {
    console.log(`Relay error. Block: ${result.message} Code: ${result.code}`);
  });

  executor.start();

  const tx: providers.TransactionRequest = {
    data: '0x1249c58b',
    to: '0x4EcDA24Cf0Dca2Fc77b382ED38343462AdB8cEdC',
    value: ETHER.mul(3).div(100),
    maxFeePerGas: 100
  };

  const tx2 = {
    data: '0x1249c58b',
    to: '0x4EcDA24Cf0Dca2Fc77b382ED38343462AdB8cEdC',
    value: ETHER.mul(3).div(100),
    maxFeePerGas: 100
  };

  const revertTx = {
    data: '0x1249c58a',
    to: '0x4EcDA24Cf0Dca2Fc77b382ED38343462AdB8cEdC',
    value: ETHER.mul(3).div(100),
    maxFeePerGas: 100
  };

  const test = {
    id: 'asdf',
    tx: tx
  };

  const test2 = {
    id: 'asdf2',
    tx: tx2
  };

  const revert = {
    id: 'fail',
    tx: revertTx
  };

  executor.add(test.id, test.tx);
  executor.add(test2.id, test2.tx);
  executor.add(revert.id, revert.tx);
}

void main();
