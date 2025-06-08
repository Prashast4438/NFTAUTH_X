// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract NFTV {
    address public owner;
    
    struct NFTData {
        string pHash; // Perceptual Hash of the NFT
        bool exists;  // Ensures NFT is registered
    }

    mapping(string => NFTData) public nftHashes; // NFT Name → NFTData (pHash, exists)

    event NFTRegistered(string indexed name, string pHash);
    
    constructor() {
        owner = msg.sender;
    }

    // 🔹 Modifier to restrict access to contract owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    // 🔹 Function to register an NFT (Only Owner)
    function registerNFT(string memory name, string memory pHash) public onlyOwner {
        require(!nftHashes[name].exists, "NFT already registered");
        nftHashes[name] = NFTData(pHash, true);
        emit NFTRegistered(name, pHash);
    }

    // 🔹 Function to get NFT hash for verification
    // This function name matches what the backend is calling
    function getNFTPhash(string memory name) public view returns (string memory) {
        NFTData memory nftData = nftHashes[name];
        if (!nftData.exists) {
            revert("NFT not found");
        }
        return nftData.pHash;
    }
}
