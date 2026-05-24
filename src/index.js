'use strict';

const crypto = require('node:crypto');
const vm = require('node:vm');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class Wallet {
  constructor(privateKey, publicKey) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.address = Wallet.addressFromPublicKey(publicKey);
  }

  static create() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
      publicKeyEncoding: { format: 'pem', type: 'spki' }
    });

    return new Wallet(privateKey, publicKey);
  }

  static addressFromPublicKey(publicKey) {
    return sha256(publicKey).slice(0, 40);
  }

  sign(payload) {
    const signer = crypto.createSign('SHA256');
    signer.update(stableStringify(payload));
    signer.end();
    return signer.sign(this.privateKey, 'hex');
  }

  static verify(payload, signature, publicKey) {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(stableStringify(payload));
    verifier.end();
    return verifier.verify(publicKey, signature, 'hex');
  }
}

class P2PNetwork {
  constructor() {
    this.peers = new Map();
  }

  connectPeer(peer) {
    if (!peer || !peer.id) {
      throw new Error('Peer id is required.');
    }

    this.peers.set(peer.id, { ...peer, connectedAt: peer.connectedAt || new Date().toISOString() });
    return this.peers.get(peer.id);
  }

  listPeers() {
    return Array.from(this.peers.values());
  }
}

class SmartContractVM {
  execute(source, state = {}, { timeout = 10 } = {}) {
    const sandbox = {
      Math,
      Date,
      state: clone(state),
      result: null
    };

    const script = new vm.Script(`"use strict";\n${source}`);
    script.runInNewContext(sandbox, { timeout });

    return { state: sandbox.state, result: sandbox.result };
  }
}

class AutomatedMarketMaker {
  constructor({ tokenA = 'POS', tokenB = 'USD', reserveA = 0, reserveB = 0, fee = 0.003 } = {}) {
    this.tokenA = tokenA;
    this.tokenB = tokenB;
    this.reserveA = reserveA;
    this.reserveB = reserveB;
    this.fee = fee;
  }

  addLiquidity(amountA, amountB) {
    if (amountA <= 0 || amountB <= 0) {
      throw new Error('Liquidity amounts must be positive.');
    }

    this.reserveA += amountA;
    this.reserveB += amountB;
    return this.getReserves();
  }

  getReserves() {
    return {
      [this.tokenA]: this.reserveA,
      [this.tokenB]: this.reserveB
    };
  }

  swap(inputToken, amountIn) {
    if (amountIn <= 0) {
      throw new Error('Swap input must be positive.');
    }

    const inputIsA = inputToken === this.tokenA;
    if (!inputIsA && inputToken !== this.tokenB) {
      throw new Error('Unsupported token.');
    }

    const reserveIn = inputIsA ? this.reserveA : this.reserveB;
    const reserveOut = inputIsA ? this.reserveB : this.reserveA;
    const amountInWithFee = amountIn * (1 - this.fee);
    const amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);

    if (!Number.isFinite(amountOut) || amountOut <= 0 || amountOut >= reserveOut) {
      throw new Error('Insufficient liquidity for swap.');
    }

    if (inputIsA) {
      this.reserveA += amountIn;
      this.reserveB -= amountOut;
      return { inputToken: this.tokenA, outputToken: this.tokenB, amountIn, amountOut };
    }

    this.reserveB += amountIn;
    this.reserveA -= amountOut;
    return { inputToken: this.tokenB, outputToken: this.tokenA, amountIn, amountOut };
  }
}

class NFTRegistry {
  constructor() {
    this.tokens = new Map();
  }

  mint({ tokenId, owner, metadata = {} }) {
    if (!tokenId || !owner) {
      throw new Error('tokenId and owner are required.');
    }

    if (this.tokens.has(tokenId)) {
      throw new Error('Token already exists.');
    }

    const token = { tokenId, owner, metadata: clone(metadata) };
    this.tokens.set(tokenId, token);
    return token;
  }

  transfer(tokenId, from, to) {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error('Unknown token.');
    }
    if (token.owner !== from) {
      throw new Error('Only the current owner can transfer this token.');
    }
    token.owner = to;
    return token;
  }

  getToken(tokenId) {
    return this.tokens.get(tokenId);
  }
}

class CrossChainBridge {
  constructor() {
    this.transfers = new Map();
  }

  lock({ asset, amount, owner, sourceChain, targetChain }) {
    if (!asset || !owner || !sourceChain || !targetChain || amount <= 0) {
      throw new Error('Valid bridge transfer details are required.');
    }

    const transfer = {
      id: sha256(stableStringify({
        asset,
        amount,
        owner,
        sourceChain,
        targetChain,
        timestamp: Date.now(),
        nonce: crypto.randomUUID()
      })),
      asset,
      amount,
      owner,
      sourceChain,
      targetChain,
      status: 'locked'
    };

    this.transfers.set(transfer.id, transfer);
    return transfer;
  }

