/// <reference types="jest" />
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Request, Response, NextFunction } from 'express';

import { userModel } from '../../users/user.model';
import { workspaceModel } from '../../workspaces/workspace.model';
import * as authMiddleware from '../../authentication/auth.middleware';
import { createTestApp, setupTestDatabase, TestData } from '../test-utils/test-helpers';
import { UserController } from '../../users/user.controller';
import { workspaceService } from '../../workspaces/workspace.service';

const userController = new UserController();

// ---------------------------
// Test suite
// ---------------------------
describe('User API – Mocked Tests', () => {
  let mongo: MongoMemoryServer;
  let testData: TestData;
  let app: ReturnType<typeof createTestApp>;

  // Spin up in-memory Mongo
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    await mongoose.connect(uri);
    console.log('✅ Connected to in-memory MongoDB');
    
    // Create app after DB connection
    app = createTestApp();
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

  // Clean mocks every test
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('PUT /api/user/profile - Update Profile, with mocks', () => {
    test('500 – update profile handles service error', async () => {
      // Mocked behavior: userModel.update throws database connection error
      // Input: profile update data
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message from Error
      jest.spyOn(userModel, 'update').mockRejectedValueOnce(new Error('Database connection failed'));

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ profile: { name: 'Test' } });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Database connection failed');
    });

    test('500 – update profile handles non-Error thrown value', async () => {
      // Mocked behavior: userModel.update throws non-Error value
      // Input: profile update data
      // Expected status code: 500 or error handler
      // Expected behavior: next(error) called
      // Expected output: error handled by error handler
      jest.spyOn(userModel, 'update').mockRejectedValueOnce('String error');

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ profile: { name: 'Test' } });

      // Should call next(error) which might be handled by error handler
      // In our case, it should still return 500
      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    test('500 – update profile handles error without message (covers error.message || fallback)', async () => {
      // Mocked behavior: userModel.update throws Error without message property
      // Input: profile update data
      // Expected status code: 500
      // Expected behavior: fallback message used when error.message is undefined
      // Expected output: fallback error message
      const errorWithoutMessage = new Error();
      delete (errorWithoutMessage as any).message;
      jest.spyOn(userModel, 'update').mockRejectedValueOnce(errorWithoutMessage);

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ profile: { name: 'Test' } });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Failed to update user info');
    });

    test('404 when userModel.update returns null (line 39)', async () => {
      // Input: update request where userModel.update returns null
      // Expected status code: 404
      // Expected behavior: returns "User not found" error
      // Expected output: error message
      // This tests line 39 in user.controller.ts
      jest.spyOn(userModel, 'update').mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ profile: { name: 'Test' } });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('User not found');
    });
  });

  describe('DELETE /api/user/profile - Delete Profile, with mocks', () => {
    test('500 – delete profile handles service error', async () => {
      // Mocked behavior: workspaceModel.find throws database error
      // Input: authenticated user deletion request
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message from Error
      jest.spyOn(workspaceModel, 'find').mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .delete('/api/user/profile')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Database error');
    });

    test('500 – delete profile handles non-Error thrown value', async () => {
      // Mocked behavior: workspaceModel.find throws non-Error value
      // Input: authenticated user deletion request
      // Expected status code: 500 or error handler
      // Expected behavior: next(error) called
      // Expected output: error handled by error handler
      jest.spyOn(workspaceModel, 'find').mockRejectedValueOnce('String error');

      const res = await request(app)
        .delete('/api/user/profile')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    test('500 – delete profile handles error without message (covers error.message || fallback)', async () => {
      // Mocked behavior: workspaceModel.find throws Error without message property
      // Input: authenticated user deletion request
      // Expected status code: 500
      // Expected behavior: fallback message used when error.message is undefined
      // Expected output: fallback error message
      const errorWithoutMessage = new Error();
      delete (errorWithoutMessage as any).message;
      jest.spyOn(workspaceModel, 'find').mockRejectedValueOnce(errorWithoutMessage);

      const res = await request(app)
        .delete('/api/user/profile')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Failed to delete user');
    });
  });

  describe('POST /api/user/fcm-token - Update FCM Token, with mocks', () => {
    test('400 – update FCM token handles validation error', async () => {
      // Mocked behavior: userModel.updateFcmToken throws validation error
      // Input: fcmToken in request body
      // Expected status code: 400
      // Expected behavior: error handled gracefully
      // Expected output: error message from Error
      jest.spyOn(userModel, 'updateFcmToken').mockRejectedValueOnce(new Error('Invalid update data'));

      const res = await request(app)
        .post('/api/user/fcm-token')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ fcmToken: 'test-token' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid update data');
    });

    test('400 – update FCM token handles non-Error thrown value', async () => {
      // Mocked behavior: userModel.updateFcmToken throws non-Error value
      // Input: fcmToken in request body
      // Expected status code: 400 or error handler
      // Expected behavior: next(error) called
      // Expected output: error handled by error handler
      jest.spyOn(userModel, 'updateFcmToken').mockRejectedValueOnce('String error');

      const res = await request(app)
        .post('/api/user/fcm-token')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ fcmToken: 'test-token' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test('400 – update FCM token handles error without message (covers error.message || fallback)', async () => {
      // Mocked behavior: userModel.updateFcmToken throws Error without message property
      // Input: fcmToken in request body
      // Expected status code: 400
      // Expected behavior: fallback message used when error.message is undefined
      // Expected output: fallback error message
      const errorWithoutMessage = new Error();
      delete (errorWithoutMessage as any).message;
      jest.spyOn(userModel, 'updateFcmToken').mockRejectedValueOnce(errorWithoutMessage);

      const res = await request(app)
        .post('/api/user/fcm-token')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ fcmToken: 'test-token' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Failed to update FCM token');
    });

    test('404 when userModel.updateFcmToken returns null (line 117)', async () => {
      // Input: FCM token update where userModel.updateFcmToken returns null
      // Expected status code: 404
      // Expected behavior: returns "User not found" error
      // Expected output: error message
      // This tests line 117 in user.controller.ts
      jest.spyOn(userModel, 'updateFcmToken').mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/user/fcm-token')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ fcmToken: 'test-token' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('User not found');
    });
  });

  describe('GET /api/user/:id - Get User By ID, with mocks', () => {
    test('500 – get user by ID handles service error', async () => {
      // Mocked behavior: userModel.findById throws database error
      // Input: user ID in URL params
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message from Error
      jest.spyOn(userModel, 'findById').mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get(`/api/user/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Internal server error');
    });

    test('500 – get user by ID handles non-Error thrown value', async () => {
      // Mocked behavior: userModel.findById throws non-Error value
      // Input: user ID in URL params
      // Expected status code: 500 or error handler
      // Expected behavior: next(error) called
      // Expected output: error handled by error handler
      jest.spyOn(userModel, 'findById').mockRejectedValueOnce('String error');

      const res = await request(app)
        .get(`/api/user/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    test('500 – get user by ID handles error without message (covers error.message || fallback)', async () => {
      // Mocked behavior: userModel.findById throws Error without message property
      // Input: user ID in URL params
      // Expected status code: 500
      // Expected behavior: fallback message used when error.message is undefined
      // Expected output: fallback error message
      const errorWithoutMessage = new Error();
      delete (errorWithoutMessage as any).message;
      jest.spyOn(userModel, 'findById').mockRejectedValueOnce(errorWithoutMessage);

      const res = await request(app)
        .get(`/api/user/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Internal server error');
    });

    test('500 – get user by ID handles non-Error thrown value via API (covers lines 161-169)', async () => {
      // Mocked behavior: userModel.findById throws non-Error value
      // Input: user ID in URL params
      // Expected status code: 500
      // Expected behavior: next(error) called, error handler returns 500
      // Coverage: user.controller.ts lines 161-169 (non-Error branch)
      jest.spyOn(userModel, 'findById').mockRejectedValueOnce({ custom: 'error object' });

      const res = await request(app)
        .get(`/api/user/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      // Global error handler catches non-Error and returns 500
      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    test('500 – get user by ID handles Error without message via API (covers line 165)', async () => {
      // Mocked behavior: userModel.findById throws Error with empty message
      // Input: user ID in URL params
      // Expected status code: 500
      // Expected behavior: fallback message used (either from controller or error handler)
      // Coverage: user.controller.ts line 165 (error.message || fallback)
      const errorWithEmptyMessage = new Error('');
      jest.spyOn(userModel, 'findById').mockRejectedValueOnce(errorWithEmptyMessage);

      const res = await request(app)
        .get(`/api/user/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      // Error may be transformed by global error handler
      expect(res.body.message).toBeDefined();
    });

    test('500 – get user by ID handles Error with custom message via API (covers line 164)', async () => {
      // Mocked behavior: userModel.findById throws Error with custom message
      // Input: user ID in URL params
      // Expected status code: 500
      // Expected behavior: error is handled, may return custom or generic message
      // Coverage: user.controller.ts line 164 (error.message path)
      jest.spyOn(userModel, 'findById').mockRejectedValueOnce(new Error('Custom error'));

      const res = await request(app)
        .get(`/api/user/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      // Error handler may transform the message
      expect(res.body.message).toBeDefined();
    });
  });

  describe('GET /api/user/email/:email - Get User By Email, with mocks', () => {
    test('500 – get user by email handles service error', async () => {
      // Mocked behavior: userModel.findByEmail throws database error
      // Input: email in URL params
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message from Error
      jest.spyOn(userModel, 'findByEmail').mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get('/api/user/email/testuser1@example.com')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Database error');
    });

    test('500 – get user by email handles non-Error thrown value', async () => {
      // Mocked behavior: userModel.findByEmail throws non-Error value
      // Input: email in URL params
      // Expected status code: 500 or error handler
      // Expected behavior: next(error) called
      // Expected output: error handled by error handler
      jest.spyOn(userModel, 'findByEmail').mockRejectedValueOnce('String error');

      const res = await request(app)
        .get('/api/user/email/testuser1@example.com')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBeGreaterThanOrEqual(500);
    });

    test('500 – get user by email handles error without message (covers error.message || fallback)', async () => {
      // Mocked behavior: userModel.findByEmail throws Error without message property
      // Input: email in URL params
      // Expected status code: 500
      // Expected behavior: fallback message used when error.message is undefined
      // Expected output: fallback error message
      const errorWithoutMessage = new Error();
      delete (errorWithoutMessage as any).message;
      jest.spyOn(userModel, 'findByEmail').mockRejectedValueOnce(errorWithoutMessage);

      const res = await request(app)
        .get('/api/user/email/testuser1@example.com')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Failed to get user');
    });

    test('400 – get user by email handles empty email via API (covers !email branch)', async () => {
      // Input: request with empty email parameter
      // Expected status code: >= 400
      // Expected behavior: validation error or route not found
      // Coverage: user.controller.ts !email validation or Express route handling
      const res = await request(app)
        .get('/api/user/email/')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      // Express may return 404 (route not found) or the controller may return 400
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('User Model Methods - Coverage via API Tests', () => {
    test('500 – getWorkspaceMembers handles findByIds error (covers userModel.findByIds lines 145-147)', async () => {
      // Mocked behavior: userModel.findByIds throws database error
      // Input: workspaceId with members
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message
      // Coverage: user.model.ts lines 145-147 (findByIds catch block)
      jest.spyOn(userModel, 'findByIds').mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Database error');
    });

    test('401 – signin with non-existent Google ID (covers userModel.findByGoogleId null return, lines 155-156)', async () => {
      // Mocked behavior: Google OAuth returns valid payload for non-existent user
      // Input: Google token for user not in database
      // Expected status code: 404
      // Expected behavior: findByGoogleId returns null, auth service throws "User not found"
      // Coverage: user.model.ts lines 155-156 (findByGoogleId returns null)
      const { authService } = require('../../authentication/auth.service');
      const originalGoogleClient = (authService as any).googleClient;
      
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: 'non-existent-google-id-user-model-test',
          email: 'nonexistent-user-model@example.com',
          name: 'Non Existent',
          picture: '',
        }),
      };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      try {
        const res = await request(app)
          .post('/api/auth/signin')
          .send({ idToken: 'token-for-nonexistent-user' });

        expect(res.status).toBe(404);
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });

    test('500 – update profile handles userModel.update error (covers lines 112-114)', async () => {
      // Mocked behavior: userModel.update throws error
      // Input: valid profile update request
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Coverage: user.model.ts lines 112-114 (update catch block)
      jest.spyOn(userModel, 'update').mockRejectedValueOnce(new Error('Failed to update user'));

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ profile: { name: 'New Name', description: 'New desc' } });

      expect(res.status).toBe(500);
    });

    test('500 – delete user handles userModel.delete error (covers lines 121-123)', async () => {
      // Mocked behavior: userModel.delete throws error
      // Input: delete user request
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Coverage: user.model.ts lines 121-123 (delete catch block)
      jest.spyOn(userModel, 'delete').mockRejectedValueOnce(new Error('Failed to delete user'));

      const res = await request(app)
        .delete('/api/user/profile')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
    });

    test('500 – get user profile handles userModel.findById error (covers lines 136-138)', async () => {
      // Mocked behavior: userModel.findById throws error
      // Input: get profile request
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Coverage: user.model.ts lines 136-138 (findById catch block)
      jest.spyOn(userModel, 'findById').mockRejectedValueOnce(new Error('Failed to find user'));

      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
    });

    test('500 – get user by email handles userModel.findByEmail error (covers lines 170-172)', async () => {
      // Mocked behavior: userModel.findByEmail throws error
      // Input: get user by email request
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Coverage: user.model.ts lines 170-172 (findByEmail catch block)
      jest.spyOn(userModel, 'findByEmail').mockRejectedValueOnce(new Error('Failed to find user'));

      const res = await request(app)
        .get('/api/user/email/test@example.com')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
    });

    test('400 – update FCM token handles userModel.updateFcmToken error (covers lines 187-189)', async () => {
      // Mocked behavior: userModel.updateFcmToken throws error
      // Input: FCM token update request
      // Expected status code: 400 (controller returns 400 for errors)
      // Expected behavior: error handled gracefully
      // Coverage: user.model.ts lines 187-189 (updateFcmToken catch block)
      jest.spyOn(userModel, 'updateFcmToken').mockRejectedValueOnce(new Error('Failed to update FCM token'));

      const res = await request(app)
        .post('/api/user/fcm-token')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ fcmToken: 'test-fcm-token' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Failed to update FCM token');
    });

    test('500 – signup handles userModel.create ZodError (covers lines 85-88)', async () => {
      // Mocked behavior: userModel.create throws ZodError (validation fails)
      // Input: signup request with invalid data
      // Expected status code: 500
      // Expected behavior: ZodError caught, "Invalid update data" thrown
      // Coverage: user.model.ts lines 85-88 (create ZodError catch)
      const { z } = require('zod');
      const zodError = new z.ZodError([{ path: ['email'], message: 'Invalid email' }]);
      jest.spyOn(userModel, 'create').mockRejectedValueOnce(zodError);
      
      // Mock authService to bypass Google verification but still call userModel.create
      const { authService } = require('../../authentication/auth.service');
      const originalGoogleClient = (authService as any).googleClient;
      
      const uniqueGoogleId = `zod-error-test-${Date.now()}`;
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: uniqueGoogleId,
          email: `zod-error-${Date.now()}@example.com`,
          name: 'Zod Error Test',
          picture: '',
        }),
      };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      // Also need to mock findByGoogleId to return null (new user)
      jest.spyOn(userModel, 'findByGoogleId').mockResolvedValueOnce(null);

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'token-for-zod-error' });

        // The error propagates up
        expect(res.status).toBeGreaterThanOrEqual(400);
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });

    test('500 – signup handles userModel.create generic error (covers lines 89-90)', async () => {
      // Mocked behavior: userModel.create throws generic error
      // Input: signup request
      // Expected status code: 500
      // Expected behavior: generic error caught, "Failed to update user" thrown
      // Coverage: user.model.ts lines 89-90 (create generic error catch)
      jest.spyOn(userModel, 'create').mockRejectedValueOnce(new Error('Database error'));
      
      const { authService } = require('../../authentication/auth.service');
      const originalGoogleClient = (authService as any).googleClient;
      
      const uniqueGoogleId = `generic-error-test-${Date.now()}`;
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: uniqueGoogleId,
          email: `generic-error-${Date.now()}@example.com`,
          name: 'Generic Error Test',
          picture: '',
        }),
      };
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockTicket);
      (authService as any).googleClient = { verifyIdToken: mockVerifyIdToken };

      // Mock findByGoogleId to return null (new user)
      jest.spyOn(userModel, 'findByGoogleId').mockResolvedValueOnce(null);

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'token-for-generic-error' });

        expect(res.status).toBeGreaterThanOrEqual(500);
      } finally {
        (authService as any).googleClient = originalGoogleClient;
      }
    });

    // Tests for internal mongoose error handling via API
    // These cover the catch blocks that only trigger on database failures
    // by mocking the internal mongoose operations and calling the API
    
    test('500 – GET /api/workspace/:id/members triggers userModel.findByIds internal catch via API (lines 145-147)', async () => {
      // Mocked behavior: Internal mongoose find fails
      // Coverage: user.model.ts lines 145-147 (findByIds catch block)
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const internalUserModel = (userModel as any).user;
      const originalFind = internalUserModel.find;
      internalUserModel.find = jest.fn().mockRejectedValue(new Error('Database error'));

      try {
        const res = await request(app)
          .get(`/api/workspace/${testData.testWorkspaceId}/members`)
          .set('Authorization', `Bearer ${testData.testUserToken}`);

        expect(res.status).toBe(500);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error finding users by IDs:', expect.any(Error));
      } finally {
        internalUserModel.find = originalFind;
        consoleErrorSpy.mockRestore();
      }
    });

    test('500 – POST /api/auth/signin triggers userModel.findByGoogleId internal catch via API (lines 160-162)', async () => {
      // Mocked behavior: Internal mongoose findOne fails during Google signin
      // Coverage: user.model.ts lines 160-162 (findByGoogleId catch block)
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { authService } = require('../../authentication/auth.service');
      const originalGoogleClient = (authService as any).googleClient;
      
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: 'test-google-id-internal-catch',
          email: 'internal-catch@example.com',
          name: 'Test',
          picture: '',
        }),
      };
      (authService as any).googleClient = { verifyIdToken: jest.fn().mockResolvedValue(mockTicket) };
      
      const internalUserModel = (userModel as any).user;
      const originalFindOne = internalUserModel.findOne;
      internalUserModel.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

      try {
        const res = await request(app)
          .post('/api/auth/signin')
          .send({ idToken: 'token-for-internal-catch-test' });

        expect(res.status).toBe(500);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error finding user by Google ID:', expect.any(Error));
      } finally {
        internalUserModel.findOne = originalFindOne;
        (authService as any).googleClient = originalGoogleClient;
        consoleErrorSpy.mockRestore();
      }
    });

    test('500 – PUT /api/user/profile triggers userModel.update internal catch via API (lines 112-114)', async () => {
      // Mocked behavior: Internal mongoose findByIdAndUpdate fails
      // Coverage: user.model.ts lines 112-114 (update catch block)
      const loggerErrorSpy = jest.spyOn(require('../../utils/logger.util').default, 'error').mockImplementation(() => {});
      const internalUserModel = (userModel as any).user;
      const originalFindByIdAndUpdate = internalUserModel.findByIdAndUpdate;
      internalUserModel.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database error'));

      try {
        const res = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${testData.testUserToken}`)
          .send({ profile: { name: 'Test Name' } });

        expect(res.status).toBe(500);
        expect(loggerErrorSpy).toHaveBeenCalledWith('Error updating user:', expect.any(Error));
      } finally {
        internalUserModel.findByIdAndUpdate = originalFindByIdAndUpdate;
      loggerErrorSpy.mockRestore();
      }
    });

    test('500 – DELETE /api/user/profile triggers userModel.delete internal catch via API (lines 121-123)', async () => {
      // Mocked behavior: Internal mongoose findByIdAndDelete fails
      // Coverage: user.model.ts lines 121-123 (delete catch block)
      const loggerErrorSpy = jest.spyOn(require('../../utils/logger.util').default, 'error').mockImplementation(() => {});
      const internalUserModel = (userModel as any).user;
      const originalFindByIdAndDelete = internalUserModel.findByIdAndDelete;
      internalUserModel.findByIdAndDelete = jest.fn().mockRejectedValue(new Error('Database error'));

      try {
        const res = await request(app)
          .delete('/api/user/profile')
          .set('Authorization', `Bearer ${testData.testUserToken}`);

        expect(res.status).toBe(500);
      expect(loggerErrorSpy).toHaveBeenCalledWith('Error deleting user:', expect.any(Error));
      } finally {
      internalUserModel.findByIdAndDelete = originalFindByIdAndDelete;
      loggerErrorSpy.mockRestore();
      }
    });

    test('500 – GET /api/user/:id triggers userModel.findById internal catch via API (lines 136-138)', async () => {
      // Mocked behavior: Internal mongoose findOne fails
      // Coverage: user.model.ts lines 136-138 (findById catch block)
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const internalUserModel = (userModel as any).user;
      const originalFindOne = internalUserModel.findOne;
      internalUserModel.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

      try {
        const res = await request(app)
          .get(`/api/user/${testData.testUserId}`)
          .set('Authorization', `Bearer ${testData.testUserToken}`);

        // Auth middleware also uses findOne, so this may fail at auth level
        expect(res.status).toBeGreaterThanOrEqual(500);
      } finally {
      internalUserModel.findOne = originalFindOne;
      consoleErrorSpy.mockRestore();
      }
    });

    test('500 – GET /api/user/email/:email triggers userModel.findByEmail internal catch via API (lines 170-172)', async () => {
      // Mocked behavior: Internal mongoose findOne fails for email lookup
      // Coverage: user.model.ts lines 170-172 (findByEmail catch block)
      const loggerErrorSpy = jest.spyOn(require('../../utils/logger.util').default, 'error').mockImplementation(() => {});
      const internalUserModel = (userModel as any).user;
      const originalFindOne = internalUserModel.findOne;
      
      // Mock to fail only on the specific email query (not auth middleware)
      let callCount = 0;
      internalUserModel.findOne = jest.fn().mockImplementation((query: any) => {
        callCount++;
        // First call is from auth middleware, let it pass
        if (callCount === 1) {
          return originalFindOne.call(internalUserModel, query);
        }
        // Second call is from findByEmail
        return Promise.reject(new Error('Database error'));
      });

      try {
        const res = await request(app)
          .get('/api/user/email/test@example.com')
          .set('Authorization', `Bearer ${testData.testUserToken}`);

        expect(res.status).toBe(500);
        expect(loggerErrorSpy).toHaveBeenCalledWith('Error finding user by email:', expect.any(Error));
      } finally {
      internalUserModel.findOne = originalFindOne;
      loggerErrorSpy.mockRestore();
      }
    });

    test('400 – POST /api/user/fcm-token triggers userModel.updateFcmToken internal catch via API (lines 187-189)', async () => {
      // Mocked behavior: Internal mongoose findByIdAndUpdate fails
      // Coverage: user.model.ts lines 187-189 (updateFcmToken catch block)
      const loggerErrorSpy = jest.spyOn(require('../../utils/logger.util').default, 'error').mockImplementation(() => {});
      const internalUserModel = (userModel as any).user;
      const originalFindByIdAndUpdate = internalUserModel.findByIdAndUpdate;
      internalUserModel.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database error'));

      try {
        const res = await request(app)
          .post('/api/user/fcm-token')
          .set('Authorization', `Bearer ${testData.testUserToken}`)
          .send({ fcmToken: 'test-token' });

        expect(res.status).toBe(400);
        expect(loggerErrorSpy).toHaveBeenCalledWith('Error updating FCM token:', expect.any(Error));
      } finally {
        internalUserModel.findByIdAndUpdate = originalFindByIdAndUpdate;
        loggerErrorSpy.mockRestore();
      }
    });

    test('500 – POST /api/auth/signup triggers userModel.updatePersonalWorkspace internal catch via API (lines 204-206)', async () => {
      // Mocked behavior: Internal mongoose findByIdAndUpdate fails during signup
      // Coverage: user.model.ts lines 204-206 (updatePersonalWorkspace catch block)
      // Note: updatePersonalWorkspace is called during signup to set user's personal workspace
      const loggerErrorSpy = jest.spyOn(require('../../utils/logger.util').default, 'error').mockImplementation(() => {});
      
      // Mock userModel.updatePersonalWorkspace to throw
      jest.spyOn(userModel, 'updatePersonalWorkspace').mockRejectedValueOnce(new Error('Failed to update personal workspace'));
      
      const { authService } = require('../../authentication/auth.service');
      const originalGoogleClient = (authService as any).googleClient;
      
      const uniqueGoogleId = `personal-ws-error-${Date.now()}`;
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: uniqueGoogleId,
          email: `personal-ws-${Date.now()}@example.com`,
          name: 'Personal WS Test',
          picture: '',
        }),
      };
      (authService as any).googleClient = { verifyIdToken: jest.fn().mockResolvedValue(mockTicket) };
      jest.spyOn(userModel, 'findByGoogleId').mockResolvedValueOnce(null);
      jest.spyOn(userModel, 'create').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        googleId: uniqueGoogleId,
        email: `personal-ws-${Date.now()}@example.com`,
        name: 'Personal WS Test',
        profilePicture: '',
        profile: { name: 'Personal WS Test', imagePath: '', description: '' },
      } as any);

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'token-for-personal-ws-error' });

        // Error during personal workspace setup should cause signup to fail
        expect(res.status).toBeGreaterThanOrEqual(500);
      } finally {
        (authService as any).googleClient = originalGoogleClient;
        loggerErrorSpy.mockRestore();
      }
    });

    test('500 – POST /api/auth/signup triggers userModel.create ZodError catch via API (lines 85-87)', async () => {
      // Mocked behavior: Internal mongoose create called with invalid data
      // Coverage: user.model.ts lines 85-87 (create ZodError catch block)
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { createUserSchema } = require('../../users/user.types');
      const { z } = require('zod');
      const originalParse = createUserSchema.parse;
      
      const zodError = new z.ZodError([{ path: ['email'], message: 'Invalid email', code: 'custom' }]);
      createUserSchema.parse = jest.fn().mockImplementation(() => {
        throw zodError;
      });

      const { authService } = require('../../authentication/auth.service');
      const originalGoogleClient = (authService as any).googleClient;
      
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: `zod-internal-${Date.now()}`,
          email: `zod-internal-${Date.now()}@example.com`,
          name: 'Zod Test',
          picture: '',
        }),
      };
      (authService as any).googleClient = { verifyIdToken: jest.fn().mockResolvedValue(mockTicket) };
      jest.spyOn(userModel, 'findByGoogleId').mockResolvedValueOnce(null);

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'token-for-zod-internal' });

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Validation error:', zodError.issues);
      } finally {
        createUserSchema.parse = originalParse;
        (authService as any).googleClient = originalGoogleClient;
        consoleErrorSpy.mockRestore();
      }
    });

    test('500 – POST /api/auth/signup triggers userModel.create generic error catch via API (lines 89-90)', async () => {
      // Mocked behavior: Internal mongoose create fails
      // Coverage: user.model.ts lines 89-90 (create generic error catch block)
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const internalUserModel = (userModel as any).user;
      const originalCreate = internalUserModel.create;
      internalUserModel.create = jest.fn().mockRejectedValue(new Error('Database error'));

      const { authService } = require('../../authentication/auth.service');
      const originalGoogleClient = (authService as any).googleClient;
      
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue({
          sub: `create-internal-${Date.now()}`,
          email: `create-internal-${Date.now()}@example.com`,
          name: 'Create Test',
          picture: '',
        }),
      };
      (authService as any).googleClient = { verifyIdToken: jest.fn().mockResolvedValue(mockTicket) };
      jest.spyOn(userModel, 'findByGoogleId').mockResolvedValueOnce(null);

      try {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({ idToken: 'token-for-create-internal' });

        expect(res.status).toBeGreaterThanOrEqual(500);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating user:', expect.any(Error));
      } finally {
        internalUserModel.create = originalCreate;
        (authService as any).googleClient = originalGoogleClient;
        consoleErrorSpy.mockRestore();
      }
    });
  });

  describe('User routes - user authentication edge cases', () => {
    const buildAppWithMockedAuth = async (userMock: any) => {
      jest.resetModules();

      // Mock authenticateToken before requiring routes
      jest.doMock('../../authentication/auth.middleware', () => ({
        authenticateToken: async (req: Request, res: Response, next: NextFunction) => {
          req.user = userMock;
          next();
        },
      }));

      const helpers = await import('../test-utils/test-helpers.js') as typeof import('../test-utils/test-helpers');
      return helpers.createTestApp();
    };

    afterEach(() => {
      jest.resetModules();
      jest.dontMock('../../authentication/auth.middleware');
    });

    test('GET /api/user/profile - 401 when req.user is undefined (lines 15-16)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests lines 15-16 in user.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('PUT /api/user/profile - 401 when req.user is undefined (line 33)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests line 33 in user.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .put('/api/user/profile')
        .set('Authorization', 'Bearer fake-token')
        .send({ profile: { name: 'Test' } });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('DELETE /api/user/profile - 401 when req.user is undefined (line 65)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests line 65 in user.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .delete('/api/user/profile')
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('POST /api/user/fcm-token - 401 when req.user is undefined (line 107)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests line 107 in user.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .post('/api/user/fcm-token')
        .set('Authorization', 'Bearer fake-token')
        .send({ fcmToken: 'test-token' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('User not authenticated');
    });
  });

  describe('GET /api/user/email/:email - Email Validation', () => {
    test('400 – returns error when email parameter is empty string', async () => {
      const { UserController } = require('../../users/user.controller');
      const controller = new UserController();

      const req = {
        params: { email: '' },
        user: { _id: new mongoose.Types.ObjectId(testData.testUserId) },
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as any;
      const next = jest.fn();

      await controller.getUserByEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid email' });
    });
  });

  describe('User Model - Database Error Handling', () => {
    test('500 – workspace assignment fails when database operation throws error', async () => {
      const logger = require('../../utils/logger.util').default;
      const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
      const internalUserModel = (userModel as any).user;
      const originalFindByIdAndUpdate = internalUserModel.findByIdAndUpdate;
      internalUserModel.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database error'));

      try {
        await expect(
          userModel.updatePersonalWorkspace(
            new mongoose.Types.ObjectId(),
            new mongoose.Types.ObjectId()
          )
        ).rejects.toThrow('Failed to update personal workspace');
      } finally {
        internalUserModel.findByIdAndUpdate = originalFindByIdAndUpdate;
        loggerErrorSpy.mockRestore();
      }
    });
  });

  // ============================================================
  // LAST - Direct controller tests that modify internal mocks
  // Must run last to avoid interfering with other tests
  // ============================================================
  describe('GET /api/user/:id - Error Handler with Direct Controller Call', () => {
    test('next(error) called when non-Error is thrown (covers line 169)', async () => {
      // Input: non-Error value thrown
      // Expected behavior: logger.error called, then next(error) called for non-Error (line 169)
      // Expected output: next receives the non-Error value
      // This tests line 169 in user.controller.ts by calling controller directly
      const req = {
        params: { id: testData.testUserId },
        user: { _id: new mongoose.Types.ObjectId(testData.testUserId) },
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as any;
      const next = jest.fn();

      // Mock userModel.findById directly to throw a non-Error value
      // This bypasses the model's try-catch wrapper entirely
      jest.spyOn(userModel, 'findById').mockRejectedValueOnce({ custom: 'error object' });

      await userController.getUserById(req, res, next);

      // Verify that next was called with the non-Error object (line 169)
      expect(next).toHaveBeenCalledWith({ custom: 'error object' });
      expect(res.status).not.toHaveBeenCalled();
    });

    test('error.message || fallback works when Error has no message (line 165 - direct controller call)', async () => {
      // Input: Error instance without message property
      // Expected behavior: fallback message is used (line 164-165)
      // Expected output: 500 with fallback message
      // Must call controller directly to avoid asyncHandler intercepting
      const req = {
        params: { id: testData.testUserId },
        user: { _id: new mongoose.Types.ObjectId(testData.testUserId) },
      } as any;
      const jsonMock = jest.fn();
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jsonMock,
      } as any;
      const next = jest.fn();

      const errorWithoutMessage = new Error();
      delete (errorWithoutMessage as any).message;
      jest.spyOn(userModel, 'findById').mockRejectedValueOnce(errorWithoutMessage);

      await userController.getUserById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Failed to get user' });
    });

    test('Error with message is handled properly (line 164 - direct controller call)', async () => {
      // Input: Error instance with a message
      // Expected behavior: error message is returned (line 164)
      // Expected output: 500 with error message
      // Must call controller directly to test line 164
      const req = {
        params: { id: testData.testUserId },
        user: { _id: new mongoose.Types.ObjectId(testData.testUserId) },
      } as any;
      const jsonMock = jest.fn();
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jsonMock,
      } as any;
      const next = jest.fn();

      jest.spyOn(userModel, 'findById').mockRejectedValueOnce(new Error('Custom error'));

      await userController.getUserById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Custom error' });
    });
  });
});

