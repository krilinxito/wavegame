const multer = require('multer');
const path = require('path');
const uuidv4 = () => require('crypto').randomUUID();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/players'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, allowed.includes(ext));
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });
