const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// アイテム画像用ストレージ
const itemStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'game-exchange/items',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
  }
});

// アバター用ストレージ
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'game-exchange/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 200, height: 200, crop: 'fill', quality: 'auto' }]
  }
});

const uploadItem   = multer({ storage: itemStorage,   limits: { fileSize: 5 * 1024 * 1024 } });
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 2 * 1024 * 1024 } });

module.exports = { cloudinary, uploadItem, uploadAvatar };
