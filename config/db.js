const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Atlas 接続成功');
  } catch (err) {
    console.error('❌ MongoDB 接続失敗:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
