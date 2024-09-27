const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');
const { 
  CognitoIdentityProviderClient, 
  SignUpCommand, 
  ConfirmSignUpCommand, 
  InitiateAuthCommand 
} = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const port = 5555;

app.use(cors());
app.use(express.json());  // Parse JSON bodies

// === AWS S3 Client Configuration ===
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// === AWS Cognito Client Configuration ===
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// === Multer for File Upload Handling ===
const upload = multer({ dest: 'uploads/' });  // Temporary folder for file upload

// Function to calculate SECRET_HASH
const calculateSecretHash = (username) => {
  const secretHash = crypto.createHmac('SHA256', process.env.COGNITO_CLIENT_SECRET)
                            .update(username + process.env.COGNITO_CLIENT_ID)
                            .digest('base64');
  return secretHash;
};

// === Routes ===

// Upload audio file to S3
app.post('/upload', upload.single('audio'), async (req, res) => {
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

// Sign-up user route
app.post('/signup', async (req, res) => {
  const { username, password, email,gender} = req.body; // Extract user details from request body

  const params = {
    ClientId: process.env.COGNITO_CLIENT_ID,
    Username: username,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email},
      { Name: 'gender', Value: gender },
    ],
    SecretHash: calculateSecretHash(username), // Include SECRET_HASH
  };

  try {
    const command = new SignUpCommand(params);
    const result = await cognitoClient.send(command);
    res.status(200).send({ message: 'User signed up successfully', result });
  } catch (err) {
    console.error('Error during sign up:', err.message || JSON.stringify(err));
    res.status(400).send({ error: err.message });
  }
});

// Confirm user route (after getting verification code)
app.post('/confirm', async (req, res) => {
  const { username, code } = req.body;

  const params = {
    ClientId: process.env.COGNITO_CLIENT_ID,
    Username: username,
    ConfirmationCode: code,
    SecretHash: calculateSecretHash(username), // Include SECRET_HASH
  };

  try {
    const command = new ConfirmSignUpCommand(params);
    const result = await cognitoClient.send(command);
    res.status(200).send({ message: 'User confirmed successfully', result });
  } catch (err) {
    console.error('Error during confirmation:', err.message || JSON.stringify(err));
    res.status(400).send({ error: err.message });
  }
});

// Sign-in user route
app.post('/signin', async (req, res) => {
  const { username, password } = req.body;

  const params = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: process.env.COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
      SECRET_HASH: calculateSecretHash(username), // Include SECRET_HASH
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const result = await cognitoClient.send(command);
    res.status(200).send({
      message: 'Sign-in successful',
      accessToken: result.AuthenticationResult.AccessToken,
      idToken: result.AuthenticationResult.IdToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
    });
  } catch (err) {
    console.error('Error during sign-in:', err.message || JSON.stringify(err));
    res.status(400).send({ error: err.message });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
