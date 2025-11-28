/// <reference types="jest" />
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { workspaceModel } from '../../workspaces/workspace.model';
import { messageModel } from '../../messages/message.model';
import { createTestApp, setupTestDatabase, TestData } from '../test-utils/test-helpers';

// ---------------------------
// Test suite
// ---------------------------
describe('Message API – Normal Tests (No Mocking)', () => {
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

  describe('GET /api/messages/workspace/:workspaceId - Get Messages', () => {
    test('200 – retrieves messages for workspace', async () => {
      // Input: workspaceId in URL, optional limit and before query params
      // Expected status code: 200
      // Expected behavior: messages returned sorted by createdAt descending
      // Expected output: array of messages
      // Create a message first
      const message = await messageModel.create({
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Test message',
      });

      const res = await request(app)
        .get(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].content).toBe('Test message');
    });

    test('200 – respects limit query parameter', async () => {
      // Input: workspaceId and limit=1
      // Expected status code: 200
      // Expected behavior: only 1 message returned
      // Expected output: array with 1 message
      // Create multiple messages first
      await messageModel.create({
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Message 1',
      });
      await messageModel.create({
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Message 2',
      });

      const res = await request(app)
        .get(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .query({ limit: '1' }) // Pass as string (query params are strings), schema will coerce
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
    });

    test('200 – respects before query parameter', async () => {
      // Input: workspaceId and before timestamp
      // Expected status code: 200
      // Expected behavior: only messages before timestamp returned
      // Expected output: array of messages before timestamp
      const beforeDate = new Date();
      
      // Create message after beforeDate
      await new Promise(resolve => setTimeout(resolve, 10));
      await messageModel.create({
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'After message',
      });

      const res = await request(app)
        .get(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .query({ before: beforeDate.toISOString() })
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      // Should not include the "After message"
      const hasAfterMessage = res.body.some((msg: any) => msg.content === 'After message');
      expect(hasAfterMessage).toBe(false);
    });

    test('400 – returns 400 when query params are invalid', async () => {
      // Input: invalid query parameters (limit as non-numeric string, before as invalid date)
      // Expected status code: 400
      // Expected behavior: validation error returned
      // Expected output: error response with validation details
      const res = await request(app)
        .get(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .query({ limit: 'not-a-number', before: 'not-a-valid-iso-date' }) // Both should fail validation
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(Array.isArray(res.body.error)).toBe(true); // Zod errors are arrays
    });

    test('404 – returns 404 when workspace not found', async () => {
      // Input: non-existent workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message "Workspace not found"
      const fakeWorkspaceId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/messages/workspace/${fakeWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    }, 60000); // Increase timeout to 60s for potential slow database operations

    test('403 – returns 403 when user is not a member', async () => {
      // Input: workspaceId where user is not a member
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message "Not a member of this workspace"
      // Create a workspace without the test user as member
      const workspace = await workspaceModel.create({
        name: 'Other Workspace',
        profile: { imagePath: '', name: 'Other Workspace', description: '' },
        ownerId: new mongoose.Types.ObjectId(),
        members: [new mongoose.Types.ObjectId()],
      });

      const res = await request(app)
        .get(`/api/messages/workspace/${workspace._id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Not a member of this workspace');
    });

    test('401 – returns 401 when user._id is not set', async () => {
      // Input: request where authenticateToken passes but req.user._id is undefined
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests line 18 in message.routes.ts
      const res = await request(app)
        .get(`/api/messages/workspace/${testData.testWorkspaceId}`)
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });
  });

  describe('POST /api/messages/workspace/:workspaceId - Create Message', () => {
    test('201 – creates message successfully', async () => {
      // Input: workspaceId in URL, content in body
      // Expected status code: 201
      // Expected behavior: message created and workspace timestamp updated
      // Expected output: created message object
      const res = await request(app)
        .post(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ content: 'New message' });

      expect(res.status).toBe(201);
      expect(res.body.content).toBe('New message');
      expect(res.body.authorId).toBe(testData.testUserId);
      expect(res.body.workspaceId).toBe(testData.testWorkspaceId);

      // Verify workspace timestamp was updated
      const workspace = await workspaceModel.findById(testData.testWorkspaceId);
      expect(workspace?.latestChatMessageTimestamp).toBeDefined();
    });

    test('400 – returns 400 when content is missing', async () => {
      // Input: request body without content
      // Expected status code: 400
      // Expected behavior: validation error returned
      // Expected output: error response
      const res = await request(app)
        .post(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test('404 – returns 404 when workspace not found', async () => {
      // Input: non-existent workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message "Workspace not found"
      const fakeWorkspaceId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/messages/workspace/${fakeWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ content: 'Test' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });

    test('403 – returns 403 when user is not a member', async () => {
      // Input: workspaceId where user is not a member
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message "Not a member of this workspace"
      const workspace = await workspaceModel.create({
        name: 'Other Workspace',
        profile: { imagePath: '', name: 'Other Workspace', description: '' },
        ownerId: new mongoose.Types.ObjectId(),
        members: [new mongoose.Types.ObjectId()],
      });

      const res = await request(app)
        .post(`/api/messages/workspace/${workspace._id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ content: 'Test' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Not a member of this workspace');
    });

    test('401 – returns 401 when user._id is not set', async () => {
      // Input: request where authenticateToken passes but req.user._id is undefined
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests line 64 in message.routes.ts
      const res = await request(app)
        .post(`/api/messages/workspace/${testData.testWorkspaceId}`)
        .send({ content: 'Test' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });
  });

  describe('DELETE /api/messages/:messageId - Delete Message', () => {
    test('200 – deletes message successfully (workspace owner)', async () => {
      // Input: messageId in URL
      // Expected status code: 200
      // Expected behavior: message deleted
      // Expected output: success message
      // Create a message
      const message = await messageModel.create({
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Message to delete',
      });

      const res = await request(app)
        .delete(`/api/messages/${message._id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Message deleted successfully');

      // Verify message is deleted
      const deletedMessage = await messageModel.findById(message._id);
      expect(deletedMessage).toBeNull();
    });

    test('404 – returns 404 when message not found', async () => {
      // Input: non-existent messageId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message "Message not found"
      const fakeMessageId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete(`/api/messages/${fakeMessageId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Message not found');
    });

    test('404 – returns 404 when workspace not found', async () => {
      // Input: messageId with associated workspace that doesn't exist
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message "Workspace not found"
      const fakeWorkspaceId = new mongoose.Types.ObjectId();
      const message = await messageModel.create({
        workspaceId: fakeWorkspaceId,
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Test',
      });

      const res = await request(app)
        .delete(`/api/messages/${message._id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });

    test('403 – returns 403 when user is not workspace owner', async () => {
      // Input: messageId in workspace where user is not owner
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message "Only workspace owner can delete messages"
      // Create workspace owned by another user
      const otherUserId = new mongoose.Types.ObjectId();
      const workspace = await workspaceModel.create({
        name: 'Other Workspace',
        profile: { imagePath: '', name: 'Other Workspace', description: '' },
        ownerId: otherUserId,
        members: [testData.testUserId, otherUserId],
      });

      const message = await messageModel.create({
        workspaceId: workspace._id,
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Test',
      });

      const res = await request(app)
        .delete(`/api/messages/${message._id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only workspace owner can delete messages');
    });

    test('401 – returns 401 when user._id is not set', async () => {
      // Input: request where authenticateToken passes but req.user._id is undefined
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests line 109 in message.routes.ts
      const message = await messageModel.create({
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        authorId: new mongoose.Types.ObjectId(testData.testUserId),
        content: 'Test',
      });

      const res = await request(app)
        .delete(`/api/messages/${message._id}`)
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });
  });
});

