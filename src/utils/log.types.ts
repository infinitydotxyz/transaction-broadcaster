export interface NftTransfer {
  address: string;
  from: string;
  to: string;
  tokenId: string;
  amount: number;
}

export interface Erc20Transfer {
    currency: string;
    from: string;
    to: string;
    amount: string;
}