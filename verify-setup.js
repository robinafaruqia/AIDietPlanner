// Simple verification script to check if setup is correct
// Run with: node verify-setup.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying AI Diet Planner Setup...\n');

const checks = {
  'package.json exists': fs.existsSync('package.json'),
  'server.js exists': fs.existsSync('server.js'),
  'models directory exists': fs.existsSync('models'),
  'routes directory exists': fs.existsSync('routes'),
  'services directory exists': fs.existsSync('services'),
  'views directory exists': fs.existsSync('views'),
  'public directory exists': fs.existsSync('public'),
};

let allPassed = true;

for (const [check, passed] of Object.entries(checks)) {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${check}`);
  if (!passed) allPassed = false;
}

// Check for node_modules
const hasNodeModules = fs.existsSync('node_modules');
console.log(`${hasNodeModules ? '✅' : '⚠️'} node_modules exists`);

if (!hasNodeModules) {
  console.log('\n⚠️  Run "npm install" to install dependencies');
}

// Check for .env
const hasEnv = fs.existsSync('.env');
console.log(`${hasEnv ? '✅' : '⚠️'} .env file exists`);

if (!hasEnv) {
  console.log('\n⚠️  Create a .env file with:');
  console.log('   PORT=3000');
  console.log('   DB_PROVIDER=supabase');
  console.log('   SUPABASE_URL=https://<project-ref>.supabase.co');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>');
  console.log('   SESSION_SECRET=your-secret-key');
}

console.log('\n' + '='.repeat(50));
if (allPassed && hasNodeModules && hasEnv) {
  console.log('✅ Setup looks good! You can run "npm start"');
} else {
  console.log('⚠️  Some setup steps are missing. See SETUP_INSTRUCTIONS.md');
}
console.log('='.repeat(50));

