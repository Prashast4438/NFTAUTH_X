# Mini Project: NFT Registration and Verification System

## Overview
This project is a hybrid AI + Blockchain NFT registration and verification system. It enables users to register NFTs by uploading images, which are processed by an AI backend to extract deep image features and compute a perceptual hash (pHash). The pHash and NFT metadata are then registered on the Ethereum blockchain via a custom smart contract, ensuring on-chain authenticity and immutability. The system combines the power of AI-based image verification (off-chain) with decentralized, transparent NFT registration (on-chain).

## Features
- **NFT Registration (On-Chain & Off-Chain):** Register NFTs by uploading images and assigning unique names. The system extracts deep features and computes a perceptual hash (pHash)  storing features off-chain (SQLite) and pHash on-chain (Ethereum smart contract).
- **NFT Verification:** Verify the authenticity of NFTs by comparing uploaded images to registered ones using AI-based feature extraction (off-chain) and by checking the on-chain pHash.
- **Hamming Distance Verification:** During NFT verification, the backend computes the perceptual hash (pHash) of the uploaded image and compares it to the pHash stored on-chain using Hamming distance. A low Hamming distance indicates high visual similarity, ensuring robust and efficient image authenticity checks.
- **RESTful API:** Flask server exposes endpoints for registration (`/register`), verification (`/verify`), and hash-based existence checks (`/verify-hash/<name>`).
- **Smart Contract Integration:** Solidity smart contract (`NFTV.sol`) manages on-chain NFT registration and pHash lookup, ensuring blockchain-backed authenticity.
- **AI/ML Backend:** Utilizes TensorFlow's MobileNetV2 for robust image feature extraction.
- **Persistent Storage:** Features are stored in an SQLite database for fast and reliable access; pHash is stored on-chain for transparency and immutability.
- **Cache Optimization:** Embedding cache improves performance for frequent verification requests.

## Architecture
- **AI Server (Flask + TensorFlow):**
  - Handles image upload, feature extraction, and database management.
  - Computes perceptual hashes (pHash) for images to enable blockchain integration.
  - Provides RESTful endpoints for NFT registration and verification.
- **Database (SQLite):**
  - Stores extracted image features mapped to NFT names for fast, off-chain verification.
- **Smart Contract (Solidity - NFTV.sol):**
  - Stores NFT names and their perceptual hashes (pHash) on the Ethereum blockchain.
  - Only the contract owner can register new NFTs on-chain.
  - Anyone can query the contract for the pHash of a registered NFT to verify authenticity.
- **Backend (Node.js):**
  - (If used) Can facilitate integration between frontend, AI server, and smart contract.
- **Frontend (React):**
  - (Optional) User interface for uploading images, registering NFTs, and verifying authenticity.

## Project Structure
```
Mini_Project_Fresh/
├── AI_Server/           # Flask + TensorFlow AI backend for feature extraction and verification
│   └── ai_server.py     # Main server code
├── Backend/             # (Optional) Node.js backend for API integration
├── Frontend/            # (Optional) React frontend for user interaction
├── SmartContract/       # Solidity smart contracts for on-chain NFT registration
│   └── contracts/
│       └── NFTV.sol     # Main NFT verification contract
├── embeddings.db        # SQLite database for off-chain feature storage
└── uploads/             # Uploaded images
```

## Data Flow
1. User uploads an image and provides an NFT name via the `/register` API endpoint (frontend or API client).
2. The AI server extracts deep features and backend computes a perceptual hash (pHash) from the image.
3. Features are stored off-chain in the SQLite database for fast, AI-powered verification.
4. The pHash and NFT name are registered on the blockchain via the NFTV smart contract (by the contract owner, using scripts or UI).
5. For verification, the user uploads an image and specifies the NFT name via the `/verify` endpoint.
6. The backend computes the pHash for the uploaded image and retrieves the on-chain pHash from the smart contract.
7. The backend compares both pHashes using Hamming distance. If the distance is below a set threshold, the NFT is considered a match.
8. The system or user can queries the smart contract to verify that the NFT's pHash is registered on-chain for additional authenticity.

## Smart Contract (NFTV.sol)
- Written in Solidity for the Ethereum blockchain (see `SmartContract/contracts/NFTV.sol`).
- Allows the contract owner to register NFT names and their perceptual hashes (pHash).
- Provides public read access to check if an NFT is registered and to retrieve its pHash.
- Emits an event when a new NFT is registered.
- Ensures only unique NFT names are registered.
- The smart contract stores the pHash for each NFT, enabling Hamming distance-based verification of image authenticity by the backend.

This hybrid approach combines the power of AI-based image feature extraction for robust verification with the immutability and transparency of blockchain for NFT authenticity.

## Project Structure
```
Mini_Project_Fresh/
├── AI_Server/           # AI/ML model server (Flask, TensorFlow)
├── Backend/             # Node.js backend API
├── Frontend/            # React frontend
├── SmartContract/       # Solidity smart contracts
├── embeddings.db        # SQLite database for embeddings
└── uploads/             # File uploads
```

## Getting Started
### Prerequisites
- Node.js & npm
- Python 3.x
- Ganache or Ethereum testnet
- MetaMask browser extension

### Backend Setup
```
cd Backend
npm install
npm start
```

### Frontend Setup
```
cd Frontend
npm install
npm start
```

### AI Server Setup
```
cd AI_Server
pip install -r requirements.txt
python ai_server.py
```

### Smart Contract Deployment
- Use Truffle/Hardhat to deploy contracts in `SmartContract/`

## Usage
1. Start all servers (backend, frontend, AI server)
2. Open frontend in browser
3. Connect MetaMask
4. Enter source/destination, book ticket

## License
MIT

## Authors
Prashast Nigam
Dheemanth SM
Nikhil EB Reddy
Tanya Sinha