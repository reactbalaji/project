const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const audioUploadRouter = require('./controller/audioUploadController');
const cognitoAuthRouter = require('./controller/cognitoAuthController');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const port = process.env.PORT || 5555;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());  // Parse JSON bodies
app.use(cors());

// === Routes ===
app.use('/audio', audioUploadRouter);  // Base route for audio upload
app.use('/auth', cognitoAuthRouter);   // Base route for cognito auth

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
