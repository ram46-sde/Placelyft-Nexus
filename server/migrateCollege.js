const mongoose = require('mongoose');
const User = require('./models/User');
const College = require('./models/College');
const PlacementDrive = require('./models/PlacementDrive');
require('dotenv').config();

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_placement_db');
  console.log('Migrating existing data...');
  
  let college = await College.findOne({ isActive: true });
  if (!college) {
    college = await College.create({
      name: 'Default Institution',
      contactEmail: 'admin@institution.edu',
      address: '123 University Drive',
    });
    console.log('Created Default College');
  }

  const resUser = await User.updateMany(
    { collegeId: { $exists: false } },
    { $set: { collegeId: college._id } }
  );
  console.log(`Updated ${resUser.modifiedCount} Users with collegeId.`);

  const resDrive = await PlacementDrive.updateMany(
    { collegeId: { $exists: false } },
    { $set: { collegeId: college._id } }
  );
  console.log(`Updated ${resDrive.modifiedCount} Drives with collegeId.`);

  await mongoose.disconnect();
}
migrate();
