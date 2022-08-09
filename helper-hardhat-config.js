const networkConfig = {
  31337: {
    name: "localhost",
    mintFee: "10000000000000000", // 0.01 ETH
    interval: "120",
  },
  4: {
    name: "rinkeby",
    mintFee: "10000000000000000", // 0.01 ETH
    interval: "120",
  },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
  networkConfig,
  developmentChains,
}
