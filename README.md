# NFT Authentication System

A complete end-to-end solution for NFT registration, verification, and ownership validation using blockchain technology, perceptual hashing, and AI-based image similarity detection.

## Overview

This system allows users to:
1. Register NFTs with their metadata and images
2. Verify the authenticity of NFTs using multiple verification methods
3. Validate ownership claims against blockchain records

The verification process uses a multi-layered approach:
- **Blockchain Verification**: Compares perceptual hash with stored hash
- **Source Image Verification**: Compares uploaded image with the original NFT image
- **AI Similarity Detection**: Uses AI models to detect image similarities
- **Ownership Verification**: Validates the claimed owner against blockchain records

## Project Structure

```
nft_Auth_final/
├── NFTAUTHX-mini_project-/
│   ├── AI_Server/          # AI model for image similarity detection
│   ├── Backend/            # Express.js server for NFT verification
│   ├── Frontend/           # React-based UI for user interaction
│   └── SmartContract/      # Ethereum smart contracts for NFT registration
└── README.md
```

## Technologies Used

- **Frontend**: React.js
- **Backend**: Node.js, Express
- **Blockchain**: Ethereum, ethers.js
- **Image Processing**: perceptual hashing (pHash)
- **AI**: Image similarity detection
- **Storage**: SQL -Lite Database for storing image embeddings

## Setup and Installation

### Prerequisites
- Node.js (v14+)
- MetaMask browser extension
- Ethereum testnet or mainnet access

### Backend Setup
1. Navigate to the Backend directory:
   ```
   cd NFTAUTHX-mini_project-/Backend
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `backend.env` file with your environment variables:
   ```
   INFURA_API_KEY=your_infura_api_key
   CONTRACT_ADDRESS=your_contract_address
   PRIVATE_KEY=your_private_key
   ```
4. Start the server:
   ```
   npm start
   ```

### Frontend Setup
1. Navigate to the Frontend directory:
   ```
   cd NFTAUTHX-mini_project-/Frontend/nftauth
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Start the React app:
   ```
   npm start
   ```

### AI Server Setup
1. Navigate to the AI Server directory:
   ```
   cd NFTAUTHX-mini_project-/AI_Server
   ```
2. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Start the AI server:
   ```
   python server.js
   ```

## Usage

### Registering an NFT
1. Connect your MetaMask wallet
2. Select "Register" action
3. Fill in the NFT details (name, contract address, token ID)
4. Upload the NFT image
5. Submit the form

### Verifying an NFT
1. Connect your MetaMask wallet
2. Select "Verify" action
3. Fill in the NFT details (name, contract address, token ID, owner address)
4. Upload the NFT image to verify
5. Submit the form
6. View the verification results

## Verification Results

The system provides detailed verification results:

- **AUTHENTIC ✅**: All verification checks passed
- **AUTHENTIC BUT OWNERSHIP MISMATCH ⚠️**: Image verified but ownership doesn't match
- **SUSPICIOUS ⚠️**: Image matches but AI similarity is low
- **FAKE ❌**: Image doesn't match registered or source NFT

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Ethereum blockchain for decentralized verification
- IPFS for decentralized storage
- OpenAI for AI model inspiration
