import { Router, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { User } from '../models';
import { authenticate, AuthRequest } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memory storage — we'll upload the buffer directly to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// POST /api/upload/avatar
router.post('/avatar', upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Upload buffer to Cloudinary
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: 'netempo/avatars',
            public_id: `user_${req.user!.id}`,
            overwrite: true,
            transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }],
          },
          (err, result) => {
            if (err || !result) reject(err || new Error('Upload failed'));
            else resolve(result as { secure_url: string });
          }
        )
        .end(req.file!.buffer);
    });

    await User.findByIdAndUpdate(req.user!.id, { avatarUrl: result.secure_url });
    res.json({ avatarUrl: result.secure_url });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

export default router;
