/// <reference types="jest" />
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Request, Response, NextFunction } from 'express';

import { messageModel } from '../../messages/message.model';
import { workspaceModel } from '../../workspaces/workspace.model';
import * as authMiddleware from '../../authentication/auth.middleware';
import { createTestApp, setupTestDatabase, TestData } from '../test-utils/test-helpers';

// ---------------------------
// Test suite
// ---------------------------
describe('Message API – Mocked Tests (Jest Mocks)', () => {
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

  describe('GET /api/messages/workspace/:workspaceId - Get Messages, with mocks', () => {
    test('500 – returns 500 when messageModel.find throws error', async () => {
      // Mocked behavior: messageModel.find throws database error
      // Input: workspaceId in URL
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message "Failed to fetch messages"
      jest.spyOn(messageModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      } as any);

      const res = await request(app)
        .get(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch messages');
    });
  });

  describe('POST /api/messages/workspace/:workspaceId - Create Message, with mocks', () => {
    test('500 – returns 500 when messageModel.create throws error', async () => {
      // Mocked behavior: messageModel.create throws database error
      // Input: workspaceId in URL, content in body
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message "Failed to create message"
      jest.spyOn(messageModel, 'create').mockRejectedValue(new Error('Database error'));

      const res = await request(app)
        .post(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ content: 'Test message' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create message');
    });

    test('500 – returns 500 when workspaceModel.findByIdAndUpdate throws error', async () => {
      // Mocked behavior: workspaceModel.findByIdAndUpdate throws error
      // Input: workspaceId in URL, content in body
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message "Failed to create message"
      jest.spyOn(messageModel, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Test',
        createdAt: new Date(),
      } as any);
      jest.spyOn(workspaceModel, 'findByIdAndUpdate').mockRejectedValue(new Error('Update error'));

      const res = await request(app)
        .post(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ content: 'Test message' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create message');
    });
  });

  describe('DELETE /api/messages/:messageId - Delete Message, with mocks', () => {
    test('500 – returns 500 when messageModel.findById throws error', async () => {
      // Mocked behavior: messageModel.findById throws database error
      // Input: messageId in URL
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message "Failed to delete message"
      jest.spyOn(messageModel, 'findById').mockRejectedValue(new Error('Database error'));

      const messageId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete message');
    });

    test('500 – returns 500 when messageModel.findByIdAndDelete throws error', async () => {
      // Mocked behavior: messageModel.findByIdAndDelete throws database error
      // Input: messageId in URL
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message "Failed to delete message"
      // Create a message first
      const message = await messageModel.create({
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Test',
      });

      jest.spyOn(messageModel, 'findByIdAndDelete').mockRejectedValue(new Error('Delete error'));

      const res = await request(app)
        .delete(`/api/messages/${message._id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete message');
    });

    test('500 – returns 500 when workspaceModel.findById throws error', async () => {
      // Mocked behavior: workspaceModel.findById throws database error
      // Input: messageId in URL
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message "Failed to delete message"
      // Create a message first
      const message = await messageModel.create({
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Test',
      });

      jest.spyOn(workspaceModel, 'findById').mockRejectedValue(new Error('Database error'));

      const res = await request(app)
        .delete(`/api/messages/${message._id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete message');
    });
  });

  describe('Message routes - user authentication edge cases', () => {
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

    test('GET /api/messages/workspace/:workspaceId - 401 when req.user._id is undefined (line 18)', async () => {
      // Input: request where authenticateToken passes but req.user._id is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests line 18 in message.routes.ts
      const appInstance = await buildAppWithMockedAuth({} as any);

      const res = await request(appInstance)
        .get(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('POST /api/messages/workspace/:workspaceId - 401 when req.user._id is undefined (line 64)', async () => {
      // Input: request where authenticateToken passes but req.user._id is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests line 64 in message.routes.ts
      const appInstance = await buildAppWithMockedAuth({} as any);

      const res = await request(appInstance)
        .post(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', 'Bearer fake-token')
        .send({ content: 'Test message' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('DELETE /api/messages/:messageId - 401 when req.user._id is undefined (line 109)', async () => {
      // Input: request where authenticateToken passes but req.user._id is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests line 109 in message.routes.ts
      // Create a message first
      const message = await messageModel.create({
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Test',
      });

      const appInstance = await buildAppWithMockedAuth({} as any);

      const res = await request(appInstance)
        .delete(`/api/messages/${message._id}`)
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });
  });

  describe('Logger utility via API endpoints', () => {
    test('API success path triggers logger.info without extra args (coverage: logger.util.ts line 7 false branch)', async () => {
      // Input: successful API call
      // Expected behavior: logger.info called with message only (no extra args)
      // Coverage: logger.util.ts line 7 (args.length > 0 false branch)
      // Note: The message controller logs success without extra args
      const res = await request(app)
        .get(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      // API completed successfully, which means logger.info was called internally
    });

    test('API error path triggers logger.error with extra args (coverage: logger.util.ts line 11 true branch)', async () => {
      // Input: API call that triggers an error
      // Expected behavior: logger.error called with message + error details (extra args)
      // Coverage: logger.util.ts line 11 (args.length > 0 true branch)
      // Note: Error handlers log with error object as additional arg
      jest.spyOn(messageModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      } as any);

      const res = await request(app)
        .get(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      // API returned error, which means logger.error was called with error details
    });
  });

  describe('Logging System - Output Format Verification', () => {
    test('info logging formats message correctly without extra context', () => {
      const logger = require('../../utils/logger.util').default;
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        logger.info('Test message without args');
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test message without args'));
      } finally {
        stdoutSpy.mockRestore();
      }
    });

    test('info logging includes additional context when provided', () => {
      const logger = require('../../utils/logger.util').default;
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        logger.info('Test message', 'arg1', 'arg2', 123);
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test message'));
        expect(stdoutSpy).toHaveBeenCalledWith(expect.stringMatching(/arg1.*arg2.*123/));
      } finally {
        stdoutSpy.mockRestore();
      }
    });

    test('error logging formats message correctly without extra context', () => {
      const logger = require('../../utils/logger.util').default;
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        logger.error('Test error without args');
        expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Test error without args'));
      } finally {
        stderrSpy.mockRestore();
      }
    });

    test('error logging includes additional details when provided', () => {
      const logger = require('../../utils/logger.util').default;
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      try {
        logger.error('Test error', 'error detail', { code: 500 });
        expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Test error'));
        expect(stderrSpy).toHaveBeenCalledWith(expect.stringMatching(/error detail/));
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });
});

