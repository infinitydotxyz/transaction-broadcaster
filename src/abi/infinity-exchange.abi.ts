import { ethers } from 'ethers';

export const infinityExchangeAbi = [
  {
    inputs: [
      { internalType: 'address', name: '_WETH', type: 'address' },
      { internalType: 'address', name: '_matchExecutor', type: 'address' }
    ],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'newMinNonce', type: 'uint256' }
    ],
    name: 'CancelAllOrders',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'uint256[]', name: 'orderNonces', type: 'uint256[]' }
    ],
    name: 'CancelMultipleOrders',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'address', name: 'complicationRegistry', type: 'address' }],
    name: 'ComplicationAdded',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'address', name: 'complicationRegistry', type: 'address' }],
    name: 'ComplicationRemoved',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'address', name: 'currencyRegistry', type: 'address' }],
    name: 'CurrencyAdded',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'address', name: 'currencyRegistry', type: 'address' }],
    name: 'CurrencyRemoved',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'bytes32', name: 'sellOrderHash', type: 'bytes32' },
      { indexed: false, internalType: 'bytes32', name: 'buyOrderHash', type: 'bytes32' },
      { indexed: false, internalType: 'address', name: 'seller', type: 'address' },
      { indexed: false, internalType: 'address', name: 'buyer', type: 'address' },
      { indexed: false, internalType: 'address', name: 'complication', type: 'address' },
      { indexed: false, internalType: 'address', name: 'currency', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'MatchOrderFulfilled',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'address', name: 'matchExecutor', type: 'address' }],
    name: 'NewMatchExecutor',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'uint16', name: 'wethTransferGasUnits', type: 'uint16' }],
    name: 'NewWethTransferGasUnits',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'previousOwner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' }
    ],
    name: 'OwnershipTransferred',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'bytes32', name: 'orderHash', type: 'bytes32' },
      { indexed: false, internalType: 'address', name: 'seller', type: 'address' },
      { indexed: false, internalType: 'address', name: 'buyer', type: 'address' },
      { indexed: false, internalType: 'address', name: 'complication', type: 'address' },
      { indexed: false, internalType: 'address', name: 'currency', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'TakeOrderFulfilled',
    type: 'event'
  },
  { stateMutability: 'payable', type: 'fallback' },
  {
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'MATCH_EXECUTOR',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'WETH',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'WETH_TRANSFER_GAS_UNITS',
    outputs: [{ internalType: 'uint16', name: '', type: 'uint16' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: '_complication', type: 'address' }],
    name: 'addComplication',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: '_currency', type: 'address' }],
    name: 'addCurrency',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: 'minNonce', type: 'uint256' }],
    name: 'cancelAllOrders',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256[]', name: 'orderNonces', type: 'uint256[]' }],
    name: 'cancelMultipleOrders',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: 'index', type: 'uint256' }],
    name: 'getComplicationAt',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: 'index', type: 'uint256' }],
    name: 'getCurrencyAt',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'uint256', name: 'nonce', type: 'uint256' }
    ],
    name: 'isNonceValid',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder',
        name: 'order',
        type: 'tuple'
      },
      { internalType: 'bytes32', name: 'orderHash', type: 'bytes32' }
    ],
    name: 'isOrderValid',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: '', type: 'address' },
      { internalType: 'uint256', name: '', type: 'uint256' }
    ],
    name: 'isUserOrderNonceExecutedOrCancelled',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'complication', type: 'address' }],
    name: 'isValidComplication',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'currency', type: 'address' }],
    name: 'isValidCurrency',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder',
        name: 'makerOrder',
        type: 'tuple'
      },
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder[]',
        name: 'manyMakerOrders',
        type: 'tuple[]'
      }
    ],
    name: 'matchOneToManyOrders',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder[]',
        name: 'makerOrders1',
        type: 'tuple[]'
      },
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder[]',
        name: 'makerOrders2',
        type: 'tuple[]'
      }
    ],
    name: 'matchOneToOneOrders',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder[]',
        name: 'sells',
        type: 'tuple[]'
      },
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder[]',
        name: 'buys',
        type: 'tuple[]'
      },
      {
        components: [
          { internalType: 'address', name: 'collection', type: 'address' },
          {
            components: [
              { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
              { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
            ],
            internalType: 'struct OrderTypes.TokenInfo[]',
            name: 'tokens',
            type: 'tuple[]'
          }
        ],
        internalType: 'struct OrderTypes.OrderItem[][]',
        name: 'constructs',
        type: 'tuple[][]'
      }
    ],
    name: 'matchOrders',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'numComplications',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'numCurrencies',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: '_complication', type: 'address' }],
    name: 'removeComplication',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: '_currency', type: 'address' }],
    name: 'removeCurrency',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  { inputs: [], name: 'renounceOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  {
    inputs: [{ internalType: 'address', name: 'destination', type: 'address' }],
    name: 'rescueETH',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'destination', type: 'address' },
      { internalType: 'address', name: 'currency', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'rescueTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder[]',
        name: 'makerOrders',
        type: 'tuple[]'
      }
    ],
    name: 'takeMultipleOneOrders',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder[]',
        name: 'makerOrders',
        type: 'tuple[]'
      },
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          }
        ],
        internalType: 'struct OrderTypes.TakerOrder[]',
        name: 'takerOrders',
        type: 'tuple[]'
      }
    ],
    name: 'takeOrders',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      {
        components: [
          { internalType: 'address', name: 'collection', type: 'address' },
          {
            components: [
              { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
              { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
            ],
            internalType: 'struct OrderTypes.TokenInfo[]',
            name: 'tokens',
            type: 'tuple[]'
          }
        ],
        internalType: 'struct OrderTypes.OrderItem[]',
        name: 'items',
        type: 'tuple[]'
      }
    ],
    name: 'transferMultipleNFTs',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: '_matchExecutor', type: 'address' }],
    name: 'updateMatchExecutor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint16', name: '_wethTransferGasUnits', type: 'uint16' }],
    name: 'updateWethTranferGas',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'userMinOrderNonce',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'sellOrderHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'buyOrderHash', type: 'bytes32' },
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder',
        name: 'sell',
        type: 'tuple'
      },
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder',
        name: 'buy',
        type: 'tuple'
      }
    ],
    name: 'verifyMatchOneToManyOrders',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'sellOrderHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'buyOrderHash', type: 'bytes32' },
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder',
        name: 'sell',
        type: 'tuple'
      },
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder',
        name: 'buy',
        type: 'tuple'
      },
      {
        components: [
          { internalType: 'address', name: 'collection', type: 'address' },
          {
            components: [
              { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
              { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
            ],
            internalType: 'struct OrderTypes.TokenInfo[]',
            name: 'tokens',
            type: 'tuple[]'
          }
        ],
        internalType: 'struct OrderTypes.OrderItem[]',
        name: 'constructedNfts',
        type: 'tuple[]'
      }
    ],
    name: 'verifyMatchOrders',
    outputs: [
      { internalType: 'bool', name: '', type: 'bool' },
      { internalType: 'uint256', name: '', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder',
        name: 'order',
        type: 'tuple'
      }
    ],
    name: 'verifyOrderSig',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'makerOrderHash', type: 'bytes32' },
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          { internalType: 'address', name: 'signer', type: 'address' },
          { internalType: 'uint256[]', name: 'constraints', type: 'uint256[]' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          },
          { internalType: 'address[]', name: 'execParams', type: 'address[]' },
          { internalType: 'bytes', name: 'extraParams', type: 'bytes' },
          { internalType: 'bytes', name: 'sig', type: 'bytes' }
        ],
        internalType: 'struct OrderTypes.MakerOrder',
        name: 'maker',
        type: 'tuple'
      },
      {
        components: [
          { internalType: 'bool', name: 'isSellOrder', type: 'bool' },
          {
            components: [
              { internalType: 'address', name: 'collection', type: 'address' },
              {
                components: [
                  { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
                  { internalType: 'uint256', name: 'numTokens', type: 'uint256' }
                ],
                internalType: 'struct OrderTypes.TokenInfo[]',
                name: 'tokens',
                type: 'tuple[]'
              }
            ],
            internalType: 'struct OrderTypes.OrderItem[]',
            name: 'nfts',
            type: 'tuple[]'
          }
        ],
        internalType: 'struct OrderTypes.TakerOrder',
        name: 'taker',
        type: 'tuple'
      }
    ],
    name: 'verifyTakeOrders',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  { stateMutability: 'payable', type: 'receive' }
] as unknown as ethers.utils.Fragment[];
