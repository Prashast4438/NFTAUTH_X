import axios from 'axios';
import fs from 'fs';
import { promisify } from 'util';
import { pipeline as pipelineCallback } from 'stream';
const pipeline = promisify(pipelineCallback);

// Test IPFS URI
const testIpfsUri = 'ipfs://bafkreih5m7ugar6cscuwqas4bzwuef2agql5k6b53ukxsmaqqyvhanhnz4';

// Function to fetch metadata from IPFS
async function fetchMetadata(tokenURI) {
    try {
        let url = tokenURI;
        if (tokenURI.startsWith('ipfs://')) {
            const cid = tokenURI.replace('ipfs://', '');
            const gateways = [
                `https://cloudflare-ipfs.com/ipfs/${cid}`,
                `https://gateway.pinata.cloud/ipfs/${cid}`,
                `https://ipfs.io/ipfs/${cid}`,
                `https://dweb.link/ipfs/${cid}`
            ];
            
            console.log(`Testing IPFS gateways for CID: ${cid}`);
            let lastError = null;
            
            for (const gateway of gateways) {
                try {
                    console.log(`Trying gateway: ${gateway}`);
                    const response = await axios.get(gateway, { timeout: 10000 });
                    console.log(`Success with gateway: ${gateway}`);
                    console.log(`Response data:`, response.data);
                    return response.data;
                } catch (err) {
                    lastError = err;
                    console.log(`Failed with gateway: ${gateway}`);
                    console.log(`Error: ${err.message}`);
                    continue;
                }
            }
            
            throw new Error(`All IPFS gateways failed: ${lastError ? lastError.message : 'Unknown error'}`);
        } else {
            console.log(`Fetching from HTTP URL: ${url}`);
            const response = await axios.get(url);
            console.log(`Success with HTTP URL: ${url}`);
            console.log(`Response data:`, response.data);
            return response.data;
        }
    } catch (error) {
        console.error(`Failed to fetch metadata: ${error.message}`);
        throw error;
    }
}

// Function to download an image from URL or IPFS
async function downloadImage(imageUrl, outputPath) {
    try {
        let url = imageUrl;
        if (imageUrl.startsWith('ipfs://')) {
            const cid = imageUrl.replace('ipfs://', '');
            const gateways = [
                `https://cloudflare-ipfs.com/ipfs/${cid}`,
                `https://gateway.pinata.cloud/ipfs/${cid}`,
                `https://ipfs.io/ipfs/${cid}`,
                `https://dweb.link/ipfs/${cid}`
            ];
            
            console.log(`Testing IPFS gateways for image download, CID: ${cid}`);
            let lastError = null;
            
            for (const gateway of gateways) {
                try {
                    console.log(`Trying gateway for image: ${gateway}`);
                    const response = await axios({
                        method: 'get',
                        url: gateway,
                        responseType: 'stream',
                        timeout: 15000
                    });
                    
                    await pipeline(response.data, fs.createWriteStream(outputPath));
                    console.log(`Success downloading image with gateway: ${gateway}`);
                    return outputPath;
                } catch (err) {
                    lastError = err;
                    console.log(`Failed downloading image with gateway: ${gateway}`);
                    console.log(`Error: ${err.message}`);
                    continue;
                }
            }
            
            throw new Error(`All IPFS gateways failed for image download: ${lastError ? lastError.message : 'Unknown error'}`);
        } else {
            console.log(`Downloading from HTTP URL: ${url}`);
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream'
            });
            
            await pipeline(response.data, fs.createWriteStream(outputPath));
            console.log(`Success downloading image from HTTP URL: ${url}`);
            return outputPath;
        }
    } catch (error) {
        console.error(`Failed to download image: ${error.message}`);
        throw error;
    }
}

// Main test function
async function testIpfs() {
    console.log('=== IPFS Gateway Test ===');
    
    try {
        // Test metadata fetching
        console.log('\n1. Testing metadata fetching from IPFS...');
        const metadata = await fetchMetadata(testIpfsUri);
        console.log('Metadata fetching successful!');
        
        // If metadata contains an image URL, test downloading it
        if (metadata && metadata.image) {
            console.log(`\n2. Testing image download from: ${metadata.image}`);
            const outputPath = './test-image.jpg';
            await downloadImage(metadata.image, outputPath);
            console.log(`Image downloaded successfully to: ${outputPath}`);
        } else {
            console.log('No image URL found in metadata, skipping image download test');
        }
        
        console.log('\nIPFS gateway test completed successfully!');
    } catch (error) {
        console.error(`\nIPFS gateway test failed: ${error.message}`);
    }
}

// Run the test
testIpfs().catch(console.error);
