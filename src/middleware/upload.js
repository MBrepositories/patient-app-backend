const multer = require('multer');
const path = require('path');
const fs = require('fs');

const MEALS_UPLOAD_DIR = path.join(__dirname, '../../uploads/meals');

// Ensure directory exists
if (!fs.existsSync(MEALS_UPLOAD_DIR)) {
  fs.mkdirSync(MEALS_UPLOAD_DIR, { recursive: true });
}

const mealPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEALS_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `meal-${req.user.id}-${Date.now()}${ext}`;
    cb(null, name);
  },
});

const mealPhotoFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Only JPEG, PNG, WEBP or HEIC images are allowed.'), { statusCode: 400 }));
  }
};

const uploadMealPhoto = multer({
  storage: mealPhotoStorage,
  fileFilter: mealPhotoFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('photo');

module.exports = { uploadMealPhoto };
