let express = require('express');
let router  = express.Router();
const { 
    CognitoIdentityProviderClient, 
    SignUpCommand, 
    ConfirmSignUpCommand, 
    InitiateAuthCommand 
  } = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');

const dotenv = require('dotenv');

dotenv.config();


// === AWS Cognito Client Config ===
const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });
  

  // Function to calculate SECRET_HASH
  const calculateSecretHash = (username) => {
    const secretHash = crypto.createHmac('SHA256', process.env.COGNITO_CLIENT_SECRET)
                              .update(username + process.env.COGNITO_CLIENT_ID)
                              .digest('base64');
    return secretHash;
  };


  router.post('/signup', async (req, res) => {
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
  router.post('/confirm', async (req, res) => {
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
  router.post('/signin', async (req, res) => {
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

  module.exports = router;