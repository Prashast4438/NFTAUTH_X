import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { ethers } from "ethers";
import fs from "fs";
import cors from "cors";
import { imageHash } from "image-hash";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { execSync } from 'child_process';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';

// No longer using the external verifier

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: "./backend.env" });
console.log('✅ Loaded environment variables.');

const app = express();
app.use(express.json());

app.use(cors({
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true
}));

// Add logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Load contract ABI
const contractABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "pHash",
          "type": "string"
        }
      ],
      "name": "NFTRegistered",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        }
      ],
      "name": "getNFTPhash",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "name": "nftHashes",
      "outputs": [
        {
          "internalType": "string",
          "name": "pHash",
          "type": "string"
        },
        {
          "internalType": "bool",
          "name": "exists",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "pHash",
          "type": "string"
        }
      ],
      "name": "registerNFT",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
];

// Create provider with fallback options to handle rate limiting
console.log('Creating provider with fallback options...');

// List of RPC URLs to try (using public endpoints as fallbacks)
const rpcUrls = [
  process.env.INFURA_RPC_URL,
  'https://eth-sepolia.g.alchemy.com/v2/demo', // Alchemy public demo key
  'https://rpc.ankr.com/eth_sepolia',          // Ankr public endpoint
  'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161' // Infura public key
];

// Create a FallbackProvider with multiple backends
let provider;
try {
  // First try the primary provider
  provider = new ethers.JsonRpcProvider(rpcUrls[0]);
  console.log('Primary provider created.');
} catch (error) {
  console.error('Error creating primary provider:', error.message);
  // If primary fails, try fallbacks
  for (let i = 1; i < rpcUrls.length; i++) {
    try {
      provider = new ethers.JsonRpcProvider(rpcUrls[i]);
      console.log(`Fallback provider ${i} created.`);
      break;
    } catch (fallbackError) {
      console.error(`Error creating fallback provider ${i}:`, fallbackError.message);
    }
  }
}

if (!provider) {
  console.error('Failed to create any provider. Using a mock provider for testing.');
  // Create a minimal mock provider for testing
  provider = {
    getBlockNumber: () => Promise.resolve(0),
    call: () => Promise.resolve('0x')
  };
}

// Create wallet and contract
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
console.log('Wallet created.');
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);
console.log("Contract created. Address:", process.env.CONTRACT_ADDRESS);

// Test contract connection but don't block server startup
contract.owner().then(owner => {
    console.log("✅ Connected to contract. Owner:", owner);
}).catch(error => {
    console.error("❌ Contract connection failed:", error);
    console.error("The server will continue running, but blockchain features won't work.");
    console.error("Try updating your Infura API key or using a different provider.");
});

const upload = multer({ dest: "uploads/" });

// Generate perceptual hash (pHash)
const generatePhash = (filePath) => {
    return new Promise((resolve, reject) => {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            const error = new Error(`File is empty: ${filePath}`);
            error.code = 'EMPTY_FILE';
            reject(error);
            return;
        }
        
        console.log(`Generating perceptual hash for file: ${filePath} (${stats.size} bytes)`);
        
        imageHash(filePath, 16, true, (error, hash) => {
            if (error) {
                console.error("Error generating perceptual hash:", error);
                reject(error);
                return;
            }
            
            console.log(`Generated perceptual hash: ${hash}`);
            resolve(hash);
        });
    });
}

function hammingDistance(hash1, hash2) {
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
}

