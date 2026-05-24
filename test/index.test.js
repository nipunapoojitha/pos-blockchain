'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ProofOfStakeBlockchain,
  SmartContractVM,
  Wallet
} = require('../src');

test('wallets use secp256k1 signatures for transaction validation', () => {
  const wallet = Wallet.create();
  const chain = new ProofOfStakeBlockchain({
    genesisBalances: { [wallet.address]: 100, receiver: 0 }
  });

  const transaction = chain.createTransaction(wallet, 'receiver', 25, { purpose: 'staking rewards' });
  chain.addTransaction(transaction);
  chain.stakeTokens(wallet.address, 50);
  chain.produceBlock(wallet.address);

  assert.equal(chain.getBalance('receiver'), 25);
  assert.throws(
    () => chain.addTransaction({ ...transaction, amount: 30 }),
    /Invalid transaction signature/
  );
});

test('staking and block production preserve zero-inflation supply', () => {
  const validator = Wallet.create();
  const recipient = Wallet.create();
  const chain = new ProofOfStakeBlockchain({
    genesisBalances: { [validator.address]: 100, [recipient.address]: 0 }
  });

  chain.stakeTokens(validator.address, 40);
  const transaction = chain.createTransaction(validator, recipient.address, 25);
  chain.addTransaction(transaction);
  const block = chain.produceBlock(validator.address);
  const snapshot = chain.getDashboardSnapshot();

  assert.equal(block.transactions.length, 1);
  assert.equal(chain.getBalance(validator.address), 35);
  assert.equal(chain.getBalance(recipient.address), 25);
  assert.equal(snapshot.totalSupply, snapshot.circulatingSupply + snapshot.totalStaked);
});

test('smart contract vm executes stateful JavaScript safely with a timeout', () => {
  const vm = new SmartContractVM();
  const execution = vm.execute(`
    for (let i = 0; i < 5; i += 1) {
      state.counter += 1;
    }
    result = state.counter * 2;
  `, { counter: 0 });

  assert.deepEqual(execution.state, { counter: 5 });
  assert.equal(execution.result, 10);
});

test('dex, nft, bridge, and dashboard snapshots expose DeFi ecosystem state', () => {
  const wallet = Wallet.create();
  const chain = new ProofOfStakeBlockchain({
    genesisBalances: { [wallet.address]: 10 }
  });

  chain.network.connectPeer({ id: 'peer-1', endpoint: 'ws://127.0.0.1:7000' });
  chain.dex.addLiquidity(1000, 1000);
  const swap = chain.dex.swap('POS', 100);
  const nft = chain.nfts.mint({ tokenId: 'nft-1', owner: wallet.address, metadata: { name: 'Genesis NFT' } });
  const transfer = chain.bridge.lock({
    asset: 'POS',
    amount: 5,
    owner: wallet.address,
    sourceChain: 'pos',
    targetChain: 'ethereum'
  });
  chain.bridge.release(transfer.id, '0xrecipient');
  const snapshot = chain.getDashboardSnapshot();

  assert.equal(swap.outputToken, 'USD');
  assert.equal(nft.owner, wallet.address);
  assert.equal(snapshot.peers, 1);
  assert.equal(snapshot.nftCount, 1);
  assert.equal(snapshot.bridgeTransfers, 1);
});
