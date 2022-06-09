import { ethers } from 'ethers';
import { BigNumber, providers } from 'ethers/lib/ethers';
import { erc20Abi } from '../abi/erc20.abi';
import { erc721Abi } from '../abi/erc721.abi';
import { infinityExchangeAbi } from '../abi/infinity-exchange.abi';
import { SupportedTokenStandard, tokenStandardByTransferTopic } from '../constants';
import { Erc20Transfer, MatchOrderFulfilledEvent, NftTransfer } from './log.types';

export function decodeNftTransfer(log: providers.Log): NftTransfer[] {
  try {
    const topics = log.topics;
    const topic = topics[0];
    const tokenStandard = tokenStandardByTransferTopic[topic];
    switch (tokenStandard) {
      case SupportedTokenStandard.ERC721: {
        const iface = new ethers.utils.Interface(erc721Abi);
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
    const iface = new ethers.utils.Interface(erc20Abi);
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

export function decodeMatchOrderFulfilled(log: providers.Log): MatchOrderFulfilledEvent[] {
  try {
    const iface = new ethers.utils.Interface(infinityExchangeAbi);
    const res = iface.parseLog(log);
    const [sellOrderHash, buyOrderHash, buyer, seller, complication, amountBigNumberish] = res.args;
    const amount = BigNumber.from(amountBigNumberish).toString();
    return [
      {
        sellOrderHash,
        buyOrderHash,
        buyer,
        seller,
        complication,
        amount
      }
    ];
  } catch (err) {
    return [];
  }
}