// Fetch tokenURI from any NFT contract
async function fetchTokenURI(contractAddress, tokenId) {
    try {
        console.log(`Fetching tokenURI for NFT at ${contractAddress} with tokenId ${tokenId}`);
        
        // Expanded ABI with more potential functions
        const expandedABI = [
            "function tokenURI(uint256 tokenId) view returns (string)",
            "function uri(uint256 tokenId) view returns (string)",
            "function tokenMetadata(uint256 tokenId) view returns (string)",
            "function token_uri(uint256 tokenId) view returns (string)",
            "function metadata(uint256 tokenId) view returns (string)",
            "function getTokenURI(uint256 tokenId) view returns (string)",
            "function tokenData(uint256 tokenId) view returns (string)"
        ];
        
        // Create contract instance
        const nftContract = new ethers.Contract(contractAddress, expandedABI, provider);
        
        // Try different token ID formats
        const tokenIdFormats = [];
        
        // Basic formats
        tokenIdFormats.push(tokenId); // original format
        tokenIdFormats.push(Number(tokenId)); // as number
        tokenIdFormats.push(String(tokenId)); // as string
        
        // Try to add BigNumber format if available
        try {
            if (ethers.BigNumber) {
                tokenIdFormats.push(ethers.BigNumber.from(tokenId));
            } else if (ethers.utils && ethers.utils.BigNumber) {
                tokenIdFormats.push(ethers.utils.BigNumber.from(tokenId));
            }
        } catch (err) {
            console.log("BigNumber format not supported, skipping...");
        }
        
        // Add advanced formats
        try {
            // Padded hex format (common in some contracts)
            if (ethers.utils && ethers.utils.hexZeroPad && ethers.utils.hexlify) {
                tokenIdFormats.push(ethers.utils.hexZeroPad(ethers.utils.hexlify(Number(tokenId)), 32));
            }
            
            // Bytes32 format
            if (ethers.utils && ethers.utils.formatBytes32String) {
                tokenIdFormats.push(ethers.utils.formatBytes32String(String(tokenId)));
            }
            
            // Hash format (some contracts use keccak256 hashed IDs)
            if (ethers.utils && ethers.utils.keccak256 && ethers.utils.toUtf8Bytes) {
                tokenIdFormats.push(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(String(tokenId))));
            }
        } catch (err) {
            console.log(`Error creating advanced token ID formats: ${err.message}`);
        }
        
        // List of functions to try
        const functionsTry = [
            'tokenURI', 
            'uri', 
            'tokenMetadata', 
            'token_uri',
            'metadata',
            'getTokenURI',
            'tokenData'
        ];
        
        // Try each function with each token ID format
        for (const funcName of functionsTry) {
            if (typeof nftContract[funcName] !== 'function') {
                console.log(`Function ${funcName} not found in contract, skipping...`);
                continue;
            }
            
            console.log(`Trying ${funcName} function...`);
            
            for (const idFormat of tokenIdFormats) {
                try {
                    console.log(`Trying with token ID format: ${typeof idFormat} (${idFormat})`);
                    const uri = await nftContract[funcName](idFormat);
                    console.log(`Successfully fetched URI using ${funcName}: ${uri}`);
                    return uri;
                } catch (err) {
                    console.log(`Error with ${funcName} using token ID format ${typeof idFormat}: ${err.message}`);
                    // Continue to next format
                }
            }
        }
        
        // Try some common patterns for known collections
        console.log("Trying common URI patterns...");
        const commonPatterns = [
            `ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/${tokenId}`,
            `ipfs://QmPbxeGcXhYQQNgsC6a36dDyYUcHgMLnGKnF8pVFmGsvqi/${tokenId}`,
            `ipfs://bafybei${tokenId.toString().padStart(44, '0')}`,
            `https://ipfs.io/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/${tokenId}`,
            `https://api.opensea.io/api/v1/metadata/${contractAddress}/${tokenId}`
        ];
        
        // Try to validate each pattern by fetching metadata
        for (const pattern of commonPatterns) {
            try {
                console.log(`Trying common pattern: ${pattern}`);
                // Just check if the URL is accessible
                const response = await axios.head(pattern.replace('ipfs://', 'https://ipfs.io/ipfs/'), {
                    timeout: 5000,
                    validateStatus: status => status < 400
                });
                console.log(`Successfully validated pattern: ${pattern}`);
                return pattern;
            } catch (err) {
                console.log(`Pattern validation failed: ${pattern}`);
            }
        }
        
        throw new Error("Could not fetch URI with any method");
    } catch (error) {
        console.error("Error fetching tokenURI:", error);
        throw new Error(`Failed to fetch tokenURI: ${error.message}`);
    }
}

