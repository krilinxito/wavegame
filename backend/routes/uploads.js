const router = require('express').Router();
const upload = require('../middleware/multerConfig');

// POST /api/upload/photo
router.post('/photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No valid image file provided' });
  // Return relative path that can be served as /uploads/players/filename
  res.json({ path: `players/${req.file.filename}` });
});

module.exports = router;
