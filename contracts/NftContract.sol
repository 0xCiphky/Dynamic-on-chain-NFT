// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

/// @title hardhat NFTcontract
/// @author Areez Ladhani
/// @notice This contract is for creating a dynamic on-chain NFT
/// @dev Contract uses chainlink keepers, openzeppelin contracts and base64 library

// imports //
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "base64-sol/base64.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

// errors //
error NftContract__notEnoughFunds();
error NftContract__paymentFailed();
error NftContract__noTokenId();
error nftContract__upKeepNotNeeded();

contract NftContract is ERC721URIStorage, Ownable, KeeperCompatibleInterface {
  // events //
  event nftMint(address minter, uint256 tokenId);
  event nftUpdate(uint256 tokenId);

  // Nft Variables //
  uint256 internal immutable i_mintPrice;
  uint256 public s_tokenCounter;
  uint256 internal constant MAX_CHANCE_VALUE = 100;
  uint256 private s_lastTimeStamp;
  uint256 private immutable i_interval;
  string private constant base64EncodedSvgPrefix = "data:image/svg+xml;base64,";
  string[3] private s_stages = ["seed ", "seedling ", "flower "];
  uint256 private s_indexStage = 1;

  // nft image variables //
  string private s_seed;
  string private s_ma_flower;
  string private s_fg_flower;

  // chainlink keepers variables //
  enum mintState {
    open,
    paused
  }
  mintState private s_state;

  constructor(
    uint256 mintPrice,
    uint256 interval,
    string memory seed,
    string memory maFlower,
    string memory fgFlower
  ) ERC721("Dynamic NFT", "DNT") {
    i_mintPrice = mintPrice;
    s_tokenCounter = 1;
    i_interval = interval;
    s_seed = svgToImageURI(seed);
    s_ma_flower = svgToImageURI(maFlower);
    s_fg_flower = svgToImageURI(fgFlower);
    s_lastTimeStamp = block.timestamp;
    s_state = mintState.open;
  }

  /// @notice lets a player mint an NFT if the correct mintfee is paid
  /// @dev uses safemint and setTokenUri to mint the NFT
  function mintNft() external payable {
    if (msg.value < i_mintPrice) {
      revert NftContract__notEnoughFunds();
    }
    uint256 tokenId = s_tokenCounter;

    _safeMint(msg.sender, tokenId);
    _setTokenURI(tokenId, tokenURI(tokenId));
    s_tokenCounter++;
    emit nftMint(msg.sender, tokenId);
  }

  /// @notice checks if the Nft is ready to go to the next stage
  /// @dev uses chainlink keepers to check if conditions are satisfied in order to call perform upkeep

  function checkUpkeep(
    bytes memory /* checkData */
  )
    public
    view
    override
    returns (
      bool upkeepNeeded,
      bytes memory /* performData */
    )
  {
    bool mintOpen = (s_state == mintState.open);
    bool minMintAmount = (s_tokenCounter > 1);
    bool intervalPassed = (block.timestamp - s_lastTimeStamp) > i_interval;
    upkeepNeeded = (mintOpen && minMintAmount && intervalPassed);
  }

  /// @notice if called successfully, nft is ready to go to next stage
  /// @dev this function calls updateStage() which makes the changes to the tokenUri

  function performUpkeep(
    bytes calldata /* performData */
  ) external override {
    (bool upkeepNeeded, ) = checkUpkeep("");
    if (!upkeepNeeded) {
      revert nftContract__upKeepNotNeeded();
    }

    updateStage();

    emit nftUpdate(s_tokenCounter - 1);
  }

  /// @notice This function updates the Nft
  /// @dev internal func called by performUpKeep to update the nft stage
  function updateStage() internal returns (string memory) {
    if (s_indexStage == s_stages.length) {
      s_indexStage = 1;
    } else {
      s_indexStage++;
    }
    //mint a couple nfts and check if this works
    uint256 tokenId = s_tokenCounter - 1;
    for (uint256 i = 1; i < tokenId; i++) {
      _setTokenURI(i, tokenURI(i));
    }
    s_lastTimeStamp = block.timestamp;
  }

  // You could also just upload the raw SVG and have solildity convert it!
  function svgToImageURI(string memory svg)
    public
    pure
    returns (string memory)
  {
    string memory baseURL = "data:image/svg+xml;base64,";
    string memory svgBase64Encoded = Base64.encode(
      bytes(string(abi.encodePacked(svg)))
    );
    return string(abi.encodePacked(baseURL, svgBase64Encoded));
  }

  /// @notice function to pause or open minting
  /// @dev can only be called by owner
  function toggleMintState() public onlyOwner {
    if (s_state == mintState.open) {
      s_state = mintState.paused;
    } else {
      s_state = mintState.open;
    }
  }

  function _baseURI() internal pure override returns (string memory) {
    return "data:application/json;base64,";
  }

  function tokenURI(uint256 tokenId)
    public
    view
    override
    returns (string memory)
  {
    string memory imageURI;
    string memory name;

    if (s_indexStage == 1) {
      name = "seed";
      imageURI = s_seed;
    } else if (s_indexStage == 2) {
      name = "seedling";
      imageURI = s_ma_flower;
    } else if (s_indexStage == 3) {
      name = "flower";
      imageURI = s_fg_flower;
    }

    //string(abi.encodePacked(s_stages[s_indexStage], name)
    return
      string(
        abi.encodePacked(
          _baseURI(),
          Base64.encode(
            bytes(
              abi.encodePacked(
                '{"name":"',
                name, // You can add whatever name here
                '", "description":"An NFT that changes based on the day", ',
                '"attributes": [{"trait_type": "stage", "value":"',
                name,
                '"}], "image":"',
                imageURI,
                '"}'
              )
            )
          )
        )
      );
  }

  /// @notice only callable by the owner
  /// @dev withdraws all funds from the contract
  function withdrawFunds() public onlyOwner {
    uint256 bal = address(this).balance;
    (bool success, ) = payable(msg.sender).call{value: bal}("");
    if (!success) {
      revert NftContract__paymentFailed();
    }
  }

  // helper functions //

  /// @notice Returns the mint price of one NFT
  function getMintPrice() public view returns (uint256) {
    return (i_mintPrice);
  }

  /// @notice Returns the tokenCounter (Notice: this is one ahead of the tokenID)
  function getTokenCounter() public view returns (uint256) {
    return (s_tokenCounter);
  }

  /// @notice Returns the timestamp the beginning of a stage
  function getLastTimestamp() public view returns (uint256) {
    return (s_lastTimeStamp);
  }

  /// @notice Returns if mint is open(0) or paused(1)
  function getMintState() public view returns (mintState) {
    return (s_state);
  }

  /// @notice Returns the Uri of the seed image
  function getSeedURI() public view returns (string memory) {
    return (s_seed);
  }

  /// @notice Returns the Uri of the ma flower image
  function getMaFlowerURI() public view returns (string memory) {
    return (s_ma_flower);
  }

  /// @notice Returns the Uri of the fg flower image
  function getFgFlowerURII() public view returns (string memory) {
    return (s_fg_flower);
  }

  /// @notice Returns the Uri of th token of a certain Id
  function getTokenUri(uint256 tokenId) public view returns (string memory) {
    return tokenURI(tokenId);
  }

  /// @notice Returns the interval(time befre Nft transitions into next state)
  function getInterval() public view returns (uint256) {
    return (i_interval);
  }

  /// @notice Returns the current stage of the NFT
  function getNftStage() public view returns (uint256) {
    return (s_indexStage);
  }
}
