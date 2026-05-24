# pos-blockchain

A compact pure-Node.js Proof of Stake (PoS) blockchain and DeFi reference implementation that includes:

- a decentralized-style P2P peer registry
- zero-inflation token accounting with validator staking
- secp256k1 ECDSA wallets and signed transfers
- a JavaScript smart-contract VM powered by Node's `vm` module
- an AMM DEX with constant-product swaps
- an NFT registry
- a simple cross-chain bridge transfer model
- dashboard-ready chain and DeFi telemetry snapshots

## Getting started

```bash
npm test
```

To preview the static dashboard, open `/dashboard/index.html` in a browser.

The dashboard accepts a `window.POS_BLOCKCHAIN_SNAPSHOT` object for live telemetry and otherwise renders placeholder preview data. Set that object before the dashboard script runs, for example with an inline `<script>` tag ahead of the page script.

## Example

```js
const { ProofOfStakeBlockchain, Wallet } = require('./src');

const validator = Wallet.create();
const user = Wallet.create();

const chain = new ProofOfStakeBlockchain({
  genesisBalances: {
    [validator.address]: 100,
    [user.address]: 0
  }
});

chain.network.connectPeer({ id: 'peer-1', endpoint: 'ws://127.0.0.1:7000' });
chain.stakeTokens(validator.address, 40);
chain.dex.addLiquidity(1_000, 1_000);
chain.nfts.mint({ tokenId: 'genesis-nft', owner: validator.address });

const tx = chain.createTransaction(validator, user.address, 25);
chain.addTransaction(tx);
chain.produceBlock(validator.address);

console.log(chain.getDashboardSnapshot());
```

## Notes

- The smart-contract VM is a lightweight Node.js `vm`-based reference environment with a bounded execution timeout by default.
- The AMM uses JavaScript number arithmetic, which is appropriate for this compact reference implementation but not production-grade fixed-point finance.
