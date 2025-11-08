/**
 * Helper script to create UploadThing token
 * 
 * UploadThing requires a base64-encoded JSON object with this structure:
 * {
 *   apiKey: string,
 *   appId: string,
 *   regions: string[]
 * }
 * 
 * Usage:
 * 1. Get your API key and App ID from https://uploadthing.com/dashboard
 * 2. Run this script: node utils/createUploadThingToken.js
 * 3. Copy the generated token to your .env file as UPLOADTHING_TOKEN
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createToken() {
  console.log('📝 UploadThing Token Generator');
  console.log('==============================\n');
  console.log('Get your API key and App ID from: https://uploadthing.com/dashboard\n');

  const apiKey = await question('Enter your UploadThing API Key: ');
  const appId = await question('Enter your UploadThing App ID: ');
  const regionsInput = await question('Enter regions (comma-separated, default: us-east-1): ');
  
  const regions = regionsInput.trim() || 'us-east-1';
  const regionsArray = regions.split(',').map(r => r.trim());

  const tokenObject = {
    apiKey: apiKey.trim(),
    appId: appId.trim(),
    regions: regionsArray
  };

  // Base64 encode the JSON object
  const tokenString = JSON.stringify(tokenObject);
  const base64Token = Buffer.from(tokenString).toString('base64');

  console.log('\n✅ Generated Token:');
  console.log('==================');
  console.log(base64Token);
  console.log('\n📋 Add this to your server/.env file:');
  console.log(`UPLOADTHING_TOKEN=${base64Token}`);
  console.log('\n⚠️  Make sure to restart your server after adding the token!\n');

  rl.close();
}

createToken().catch(console.error);

