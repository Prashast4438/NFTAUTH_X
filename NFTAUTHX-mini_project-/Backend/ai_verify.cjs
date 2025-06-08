// CommonJS module for AI verification
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Get command line arguments
const name = process.argv[2];
const filePath = process.argv[3];

async function verifyWithAI() {
  try {
    // Prepare form data for image upload
    const form = new FormData();
    form.append('name', name);
    form.append('image', fs.createReadStream(filePath));

    // Make a POST request to the AI server's /verify endpoint
    const response = await axios.post('http://localhost:5050/verify', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    // Output the AI server's result as JSON
    console.log(JSON.stringify(response.data));
  } catch (error) {
    // Handle errors
    let errMsg = error.message;
    if (error.response && error.response.data) {
      errMsg += ' | ' + JSON.stringify(error.response.data);
    }
    console.log(JSON.stringify({
      isFake: true,
      confidence: 0,
      error: errMsg
    }));
  }
}

// Run the verification
verifyWithAI();
