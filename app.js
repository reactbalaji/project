const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'); // Importing the required classes
const fs = require('fs');
const path = require('path');
const cors =  require('cors');

require('dotenv').config();

const app = express();
const port = 5555;

app.use(cors())
// Create an S3 client
const s3 = new S3Client({ 
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const upload = multer({ dest: 'uploads/' });  // File will be stored temporarily in uploads folder

// API route to handle file upload
app.post('/upload', upload.single('audio'), async (req, res) => {
  const file = req.file;
  const fileStream = fs.createReadStream(file.path);

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `audio/${Date.now()}_${file.originalname}`,  // Unique filename
    Body: fileStream,
    ContentType: 'audio/wav',
  };

  // Upload the file to S3
  const command = new PutObjectCommand(params);
  
  try {
    const data = await s3.send(command);
    fs.unlinkSync(file.path);  // Delete the file from server after upload
    res.status(200).send({ message: 'Upload successful', url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}` });
  } catch (err) {
    console.error('Error uploading to S3:', err);
    fs.unlinkSync(file.path); // Ensure the temporary file is deleted on error as well
    return res.status(500).send('Error uploading to S3');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