// Fetch metadata from tokenURI
async function fetchMetadata(tokenURI) {
    try {
        console.log(`\n==== Fetching Metadata ====`);
        console.log(`Original tokenURI: ${tokenURI}`);
        
        let url = tokenURI;
        
        // Handle special case for base64 encoded metadata
        if (tokenURI.startsWith('data:application/json;base64,')) {
            console.log('Detected base64 encoded metadata');
            try {
                const base64Data = tokenURI.replace('data:application/json;base64,', '');
                const decodedData = Buffer.from(base64Data, 'base64').toString();
                console.log(`Decoded metadata: ${decodedData.substring(0, 100)}...`);
                return JSON.parse(decodedData);
            } catch (err) {
                console.error(`Error decoding base64 metadata: ${err.message}`);
            }
        }
        
        // Handle IPFS URIs
        if (tokenURI.startsWith('ipfs://')) {
            const cid = tokenURI.replace('ipfs://', '');
            const gateways = [
                `https://gateway.pinata.cloud/ipfs/${cid}`,
                `https://ipfs.io/ipfs/${cid}`,
                `https://dweb.link/ipfs/${cid}`,
                `https://cloudflare-ipfs.com/ipfs/${cid}`,
                `https://ipfs.fleek.co/ipfs/${cid}`,
                `https://gateway.ipfs.io/ipfs/${cid}`,
                `https://cf-ipfs.com/ipfs/${cid}`
            ];
            
            console.log(`Fetching metadata from IPFS CID: ${cid}`);
            console.log(`Trying multiple gateways...`);
            
            let lastError = null;
            
            for (const gateway of gateways) {
                try {
                    console.log(`Trying gateway: ${gateway}`);
                    const response = await axios.get(gateway, { 
                        timeout: 15000,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });
                    console.log(`Success with gateway: ${gateway}`);
                    console.log(`Metadata: ${JSON.stringify(response.data).substring(0, 200)}...`);
                    return response.data;
                } catch (err) {
                    lastError = err;
                    console.log(`Failed with gateway: ${gateway} - ${err.message} (${err.response ? err.response.status : 'No status'})`);
                    continue;
                }
            }
            
            throw new Error(`All IPFS gateways failed: ${lastError ? lastError.message : 'Unknown error'}`);
        } else {
            console.log(`Fetching metadata from HTTP URL: ${url}`);
            try {
                const response = await axios.get(url, {
                    timeout: 15000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                console.log(`Success with HTTP URL: ${url}`);
                console.log(`Metadata: ${JSON.stringify(response.data).substring(0, 200)}...`);
                return response.data;
            } catch (err) {
                console.error(`Failed with HTTP URL: ${url} - ${err.message} (${err.response ? err.response.status : 'No status'})`);
                throw err;
            }
        }
    } catch (error) {
        console.error(`Failed to fetch metadata: ${error.message}`);
        throw new Error(`Failed to fetch metadata: ${error.message}`);
    }
}

// Download image from URL
async function downloadImage(imageUrl, outputPath) {
    try {
        console.log(`\n==== Downloading Image ====`);
        console.log(`Image URL: ${imageUrl}`);
        console.log(`Output path: ${outputPath}`);
        
        // Create directory if it doesn't exist
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Handle IPFS URIs
        if (imageUrl.startsWith('ipfs://')) {
            const cid = imageUrl.replace('ipfs://', '');
            const gateways = [
                `https://gateway.pinata.cloud/ipfs/${cid}`,
                `https://ipfs.io/ipfs/${cid}`,
                `https://dweb.link/ipfs/${cid}`,
                `https://cloudflare-ipfs.com/ipfs/${cid}`,
                `https://ipfs.fleek.co/ipfs/${cid}`,
                `https://gateway.ipfs.io/ipfs/${cid}`,
                `https://cf-ipfs.com/ipfs/${cid}`
            ];
            
            console.log(`Downloading image from IPFS CID: ${cid}`);
            console.log(`Trying multiple gateways...`);
            
            let lastError = null;
            
            for (const gateway of gateways) {
                try {
                    console.log(`Trying gateway: ${gateway}`);
                    const response = await axios({
                        method: 'get',
                        url: gateway,
                        responseType: 'stream',
                        timeout: 15000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });
                    
                    const streamPipeline = promisify(pipeline);
                    await streamPipeline(response.data, fs.createWriteStream(outputPath));
                    
                    console.log(`Success downloading image with gateway: ${gateway}`);
                    return outputPath;
                } catch (err) {
                    lastError = err;
                    console.log(`Failed with gateway: ${gateway} - ${err.message}`);
                    continue;
                }
            }
            
            throw new Error(`All IPFS gateways failed for image download: ${lastError ? lastError.message : 'Unknown error'}`);
        } else {
            // Regular HTTP URL
            console.log(`Downloading from HTTP URL: ${imageUrl}`);
            try {
                const response = await axios({
                    method: 'get',
                    url: imageUrl,
                    responseType: 'stream',
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                
                const streamPipeline = promisify(pipeline);
                await streamPipeline(response.data, fs.createWriteStream(outputPath));
                
                console.log(`Successfully downloaded image from HTTP URL: ${imageUrl}`);
                return outputPath;
            } catch (err) {
                console.error(`Failed to download from HTTP URL: ${imageUrl} - ${err.message}`);
                throw err;
            }
        }
    } catch (error) {
        console.error("Error downloading image:", error);
        throw new Error(`Failed to download image: ${error.message}`);
    }
}

// 🔹 Register NFT endpoint
// Basic route to check if server is running
app.get('/', (req, res) => {
    res.json({ message: "Backend server is running!" });
});

// Add a route to check if the server is responding to the register endpoint
app.get("/register", (req, res) => {
    res.json({ message: "Register endpoint is working!" });
});

// Add a route to check if the server is responding to the verify endpoint
app.get("/verify", (req, res) => {
    res.json({ message: "Verify endpoint is working!" });
});

app.post("/register", upload.single("image"), async (req, res) => {
    console.log("\n=== New Registration Request ===");
    console.log("Request body:", req.body);
    console.log("File:", req.file ? req.file.path : "No file uploaded");
    
    let nftImagePath = null;
    
    try {
        const { name, contractAddress, tokenId } = req.body;
        if (!req.file || !name) {
            console.log("Missing required fields");
            return res.status(400).json({ error: "Missing image or name" });
        }

        // Check if NFT already exists in our system
        try {
            const existingNFT = await contract.nftHashes(name);
            if (existingNFT.exists) {
                return res.status(400).json({ error: "NFT with this name already exists" });
            }
        } catch (error) {
            console.log("Error checking NFT existence:", error);
            // If errors assume NFT doesn't exist and continue
        }
        
        // Generate pHash for the uploaded image
        console.log("Generating pHash for uploaded image...");
        const uploadedImagePHash = await generatePhash(req.file.path);
        console.log("Generated pHash for uploaded image:", uploadedImagePHash);
        
        // If contract address and token ID are provided, fetch the original NFT image
        let sourceImageMatch = true;
        let sourceImagePHash = null;
        
        if (contractAddress && tokenId) {
            try {
                console.log(`Fetching NFT data from contract ${contractAddress} with token ID ${tokenId}`);
                
                // 1. Fetch tokenURI from the NFT contract
                const tokenURI = await fetchTokenURI(contractAddress, tokenId);
                
                // 2. Fetch metadata from tokenURI
                const metadata = await fetchMetadata(tokenURI);
                console.log("Metadata:", JSON.stringify(metadata).substring(0, 200) + "...");
                
                // 3. Get image URL from metadata
                const imageUrl = metadata.image || metadata.image_url || metadata.image_data;
                if (!imageUrl) {
                    throw new Error("No image URL found in metadata");
                }
                
                // 4. Download the NFT image
                nftImagePath = path.join("uploads", `nft_${Date.now()}.jpg`);
                await downloadImage(imageUrl, nftImagePath);
                
                // 5. Generate pHash for the NFT image
                sourceImagePHash = await generatePhash(nftImagePath);
                console.log("Generated pHash for NFT source image:", sourceImagePHash);
                
                // 6. Compare pHashes
                const distance = hammingDistance(uploadedImagePHash, sourceImagePHash);
                const threshold = 10; // Adjust threshold as needed
                sourceImageMatch = distance <= threshold;
                
                console.log(`Source image comparison: distance=${distance}, threshold=${threshold}, match=${sourceImageMatch}`);
                
                if (!sourceImageMatch) {
                    return res.status(400).json({
                        error: "Uploaded image does not match the NFT source image",
                        details: {
                            distance,
                            threshold,
                            uploadedImagePHash,
                            sourceImagePHash
                        }
                    });
                }
            } catch (error) {
                console.error("Error verifying NFT source image:", error);
                return res.status(400).json({
                    error: "Failed to verify NFT source image",
                    details: error.message
                });
            }
        } else {
            console.log("No contract address or token ID provided, skipping source image verification");
        }

        // Send image to AI server for feature extraction/storage
        try {
            const aiFormData = new FormData();
            const fileBuffer = fs.readFileSync(req.file.path);
            aiFormData.append('image', fileBuffer, { filename: path.basename(req.file.path) });
            aiFormData.append('name', name);

            const aiResponse = await axios.post('http://localhost:5050/register', aiFormData, {
                headers: aiFormData.getHeaders()
            });

            console.log("AI Server response:", aiResponse.data);
        } catch (error) {
            console.log("Error registering with AI server:", error);
            return res.status(500).json({ 
                error: "Failed to register with AI server", 
                details: error.message 
            });
        }

        console.log("Registering NFT on blockchain...");
        console.log("Name:", name);
        console.log("pHash:", uploadedImagePHash);
        
        // Get contract owner for verification
        const contractOwner = await contract.owner();
        
        const tx = await contract.registerNFT(name, uploadedImagePHash);
        console.log("Transaction sent:", tx.hash);
        console.log("Waiting for confirmation...");
        await tx.wait();
        console.log("Transaction confirmed!");
        
        res.json({ 
            message: "NFT registered successfully!", 
            txHash: tx.hash,
            details: {
                name,
                pHash: uploadedImagePHash,
                sourceImageMatch: sourceImageMatch,
                sourceImagePHash: sourceImagePHash,
                owner: contractOwner
            }
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ 
            error: "Registration failed", 
            details: error.message,
            reason: error.reason
        });
    } finally {
        // Clean up uploaded file
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
                console.log(`Cleaned up uploaded file: ${req.file.path}`);
            } catch (cleanupError) {
                console.error(`Error cleaning up uploaded file: ${cleanupError.message}`);
            }
        }
        
        // Clean up downloaded NFT image if it exists
        if (nftImagePath && fs.existsSync(nftImagePath)) {
            try {
                fs.unlinkSync(nftImagePath);
                console.log(`Cleaned up downloaded NFT image: ${nftImagePath}`);
            } catch (cleanupError) {
                console.error(`Error cleaning up NFT image: ${cleanupError.message}`);
            }
        }
    }
});

app.post("/verify", upload.single("image"), async (req, res) => {
    // Initialize all response-related variables to safe defaults
    let ownershipVerified = false;
    let phashMatch = false;
    let sourceImageMatch = false;
    let aiSimilarityScore = null;
    let aiMatched = false;
    let conclusion = '';
    let perceptualHash = '';
    let storedHash = '';
    let phashDistance = null;
    let owner = '';
    let claimedOwner = '';
    let aiModelResult = {};
    let filePath = req.file?.path || null;
    let nftImagePath = null;

    console.log("\n=== New Verification Request ===");
    console.log("Request body:", req.body);
    console.log("File path:", filePath);

    let blockchainResult = null;
    aiModelResult = null;
    let ownershipResult = null;
    let sourceImageResult = null;

    try {
        const { name, contractAddress, tokenId, ownerAddress } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: "No image uploaded" });
        }

        if (!name) {
            return res.status(400).json({ error: "Missing NFT name" });
        }

        // Generate hash for uploaded image
        const uploadedHash = await generatePhash(filePath);
        console.log(`Generated hash for uploaded image: ${uploadedHash}`);

        // === BLOCKCHAIN VERIFICATION (pHash comparison) ===
        // Get stored pHash from our contract
        const storedHash = await contract.getNFTPhash(name);
        console.log(`Retrieved stored hash for ${name}: ${storedHash}`);

        // Compare hashes
        const isExact = uploadedHash === storedHash;
        const distance = hammingDistance(uploadedHash, storedHash);
        const threshold = 10; // Adjust as needed
        const phashMatch = isExact || distance <= threshold;

        blockchainResult = {
            storedHash,
            uploadedHash,
            isExact,
            distance,
            threshold,
            phashMatch
        };

        // === SOURCE IMAGE VERIFICATION ===
        // If contract address and token ID are provided, fetch the original NFT image
        let sourceImageMatch = false;

        if (contractAddress && tokenId) {
            try {
                console.log(`Fetching NFT data from contract ${contractAddress} with token ID ${tokenId}`);

                // 1. Fetch tokenURI from the NFT contract
                const tokenURI = await fetchTokenURI(contractAddress, tokenId);

                // 2. Fetch metadata from tokenURI
                const metadata = await fetchMetadata(tokenURI);
                console.log("Metadata:", JSON.stringify(metadata).substring(0, 200) + "...");

                // 3. Get image URL from metadata
                const imageUrl = metadata.image || metadata.image_url || metadata.image_data;
                if (!imageUrl) {
                    throw new Error("No image URL found in metadata");
                }

                // 4. Download the NFT image
                nftImagePath = path.join("uploads", `nft_verify_${Date.now()}.jpg`);
                await downloadImage(imageUrl, nftImagePath);

                // 5. Generate pHash for the NFT image
                const sourceImagePHash = await generatePhash(nftImagePath);
                console.log("Generated pHash for NFT source image:", sourceImagePHash);

                // 6. Compare pHashes
                const sourceDistance = hammingDistance(uploadedHash, sourceImagePHash);
                const sourceThreshold = 10; // Adjust threshold as needed
                sourceImageMatch = sourceDistance <= sourceThreshold;

                console.log(`Source image comparison: distance=${sourceDistance}, threshold=${sourceThreshold}, match=${sourceImageMatch}`);

                sourceImageResult = {
                    sourceImagePHash,
                    sourceDistance,
                    sourceThreshold,
                    sourceImageMatch
                };

                // 7. Check ownership if ownerAddress is provided
                if (ownerAddress) {
                    try {
                        // Standard ERC721 ABI for ownerOf function
                        const erc721ABI = ["function ownerOf(uint256 tokenId) view returns (address)"];

                        // Create contract instance
                        const nftContract = new ethers.Contract(contractAddress, erc721ABI, provider);

                        // Get current owner
                        const currentOwner = await nftContract.ownerOf(tokenId);
                        console.log(`Current owner of token ${tokenId}: ${currentOwner}`);
                        console.log(`Claimed owner: ${ownerAddress}`);

                        // Assign to the outer scope variable
                        ownershipVerified = currentOwner.toLowerCase() === ownerAddress.toLowerCase();
                        console.log(`Ownership verification result: ${ownershipVerified}`);

                        ownershipResult = {
                            currentOwner,
                            claimedOwner: ownerAddress,
                            ownershipVerified
                        };
                    } catch (error) {
                        console.error("Error verifying ownership:", error);
                        ownershipResult = {
                            error: error.message,
                            ownershipVerified: false
                        };
                    }
                }
            } catch (error) {
                console.error("Error verifying NFT source image:", error);
                sourceImageResult = {
                    error: error.message,
                    sourceImageMatch: false
                };
            }
        } else {
            console.log("No contract address or token ID provided, skipping source image verification");
            sourceImageResult = {
                error: "No contract address or token ID provided",
                sourceImageMatch: false
            };
        }

        // === AI MODEL VERIFICATION (Cosine similarity) ===
        console.log("Performing AI verification using separate process...");
        try {
            // Use a separate Node.js process to run the CommonJS verification module
            // This avoids the "require is not defined" error in ES6 modules
            console.log(`[AI VERIFY] Verifying NFT: ${name} using separate process`);
            // Create the command to run the verification script
            const verifyCommand = `node ${path.join(__dirname, 'ai_verify.cjs')} "${name}" "${filePath}"`;
            console.log(`[AI VERIFY] Executing command: ${verifyCommand}`);
            // Execute the command and get the output
            let verifyOutput;
            try {
                verifyOutput = execSync(verifyCommand).toString().trim();
                console.log(`[AI VERIFY] Verification output: ${verifyOutput}`);
            } catch (execError) {
                console.error(`[AI VERIFY] execSync error:`, execError);
                aiModelResult = {
                    isFake: true,
                    confidence: 0,
                    error: `execSync error: ${execError.message}`
                };
                throw execError;
            }
            // Parse the JSON output
            aiModelResult = JSON.parse(verifyOutput);
            // Normalize fields for downstream logic
            if ('matched' in aiModelResult && 'similarity' in aiModelResult) {
                aiModelResult = {
                    isFake: !aiModelResult.matched,
                    confidence: aiModelResult.similarity * 100,
                    ...aiModelResult
                };
            }
            console.log("[AI VERIFY] AI verification result (normalized):", aiModelResult);
            console.log('=== LOG: AI verification complete, proceeding to build response object ===');

// === Sending Verification Response ===
// Calculate final result based on verification outcomes
let finalResult = "";
if (phashMatch && sourceImageMatch && aiModelResult.matched && ownershipVerified) {
  finalResult = "AUTHENTIC ✅ - All verification checks passed";
} else if (phashMatch && sourceImageMatch && aiModelResult.matched && !ownershipVerified) {
  finalResult = "AUTHENTIC BUT OWNERSHIP MISMATCH ⚠️ - Image verified but ownership doesn't match";
} else if (phashMatch && sourceImageMatch && !aiModelResult.matched) {
  finalResult = "SUSPICIOUS ⚠️ - Image matches but AI similarity is low";
} else if (!phashMatch || !sourceImageMatch) {
  finalResult = "FAKE ❌ - Image doesn't match registered or source NFT";
} else {
  finalResult = "VERIFICATION FAILED ❌ - Couldn't complete all verification steps";
}

const verificationResult = {
  ownershipVerified,
  phashMatch,
  sourceImageMatch,
  aiSimilarityScore: aiModelResult.confidence,
  cosineSimilarity: aiModelResult.similarity || (aiModelResult.confidence ? aiModelResult.confidence / 100 : 0),
  aiMatched: aiModelResult.matched,
  finalResult
  // Debug field removed
};
console.log("=== Sending Verification Response ===");
res.json(verificationResult);
console.log("=== Response sent successfully ===");
        } catch (error) {
            console.error("Error in AI server communication:", error.message);
            console.error("Error stack:", error.stack);

            // If there's a response from the AI server, log it
            if (error.response) {
                console.error("AI server response status:", error.response.status);
                console.error("AI server response data:", JSON.stringify(error.response.data, null, 2));
            }

            aiModelResult = {
                isFake: true,
                confidence: 0,
                error: error.message,
                errorType: error.constructor.name
            };
        }
    } catch (error) {
        console.error("Error in AI server communication:", error.message);
        console.error("Error stack:", error.stack);

        // If there's a response from the AI server, log it
        if (error.response) {
            console.error("AI server response status:", error.response.status);
            console.error("AI server response data:", JSON.stringify(error.response.data, null, 2));
        }

        aiModelResult = {
            isFake: true,
            confidence: 0,
            error: error.message,
            errorType: error.name,
            blockchainStatus: blockchainResult ? 'completed' : 'failed',
            aiStatus: 'failed',
            similarity: 0,
            matched: false
        };
        
        // Determine final conclusion based on all verification steps
        const phashMatch = blockchainResult?.phashMatch || false;
        const sourceImageMatch = sourceImageResult?.sourceImageMatch || false;
        const cosineSimilarity = aiModelResult?.similarity || 0;
        const ownershipVerified = ownershipResult?.ownershipVerified || false;
        
        // Calculate final result
        let finalResult = "";
        if (phashMatch && sourceImageMatch && cosineSimilarity >= 0.8 && ownershipVerified) {
            finalResult = "AUTHENTIC ✅ - All verification checks passed";
        } else if (phashMatch && sourceImageMatch && cosineSimilarity >= 0.8 && !ownershipVerified) {
            finalResult = "AUTHENTIC BUT OWNERSHIP MISMATCH ⚠️ - Image verified but ownership doesn't match";
        } else if (phashMatch && sourceImageMatch && cosineSimilarity < 0.8) {
            finalResult = "SUSPICIOUS ⚠️ - Image matches but AI similarity is low";
        } else if (!phashMatch || !sourceImageMatch) {
            finalResult = "FAKE ❌ - Image doesn't match registered or source NFT";
        } else {
            finalResult = "VERIFICATION FAILED ❌ - Couldn't complete all verification steps";
        }

        try {
            // Create the response object
            const responseObj = {
                ownershipVerified: ownershipVerified,
                phashMatch: phashMatch,
                sourceImageMatch: sourceImageMatch,
                cosineSimilarity: cosineSimilarity,
                aiSimilarityScore: cosineSimilarity * 100,
                aiMatched: cosineSimilarity >= 0.8,
                finalResult: finalResult
                // Details field removed
            };
            
            // Log the response being sent
            console.log('=== Sending Verification Response ===');
            console.log(JSON.stringify(responseObj, null, 2));
            
            // Return the formatted response
            res.json(responseObj);
            console.log('=== Response sent successfully ===');
        } catch (err) {
            console.error('=== ERROR in verification endpoint ===');
            console.error(err);
            // Always send an error response to the frontend
            res.status(500).json({ error: err.message || 'Unknown error in verification endpoint' });
        }
    } finally {
        // Clean up uploaded file
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log("Cleaned up uploaded file:", filePath);
            } catch (err) {
                console.error("Cleanup error:", err.message);
            }
        }
        
        // Clean up downloaded NFT image if it exists
        if (nftImagePath && fs.existsSync(nftImagePath)) {
            try {
                fs.unlinkSync(nftImagePath);
                console.log("Cleaned up downloaded NFT image:", nftImagePath);
            } catch (cleanupError) {
                console.error("Error cleaning up NFT image:", cleanupError.message);
            }
        }
    }
});

// Start the server after all routes are defined
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
