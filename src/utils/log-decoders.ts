import { ChainNFTs, MatchOrderFulfilledEvent } from '@infinityxyz/lib/types/core';
import { ethers } from 'ethers';
import { BigNumber, BigNumberish, providers } from 'ethers/lib/ethers';
import { ERC20ABI, ERC721ABI, InfinityExchangeABI } from '@infinityxyz/lib/abi';
import { SupportedTokenStandard, tokenStandardByTransferTopic } from './constants';
import { Erc20Transfer, NftTransfer } from './log.types';

export function decodeNftTransfer(log: providers.Log): NftTransfer[] {
  try {
    const topics = log.topics;
    const topic = topics[0];
    const tokenStandard = tokenStandardByTransferTopic[topic];
    switch (tokenStandard) {
      case SupportedTokenStandard.ERC721: {
        const iface = new ethers.utils.Interface(ERC721ABI);
        const res = iface.parseLog(log);
        const [from, to, tokenId] = res.args;
        return [
          {
            address: log.address.toLowerCase(),
            from: from.toLowerCase(),
            to: to.toLowerCase(),
            tokenId: BigNumber.isBigNumber(tokenId) ? tokenId.toString() : tokenId,
            amount: 1
          }
        ];
      }
      default:
        return [];
    }
  } catch (err) {
    return [];
  }
}

export function decodeErc20Transfer(log: providers.Log): Erc20Transfer[] {
  try {
    const iface = new ethers.utils.Interface(ERC20ABI);
    const res = iface.parseLog(log);
    const [src, dst, wad] = res.args;
    const currency = log.address.toLowerCase();
    return [
      {
        currency,
        from: src.toLowerCase(),
        to: dst.toLowerCase(),
        amount: wad.toString()
      }
    ];
  } catch (err) {
    return [];
  }
}

export function decodeMatchOrderFulfilled(log: providers.Log): Omit<MatchOrderFulfilledEvent, 'chainId'>[] {
  try {
    const iface = new ethers.utils.Interface(InfinityExchangeABI);
    const res = iface.parseLog(log);
    // token id, quantity
    type NftTokenArg = [BigNumberish, BigNumberish];
    type NftsTokensArg = NftTokenArg[];
    type NftCollectionArg = [string, NftsTokensArg];
    type NftsArg = NftCollectionArg[];
    type Args = [string, string, string, string, string, string, BigNumberish, NftsArg];
    const [sellOrderHash, buyOrderHash, seller, buyer, complication, currency, amountBigNumberish, nfts] =
      res.args as Args;

    const decodedNfts: ChainNFTs[] = nfts.map(([collectionAddress, tokensArg]) => {
      const collection = collectionAddress.toLowerCase();
      const tokens = tokensArg.map(([tokenId, quantity]) => {
        const id = BigNumber.from(tokenId).toString();
        const numTokens = BigNumber.from(quantity).toNumber();
        return { tokenId: id, numTokens };
      });

      return { collection, tokens };
    });

    const amount = BigNumber.from(amountBigNumberish).toString();
    return [
      {
        exchangeAddress: log.address.toLowerCase(),
        txHash: log.transactionHash.toLowerCase(),
        blockNumber: log.blockNumber,
        sellOrderHash: sellOrderHash.toLowerCase(),
        buyOrderHash: buyOrderHash.toLowerCase(),
        buyer: buyer.toLowerCase(),
        seller: seller.toLowerCase(),
        complication: complication.toLowerCase(),
        amount,
        currencyAddress: currency.toLowerCase(),
        nfts: decodedNfts
      }
    ];
  } catch (err) {
    return [];
  }
}