  release(transferId, recipient) {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      throw new Error('Unknown bridge transfer.');
    }
    if (transfer.status !== 'locked') {
      throw new Error('Bridge transfer is not releasable.');
    }
    transfer.status = 'released';
    transfer.recipient = recipient;
    return transfer;
  }
}

class ProofOfStakeBlockchain {
  constructor({ chainName = 'pos-blockchain', genesisBalances = {} } = {}) {
    this.chainName = chainName;
    this.chain = [];
    this.pendingTransactions = [];
    this.network = new P2PNetwork();
    this.vm = new SmartContractVM();
    this.dex = new AutomatedMarketMaker();
    this.nfts = new NFTRegistry();
    this.bridge = new CrossChainBridge();
    this.balances = new Map(Object.entries(genesisBalances));
    this.validators = new Map();
    this.totalSupply = Object.values(genesisBalances).reduce((sum, amount) => sum + amount, 0);

    this.chain.push(this.#createBlock({
      previousHash: '0'.repeat(64),
      transactions: [],
      validator: 'genesis'
    }));
  }

  getBalance(address) {
    return this.balances.get(address) || 0;
  }

  getStake(address) {
    return this.validators.get(address) || 0;
  }

  createTransaction(wallet, to, amount, metadata = {}) {
    if (!(wallet instanceof Wallet)) {
      throw new Error('A Wallet instance is required to create transactions.');
    }

    const payload = {
      from: wallet.address,
      to,
      amount,
      metadata,
      timestamp: Date.now()
    };

    return {
      ...payload,
      publicKey: wallet.publicKey,
      signature: wallet.sign(payload)
    };
  }

  addTransaction(transaction) {
    this.#assertValidTransaction(transaction);
    this.pendingTransactions.push(clone(transaction));
    return transaction;
  }

  stakeTokens(address, amount) {
    if (amount <= 0) {
      throw new Error('Stake amount must be positive.');
    }

    const currentBalance = this.getBalance(address);
    if (currentBalance < amount) {
      throw new Error('Insufficient balance to stake.');
    }

    this.balances.set(address, currentBalance - amount);
    this.validators.set(address, this.getStake(address) + amount);
    return this.getStake(address);
  }

  produceBlock(validatorAddress) {
    if (this.getStake(validatorAddress) <= 0) {
      throw new Error('Validator must have stake before producing blocks.');
    }

    const appliedTransactions = [];
    for (const transaction of this.pendingTransactions) {
      if (this.getBalance(transaction.from) < transaction.amount) {
        continue;
      }

      this.balances.set(transaction.from, this.getBalance(transaction.from) - transaction.amount);
      this.balances.set(transaction.to, this.getBalance(transaction.to) + transaction.amount);
      appliedTransactions.push(transaction);
    }

    this.pendingTransactions = [];
    const block = this.#createBlock({
      previousHash: this.getLatestBlock().hash,
      transactions: appliedTransactions,
      validator: validatorAddress
    });
    this.chain.push(block);
    return block;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  getDashboardSnapshot() {
    return {
      chainName: this.chainName,
      totalSupply: this.totalSupply,
      circulatingSupply: Array.from(this.balances.values()).reduce((sum, amount) => sum + amount, 0),
      totalStaked: Array.from(this.validators.values()).reduce((sum, amount) => sum + amount, 0),
      blocks: this.chain.length,
      pendingTransactions: this.pendingTransactions.length,
      peers: this.network.listPeers().length,
      nftCount: this.nfts.tokens.size,
      bridgeTransfers: this.bridge.transfers.size,
      dexReserves: this.dex.getReserves()
    };
  }

  #assertValidTransaction(transaction) {
    if (!transaction || transaction.amount <= 0 || !transaction.from || !transaction.to || !transaction.signature || !transaction.publicKey) {
      throw new Error('Invalid transaction payload.');
    }

    if (Wallet.addressFromPublicKey(transaction.publicKey) !== transaction.from) {
      throw new Error('Transaction sender does not match the supplied public key.');
    }

    const payload = {
      from: transaction.from,
      to: transaction.to,
      amount: transaction.amount,
      metadata: transaction.metadata || {},
      timestamp: transaction.timestamp
    };

    if (!Wallet.verify(payload, transaction.signature, transaction.publicKey)) {
      throw new Error('Invalid transaction signature.');
    }
  }

  #createBlock({ previousHash, transactions, validator }) {
    const block = {
      index: this.chain.length,
      timestamp: new Date().toISOString(),
      previousHash,
      validator,
      transactions: clone(transactions)
    };

    block.hash = sha256(stableStringify(block));
    return block;
  }
}

module.exports = {
  AutomatedMarketMaker,
  CrossChainBridge,
  NFTRegistry,
  P2PNetwork,
  ProofOfStakeBlockchain,
  SmartContractVM,
  Wallet
};
