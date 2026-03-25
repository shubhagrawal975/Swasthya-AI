const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const AppError = require('./AppError');

const ALLOWED = ['application/pdf','image/jpeg','image/png','image/webp'];
const BASE = process.env.UPLOAD_BASE_PATH || './uploads';
['credentials','camps','documents','avatars'].forEach(d => {
  const p = path.join(BASE, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const docFields = ['degree_certificate','mci_certificate','additional_docs'];
    let folder = 'documents';
    if (docFields.includes(file.fieldname)) folder = 'credentials';
    else if (['banner_image','profile_photo','avatar'].includes(file.fieldname)) folder = 'avatars';
    else if (file.fieldname === 'camp_banner') folder = 'camps';
    cb(null, path.join(BASE, folder));
  },
  filename: (req, file, cb) => {
    const uid = crypto.randomBytes(10).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g,'');
    const safe = file.fieldname.replace(/[^a-z0-9_]/gi,'_');
    cb(null, `${safe}-${uid}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED.includes(file.mimetype)) return cb(null, true);
  cb(new AppError(`File type not allowed: ${file.mimetype}`, 400), false);
};

const upload = multer({
  storage, fileFilter,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
});

module.exports = upload;
