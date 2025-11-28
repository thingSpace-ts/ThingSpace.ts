/// <reference types="jest" />
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express';

import logger from '../../utils/logger.util';
import { authMiddleware as legacyAuthMiddleware } from '../../authentication/auth.middleware';
import { userModel } from '../../users/user.model';
import { workspaceModel } from '../../workspaces/workspace.model';
import { authService } from '../../authentication/auth.service';
import { createTestApp, setupTestDatabase, TestData } from '../test-utils/test-helpers';

// ---------------------------
// Test suite
// ---------------------------
describe('Auth API – Normal Tests (No Mocking)', () => {
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

  // Tear down DB
  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongo) {
      await mongo.stop({ doCleanup: true, force: true });
    }
  });

  // Fresh DB state before each test
  beforeEach(async () => {
    testData = await setupTestDatabase(app);
  });

  describe('POST /api/auth/signup - Sign Up (Validation)', () => {
    test('400 – returns validation error when idToken is missing', async () => {
      // Input: request body without idToken
      // Expected status code: 400
      // Expected behavior: validateBody middleware rejects request
      // Expected output: validation error with details
      const res = await request(app)
        .post('/api/auth/signup')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.message).toBe('Invalid input data');
      expect(res.body.details).toBeDefined();
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    test('400 – returns validation error when idToken is empty string', async () => {
      // Input: request body with empty idToken
      // Expected status code: 400
      // Expected behavior: validateBody middleware rejects request (min(1) validation)
      // Expected output: validation error with details
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.details).toBeDefined();
      const fieldPaths = res.body.details.map((d: any) => d.field);
      expect(fieldPaths).toContain('idToken');
    });

    test('400 – returns validation error when idToken is wrong type', async () => {
      // Input: request body with non-string idToken
      // Expected status code: 400
      // Expected behavior: validateBody middleware rejects request (type validation)
      // Expected output: validation error with details
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.details).toBeDefined();
    });
  });

  describe('POST /api/auth/signin - Sign In (Validation)', () => {
    test('400 – returns validation error when idToken is missing', async () => {
      // Input: request body without idToken
      // Expected status code: 400
      // Expected behavior: validateBody middleware rejects request
      // Expected output: validation error with details
      const res = await request(app)
        .post('/api/auth/signin')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.message).toBe('Invalid input data');
      expect(res.body.details).toBeDefined();
    });
  });

  describe('POST /api/auth/dev-login - Dev Login', () => {
    test('200 – creates new test user and returns token', async () => {
      // Input: email in request body (optional, defaults to test@example.com)
      // Expected status code: 200
      // Expected behavior: creates new user if doesn't exist, returns token
      // Expected output: success response with token and user data
      const res = await request(app)
        .post('/api/auth/dev-login')
        .send({ email: 'dev-test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Dev login successful');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('dev-test@example.com');
    });

    test('200 – returns token for existing user', async () => {
      // Input: email of existing user
      // Expected status code: 200
      // Expected behavior: finds existing user, returns token
      // Expected output: success response with token and user data
      // First create a user
      const existingUser = await userModel.create({
        googleId: 'dev-test-existing',
        email: 'existing@example.com',
        name: 'Existing User',
        profilePicture: '',
      });

      const res = await request(app)
        .post('/api/auth/dev-login')
        .send({ email: 'existing@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Dev login successful');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user._id).toBe(existingUser._id.toString());
    });

    test('200 – uses default email when email not provided', async () => {
      // Input: empty request body (no email)
      // Expected status code: 200
      // Expected behavior: uses default email 'test@example.com'
      // Expected output: success response with token and user data
      const res = await request(app)
        .post('/api/auth/dev-login')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('test@example.com');
    });
  });

  describe('POST /api/auth/signup - Sign Up', () => {
    test('400 – returns 400 when idToken is missing', async () => {
      // Input: request body without idToken
      // Expected status code: 400
      // Expected behavior: validation error returned
      // Expected output: validation error response
      const res = await request(app)
        .post('/api/auth/signup')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('400 – returns 400 when idToken is empty string', async () => {
      // Input: request body with empty idToken
      // Expected status code: 400
      // Expected behavior: validation error returned
      // Expected output: validation error response
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/auth/signin - Sign In', () => {
    test('400 – returns 400 when idToken is missing', async () => {
      // Input: request body without idToken
      // Expected status code: 400
      // Expected behavior: validation error returned
      // Expected output: validation error response
      const res = await request(app)
        .post('/api/auth/signin')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    test('400 – returns 400 when idToken is empty string', async () => {
      // Input: request body with empty idToken
      // Expected status code: 400
      // Expected behavior: validation error returned
      // Expected output: validation error response
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ idToken: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/auth/dev-login - Database Error via API', () => {
    beforeEach(async () => {
      // Ensure database is connected before each test in this describe block
      if (mongoose.connection.readyState === 0 && mongo) {
        await mongoose.connect(mongo.getUri());
      }
    });

    afterEach(async () => {
      // Ensure database is reconnected after each test
      if (mongoose.connection.readyState === 0 && mongo) {
        await mongoose.connect(mongo.getUri());
      }
    });

    test('500 – dev-login returns error when database is disconnected', async () => {
      // Input: database operation that fails
      // Expected status code: 500
      // Expected behavior: Error caught by controller/middleware
      // Expected output: Internal server error (global error handler)
      if (!mongo) {
        throw new Error('MongoDB Memory Server not initialized');
      }
      const currentUri = mongo.getUri();
      
      // Disconnect database temporarily to trigger error
      await mongoose.disconnect();
      
      try {
        const res = await request(app)
          .post('/api/auth/dev-login')
          .send({ email: 'test-db-error@example.com' });

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Internal server error');
      } finally {
        // Reconnect using the same Mongo instance
        await mongoose.connect(currentUri);
      }
    });
  });

  describe('Async Handler integration via /api/auth/dev-login', () => {
    /**
     * Uses the real /api/auth/dev-login route but swaps the controller method so we can
     * deterministically trigger asyncHandler behaviours. No fake endpoints are introduced.
     */
    const buildAppWithMockedDevLogin = async (
      impl: () => Promise<void>
    ) => {
      jest.resetModules();

      if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
      }

      const { AuthController } = await import('../../authentication/auth.controller.js') as typeof import('../../authentication/auth.controller');
      jest
        .spyOn(AuthController.prototype, 'devLogin')
        .mockImplementation(async function devLoginMock(req, res, next) {
          await impl();
          return res;
        });

      const helpers = await import('../test-utils/test-helpers.js') as typeof import('../test-utils/test-helpers');
      const appInstance = helpers.createTestApp();

      return appInstance;
    };

    afterEach(() => {
      jest.restoreAllMocks();
      jest.resetModules();
    });

    test('500 – surfaces thrown Error through global error handler', async () => {
      // Input: POST /api/auth/dev-login with controller throwing an Error instance
      // Expected status code: 500
      // Expected behavior: error bubbles into asyncHandler and global error middleware
      // Expected output: generic 500 JSON response ({ message: 'Internal server error' })
      const appInstance = await buildAppWithMockedDevLogin(async () => {
        throw new Error('Integration failure');
      });

      const res = await request(appInstance)
        .post('/api/auth/dev-login')
        .send({ email: 'error@example.com' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
    });

    test('500 – surfaces non-Error rejections via Express default handler', async () => {
      // Input: POST /api/auth/dev-login with controller throwing a string (non-Error)
      // Expected status code: 500
      // Expected behavior: asyncHandler forwards rejection, Express default handler renders HTML
      // Expected output: HTML error page containing the non-Error value
      const appInstance = await buildAppWithMockedDevLogin(async () => {
        throw 'String error';
      });

      const res = await request(appInstance)
        .post('/api/auth/dev-login')
        .send({ email: 'error@example.com' });

      expect(res.status).toBe(500);
      expect(res.text).toContain('String error');
    });
  });

  describe('Global error handling', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('404 – returns structured response for unknown routes', async () => {
      // Input: GET request to unknown /api path with valid auth token
      // Expected status code: 404
      // Expected behaviour: notFoundHandler formats response with route details
      // Expected output: JSON containing error, message, path, method, timestamp
      const res = await request(app)
        .get('/api/route-that-does-not-exist')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .expect(404);

      expect(res.body).toMatchObject({
        error: 'Route not found',
        message: 'Cannot GET /api/route-that-does-not-exist',
        path: '/api/route-that-does-not-exist',
        method: 'GET',
      });
      expect(typeof res.body.timestamp).toBe('string');
    });

    test('500 – falls back to generic message when controller throws', async () => {
      // Input: POST /api/auth/signup where service layer throws
      // Expected status code: 500
      // Expected behaviour: global error handler logs and returns generic payload
      // Expected output: { message: 'Internal server error' }
      const loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
      const signUpSpy = jest
        .spyOn(authService, 'signUpWithGoogle')
        .mockRejectedValue(new Error('Simulated failure'));

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ idToken: 'valid-token' })
        .expect(500);

      expect(res.body).toEqual({ message: 'Internal server error' });
      expect(loggerSpy).toHaveBeenCalledWith('Error:', expect.any(Error));
      expect(signUpSpy).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('authenticateToken middleware', () => {
    const workspacePath = '/api/workspace/user';
    let originalSecret: string | undefined;

    beforeEach(() => {
      originalSecret = process.env.JWT_SECRET;
    });

    afterEach(() => {
      if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = originalSecret;
      }
    });

    test('401 – denies access when token is missing', async () => {
      // Input: request without Authorization header
      // Expected status code: 401
      // Expected behaviour: authenticateToken blocks request with Access denied
      // Expected output: JSON containing Access denied error
      const res = await request(app)
        .get(workspacePath)
        .expect(401);

      expect(res.body).toEqual({ error: 'Access denied', message: 'No token provided' });
    });

    test('500 – returns configuration error when JWT_SECRET missing', async () => {
      // Input: request with token but JWT_SECRET unset
      // Expected status code: 500
      // Expected behaviour: authenticateToken responds with configuration error
      // Expected output: error message "JWT_SECRET not configured"
      delete process.env.JWT_SECRET;

      const res = await request(app)
        .get(workspacePath)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .expect(500);

      expect(res.body).toEqual({
        error: 'Server configuration error',
        message: 'JWT_SECRET not configured',
      });
    });

    test('401 – returns user not found when token references missing user', async () => {
      // Input: token signed for a non-existent user
      // Expected status code: 401
      // Expected behaviour: authenticateToken returns user not found error
      // Expected output: message "Token is valid but user no longer exists"
      const ghostId = new mongoose.Types.ObjectId();
      const ghostToken = jwt.sign({ id: ghostId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

      const res = await request(app)
        .get(workspacePath)
        .set('Authorization', `Bearer ${ghostToken}`)
        .expect(401);

      expect(res.body).toEqual({
        error: 'User not found',
        message: 'Token is valid but user no longer exists',
      });
    });

    test('401 – returns token expired when token is past expiry', async () => {
      // Input: expired token
      // Expected status code: 401
      // Expected behaviour: authenticateToken detects TokenExpiredError
      // Expected output: error "Token expired" and prompt to login again
      const expiredToken = jwt.sign(
        { id: new mongoose.Types.ObjectId(testData.testUserId) },
        process.env.JWT_SECRET as string,
        { expiresIn: '1ms' }
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      const res = await request(app)
        .get(workspacePath)
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body).toEqual({
        error: 'Token expired',
        message: 'Please login again',
      });
    });

    test('401 – returns invalid token when JWT is malformed', async () => {
      // Input: malformed token
      // Expected status code: 401
      // Expected behaviour: authenticateToken responds with invalid token error
      // Expected output: error "Invalid token" and descriptive message
      const res = await request(app)
        .get(workspacePath)
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);

      expect(res.body).toEqual({
        error: 'Invalid token',
        message: 'Token is malformed or expired',
      });
    });

    test('200 – allows access when token is valid', async () => {
      // Input: valid token issued by test helpers
      // Expected status code: 200
      // Expected behaviour: authenticateToken sets req.user and allows route handler
      // Expected output: successful workspaces response
      const res = await request(app)
        .get(workspacePath)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .expect(200);

      expect(res.body.message).toBe('Workspaces retrieved successfully');
      expect(Array.isArray(res.body.data.workspaces)).toBe(true);
    });
  });

  describe('authMiddleware legacy export', () => {
    const createMockRes = () => {
      const json = jest.fn();
      const res = {
        status: jest.fn().mockReturnThis(),
        json,
      } as unknown as ExpressResponse;
      return { res, json };
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('401 – returns 401 when no token provided', () => {
      // Input: request without Authorization header
      // Expected behaviour: authMiddleware responds with 401
      const { res, json } = createMockRes();
      const next = jest.fn();

      legacyAuthMiddleware({ headers: {} } as unknown as ExpressRequest, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    test('next receives configuration error when JWT_SECRET missing', () => {
      // Input: JWT_SECRET unset at module load
      // Expected behaviour: middleware forwards configuration error to next
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      let middleware: ((req: ExpressRequest, res: ExpressResponse, next: NextFunction) => unknown) | undefined;
      jest.isolateModules(() => {
        ({ authMiddleware: middleware } = require('../../authentication/auth.middleware'));
      });

      if (!middleware) {
        throw new Error('authMiddleware not loaded');
      }

      if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = originalSecret;
      }

      const { res } = createMockRes();
      const next = jest.fn();

      middleware(
        { headers: { authorization: 'Bearer whatever' } } as unknown as ExpressRequest,
        res,
        next
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'JWT_SECRET not configured' }));
      expect(res.status).not.toHaveBeenCalled();
    });

    test('401 – handles token expiration errors', () => {
      // Input: jwt.verify throws TokenExpiredError
      // Expected behaviour: middleware returns 401 Invalid token
      const { res, json } = createMockRes();
      const next = jest.fn();
      const verifySpy = jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new jwt.TokenExpiredError('Expired', new Date());
      });

      legacyAuthMiddleware(
        { headers: { authorization: 'Bearer expired' } } as unknown as ExpressRequest,
        res,
        next
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
      verifySpy.mockRestore();
    });

    test('401 – handles malformed token errors', () => {
      // Input: jwt.verify throws JsonWebTokenError
      // Expected behaviour: middleware returns 401 Invalid token
      const { res, json } = createMockRes();
      const next = jest.fn();
      const verifySpy = jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new jwt.JsonWebTokenError('malformed');
      });

      legacyAuthMiddleware(
        { headers: { authorization: 'Bearer malformed' } } as unknown as ExpressRequest,
        res,
        next
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
      verifySpy.mockRestore();
    });

    test('401 – handles unexpected verification errors', () => {
      // Input: jwt.verify throws generic Error
      // Expected behaviour: middleware falls back to generic invalid token response
      const { res, json } = createMockRes();
      const next = jest.fn();
      const verifySpy = jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('boom');
      });

      legacyAuthMiddleware(
        { headers: { authorization: 'Bearer bad' } } as unknown as ExpressRequest,
        res,
        next
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
      verifySpy.mockRestore();
    });

    test('calls next when token is valid', () => {
      // Input: valid token with configured secret
      // Expected behaviour: middleware attaches decoded payload to req.user and calls next
      const { res } = createMockRes();
      const next = jest.fn();
      const validToken = jwt.sign({ foo: 'bar' }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
      const req = {
        headers: { authorization: `Bearer ${validToken}` },
      } as unknown as ExpressRequest;

      legacyAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.user).toMatchObject({ foo: 'bar' });
    });

    test('next receives configuration error when JWT_SECRET becomes undefined at runtime', () => {
      // Input: JWT_SECRET set at module load but undefined at runtime (lines 93-95)
      // Expected behaviour: middleware forwards configuration error to next
      const originalSecret = process.env.JWT_SECRET;
      
      // Temporarily delete JWT_SECRET after module has loaded (but moduleHadJwtSecret is true)
      const currentSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const { res } = createMockRes();
      const next = jest.fn();

      legacyAuthMiddleware(
        { headers: { authorization: 'Bearer whatever' } } as unknown as ExpressRequest,
        res,
        next
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'JWT_SECRET not configured' }));
      expect(res.status).not.toHaveBeenCalled();

      // Restore
      if (currentSecret) {
        process.env.JWT_SECRET = currentSecret;
      }
      if (originalSecret) {
        process.env.JWT_SECRET = originalSecret;
      }
    });

    test('next receives configuration error from catch block', () => {
      // Input: Error with message 'JWT_SECRET not configured' thrown in try block (lines 105-107)
      // Expected behaviour: middleware forwards error to next from catch block
      const { res } = createMockRes();
      const next = jest.fn();
      
      // Mock jwt.verify to throw the specific error we want to test
      const verifySpy = jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('JWT_SECRET not configured');
      });

      legacyAuthMiddleware(
        { headers: { authorization: 'Bearer token' } } as unknown as ExpressRequest,
        res,
        next
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'JWT_SECRET not configured' }));
      expect(res.status).not.toHaveBeenCalled();
      
      verifySpy.mockRestore();
    });
  });
});

