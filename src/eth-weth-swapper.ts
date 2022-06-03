import { TransactionRequest } from '@ethersproject/abstract-provider';
import { ChainId } from '@infinityxyz/lib/types/core';
import { chainConstants } from '@infinityxyz/lib/utils/constants';
import { BigNumber, Contract, providers, Wallet } from 'ethers';
import { erc20Abi } from './abi/erc20.abi';
import { wethAbi } from './abi/weth.abi';

export enum Token {
  Eth = 'ETH',
  Weth = 'WETH'
}

export class EthWethSwapper {
  public readonly chainId: ChainId;
  public readonly wethAddress: string;

  constructor(private provider: providers.JsonRpcProvider, private wallet: Wallet) {
    this.chainId = `${provider.network.chainId}` as ChainId;
    this.wethAddress = chainConstants[this.chainId].wethAddress;
    if (!this.wethAddress) {
      throw new Error(`No weth address found for chainId: ${this.chainId}`);
    }
  }

  public async checkBalance(token: Token): Promise<BigNumber> {
    switch (token) {
      case Token.Eth:
        return await this.getEthBalance();
      case Token.Weth:
        return await this.getErc20Balance(this.wethAddress);
      default:
        throw new Error(`Unknown token: ${token}`);
    }
  }

  public async getEthBalance(): Promise<BigNumber> {
    const balance = await this.wallet.getBalance();
    return balance;
  }

  public async getErc20Balance(address: string): Promise<BigNumber> {
    const contract = new Contract(address, erc20Abi, this.provider);
    const balance = await contract.functions.balanceOf(address);
    return BigNumber.from(balance.toString());
  }

  public async swapEthForWeth(amountInWei: string): Promise<TransactionRequest> {
    const contract = new Contract(this.wethAddress, wethAbi, this.provider);
    const fn = contract.interface.getFunction('deposit');
    const data = contract.interface.encodeFunctionData(fn);

    const txRequest: TransactionRequest = {
      to: contract.address,
      data,
      from: this.wallet.address,
      value: BigNumber.from(amountInWei),
      chainId: parseInt(this.chainId)
    } 
    
    const estimate = await this.provider.estimateGas(txRequest);
    const gasLimit = Math.floor(estimate.toNumber() * 1.2);
    return {
      ...txRequest,
      gasLimit: gasLimit,
    };
  }

  public async swapWethForEth(amountInWei: string): Promise<TransactionRequest> {
    const contract = new Contract(this.wethAddress, wethAbi, this.provider);
    const fn = contract.interface.getFunction('withdraw');
    const data = contract.interface.encodeFunctionData(fn, [amountInWei]);

    const txRequest: TransactionRequest = {
      to: contract.address,
      data,
      from: this.wallet.address,
      chainId: parseInt(this.chainId)
    }

    const estimate = await this.provider.estimateGas(txRequest);
    const gasLimit = Math.floor(estimate.toNumber() * 1.2);
    return {
      ...txRequest,
      gasLimit: gasLimit
    };
  }
}
