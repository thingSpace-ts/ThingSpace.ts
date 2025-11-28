/// <reference types="jest" />
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { workspaceModel } from '../../workspaces/workspace.model';
import { userModel } from '../../users/user.model';
import { noteModel } from '../../notes/note.model';
import { workspaceService } from '../../workspaces/workspace.service';
import { NoteType } from '../../notes/notes.types';
import { notificationService } from '../../notifications/notification.service';
import { createTestApp, setupTestDatabase, TestData } from '../test-utils/test-helpers';

// ---------------------------
// Test suite
// ---------------------------
describe('Workspace API – Normal Tests (No Mocking)', () => {
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

  describe('POST /api/workspace - Create Workspace', () => {
    test('400 – returns validation error when name is missing', async () => {
      // Input: request body without name
      // Expected status code: 400
      // Expected behavior: validateBody middleware rejects request
      // Expected output: validation error with details
      const res = await request(app)
        .post('/api/workspace')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.message).toBe('Invalid input data');
      expect(res.body.details).toBeDefined();
    });

    test('400 – returns validation error when name is empty string', async () => {
      // Input: request body with empty name
      // Expected status code: 400
      // Expected behavior: validateBody middleware rejects request (min(1) validation)
      // Expected output: validation error with details
      const res = await request(app)
        .post('/api/workspace')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.details).toBeDefined();
      const fieldPaths = res.body.details.map((d: any) => d.field);
      expect(fieldPaths).toContain('name');
    });

    test('400 – returns validation error when name has wrong type', async () => {
      // Input: request body with non-string name
      // Expected status code: 400
      // Expected behavior: validateBody middleware rejects request (type validation)
      // Expected output: validation error with details
      const res = await request(app)
        .post('/api/workspace')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ name: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.details).toBeDefined();
    });

    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 10-11 in workspace.controller.ts
      const res = await request(app)
        .post('/api/workspace')
        .send({ name: 'Test Workspace' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test('201 – creates a workspace', async () => {
      // Input: workspaceData with name, optional description and profilePicture
      // Expected status code: 201
      // Expected behavior: workspace is created in database
      // Expected output: workspaceId of the created workspace
      const workspaceData = {
        name: 'My New Workspace',
        description: 'A test workspace',
        profilePicture: 'https://example.com/image.jpg',
      };

      const res = await request(app)
        .post('/api/workspace')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send(workspaceData);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Workspace created successfully');
      expect(res.body.data.workspaceId).toBeDefined();
    });

    test('201 – creates workspace with minimal data', async () => {
      // Input: workspaceData with only name
      // Expected status code: 201
      // Expected behavior: workspace is created with default values
      // Expected output: workspaceId of the created workspace
      const workspaceData = {
        name: 'Minimal Workspace',
      };

      const res = await request(app)
        .post('/api/workspace')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send(workspaceData);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Workspace created successfully');
      expect(res.body.data.workspaceId).toBeDefined();
    });

    test('409 – workspace name already in use', async () => {
      // Input: workspaceData with name that already exists for this user
      // Expected status code: 409
      // Expected behavior: error message returned
      // Expected output: error message
      const workspaceData = {
        name: 'Test Workspace', // Same name as testData.testWorkspaceId
      };

      const res = await request(app)
        .post('/api/workspace')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send(workspaceData);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Workspace name already in use');
    });
  });

  describe('GET /api/workspace/personal - Get Personal Workspace', () => {
    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 38-39 in workspace.controller.ts
      const res = await request(app)
        .get('/api/workspace/personal')
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    test('200 – retrieves personal workspace successfully', async () => {
      // Input: userId with personal workspace
      // Expected status code: 200
      // Expected behavior: workspace is retrieved
      // Expected output: workspace data
      
      // Create a personal workspace for the test user
      const personalWorkspace = await workspaceModel.create({
        name: 'Personal Workspace',
        profile: { imagePath: '', name: 'Personal Workspace', description: 'My personal workspace' },
        ownerId: new mongoose.Types.ObjectId(testData.testUserId),
        members: [new mongoose.Types.ObjectId(testData.testUserId)],
      });
      
      // Update user to have this personal workspace
      await userModel.updatePersonalWorkspace(
        new mongoose.Types.ObjectId(testData.testUserId),
        personalWorkspace._id
      );

      const res = await request(app)
        .get('/api/workspace/personal')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Personal workspace retrieved successfully');
      expect(res.body.data.workspace).toBeDefined();
      expect(res.body.data.workspace._id).toBe(personalWorkspace._id.toString());
      expect(res.body.data.workspace.name).toBe('Personal Workspace');
      expect(res.body.data.workspace.ownerId).toBe(testData.testUserId);
    });

    test('404 – personal workspace ID exists but workspace not found', async () => {
      // Input: userId with personalWorkspaceId pointing to non-existent workspace
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: "Personal workspace not found" error
      const fakeWorkspaceId = new mongoose.Types.ObjectId();
      
      // Set user's personalWorkspaceId to a non-existent workspace
      await userModel.updatePersonalWorkspace(
        new mongoose.Types.ObjectId(testData.testUserId),
        fakeWorkspaceId
      );

      const res = await request(app)
        .get('/api/workspace/personal')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Personal workspace not found');
    });

    test('404 – user does not have personal workspace', async () => {
      // Input: userId without personal workspace
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const res = await request(app)
        .get('/api/workspace/personal')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('personal workspace');
    });

    test('404 – API returns "User not found" when service throws (via mock)', async () => {
      // Mocked behavior: workspaceService.getPersonalWorkspaceForUser throws "User not found"
      // Input: authenticated request via API
      // Expected status code: 404
      // Expected behaviour: controller catches service error and returns 404 response
      // Expected output: JSON error "User not found"
      const serviceSpy = jest
        .spyOn(workspaceService, 'getPersonalWorkspaceForUser')
        .mockRejectedValueOnce(new Error('User not found'));

      const res = await request(app)
        .get('/api/workspace/personal')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');

      serviceSpy.mockRestore();
    });

    test('401 – invalid token (user not found)', async () => {
      // Input: invalid token for non-existent user
      // Expected status code: 401 (auth fails before checking user existence)
      // Expected behavior: error message returned
      // Expected output: error message
      const res = await request(app)
        .get('/api/workspace/personal')
        .set('Authorization', 'Bearer invalid-token-for-non-existent-user');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/workspace/user - Get Workspaces For User', () => {
    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 72-73 in workspace.controller.ts
      const res = await request(app)
        .get('/api/workspace/user')
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    test('200 – retrieves all workspaces for user', async () => {
      // Input: userId in header
      // Expected status code: 200
      // Expected behavior: list of workspaces retrieved
      // Expected output: array of workspaces
      const res = await request(app)
        .get('/api/workspace/user')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Workspaces retrieved successfully');
      expect(res.body.data.workspaces).toBeDefined();
      expect(Array.isArray(res.body.data.workspaces)).toBe(true);
    });

    test('200 – excludes personal workspace from results', async () => {
      // Input: userId with personal workspace
      // Expected status code: 200
      // Expected behavior: personal workspace excluded from results
      // Expected output: array of workspaces without personal workspace
      
      // Create a personal workspace
      const personalWorkspace = await workspaceModel.create({
        name: 'Personal Workspace',
        profile: { imagePath: '', name: 'Personal Workspace', description: 'My personal workspace' },
        ownerId: new mongoose.Types.ObjectId(testData.testUserId),
        members: [new mongoose.Types.ObjectId(testData.testUserId)],
      });
      
      // Update user to have this personal workspace
      await userModel.updatePersonalWorkspace(
        new mongoose.Types.ObjectId(testData.testUserId),
        personalWorkspace._id
      );

      const res = await request(app)
        .get('/api/workspace/user')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspaces).toBeDefined();
      // Personal workspace should be excluded
      const workspaceIds = res.body.data.workspaces.map((w: any) => w._id);
      expect(workspaceIds).not.toContain(personalWorkspace._id.toString());
    });
  });

  describe('GET /api/workspace/:id - Get Workspace', () => {
    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 92-93 in workspace.controller.ts
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}`)
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    test('200 – retrieves workspace when user is a member', async () => {
      // Input: workspaceId in URL
      // Expected status code: 200
      // Expected behavior: workspace details retrieved
      // Expected output: workspace object
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Workspace retrieved successfully');
      expect(res.body.data.workspace).toBeDefined();
      expect(res.body.data.workspace._id).toBe(testData.testWorkspaceId);
    });

    test('403 – cannot access workspace when not a member', async () => {
      // Input: workspaceId of workspace user is not a member of
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspace2Id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/workspace/${fakeWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });
  });

  describe('GET /api/workspace/:id/members - Get Workspace Members', () => {
    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}/members`)
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    test('200 – retrieves workspace members', async () => {
      // Input: workspaceId in URL
      // Expected status code: 200
      // Expected behavior: list of members retrieved
      // Expected output: array of user objects
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Members retrieved successfully');
      expect(res.body.data.members).toBeDefined();
      expect(Array.isArray(res.body.data.members)).toBe(true);
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/workspace/${fakeWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });
  });

  describe('GET /api/workspace/:id/tags - Get All Tags', () => {
    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 159-160 in workspace.controller.ts
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}/tags`)
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    beforeEach(async () => {
      // Create notes with tags
      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: testData.testWorkspaceId,
        noteType: NoteType.CONTENT,
        tags: ['tag1', 'tag2'],
        fields: [{ fieldType: 'title', content: 'Note 1', _id: '1' }],
      });

      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: testData.testWorkspaceId,
        noteType: NoteType.CONTENT,
        tags: ['tag2', 'tag3'],
        fields: [{ fieldType: 'title', content: 'Note 2', _id: '2' }],
      });
    });

    test('200 – retrieves all unique tags in workspace', async () => {
      // Input: workspaceId in URL
      // Expected status code: 200
      // Expected behavior: list of unique tags retrieved
      // Expected output: array of unique tag strings
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}/tags`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Tags retrieved successfully');
      expect(res.body.data.tags).toBeDefined();
      expect(Array.isArray(res.body.data.tags)).toBe(true);
      expect(res.body.data.tags.length).toBeGreaterThanOrEqual(3); // tag1, tag2, tag3
      // Verify flatMap is executed by checking tags are extracted from multiple notes
      expect(res.body.data.tags).toContain('tag1');
      expect(res.body.data.tags).toContain('tag2');
      expect(res.body.data.tags).toContain('tag3');
    });

    test('403 – cannot access tags when not a member', async () => {
      // Input: workspaceId of workspace user is not a member of
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspace2Id}/tags`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/workspace/${fakeWorkspaceId}/tags`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });
  });

  describe('GET /api/workspace/:id/membership/:userId - Get Membership Status', () => {
    test('200 – returns OWNER status', async () => {
      // Input: workspaceId and userId where user is owner
      // Expected status code: 200
      // Expected behavior: membership status retrieved
      // Expected output: status object with OWNER
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}/membership/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Membership status retrieved successfully');
      expect(res.body.data.status).toBe('OWNER');
    });

    test('200 – returns MEMBER status', async () => {
      // Input: workspaceId and userId where user is a member (not owner)
      // Expected status code: 200
      // Expected behavior: membership status retrieved
      // Expected output: status object with MEMBER
      
      // Add testUserId as a member to testWorkspace2 (owned by testUser2Id)
      await workspaceModel.findByIdAndUpdate(
        testData.testWorkspace2Id,
        { $addToSet: { members: new mongoose.Types.ObjectId(testData.testUserId) } }
      );

      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspace2Id}/membership/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('MEMBER');
    });

    test('200 – returns BANNED status', async () => {
      // Input: workspaceId and userId where user is banned
      // Expected status code: 200
      // Expected behavior: membership status retrieved
      // Expected output: status object with BANNED
      
      // Ban testUser2Id from testWorkspaceId
      await workspaceModel.findByIdAndUpdate(
        testData.testWorkspaceId,
        { $addToSet: { bannedMembers: new mongoose.Types.ObjectId(testData.testUser2Id) } }
      );

      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}/membership/${testData.testUser2Id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('BANNED');
    });

    test('200 – returns NOT_MEMBER status', async () => {
      // Input: workspaceId and userId where user is not a member
      // Expected status code: 200
      // Expected behavior: membership status retrieved
      // Expected output: status object with NOT_MEMBER
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspace2Id}/membership/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('NOT_MEMBER');
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/workspace/${fakeWorkspaceId}/membership/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });
  });

  describe('POST /api/workspace/:id/members - Invite Member', () => {
    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 215-216 in workspace.controller.ts
      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/members`)
        .send({ userId: testData.testUser2Id });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    test('200 – adds member to workspace', async () => {
      // Input: workspaceId in URL, userId in body
      // Expected status code: 200
      // Expected behavior: member added to workspace
      // Expected output: updated workspace object
      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ userId: testData.testUser2Id });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Member added successfully');
      expect(res.body.data.workspace).toBeDefined();
      expect(res.body.data.workspace.members).toContain(testData.testUser2Id);
    });

    test('400 – missing userId', async () => {
      // Input: workspaceId in URL, no userId in body
      // Expected status code: 400
      // Expected behavior: validation error
      // Expected output: error message
      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('userId is required');
    });

    test('400 – user already a member', async () => {
      // Input: workspaceId and userId where user is already a member
      // Expected status code: 400
      // Expected behavior: error message returned
      // Expected output: error message
      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ userId: testData.testUserId }); // Adding owner again

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already a member');
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/workspace/${fakeWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ userId: testData.testUser2Id });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });

    test('404 – user to add not found', async () => {
      // Input: workspaceId and fake userId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeUserId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ userId: fakeUserId });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User to add not found');
    });

    test('403 – cannot invite when not a member', async () => {
      // Input: workspaceId where requesting user is not a member
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      
      // testUserId is not a member of testWorkspace2Id
      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspace2Id}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ userId: testData.testUser2Id });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
      expect(res.body.error).toContain('not a member of this workspace');
    });

    test('403 – cannot invite members to personal workspace', async () => {
      // Input: workspaceId of a personal workspace
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      
      // Create a personal workspace
      const personalWorkspace = await workspaceModel.create({
        name: 'Personal Workspace',
        profile: { imagePath: '', name: 'Personal Workspace', description: '' },
        ownerId: new mongoose.Types.ObjectId(testData.testUserId),
        members: [new mongoose.Types.ObjectId(testData.testUserId)],
      });
      
      // Set it as the user's personal workspace
      await userModel.updatePersonalWorkspace(
        new mongoose.Types.ObjectId(testData.testUserId),
        personalWorkspace._id
      );

      const res = await request(app)
        .post(`/api/workspace/${personalWorkspace._id.toString()}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ userId: testData.testUser2Id });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Cannot invite members to personal workspace');
    });

    test('403 – cannot invite banned user', async () => {
      // Input: workspaceId and userId of a banned user
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      // First ban the user
      await workspaceModel.findByIdAndUpdate(testData.testWorkspaceId, {
        $push: { bannedMembers: new mongoose.Types.ObjectId(testData.testUser2Id) },
      });

      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ userId: testData.testUser2Id });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('banned from this workspace');
    });

    test('200 – sends notification when user has fcmToken', async () => {
      // Input: workspaceId, userId with fcmToken set
      // Expected status code: 200
      // Expected behavior: member added, notification attempted (covers notification sending branch)
      // Expected output: updated workspace object
      
      // Set fcmToken for testUser2Id
      await userModel.updateFcmToken(
        new mongoose.Types.ObjectId(testData.testUser2Id),
        'test-fcm-token-123'
      );

      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ userId: testData.testUser2Id });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Member added successfully');
      // Note: Notification may succeed or fail depending on Firebase setup, but the code path is covered
    });

    test('200 – skips notification when user has no fcmToken', async () => {
      // Input: workspaceId, userId without fcmToken
      // Expected status code: 200
      // Expected behavior: member added, notification skipped (covers else branch)
      // Expected output: updated workspace object
      
      // Ensure testUser2Id has no fcmToken (should be null/undefined by default)
      const user = await userModel.findById(new mongoose.Types.ObjectId(testData.testUser2Id));
      expect(user?.fcmToken).toBeUndefined();

      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ userId: testData.testUser2Id });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Member added successfully');
      // This covers the else branch where fcmToken is missing
    });

    test('200 – handles notification error gracefully (covers catch block)', async () => {
      // Input: workspaceId, userId with fcmToken, but notification service throws
      // Expected status code: 200
      // Expected behavior: member added despite notification failure (covers catch block)
      // Expected output: updated workspace object
      
      // Set fcmToken for testUser2Id
      await userModel.updateFcmToken(
        new mongoose.Types.ObjectId(testData.testUser2Id),
        'test-fcm-token-456'
      );

      // Mock notification service to throw an error to trigger the catch block
      const sendNotificationSpy = jest.spyOn(notificationService, 'sendNotification')
        .mockRejectedValueOnce(new Error('Notification service error'));

      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/members`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ userId: testData.testUser2Id });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Member added successfully');
      expect(res.body.data.workspace.members).toContain(testData.testUser2Id);
      // Verify notification was attempted (covers the catch block)
      expect(sendNotificationSpy).toHaveBeenCalledTimes(1);

      // Restore the spy
      sendNotificationSpy.mockRestore();
    });
  });

  describe('POST /api/workspace/:id/leave - Leave Workspace', () => {
    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 275-276 in workspace.controller.ts
      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/leave`)
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    beforeEach(async () => {
      // Add testUser2 as a member first
      await workspaceModel.findByIdAndUpdate(testData.testWorkspaceId, {
        $push: { members: new mongoose.Types.ObjectId(testData.testUser2Id) },
      });
    });

    test('200 – user leaves workspace', async () => {
      // Input: workspaceId in URL
      // Expected status code: 200
      // Expected behavior: user removed from workspace members
      // Expected output: updated workspace object
      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/leave`)
        .set('Authorization', `Bearer ${testData.testUser2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Successfully left the workspace');
      expect(res.body.data.workspace).toBeDefined();
      expect(res.body.data.workspace.members).not.toContain(testData.testUser2Id);
    });

    test('403 – cannot leave personal workspace', async () => {
      // Input: workspaceId of a personal workspace
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      
      // Create a personal workspace
      const personalWorkspace = await workspaceModel.create({
        name: 'Personal Workspace',
        profile: { imagePath: '', name: 'Personal Workspace', description: '' },
        ownerId: new mongoose.Types.ObjectId(testData.testUserId),
        members: [new mongoose.Types.ObjectId(testData.testUserId)],
      });
      
      // Set it as the user's personal workspace
      await userModel.updatePersonalWorkspace(
        new mongoose.Types.ObjectId(testData.testUserId),
        personalWorkspace._id
      );
      
      // Add testUser2 as a member so they can try to leave
      await workspaceModel.findByIdAndUpdate(
        personalWorkspace._id,
        { $push: { members: new mongoose.Types.ObjectId(testData.testUser2Id) } }
      );

      const res = await request(app)
        .post(`/api/workspace/${personalWorkspace._id.toString()}/leave`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Cannot leave your personal workspace');
    });

    test('403 – owner cannot leave workspace', async () => {
      // Input: workspaceId where user is owner
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspaceId}/leave`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Owner cannot leave');
    });

    test('400 – user not a member', async () => {
      // Input: workspaceId where user is not a member
      // Expected status code: 400
      // Expected behavior: error message returned
      // Expected output: error message
      const res = await request(app)
        .post(`/api/workspace/${testData.testWorkspace2Id}/leave`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('You are not a member of this workspace');
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/workspace/${fakeWorkspaceId}/leave`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });
  });

  describe('PUT /api/workspace/:id - Update Workspace Profile', () => {
    test('400 – returns validation error when name is empty string', async () => {
      // Input: request body with empty name
      // Expected status code: 400
      // Expected behavior: validateBody middleware rejects request (min(1) validation)
      // Expected output: validation error with details
      const res = await request(app)
        .put(`/api/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.details).toBeDefined();
      const fieldPaths = res.body.details.map((d: any) => d.field);
      expect(fieldPaths).toContain('name');
    });

    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 364-365 in workspace.controller.ts
      const res = await request(app)
        .put(`/api/workspace/${testData.testWorkspaceId}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    test('200 – updates workspace profile', async () => {
      // Input: workspaceId in URL, updateData in body
      // Expected status code: 200
      // Expected behavior: workspace profile updated
      // Expected output: updated workspace object
      const updateData = {
        name: 'Updated Workspace Name',
        description: 'Updated description',
      };

      const res = await request(app)
        .put(`/api/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Workspace profile updated successfully');
      expect(res.body.data.workspace.name).toBe('Updated Workspace Name');
      expect(res.body.data.workspace.profile.description).toBe('Updated description');
    });

    test('403 – only owner can update profile', async () => {
      // Input: workspaceId and updateData, but user is not owner
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      // First add user2 as member
      await workspaceModel.findByIdAndUpdate(testData.testWorkspaceId, {
        $push: { members: new mongoose.Types.ObjectId(testData.testUser2Id) },
      });

      const updateData = {
        name: 'Hacked Name',
      };

      const res = await request(app)
        .put(`/api/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUser2Token}`)
        .send(updateData);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only workspace owner');
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .put(`/api/workspace/${fakeWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });
  });

  describe('PUT /api/workspace/:id/picture - Update Workspace Picture', () => {
    test('400 – returns validation error when profilePicture is missing', async () => {
      // Input: request body without profilePicture
      // Expected status code: 400
      // Expected behavior: validateBody middleware rejects request
      // Expected output: validation error with details
      const res = await request(app)
        .put(`/api/workspace/${testData.testWorkspaceId}/picture`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.message).toBe('Invalid input data');
      expect(res.body.details).toBeDefined();
    });

    test('400 – returns validation error when profilePicture is empty string', async () => {
      // Input: request body with empty profilePicture
      // Expected status code: 400
      // Expected behavior: validateBody middleware rejects request (min(1) validation)
      // Expected output: validation error with details
      const res = await request(app)
        .put(`/api/workspace/${testData.testWorkspaceId}/picture`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ profilePicture: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.details).toBeDefined();
      const fieldPaths = res.body.details.map((d: any) => d.field);
      expect(fieldPaths).toContain('profilePicture');
    });

    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 401-402 in workspace.controller.ts
      const res = await request(app)
        .put(`/api/workspace/${testData.testWorkspaceId}/picture`)
        .send({ profilePicture: 'https://example.com/image.jpg' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    test('200 – updates workspace picture', async () => {
      // Input: workspaceId in URL, profilePicture in body
      // Expected status code: 200
      // Expected behavior: workspace picture updated
      // Expected output: updated workspace object
      const updateData = {
        profilePicture: 'https://example.com/new-picture.jpg',
      };

      const res = await request(app)
        .put(`/api/workspace/${testData.testWorkspaceId}/picture`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Workspace picture updated successfully');
      expect(res.body.data.workspace.profile.imagePath).toBe('https://example.com/new-picture.jpg');
    });

    test('403 – only owner can update picture', async () => {
      // Input: workspaceId and profilePicture, but user is not owner
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      await workspaceModel.findByIdAndUpdate(testData.testWorkspaceId, {
        $push: { members: new mongoose.Types.ObjectId(testData.testUser2Id) },
      });

      const updateData = {
        profilePicture: 'https://example.com/hacked.jpg',
      };

      const res = await request(app)
        .put(`/api/workspace/${testData.testWorkspaceId}/picture`)
        .set('Authorization', `Bearer ${testData.testUser2Token}`)
        .send(updateData);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only workspace owner');
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .put(`/api/workspace/${fakeWorkspaceId}/picture`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ profilePicture: 'https://example.com/pic.jpg' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });
  });

  describe('DELETE /api/workspace/:id/members/:userId - Ban Member', () => {
    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 317-318 in workspace.controller.ts
      const res = await request(app)
        .delete(`/api/workspace/${testData.testWorkspaceId}/members/${testData.testUser2Id}`)
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    beforeEach(async () => {
      // Add testUser2 as a member first
      await workspaceModel.findByIdAndUpdate(testData.testWorkspaceId, {
        $push: { members: new mongoose.Types.ObjectId(testData.testUser2Id) },
      });
    });

    test('200 – bans member from workspace', async () => {
      // Input: workspaceId and userId in URL
      // Expected status code: 200
      // Expected behavior: member removed and added to banned list
      // Expected output: updated workspace object
      const res = await request(app)
        .delete(`/api/workspace/${testData.testWorkspaceId}/members/${testData.testUser2Id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Member banned successfully');
      expect(res.body.data.workspace).toBeDefined();
      expect(res.body.data.workspace.members).not.toContain(testData.testUser2Id);
    });

    test('200 – bans already banned user (no duplicate)', async () => {
      // Input: workspaceId and userId where user is already banned
      // Expected status code: 200
      // Expected behavior: user remains banned, no duplicate
      // Expected output: updated workspace object
      
      // First ban the user
      await workspaceModel.findByIdAndUpdate(testData.testWorkspaceId, {
        $push: { bannedMembers: new mongoose.Types.ObjectId(testData.testUser2Id) },
        $pull: { members: new mongoose.Types.ObjectId(testData.testUser2Id) },
      });

      // Try to ban again
      const res = await request(app)
        .delete(`/api/workspace/${testData.testWorkspaceId}/members/${testData.testUser2Id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Member banned successfully');
      
      // Verify user is still banned (check by verifying workspace)
      const workspace = await workspaceModel.findById(testData.testWorkspaceId);
      const bannedCount = workspace?.bannedMembers.filter(id => id.toString() === testData.testUser2Id).length || 0;
      expect(bannedCount).toBe(1); // Should only appear once, not duplicated
    });

    test('403 – cannot ban members from personal workspace', async () => {
      // Input: workspaceId of a personal workspace
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      
      // Create a personal workspace
      const personalWorkspace = await workspaceModel.create({
        name: 'Personal Workspace',
        profile: { imagePath: '', name: 'Personal Workspace', description: '' },
        ownerId: new mongoose.Types.ObjectId(testData.testUserId),
        members: [new mongoose.Types.ObjectId(testData.testUserId)],
      });
      
      // Set it as the user's personal workspace
      await userModel.updatePersonalWorkspace(
        new mongoose.Types.ObjectId(testData.testUserId),
        personalWorkspace._id
      );
      
      // Add testUser2 as a member
      await workspaceModel.findByIdAndUpdate(
        personalWorkspace._id,
        { $push: { members: new mongoose.Types.ObjectId(testData.testUser2Id) } }
      );

      const res = await request(app)
        .delete(`/api/workspace/${personalWorkspace._id.toString()}/members/${testData.testUser2Id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Cannot ban members from personal workspace');
    });

    test('403 – only owner can ban members', async () => {
      // Input: workspaceId and userId, but requesting user is not owner
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      // Create a third user and get token via dev-login
      const loginRes3 = await request(app)
        .post('/api/auth/dev-login')
        .send({ email: 'testuser3@example.com' });
      
      if (loginRes3.status !== 200) {
        throw new Error(`Failed to login test user 3: ${JSON.stringify(loginRes3.body)}`);
      }
      const testUser3Token = loginRes3.body.data.token;
      const testUser3Id = loginRes3.body.data.user._id;

      await workspaceModel.findByIdAndUpdate(testData.testWorkspaceId, {
        $push: { members: new mongoose.Types.ObjectId(testUser3Id) },
      });

      const res = await request(app)
        .delete(`/api/workspace/${testData.testWorkspaceId}/members/${testData.testUser2Id}`)
        .set('Authorization', `Bearer ${testUser3Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only workspace owner');
    });

    test('400 – cannot ban workspace owner', async () => {
      // Input: workspaceId and userId where userId is the owner
      // Expected status code: 400
      // Expected behavior: error message returned
      // Expected output: error message
      const res = await request(app)
        .delete(`/api/workspace/${testData.testWorkspaceId}/members/${testData.testUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot ban the workspace owner');
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/workspace/${fakeWorkspaceId}/members/${testData.testUser2Id}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });

    test('404 – user to ban not found', async () => {
      // Input: workspaceId and fake userId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeUserId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/workspace/${testData.testWorkspaceId}/members/${fakeUserId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User to ban not found');
    });
  });

  describe('DELETE /api/workspace/:id - Delete Workspace', () => {
    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 439-440 in workspace.controller.ts
      const res = await request(app)
        .delete(`/api/workspace/${testData.testWorkspaceId}`)
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    test('200 – deletes workspace and all notes', async () => {
      // Input: workspaceId in URL
      // Expected status code: 200
      // Expected behavior: workspace and all its notes deleted
      // Expected output: deleted workspace object
      // Create some notes first
      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: testData.testWorkspaceId,
        noteType: NoteType.CONTENT,
        tags: ['test'],
        fields: [{ fieldType: 'title', content: 'Test Note', _id: '1' }],
      });

      const res = await request(app)
        .delete(`/api/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Workspace and all its notes deleted successfully');
      expect(res.body.data.workspace).toBeDefined();

      // Verify workspace is deleted
      const deletedWorkspace = await workspaceModel.findById(testData.testWorkspaceId);
      expect(deletedWorkspace).toBeNull();

      // Verify notes are deleted
      const notes = await noteModel.find({ workspaceId: testData.testWorkspaceId });
      expect(notes.length).toBe(0);
    });

    test('403 – cannot delete personal workspace', async () => {
      // Input: workspaceId of a personal workspace
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      
      // Create a personal workspace
      const personalWorkspace = await workspaceModel.create({
        name: 'Personal Workspace',
        profile: { imagePath: '', name: 'Personal Workspace', description: '' },
        ownerId: new mongoose.Types.ObjectId(testData.testUserId),
        members: [new mongoose.Types.ObjectId(testData.testUserId)],
      });
      
      // Set it as the user's personal workspace
      await userModel.updatePersonalWorkspace(
        new mongoose.Types.ObjectId(testData.testUserId),
        personalWorkspace._id
      );

      const res = await request(app)
        .delete(`/api/workspace/${personalWorkspace._id.toString()}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Cannot delete your personal workspace');
    });

    test('403 – only owner can delete workspace', async () => {
      // Input: workspaceId where user is not owner
      // Expected status code: 403
      // Expected behavior: error message returned
      // Expected output: error message
      await workspaceModel.findByIdAndUpdate(testData.testWorkspaceId, {
        $push: { members: new mongoose.Types.ObjectId(testData.testUser2Id) },
      });

      const res = await request(app)
        .delete(`/api/workspace/${testData.testWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUser2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only workspace owner');
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/workspace/${fakeWorkspaceId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });
  });

  describe('GET /api/workspace/:id/poll - Poll For New Messages', () => {
    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without user authentication
      // Expected status code: 401
      // Expected behavior: error message returned
      // Expected output: error message "User not authenticated"
      // This tests lines 476-477 in workspace.controller.ts
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}/poll`)
;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access denied');
    });

    test('200 – checks for new messages', async () => {
      // Input: workspaceId in URL
      // Expected status code: 200
      // Expected behavior: polling check completed
      // Expected output: hasNewMessages boolean
      const res = await request(app)
        .get(`/api/workspace/${testData.testWorkspaceId}/poll`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Polling check completed');
      expect(res.body.data.hasNewMessages).toBeDefined();
      expect(typeof res.body.data.hasNewMessages).toBe('boolean');
    });

    test('404 – workspace not found', async () => {
      // Input: fake workspaceId
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: error message
      const fakeWorkspaceId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/workspace/${fakeWorkspaceId}/poll`)
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Workspace not found');
    });
  });
});

