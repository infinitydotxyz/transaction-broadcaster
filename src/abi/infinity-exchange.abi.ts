export const infinityExchangeAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_currencyRegistry',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '_complicationRegistry',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '_WETH',
        type: 'address'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'user',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'newMinNonce',
        type: 'uint256'
      }
    ],
    name: 'CancelAllOrders',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'user',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'uint256[]',
        name: 'orderNonces',
        type: 'uint256[]'
      }
    ],
    name: 'CancelMultipleOrders',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'complicationRegistry',
        type: 'address'
      }
    ],
    name: 'NewComplicationRegistry',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'currencyRegistry',
        type: 'address'
      }
    ],
    name: 'NewCurrencyRegistry',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'infinityFeeTreasury',
        type: 'address'
      }
    ],
    name: 'NewInfinityFeeTreasury',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'nftTransferSelector',
        type: 'address'
      }
    ],
    name: 'NewNFTTransferSelector',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'sellOrderHash',
        type: 'bytes32'
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'buyOrderHash',
        type: 'bytes32'
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'seller',
        type: 'address'
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'buyer',
        type: 'address'
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'complication',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'currency',
        type: 'address'
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'collection',
            type: 'address'
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'tokenId',
                type: 'uint256'
              },
              {
                internalType: 'uint256',
                name: 'numTokens',
                type: 'uint256'
              }
            ],
            internalType: 'struct OrderTypes.TokenInfo[]',
            name: 'tokens',
            type: 'tuple[]'
          }
        ],
        indexed: false,
        internalType: 'struct OrderTypes.OrderItem[]',
        name: 'nfts',
        type: 'tuple[]'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256'
      }
    ],
    name: 'OrderFulfilled',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'previousOwner',
        type: 'address'
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newOwner',
        type: 'address'
      }
    ],
    name: 'OwnershipTransferred',
    type: 'event'
  },
  {
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'WETH',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'from',
        type: 'address'
      },
      {
        internalType: 'address',
        name: 'to',
        type: 'address'
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'collection',
            type: 'address'
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'tokenId',
                type: 'uint256'
              },
              {
                internalType: 'uint256',
                name: 'numTokens',
                type: 'uint256'
              }
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
    name: 'batchTransferNFTs',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'minNonce',
        type: 'uint256'
      }
    ],
    name: 'cancelAllOrders',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'uint256[]',
        name: 'orderNonces',
        type: 'uint256[]'
      }
    ],
    name: 'cancelMultipleOrders',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'complicationRegistry',
    outputs: [
      {
        internalType: 'contract IComplicationRegistry',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'currencyRegistry',
    outputs: [
      {
        internalType: 'contract ICurrencyRegistry',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'infinityFeeTreasury',
    outputs: [
      {
        internalType: 'contract IInfinityFeeTreasury',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'infinityTradingRewards',
    outputs: [
      {
        internalType: 'contract IInfinityTradingRewards',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'user',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: 'nonce',
        type: 'uint256'
      }
    ],
    name: 'isNonceValid',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'bool',
            name: 'isSellOrder',
            type: 'bool'
          },
          {
            internalType: 'address',
            name: 'signer',
            type: 'address'
          },
          {
            internalType: 'bytes32',
            name: 'dataHash',
            type: 'bytes32'
          },
          {
            internalType: 'uint256[]',
            name: 'constraints',
            type: 'uint256[]'
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'collection',
                type: 'address'
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'tokenId',
                    type: 'uint256'
                  },
                  {
                    internalType: 'uint256',
                    name: 'numTokens',
                    type: 'uint256'
                  }
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
          {
            internalType: 'address[]',
            name: 'execParams',
            type: 'address[]'
          },
          {
            internalType: 'bytes',
            name: 'extraParams',
            type: 'bytes'
          },
          {
            internalType: 'bytes',
            name: 'sig',
            type: 'bytes'
          }
        ],
        internalType: 'struct OrderTypes.Order[]',
        name: 'sells',
        type: 'tuple[]'
      },
      {
        components: [
          {
            internalType: 'bool',
            name: 'isSellOrder',
            type: 'bool'
          },
          {
            internalType: 'address',
            name: 'signer',
            type: 'address'
          },
          {
            internalType: 'bytes32',
            name: 'dataHash',
            type: 'bytes32'
          },
          {
            internalType: 'uint256[]',
            name: 'constraints',
            type: 'uint256[]'
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'collection',
                type: 'address'
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'tokenId',
                    type: 'uint256'
                  },
                  {
                    internalType: 'uint256',
                    name: 'numTokens',
                    type: 'uint256'
                  }
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
          {
            internalType: 'address[]',
            name: 'execParams',
            type: 'address[]'
          },
          {
            internalType: 'bytes',
            name: 'extraParams',
            type: 'bytes'
          },
          {
            internalType: 'bytes',
            name: 'sig',
            type: 'bytes'
          }
        ],
        internalType: 'struct OrderTypes.Order[]',
        name: 'buys',
        type: 'tuple[]'
      },
      {
        components: [
          {
            internalType: 'bool',
            name: 'isSellOrder',
            type: 'bool'
          },
          {
            internalType: 'address',
            name: 'signer',
            type: 'address'
          },
          {
            internalType: 'bytes32',
            name: 'dataHash',
            type: 'bytes32'
          },
          {
            internalType: 'uint256[]',
            name: 'constraints',
            type: 'uint256[]'
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'collection',
                type: 'address'
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'tokenId',
                    type: 'uint256'
                  },
                  {
                    internalType: 'uint256',
                    name: 'numTokens',
                    type: 'uint256'
                  }
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
          {
            internalType: 'address[]',
            name: 'execParams',
            type: 'address[]'
          },
          {
            internalType: 'bytes',
            name: 'extraParams',
            type: 'bytes'
          },
          {
            internalType: 'bytes',
            name: 'sig',
            type: 'bytes'
          }
        ],
        internalType: 'struct OrderTypes.Order[]',
        name: 'constructs',
        type: 'tuple[]'
      },
      {
        internalType: 'bool',
        name: 'tradingRewards',
        type: 'bool'
      },
      {
        internalType: 'bool',
        name: 'feeDiscountEnabled',
        type: 'bool'
      }
    ],
    name: 'matchOrders',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'nftTransferSelector',
    outputs: [
      {
        internalType: 'contract INFTTransferSelector',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'bool',
            name: 'isSellOrder',
            type: 'bool'
          },
          {
            internalType: 'address',
            name: 'signer',
            type: 'address'
          },
          {
            internalType: 'bytes32',
            name: 'dataHash',
            type: 'bytes32'
          },
          {
            internalType: 'uint256[]',
            name: 'constraints',
            type: 'uint256[]'
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'collection',
                type: 'address'
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'tokenId',
                    type: 'uint256'
                  },
                  {
                    internalType: 'uint256',
                    name: 'numTokens',
                    type: 'uint256'
                  }
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
          {
            internalType: 'address[]',
            name: 'execParams',
            type: 'address[]'
          },
          {
            internalType: 'bytes',
            name: 'extraParams',
            type: 'bytes'
          },
          {
            internalType: 'bytes',
            name: 'sig',
            type: 'bytes'
          }
        ],
        internalType: 'struct OrderTypes.Order[]',
        name: 'makerOrders',
        type: 'tuple[]'
      },
      {
        components: [
          {
            internalType: 'bool',
            name: 'isSellOrder',
            type: 'bool'
          },
          {
            internalType: 'address',
            name: 'signer',
            type: 'address'
          },
          {
            internalType: 'bytes32',
            name: 'dataHash',
            type: 'bytes32'
          },
          {
            internalType: 'uint256[]',
            name: 'constraints',
            type: 'uint256[]'
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'collection',
                type: 'address'
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'tokenId',
                    type: 'uint256'
                  },
                  {
                    internalType: 'uint256',
                    name: 'numTokens',
                    type: 'uint256'
                  }
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
          {
            internalType: 'address[]',
            name: 'execParams',
            type: 'address[]'
          },
          {
            internalType: 'bytes',
            name: 'extraParams',
            type: 'bytes'
          },
          {
            internalType: 'bytes',
            name: 'sig',
            type: 'bytes'
          }
        ],
        internalType: 'struct OrderTypes.Order[]',
        name: 'takerOrders',
        type: 'tuple[]'
      },
      {
        internalType: 'bool',
        name: 'tradingRewards',
        type: 'bool'
      },
      {
        internalType: 'bool',
        name: 'feeDiscountEnabled',
        type: 'bool'
      }
    ],
    name: 'takeOrders',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newOwner',
        type: 'address'
      }
    ],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_complicationRegistry',
        type: 'address'
      }
    ],
    name: 'updateComplicationRegistry',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_currencyRegistry',
        type: 'address'
      }
    ],
    name: 'updateCurrencyRegistry',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_infinityFeeTreasury',
        type: 'address'
      }
    ],
    name: 'updateInfinityFeeTreasury',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_nftTransferSelector',
        type: 'address'
      }
    ],
    name: 'updateNFTTransferSelector',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    name: 'userMinOrderNonce',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'bool',
            name: 'isSellOrder',
            type: 'bool'
          },
          {
            internalType: 'address',
            name: 'signer',
            type: 'address'
          },
          {
            internalType: 'bytes32',
            name: 'dataHash',
            type: 'bytes32'
          },
          {
            internalType: 'uint256[]',
            name: 'constraints',
            type: 'uint256[]'
          },
          {
            components: [
              {
                internalType: 'address',
                name: 'collection',
                type: 'address'
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'tokenId',
                    type: 'uint256'
                  },
                  {
                    internalType: 'uint256',
                    name: 'numTokens',
                    type: 'uint256'
                  }
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
          {
            internalType: 'address[]',
            name: 'execParams',
            type: 'address[]'
          },
          {
            internalType: 'bytes',
            name: 'extraParams',
            type: 'bytes'
          },
          {
            internalType: 'bytes',
            name: 'sig',
            type: 'bytes'
          }
        ],
        internalType: 'struct OrderTypes.Order',
        name: 'order',
        type: 'tuple'
      }
    ],
    name: 'verifyOrderSig',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
];
