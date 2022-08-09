const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const fs = require("fs")

module.exports = async function ({ deployments, getNamedAccounts }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId

  const interval = networkConfig[chainId].interval
  const mintFee = networkConfig[chainId].mintFee

  const youngCat = await fs.readFileSync("./images/DynamicNft/seed.svg", {
    encoding: "utf8",
  })
  const maCat = await fs.readFileSync("./images/DynamicNft/ma-flower.svg", {
    encoding: "utf8",
  })
  const oldCat = await fs.readFileSync("./images/DynamicNft/fg.svg", {
    encoding: "utf8",
  })

  const args = [mintFee, interval, youngCat, maCat, oldCat]

  log("deploying contract...")
  const NftContract = await deploy("NftContract", {
    from: deployer,
    log: true,
    args: args,
    waitConfrimations: network.config.blockConfirmations || 15,
  })
  log("contract deployed!")

  // Verify the deployment
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying...")
    await verify(NftContract.address, args)
  }
}

module.exports.tags = ["all", "NftContract", "main"]
