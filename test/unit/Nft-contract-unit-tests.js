const { expect, assert } = require("chai")
const { network, ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
require("dotenv").config()

const seedSvgUri = process.env.SEED_SVG
const fgSvgUri = process.env.FG_SVG
const maFlowerSvgUri = process.env.MA_SVG
const seedTokenuri = process.env.SEED_TOKEN_URI
const maFlowerTOkenUri = process.env.MA_TOKEN_URI
const fgFlowerTOkenUri = process.env.FG_TOKEN_URI

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("staging tests for nftContract", () => {
      let deployer,
        accounts,
        mintFee,
        nftContract,
        interval,
        prevStage,
        prevTimeStamp
      beforeEach(async () => {
        accounts = ethers.getSigners()
        deployer = accounts[0]
        await deployments.fixture(["NftContract"])
        nftContract = await ethers.getContract("NftContract", deployer)
        mintFee = await nftContract.getMintPrice()
        interval = await nftContract.getInterval()
      })
      describe("constructor", () => {
        it("initializes the mint fee correctly", async () => {
          assert.equal(mintFee.toString(), "10000000000000000")
        })
        it("converts the svg images correctly", async () => {
          const seedUri = await nftContract.getSeedURI()
          const maFlowerUri = await nftContract.getMaFlowerURI()
          const fgFlowerUri = await nftContract.getFgFlowerURII()
          assert.equal(seedUri, seedSvgUri)
          assert.equal(maFlowerUri, maFlowerSvgUri)
          assert.equal(fgSvgUri, fgFlowerUri)
        })
        it("tokenId starts at 1", async () => {
          const tokenId = await nftContract.getTokenCounter()
          assert.equal(tokenId.toString(), "1")
        })
        it("Mint state is set to open", async () => {
          const state = await nftContract.getMintState()
          assert.equal(state.toString(), "0")
        })
      })
      describe("mintNft", () => {
        it("reverts if mint fee not paid", async () => {
          await expect(nftContract.mintNft()).to.be.revertedWith(
            "NftContract__notEnoughFunds"
          )
        })
        it("mints an nft and emits an event when mintFee is paid", async () => {
          await expect(nftContract.mintNft({ value: mintFee })).to.emit(
            nftContract,
            "nftMint"
          )
          const tokenId = await nftContract.getTokenCounter()
          assert.equal(tokenId.toString(), "2")
        })
        it("increments the tokenId and sets tokenUri when nft minted", async () => {
          await nftContract.mintNft({ value: mintFee })
          const tokenId = await nftContract.getTokenCounter()
          assert.equal(tokenId.toString(), "2")
          const tokenUri = await nftContract.getTokenUri(1)
          assert.equal(tokenUri, seedTokenuri)
        })
      })
      describe("checkUpKeep", () => {
        it("returns false if enough time has not passed, while other conditions pass", async () => {
          await nftContract.mintNft({ value: mintFee })
          const { upkeepNeeded } = await nftContract.callStatic.checkUpkeep(
            "0x"
          )
          assert(!upkeepNeeded)
        })
        it("returns false if no one has minted, while other conditions pass", async () => {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await nftContract.callStatic.checkUpkeep(
            "0x"
          )
          assert(!upkeepNeeded)
        })
        it("returns false if mint is paused, while other conditions pass", async () => {
          await nftContract.mintNft({ value: mintFee })
          await nftContract.toggleMintState()
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await nftContract.callStatic.checkUpkeep(
            "0x"
          )
          assert(!upkeepNeeded)
        })
        it("returns true if all conditions pass", async () => {
          await nftContract.mintNft({ value: mintFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await nftContract.callStatic.checkUpkeep(
            "0x"
          )
          assert(upkeepNeeded)
        })
      })
      describe("performUpKeep", () => {
        it("can only run if checkUpKeep is true", async () => {
          await nftContract.mintNft({ value: mintFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          const tx = await nftContract.performUpkeep([])
          assert(tx)
          //if tx has no erros and the function runs this will pass
        })
        it("reverts when checkUpKeep is false", async () => {
          await expect(nftContract.performUpkeep([])).to.be.revertedWith(
            "nftContract__upKeepNotNeeded()"
            //we can add the params of the error but this is good enough too
          )
        })
        it("emits an event after performUpKeep", async () => {
          await nftContract.mintNft({ value: mintFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          const tx = await nftContract.performUpkeep([])
          expect(tx).to.emit("nftUpdate")
        })
      })
      describe("updateStage", () => {
        beforeEach(async () => {
          prevTimeStamp = await nftContract.getLastTimestamp()
          prevStage = await nftContract.getNftStage()
          await nftContract.mintNft({ value: mintFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          await nftContract.performUpkeep([])
        })
        it("updates the stage of the NFT by 1 (seed to young flower)", async () => {
          const currentStage = await nftContract.getNftStage()
          assert.equal(prevStage.toNumber() + 1, currentStage)
          const tokenId = (await nftContract.getTokenCounter()) - 1
          const tokenUri = await nftContract.getTokenUri(tokenId)
          assert.equal(tokenUri, maFlowerTOkenUri)
        })
        it("updates the stage of the NFT by 1 (young flower to fully grown flower)", async () => {
          prevStage = await nftContract.getNftStage()
          await nftContract.mintNft({ value: mintFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          await nftContract.performUpkeep([])
          const currentStage = await nftContract.getNftStage()
          assert.equal(prevStage.toNumber() + 1, currentStage)
          const tokenId = (await nftContract.getTokenCounter()) - 1
          const tokenUri = await nftContract.getTokenUri(tokenId)
          assert.equal(tokenUri, fgFlowerTOkenUri)
        })
        it("resets back to seed (fully grown flower to seed)", async () => {
          prevStage = await nftContract.getNftStage()
          await nftContract.mintNft({ value: mintFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
          await nftContract.performUpkeep([])
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          //Third round
          await network.provider.send("evm_mine", [])
          await nftContract.performUpkeep([])
          const currentStage = await nftContract.getNftStage()
          assert.equal("1", currentStage)
          const tokenId = (await nftContract.getTokenCounter()) - 1
          const tokenUri = await nftContract.getTokenUri(tokenId)
          assert.equal(tokenUri, seedTokenuri)
        })
        it("resets the lastTimeStamp", async () => {
          newTimeStamp = await nftContract.getLastTimestamp()
          assert(newTimeStamp > prevTimeStamp)
        })
      })
      describe("withdraw funds", () => {
        it("lets the owner of the contract withdraw funds", async () => {
          const withdraw = await nftContract.withdrawFunds()
          assert(withdraw)
        })
        it("Doesn't let anyone else apart from the owner withdraw funds", async () => {
          const accounts = await ethers.getSigners()
          const randomAccount = accounts[1]
          const randomAccountConnected = await nftContract.connect(
            randomAccount
          )
          await expect(
            randomAccountConnected.withdrawFunds()
          ).to.be.revertedWith("Ownable: caller is not the owner")
        })
      })
    })
