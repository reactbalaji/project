let express = require('express');

const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();
let router = express.Router();

// === AWS S3 Client Config ===
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('audio'), async (req, res) => {
  const file = req.file;
  const fileStream = fs.createReadStream(file.path);

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `audio/${Date.now()}_${file.originalname}`, // Unique file name
    Body: fileStream,
    ContentType: 'audio/wav', // Set the MIME type
  };

  try {
    const command = new PutObjectCommand(params);
    const data = await s3.send(command);
    fs.unlinkSync(file.path); // Delete the temp file after upload
    res.status(200).send({
      message: 'Upload successful',
      url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`,
    });
  } catch (err) {
    console.error('Error uploading to S3:', err);
    fs.unlinkSync(file.path); // Clean up in case of error
    return res.status(500).send('Error uploading to S3');
  }
});


module.exports = router;



