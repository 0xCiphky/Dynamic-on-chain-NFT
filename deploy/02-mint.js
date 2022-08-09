const { network, ethers } = require("hardhat")

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId

  // Dynamic SVG  NFT
  const nftContract = await ethers.getContract("NftContract", deployer)
  console.log("Minting Nft!")
  mintFee = await nftContract.getMintPrice()
  const nftContractMintTx = await nftContract.mintNft({ value: mintFee })
  await nftContractMintTx.wait(1)
}
module.exports.tags = ["all", "mint"]
