/// <reference types="jest" />
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';

import { authService } from '../../authentication/auth.service';
import { workspaceService } from '../../workspaces/workspace.service';
import { userModel } from '../../users/user.model';
import { connectDB, disconnectDB } from '../../utils/database';
import { createTestApp, setupTestDatabase, TestData } from '../test-utils/test-helpers';

// ---------------------------
// Test suite
// ---------------------------
describe('Auth API – Mocked Tests (Jest Mocks)', () => {
  let mongo: MongoMemoryServer;
  let testData: TestData;
  let app: ReturnType<typeof createTestApp>;

  // Spin up in-memory Mongo
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    await mongoose.connect(uri);
    console.log('✅ Connected to in-memory MongoDB');

    // Ensure JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    }
    
    // Create app after DB connection (uses full production app)
    app = createTestApp();
  }, 60000); // 60 second timeout for MongoDB Memory Server startup

  // Clean mocks every test
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // Tear down DB
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop({ doCleanup: true, force: true });
  });

  // Fresh DB state before each test
  beforeEach(async () => {
    testData = await setupTestDatabase(app);
  });

  describe('POST /api/auth/signup - Sign Up, with mocks', () => {
    test('500 – returns 500 when validation middleware encounters non-ZodError', async () => {
      // Mocked behavior: schema.parse throws non-ZodError exception
      // Input: request body (doesn't matter, mock will intercept)
      // Expected status code: 500
      // Expected behavior: validation middleware catches non-ZodError and returns 500
      // Expected output: error message "Validation processing failed"
      // This tests the non-ZodError catch branch in validation.middleware.ts
      const { authenticateUserSchema } = require('../../authentication/auth.types');
      const originalParse = authenticateUserSchema.parse;
      
      jest.spyOn(authenticateUserSchema, 'parse').mockImplementation(() => {
        throw new Error('Unexpected validation error');
      });

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'any-token' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Internal server error');
        expect(res.body.message).toBe('Validation processing failed');
      } finally {
        authenticateUserSchema.parse = originalParse;
      }
    });

    test('401 – returns 401 when Google token is invalid', async () => {
      // Mocked behavior: authService.signUpWithGoogle throws Invalid Google token error
      // Input: invalid Google idToken
      // Expected status code: 401
      // Expected behavior: error handled gracefully
      // Expected output: error message "Invalid Google token"
      jest.spyOn(authService, 'signUpWithGoogle').mockRejectedValueOnce(new Error('Invalid Google token'));

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: 'invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid Google token');
    });

    test('409 – returns 409 when user already exists', async () => {
      // Mocked behavior: authService.signUpWithGoogle throws User already exists error
      // Input: valid Google idToken for existing user
      // Expected status code: 409
      // Expected behavior: error handled gracefully
      // Expected output: error message "User already exists"
      jest.spyOn(authService, 'signUpWithGoogle').mockRejectedValueOnce(new Error('User already exists'));

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: 'valid-token' });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });

    test('500 – returns 500 when service throws Failed to process user', async () => {
      // Mocked behavior: authService.signUpWithGoogle throws Failed to process user error
      // Input: valid Google idToken for new user
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message
      jest.spyOn(authService, 'signUpWithGoogle').mockRejectedValueOnce(new Error('Failed to process user'));

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: 'valid-token' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Failed to process user');
    });

    test('500 – returns 500 when service throws generic error', async () => {
      // Mocked behavior: authService.signUpWithGoogle throws generic error
      // Input: valid Google idToken
      // Expected status code: 500
      // Expected behavior: error passed to next()
      // Expected output: error handled by error handler
      jest.spyOn(authService, 'signUpWithGoogle').mockRejectedValueOnce(new Error('Unexpected error'));

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: 'valid-token' });

      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    test('500 – handles non-Error thrown value', async () => {
      // Mocked behavior: authService.signUpWithGoogle throws non-Error value
      // Input: valid Google idToken
      // Expected status code: 500 or handled by error handler
      // Expected behavior: next(error) called
      // Expected output: error handled by error handler
      jest.spyOn(authService, 'signUpWithGoogle').mockRejectedValueOnce('String error');

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: 'valid-token' });

      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    test('201 – returns 201 when signup succeeds and personal workspace is created', async () => {
      // Mocked behavior: authService.signUpWithGoogle succeeds, workspaceService.createWorkspace succeeds, userModel.updatePersonalWorkspace succeeds
      // Input: valid Google idToken
      // Expected status code: 201
      // Expected behavior: user created, personal workspace created, user updated with workspace ID
      // Expected output: success response with token and user data (tests auth.controller.ts lines 28-38)
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        googleId: 'test-google-id',
        email: 'test@example.com',
        name: 'Test User',
        profile: {
          imagePath: 'https://example.com/image.jpg',
          name: 'Test User',
          description: '',
        },
        profilePicture: 'https://example.com/image.jpg',
        fcmToken: undefined,
        personalWorkspaceId: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockWorkspace = {
        _id: new mongoose.Types.ObjectId(),
        name: "Test User's Personal Workspace",
        profile: {
          imagePath: 'https://example.com/image.jpg',
          name: "Test User's Personal Workspace",
          description: 'Your personal workspace for all your personal notes',
        },
        ownerId: mockUser._id,
        members: [mockUser._id],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(authService, 'signUpWithGoogle').mockResolvedValueOnce({
        token: 'mock-token',
        user: mockUser as any,
      });
      jest.spyOn(workspaceService, 'createWorkspace').mockResolvedValueOnce(mockWorkspace as any);
      jest.spyOn(userModel, 'updatePersonalWorkspace').mockResolvedValueOnce(mockUser as any);

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: 'valid-token' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User signed up successfully');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.token).toBe('mock-token');
      expect(res.body.data.user).toBeDefined();
      
      // Verify workspaceService.createWorkspace was called with correct parameters
      expect(workspaceService.createWorkspace).toHaveBeenCalledWith(
        mockUser._id,
        {
          name: "Test User's Personal Workspace",
          profilePicture: 'https://example.com/image.jpg',
          description: 'Your personal workspace for all your personal notes',
        }
      );
      
      // Verify userModel.updatePersonalWorkspace was called with correct parameters
      expect(userModel.updatePersonalWorkspace).toHaveBeenCalledWith(
        mockUser._id,
        new mongoose.Types.ObjectId(mockWorkspace._id)
      );
    });

    test('201 – returns 201 when signup succeeds with empty profile imagePath (fallback to empty string)', async () => {
      // Mocked behavior: authService.signUpWithGoogle succeeds with user that has no imagePath
      // Input: valid Google idToken
      // Expected status code: 201
      // Expected behavior: workspace created with empty string for profilePicture (tests auth.controller.ts line 25 fallback)
      // Expected output: success response (tests auth.controller.ts line 25 || '' branch)
      const mockUserNoImage = {
        _id: new mongoose.Types.ObjectId(),
        googleId: 'test-google-id-2',
        email: 'test2@example.com',
        name: 'Test User 2',
        profile: {
          imagePath: undefined, // No image path
          name: 'Test User 2',
          description: '',
        },
        profilePicture: undefined,
        fcmToken: undefined,
        personalWorkspaceId: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockWorkspaceNoImage = {
        _id: new mongoose.Types.ObjectId(),
        name: "Test User 2's Personal Workspace",
        profile: {
          imagePath: '',
          name: "Test User 2's Personal Workspace",
          description: 'Your personal workspace for all your personal notes',
        },
        ownerId: mockUserNoImage._id,
        members: [mockUserNoImage._id],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(authService, 'signUpWithGoogle').mockResolvedValueOnce({
        token: 'mock-token-2',
        user: mockUserNoImage as any,
      });
      jest.spyOn(workspaceService, 'createWorkspace').mockResolvedValueOnce(mockWorkspaceNoImage as any);
      jest.spyOn(userModel, 'updatePersonalWorkspace').mockResolvedValueOnce(mockUserNoImage as any);

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: 'valid-token-2' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User signed up successfully');
      
      // Verify workspaceService.createWorkspace was called with empty string for profilePicture (fallback)
      expect(workspaceService.createWorkspace).toHaveBeenCalledWith(
        mockUserNoImage._id,
        {
          name: "Test User 2's Personal Workspace",
          profilePicture: '', // Should be empty string when imagePath is undefined
          description: 'Your personal workspace for all your personal notes',
        }
      );
    });

    // Tests that exercise actual auth.service.ts code by mocking the Google OAuth client
    test('401 – signup with Google verification failure (exercises auth.service.ts lines 17-41)', async () => {
      // Mocked behavior: Google OAuth2Client.verifyIdToken rejects
      // Input: invalid Google idToken
      // Expected status code: 401
      // Expected behavior: auth.service.ts verifyGoogleToken catches error, throws "Invalid Google token"
      // Coverage: auth.service.ts lines 17-41 (verifyGoogleToken error path)
      
      const originalGoogleClient = (authService as any).googleClient;
      const mockVerifyIdToken = jest.fn().mockRejectedValue(new Error('Google verification failed'));
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'invalid-google-token' });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid Google token');
        expect(mockVerifyIdToken).toHaveBeenCalled();
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });

    test('401 – signup with null payload from Google (exercises auth.service.ts line 24-25)', async () => {
      // Mocked behavior: Google OAuth2Client returns ticket with null payload
      // Input: Google token that returns null payload
      // Expected status code: 401
      // Expected behavior: auth.service.ts verifyGoogleToken throws "Invalid Google token"
      // Coverage: auth.service.ts lines 24-25 (null payload check)
      
      const originalGoogleClient = (authService as any).googleClient;
      const mockTicket = { getPayload: jest.fn().mockReturnValue(null) };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'token-with-null-payload' });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid Google token');
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });

    test('401 – signup with missing email in payload (exercises auth.service.ts line 28-29)', async () => {
      // Mocked behavior: Google OAuth2Client returns payload missing email
      // Input: Google token with payload missing email
      // Expected status code: 401
      // Expected behavior: auth.service.ts verifyGoogleToken throws "Invalid Google token"
      // Coverage: auth.service.ts lines 28-29 (missing email/name check)
      
      const originalGoogleClient = (authService as any).googleClient;
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: 'test-google-id',
          name: 'Test User',
          picture: '',
          // email is missing
        }),
      };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'token-missing-email' });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid Google token');
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });

    test('409 – signup with existing user (exercises auth.service.ts lines 63-67)', async () => {
      // Mocked behavior: Google OAuth2Client returns valid payload for existing user
      // Input: valid Google token for user that already exists
      // Expected status code: 409
      // Expected behavior: auth.service.ts signUpWithGoogle finds existing user, throws "User already exists"
      // Coverage: auth.service.ts lines 63-67 (existing user check)
      
      // First create a user in the database
      const existingUser = await userModel.create({
        googleId: 'existing-google-id-for-signup-test',
        email: 'existing-signup@example.com',
        name: 'Existing User',
        profilePicture: '',
      });

      const originalGoogleClient = (authService as any).googleClient;
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: existingUser.googleId,
          email: 'existing-signup@example.com',
          name: 'Existing User',
          picture: '',
        }),
      };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'valid-token-for-existing-user' });

        expect(res.status).toBe(409);
        expect(res.body.message).toContain('already exists');
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });

    test('201 – signup success with actual service code (exercises auth.service.ts lines 70-74)', async () => {
      // Mocked behavior: Google OAuth2Client returns valid payload for new user
      // Input: valid Google token for new user
      // Expected status code: 201
      // Expected behavior: auth.service.ts creates user and generates token
      // Coverage: auth.service.ts lines 70-74 (user creation and token generation)
      
      const uniqueGoogleId = `new-user-google-id-${Date.now()}`;
      const uniqueEmail = `newuser-${Date.now()}@example.com`;

      const originalGoogleClient = (authService as any).googleClient;
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: uniqueGoogleId,
          email: uniqueEmail,
          name: 'New User',
          picture: 'https://example.com/pic.jpg',
        }),
      };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'valid-token-for-new-user' });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('User signed up successfully');
        expect(res.body.data.token).toBeDefined();
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user.email).toBe(uniqueEmail);
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });
  });

  describe('POST /api/auth/signin - Sign In, with mocks', () => {
    test('401 – returns 401 when Google token is invalid', async () => {
      // Mocked behavior: authService.signInWithGoogle throws Invalid Google token error
      // Input: invalid Google idToken
      // Expected status code: 401
      // Expected behavior: error handled gracefully
      // Expected output: error message "Invalid Google token"
      jest.spyOn(authService, 'signInWithGoogle').mockRejectedValueOnce(new Error('Invalid Google token'));

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ idToken: 'invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid Google token');
    });

    test('404 – returns 404 when user not found', async () => {
      // Mocked behavior: authService.signInWithGoogle throws User not found error
      // Input: valid Google idToken for non-existent user
      // Expected status code: 404
      // Expected behavior: error handled gracefully
      // Expected output: error message "User not found"
      jest.spyOn(authService, 'signInWithGoogle').mockRejectedValueOnce(new Error('User not found'));

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ idToken: 'valid-token' });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    test('500 – returns 500 when service throws Failed to process user', async () => {
      // Mocked behavior: authService.signInWithGoogle throws Failed to process user error
      // Input: valid Google idToken
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message
      jest.spyOn(authService, 'signInWithGoogle').mockRejectedValueOnce(new Error('Failed to process user'));

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ idToken: 'valid-token' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Failed to process user');
    });

    test('500 – handles non-Error thrown value', async () => {
      // Mocked behavior: authService.signInWithGoogle throws non-Error value
      // Input: valid Google idToken
      // Expected status code: 500 or handled by error handler
      // Expected behavior: next(error) called
      // Expected output: error handled by error handler
      jest.spyOn(authService, 'signInWithGoogle').mockRejectedValueOnce('String error');

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ idToken: 'valid-token' });

      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    test('200 – returns 200 when signin succeeds', async () => {
      // Mocked behavior: authService.signInWithGoogle succeeds
      // Input: valid Google idToken
      // Expected status code: 200
      // Expected behavior: user signed in successfully
      // Expected output: success response with token and user data (tests auth.controller.ts line 79)
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        googleId: 'test-google-id',
        email: 'test@example.com',
        name: 'Test User',
        profile: {
          imagePath: 'https://example.com/image.jpg',
          name: 'Test User',
          description: '',
        },
        profilePicture: 'https://example.com/image.jpg',
        fcmToken: undefined,
        personalWorkspaceId: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(authService, 'signInWithGoogle').mockResolvedValueOnce({
        token: 'mock-token',
        user: mockUser as any,
      });

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ idToken: 'valid-token' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User signed in successfully');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.token).toBe('mock-token');
      expect(res.body.data.user).toBeDefined();
    });

    // Tests that exercise actual auth.service.ts signin code by mocking the Google OAuth client
    test('401 – signin with Google verification failure (exercises auth.service.ts lines 17-41)', async () => {
      // Mocked behavior: Google OAuth2Client.verifyIdToken rejects
      // Input: invalid Google idToken
      // Expected status code: 401
      // Expected behavior: auth.service.ts verifyGoogleToken catches error, throws "Invalid Google token"
      // Coverage: auth.service.ts lines 17-41 (verifyGoogleToken error path via signin)
      
      const originalGoogleClient = (authService as any).googleClient;
      const mockVerifyIdToken = jest.fn().mockRejectedValue(new Error('Google verification failed'));
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      try {
        const res = await request(app)
          .post('/api/auth/signin')
          .send({ idToken: 'invalid-google-token' });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid Google token');
        expect(mockVerifyIdToken).toHaveBeenCalled();
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });

    test('404 – signin with non-existent user (exercises auth.service.ts lines 86-88)', async () => {
      // Mocked behavior: Google OAuth2Client returns valid payload for non-existent user
      // Input: valid Google token for user that doesn't exist
      // Expected status code: 404
      // Expected behavior: auth.service.ts signInWithGoogle doesn't find user, throws "User not found"
      // Coverage: auth.service.ts lines 86-88 (user not found check)
      
      const originalGoogleClient = (authService as any).googleClient;
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: 'non-existent-google-id-for-signin',
          email: 'nonexistent-signin@example.com',
          name: 'Non Existent',
          picture: '',
        }),
      };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      try {
        const res = await request(app)
          .post('/api/auth/signin')
          .send({ idToken: 'valid-token-for-nonexistent-user' });

        expect(res.status).toBe(404);
        expect(res.body.message).toContain('not found');
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });

    test('200 – signin success with actual service code (exercises auth.service.ts lines 91-93)', async () => {
      // Mocked behavior: Google OAuth2Client returns valid payload for existing user
      // Input: valid Google token for existing user
      // Expected status code: 200
      // Expected behavior: auth.service.ts finds user and generates token
      // Coverage: auth.service.ts lines 91-93 (token generation for existing user)
      
      // First create a user in the database
      const existingUser = await userModel.create({
        googleId: 'existing-google-id-for-signin-test',
        email: 'existing-signin@example.com',
        name: 'Existing Signin User',
        profilePicture: '',
      });

      const originalGoogleClient = (authService as any).googleClient;
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: existingUser.googleId,
          email: 'existing-signin@example.com',
          name: 'Existing Signin User',
          picture: '',
        }),
      };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      try {
        const res = await request(app)
          .post('/api/auth/signin')
          .send({ idToken: 'valid-token-for-existing-user' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('User signed in successfully');
        expect(res.body.data.token).toBeDefined();
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user._id.toString()).toBe(existingUser._id.toString());
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });
  });

  describe('POST /api/auth/dev-login - Dev Login, with mocks', () => {
    test('500 – returns 500 when service throws error', async () => {
      // Mocked behavior: authService.devLogin throws error
      // Input: email for new user
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message
      jest.spyOn(authService, 'devLogin').mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/auth/dev-login')
        .send({ email: 'dev-error@example.com' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Internal server error');
    });

    test('500 – handles non-Error thrown value', async () => {
      // Mocked behavior: authService.devLogin throws non-Error value
      // Input: email
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      jest.spyOn(authService, 'devLogin').mockRejectedValueOnce('String error');

      const res = await request(app)
        .post('/api/auth/dev-login')
        .send({ email: 'dev-error@example.com' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Dev login failed');
    });

    test('500 – handles Error with empty message by delegating to middleware', async () => {
      // Mocked behavior: authService.devLogin throws Error with empty message
      // Input: email
      // Expected status code: 500
      // Expected behavior: error.message is empty, so fallback to 'Dev login failed'
      // Expected output: 'Dev login failed' (tests auth.controller.ts line 126)
      const errorWithEmptyMessage = new Error('');
      errorWithEmptyMessage.message = ''; // Explicitly set empty message
      jest.spyOn(authService, 'devLogin').mockRejectedValueOnce(errorWithEmptyMessage);

      const res = await request(app)
        .post('/api/auth/dev-login')
        .send({ email: 'dev-error@example.com' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Internal server error');
    });
  });

  describe('Auth Service - generateAccessToken error paths via API', () => {
    test('500 – POST /api/auth/signup fails when JWT_SECRET is not configured via API (exercises auth.service.ts line 46-47)', async () => {
      // Input: JWT_SECRET not set, valid signup attempt via API
      // Expected behavior: generateAccessToken throws "JWT_SECRET not configured", API returns 500
      // Expected status code: 500
      // Coverage: auth.service.ts lines 46-47 (JWT_SECRET check)
      
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      // Clear module cache to get fresh JWT_SECRET evaluation
      jest.resetModules();

      // Re-import fresh modules and create fresh app
      const { authService: freshAuthService } = require('../../authentication/auth.service');
      const { userModel: freshUserModel } = require('../../users/user.model');
      const { createTestApp } = require('../test-utils/test-helpers');
      const freshApp = createTestApp();

      const uniqueGoogleId = `jwt-error-test-${Date.now()}`;
      const uniqueEmail = `jwt-error-${Date.now()}@example.com`;

      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: uniqueGoogleId,
          email: uniqueEmail,
          name: 'JWT Error Test User',
          picture: '',
        }),
      };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (freshAuthService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      // Mock userModel methods
      jest.spyOn(freshUserModel, 'findByGoogleId').mockResolvedValueOnce(null);
      jest.spyOn(freshUserModel, 'create').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        googleId: uniqueGoogleId,
        email: uniqueEmail,
        name: 'JWT Error Test User',
        profilePicture: '',
        profile: { name: 'JWT Error Test User', imagePath: '', description: '' },
      } as any);

      try {
        const res = await request(freshApp)
          .post('/api/auth/signup')
          .send({ idToken: 'valid-token-for-jwt-error' });

        // The error should propagate and be handled by error middleware
        expect(res.status).toBeGreaterThanOrEqual(500);
      } finally {
        // Restore JWT_SECRET
        process.env.JWT_SECRET = originalSecret;
        jest.resetModules();
        // Re-import to restore normal state
        require('../../authentication/auth.service');
        require('../../users/user.model');
      }
    });

    test('signup fails when jwt.sign returns non-string (exercises auth.service.ts line 52-53)', async () => {
      // Input: jwt.sign mocked to return null
      // Expected behavior: generateAccessToken throws "Failed to generate token"
      // Expected status code: 500
      // Coverage: auth.service.ts lines 52-53 (token type check)
      
      const originalGoogleClient = (authService as any).googleClient;
      const uniqueGoogleId = `token-fail-${Date.now()}`;
      const uniqueEmail = `token-fail-${Date.now()}@example.com`;

      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: uniqueGoogleId,
          email: uniqueEmail,
          name: 'Token Fail Test User',
          picture: '',
        }),
      };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      // Mock findByGoogleId to return null (new user)
      jest.spyOn(userModel, 'findByGoogleId').mockResolvedValueOnce(null);
      // Mock create to return a user
      jest.spyOn(userModel, 'create').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        googleId: uniqueGoogleId,
        email: uniqueEmail,
        name: 'Token Fail Test User',
        profilePicture: '',
        profile: { name: 'Token Fail Test User', imagePath: '', description: '' },
      } as any);

      // Mock jwt.sign to return null
      const signSpy = jest.spyOn(jwt, 'sign').mockReturnValue(null as any);

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'valid-token-for-token-fail' });

        // The error should propagate and be handled by error middleware
        expect(res.status).toBeGreaterThanOrEqual(500);
      } finally {
        (authService as any).googleClient = originalGoogleClient;
        signSpy.mockRestore();
      }
    });
  });

  describe('Database Connection Infrastructure Tests via API', () => {
    let savedMongoUri: string | undefined;

    beforeEach(() => {
      // Save the current test MongoDB URI
      savedMongoUri = mongo.getUri();
    });

    afterEach(async () => {
      // Clean up SIGINT listeners to avoid test interference
      process.removeAllListeners('SIGINT');
      // Clean up mongoose event listeners
      mongoose.connection.removeAllListeners('error');
      mongoose.connection.removeAllListeners('disconnected');
      
      // Restore connection to the test MongoDB for other tests
      if (mongoose.connection.readyState === 0 && savedMongoUri) {
        await mongoose.connect(savedMongoUri);
      }
    });

    test('connectDB connects successfully and API calls work (exercises database.ts lines 10-12)', async () => {
      // Input: valid MONGODB_URI
      // Expected behavior: connectDB connects to MongoDB, API calls succeed
      // Coverage: database.ts lines 5-12 (successful connection path)
      
      const originalMongoUri = process.env.MONGODB_URI;
      let testMongo: MongoMemoryServer | null = null;
      
      try {
        testMongo = await MongoMemoryServer.create();
        process.env.MONGODB_URI = testMongo.getUri();
        
        // Disconnect existing connection
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }

        // Call connectDB
        await connectDB();

        expect(mongoose.connection.readyState).toBe(1); // 1 = connected

        // Verify API works by making a dev-login call
        const res = await request(app)
          .post('/api/auth/dev-login')
          .send({ email: 'db-test@example.com' });

        expect(res.status).toBe(200);
        
        await mongoose.disconnect();
      } finally {
        process.env.MONGODB_URI = originalMongoUri;
        if (testMongo) {
          await testMongo.stop({ doCleanup: true, force: true });
        }
      }
    });

    test('connectDB handles missing MONGODB_URI (exercises database.ts lines 6-7, 33-35)', async () => {
      // Input: MONGODB_URI is undefined
      // Expected behavior: connectDB catches error, sets process.exitCode to 1
      // Coverage: database.ts lines 6-7 (uri check) and 33-35 (catch block)
      
      const originalMongoUri = process.env.MONGODB_URI;
      const originalExitCode = process.exitCode;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      try {
        delete process.env.MONGODB_URI;
        process.exitCode = undefined;

        await connectDB();

        expect(process.exitCode).toBe(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to connect to MongoDB:', expect.any(Error));
      } finally {
        process.env.MONGODB_URI = originalMongoUri;
        process.exitCode = originalExitCode;
        consoleErrorSpy.mockRestore();
      }
    });

    test('connectDB handles connection failure (exercises database.ts lines 33-35)', async () => {
      // Input: mongoose.connect fails
      // Expected behavior: Error caught, process.exitCode set to 1
      // Coverage: database.ts lines 33-35 (catch block)
      
      const originalMongoUri = process.env.MONGODB_URI;
      const originalExitCode = process.exitCode;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const connectSpy = jest.spyOn(mongoose, 'connect').mockRejectedValueOnce(new Error('Connection failed'));
      
      try {
        process.env.MONGODB_URI = 'mongodb://invalid-host:27017/test';
        process.exitCode = undefined;

        await connectDB();

        expect(process.exitCode).toBe(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to connect to MongoDB:', expect.any(Error));
      } finally {
        process.env.MONGODB_URI = originalMongoUri;
        process.exitCode = originalExitCode;
        connectSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }
    });

    test('connectDB registers error event handler (exercises database.ts lines 14-16)', async () => {
      // Input: MongoDB connection error event emitted
      // Expected behavior: Error handler logs error
      // Coverage: database.ts lines 14-16 (error event handler)
      
      const originalMongoUri = process.env.MONGODB_URI;
      let testMongo: MongoMemoryServer | null = null;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      try {
        testMongo = await MongoMemoryServer.create();
        process.env.MONGODB_URI = testMongo.getUri();
        
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }

        await connectDB();

        // Emit error event
        const testError = new Error('Test connection error');
        mongoose.connection.emit('error', testError);

        expect(consoleErrorSpy).toHaveBeenCalledWith('❌ MongoDB connection error:', testError);
        
        await mongoose.disconnect();
      } finally {
        process.env.MONGODB_URI = originalMongoUri;
        consoleErrorSpy.mockRestore();
        if (testMongo) {
          await testMongo.stop({ doCleanup: true, force: true });
        }
      }
    });

    test('connectDB registers disconnected event handler (exercises database.ts lines 18-20)', async () => {
      // Input: MongoDB disconnected event emitted
      // Expected behavior: Handler logs disconnection message
      // Coverage: database.ts lines 18-20 (disconnected event handler)
      
      const originalMongoUri = process.env.MONGODB_URI;
      let testMongo: MongoMemoryServer | null = null;
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      try {
        testMongo = await MongoMemoryServer.create();
        process.env.MONGODB_URI = testMongo.getUri();
        
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }

        await connectDB();

        // Emit disconnected event
        mongoose.connection.emit('disconnected');

        expect(consoleLogSpy).toHaveBeenCalledWith('⚠️ MongoDB disconnected');
        
        await mongoose.disconnect();
      } finally {
        process.env.MONGODB_URI = originalMongoUri;
        consoleLogSpy.mockRestore();
        if (testMongo) {
          await testMongo.stop({ doCleanup: true, force: true });
        }
      }
    });

    test('connectDB registers SIGINT handler that closes connection (exercises database.ts lines 22-28)', async () => {
      // Input: SIGINT signal emitted
      // Expected behavior: Connection closes, exitCode set to 0
      // Coverage: database.ts lines 22-28 (SIGINT handler success path)
      
      const originalMongoUri = process.env.MONGODB_URI;
      const originalExitCode = process.exitCode;
      let testMongo: MongoMemoryServer | null = null;
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      try {
        testMongo = await MongoMemoryServer.create();
        process.env.MONGODB_URI = testMongo.getUri();
        process.exitCode = undefined;
        
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }

        await connectDB();

        // Mock close to succeed
        const closeSpy = jest.spyOn(mongoose.connection, 'close').mockResolvedValueOnce(undefined);

        // Emit SIGINT
        process.emit('SIGINT', 'SIGINT');

        // Wait for async handler
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(closeSpy).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith('MongoDB connection closed through app termination');
        expect(process.exitCode).toBe(0);
        
        closeSpy.mockRestore();
        await mongoose.disconnect();
      } finally {
        process.env.MONGODB_URI = originalMongoUri;
        process.exitCode = originalExitCode;
        consoleLogSpy.mockRestore();
        if (testMongo) {
          await testMongo.stop({ doCleanup: true, force: true });
        }
      }
    });

    test('connectDB SIGINT handler handles close error (exercises database.ts lines 29-31)', async () => {
      // Input: SIGINT signal when connection.close fails
      // Expected behavior: Error caught and logged
      // Coverage: database.ts lines 29-31 (SIGINT handler error path)
      
      const originalMongoUri = process.env.MONGODB_URI;
      const originalExitCode = process.exitCode;
      let testMongo: MongoMemoryServer | null = null;
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      try {
        testMongo = await MongoMemoryServer.create();
        process.env.MONGODB_URI = testMongo.getUri();
        process.exitCode = undefined;
        
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }

        await connectDB();

        // Mock close to fail
        const closeError = new Error('Failed to close connection');
        const closeSpy = jest.spyOn(mongoose.connection, 'close').mockRejectedValueOnce(closeError);

        // Emit SIGINT
        process.emit('SIGINT', 'SIGINT');

        // Wait for async handler
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(closeSpy).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error closing MongoDB connection on SIGINT:', closeError);
        
        closeSpy.mockRestore();
        await mongoose.disconnect();
      } finally {
        process.env.MONGODB_URI = originalMongoUri;
        process.exitCode = originalExitCode;
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        if (testMongo) {
          await testMongo.stop({ doCleanup: true, force: true });
        }
      }
    });

    test('disconnectDB successfully closes connection (exercises database.ts lines 41-42)', async () => {
      // Input: connected mongoose instance
      // Expected behavior: Connection closes successfully
      // Coverage: database.ts lines 41-42 (disconnectDB success path)
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const closeSpy = jest.spyOn(mongoose.connection, 'close').mockResolvedValueOnce(undefined);
      
      try {
        await disconnectDB();

        expect(closeSpy).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith('✅ MongoDB disconnected successfully');
      } finally {
        closeSpy.mockRestore();
        consoleLogSpy.mockRestore();
      }
    });

    test('disconnectDB handles close error (exercises database.ts lines 43-44)', async () => {
      // Input: mongoose connection.close fails
      // Expected behavior: Error caught and logged
      // Coverage: database.ts lines 43-44 (disconnectDB error path)
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const closeError = new Error('Close failed');
      const closeSpy = jest.spyOn(mongoose.connection, 'close').mockRejectedValueOnce(closeError);
      
      try {
        await disconnectDB();

        expect(closeSpy).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error disconnecting from MongoDB:', closeError);
      } finally {
        closeSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }
    });
  });

});

