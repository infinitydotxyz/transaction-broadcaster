export interface NftTransfer {
  address: string;
  from: string;
  to: string;
  tokenId: string;
  amount: number;
}

export interface MatchOrderFulfilledEvent {
  sellOrderHash: string;
  buyOrderHash: string;
  buyer: string;
  seller: string;
  complication: string;
  amount: string;
}


export interface Erc20Transfer {
    currency: string;
    from: string;
    to: string;
    amount: string;
}