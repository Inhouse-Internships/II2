const mongoose = require('mongoose');
const env = require('./env');

let listenersBound = false;

function bindConnectionListeners() {
  if (listenersBound) return;
  listenersBound = true;

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
  });
}

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.set('strictQuery', true);
  bindConnectionListeners();

  await mongoose.connect(env.MONGO_URI, {
    maxPoolSize: env.IS_PRODUCTION ? 20 : 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    autoIndex: !env.IS_PRODUCTION
  });

  console.log('MongoDB connected');
  return mongoose.connection;
}

module.exports = connectDB;
