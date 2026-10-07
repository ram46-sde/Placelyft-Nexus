const mongoose = require('mongoose');
const dotenv = require('dotenv');
const readline = require('readline');
const User = require('./models/User');
const College = require('./models/College');

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_placement_db');
    console.log('Connected to MongoDB.');

    // 1. Ensure at least one College exists
    let defaultCollege = await College.findOne({ isActive: true });
    if (!defaultCollege) {
      console.log('No active College found. Creating a Default College...');
      defaultCollege = await College.create({
        name: 'Default Institution',
        contactEmail: 'admin@institution.edu',
        address: '123 University Drive',
      });
      console.log(`Created Default College: ${defaultCollege.name}`);
    } else {
      console.log(`Using existing College: ${defaultCollege.name}`);
    }

    console.log('\n--- SUPER ADMIN PROVISIONING ---');
    const name = await question('Enter Admin Name (e.g. System Admin): ');
    const email = await question('Enter Admin Email: ');
    
    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      console.log(`\nUser with email ${email} already exists! Aborting.`);
      process.exit(1);
    }

    const password = await question('Enter Admin Password (min 6 chars): ');

    if (password.length < 6) {
      console.log('\nPassword too short. Aborting.');
      process.exit(1);
    }

    // 2. Create Super Admin
    await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password,
      role: 'super_admin',
      collegeId: defaultCollege._id, // Assign to default college
    });

    console.log('\nSuccess! Super Admin account created securely.');
    process.exit(0);
  } catch (error) {
    console.error('Error during provisioning:', error);
    process.exit(1);
  }
};

seedAdmin();
