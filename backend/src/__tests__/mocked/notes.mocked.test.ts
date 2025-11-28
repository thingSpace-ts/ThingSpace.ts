/// <reference types="jest" />
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import OpenAI from 'openai';
import type { Request, Response, NextFunction } from 'express';

import { NoteType } from '../../notes/notes.types';
import { noteService } from '../../notes/notes.service';
import { noteModel } from '../../notes/note.model';
import { workspaceModel } from '../../workspaces/workspace.model';
import * as authMiddleware from '../../authentication/auth.middleware';
import { createTestApp, setupTestDatabase, TestData } from '../test-utils/test-helpers';

// ---------------------------
// Test suite
// ---------------------------
describe('Notes API – Mocked Tests (Jest Mocks)', () => {
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

  // Clean mocks every test; full DB reset occurs in beforeEach
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
    
    // Mock OpenAI client for beforeEach note creation (used in setup for other tests)
    // Reset client cache to ensure fresh mock
    (noteService as any).client = null;
    
    const mockEmbedding = Array(3072).fill(0).map(() => Math.random() * 0.1 - 0.05);
    const mockClient = {
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: mockEmbedding }],
        }),
      },
    };
    
    jest.spyOn(noteService as any, 'getClient').mockReturnValue(mockClient);
  });

  describe('POST /api/notes - Create Note, with mocks', () => {
    test('500 – create note handles service error', async () => {
      // Mocked behavior: noteService.createNote throws database connection error
      // Input: noteData with workspaceId, noteType, tags, fields
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: None
      jest.spyOn(noteService, 'createNote').mockRejectedValue(new Error('Database connection failed'));

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['test'],
          fields: [{ fieldType: 'title', content: 'Test', _id: '1' }],
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    test('500 – create note handles non-Error thrown value', async () => {
      // Mocked behavior: noteService.createNote throws non-Error value (string)
      // Input: noteData with workspaceId, noteType, tags, fields
      // Expected status code: 500
      // Expected behavior: error handled gracefully, falls back to generic message
      // Expected output: generic error message "Failed to create note"
      jest.spyOn(noteService, 'createNote').mockRejectedValue('String error');

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['test'],
          fields: [{ fieldType: 'title', content: 'Test', _id: '1' }],
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create note');
    });

    test('OpenAI success path creates note with embeddings', async () => {
      // Mocked behavior: OpenAI API call succeeds and returns embeddings
      // Input: noteData with fields that trigger OpenAI embeddings
      // Expected status code: 201
      // Expected behavior: note created with vector embeddings
      // Expected output: note created successfully
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      // Reset the client cache and mock getClient to return a fake client
      (noteService as any).client = null;
      
      const mockClient = {
        embeddings: {
          create: jest.fn().mockResolvedValue({
            data: [{ embedding: mockEmbedding }],
          }),
        },
      };
      
      jest.spyOn(noteService as any, 'getClient').mockReturnValue(mockClient);

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['openai-success-test'],
          fields: [
            { fieldType: 'title', content: 'OpenAI Success Test', _id: '1' },
            { fieldType: 'textbox', content: 'This creates embeddings', _id: '2' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.note).toBeDefined();
      expect(res.body.data.note.vectorData).toBeDefined();
    });

    test('500 – OpenAI failure causes note creation to fail', async () => {
      // Mocked behavior: OpenAI API call fails
      // Input: noteData with fields that would trigger OpenAI
      // Expected status code: 500
      // Expected behavior: error propagates and note creation fails
      // Expected output: error message
      // Reset the client cache and mock getClient to return a client that throws
      (noteService as any).client = null;
      
      const mockClient = {
        embeddings: {
          create: jest.fn().mockRejectedValue(new Error('OpenAI API error')),
        },
      };
      
      jest.spyOn(noteService as any, 'getClient').mockReturnValue(mockClient);

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['openai-error-test'],
          fields: [
            { fieldType: 'title', content: 'OpenAI Error Test', _id: '1' },
            { fieldType: 'textbox', content: 'This should fail when OpenAI fails', _id: '2' },
          ],
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    test('500 – OpenAI embeddings error propagates and fails note creation', async () => {
      // Mocked behavior: OpenAI embeddings.create throws error
      // Input: noteData with fields that trigger OpenAI embeddings
      // Expected status code: 500
      // Expected behavior: error propagates and note creation fails
      // Expected output: error message
      // Reset the client cache and mock getClient to return a client that throws
      (noteService as any).client = null;
      
      const mockClient = {
        embeddings: {
          create: jest.fn().mockRejectedValue(new Error('OpenAI API error')),
        },
      };
      
      jest.spyOn(noteService as any, 'getClient').mockReturnValue(mockClient);

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['openai-error-test'],
          fields: [
            { fieldType: 'title', content: 'OpenAI Error Test', _id: '1' },
            { fieldType: 'textbox', content: 'This triggers embeddings', _id: '2' },
          ],
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('PUT /api/notes/:id - Update Note, with mocks', () => {
    let noteId: string;

    beforeEach(async () => {
      const create = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['mock-test'],
          fields: [{ fieldType: 'title', content: 'Mock Test Note', _id: '1' }],
        });
      noteId = create.body.data.note._id;
    });

    test('500 – update note handles service error', async () => {
      // Mocked behavior: noteService.updateNote throws database write error
      // Input: noteId in URL, updated tags and fields
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: None
      jest.spyOn(noteService, 'updateNote').mockRejectedValue(new Error('Database write failed'));

      const res = await request(app)
        .put(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ tags: ['updated'], fields: [{ fieldType: 'title', content: 'Updated', _id: '1' }] });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    test('500 – update note handles non-Error thrown value', async () => {
      // Mocked behavior: noteService.updateNote throws non-Error value (object)
      // Input: noteId in URL, updated tags and fields
      // Expected status code: 500
      // Expected behavior: error handled gracefully, falls back to generic message
      // Expected output: generic error message "Failed to update note"
      jest.spyOn(noteService, 'updateNote').mockRejectedValue({ code: 'UNKNOWN' });

      const res = await request(app)
        .put(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ tags: ['updated'], fields: [{ fieldType: 'title', content: 'Updated', _id: '1' }] });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update note');
    });
  });

  describe('GET /api/notes/:id - Get Single Note, with mocks', () => {
    let noteId: string;

    beforeEach(async () => {
      const create = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['mock-test'],
          fields: [{ fieldType: 'title', content: 'Mock Test Note', _id: '1' }],
        });
      noteId = create.body.data.note._id;
    });

    test('500 – get single note handles service error', async () => {
      // Mocked behavior: noteService.getNote throws database lookup error
      // Input: noteId in URL
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: None
      jest.spyOn(noteService, 'getNote').mockRejectedValue(new Error('Database lookup failed'));

      const res = await request(app).get(`/api/notes/${noteId}`).set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    test('500 – get note handles non-Error thrown value', async () => {
      // Mocked behavior: noteService.getNote throws non-Error value (null)
      // Input: noteId in URL
      // Expected status code: 500
      // Expected behavior: error handled gracefully, falls back to generic message
      // Expected output: generic error message "Failed to retrieve note"
      jest.spyOn(noteService, 'getNote').mockRejectedValue(null);

      const res = await request(app).get(`/api/notes/${noteId}`).set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to retrieve note');
    });
  });

  describe('DELETE /api/notes/:id - Delete Note, with mocks', () => {
    let noteId: string;

    beforeEach(async () => {
      const create = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['mock-test'],
          fields: [{ fieldType: 'title', content: 'Mock Test Note', _id: '1' }],
        });
      noteId = create.body.data.note._id;
    });

    test('500 – delete note handles service error', async () => {
      // Mocked behavior: noteService.deleteNote throws database delete error
      // Input: noteId in URL
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: None
      jest.spyOn(noteService, 'deleteNote').mockRejectedValue(new Error('Database delete failed'));

      const res = await request(app).delete(`/api/notes/${noteId}`).set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    test('500 – delete note handles non-Error thrown value', async () => {
      // Mocked behavior: noteService.deleteNote throws non-Error value (string)
      // Input: noteId in URL
      // Expected status code: 500
      // Expected behavior: error handled gracefully, falls back to generic message
      // Expected output: generic error message "Failed to delete note"
      jest.spyOn(noteService, 'deleteNote').mockRejectedValue('String error');

      const res = await request(app).delete(`/api/notes/${noteId}`).set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete note');
    });
  });

  describe('GET /api/notes - Find Notes, with mocks', () => {
    test('500 – get notes handles service error', async () => {
      // Mocked behavior: noteService.getNotes throws database query error
      // Input: workspaceId and noteType in query params
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: None
      jest.spyOn(noteService, 'getNotes').mockRejectedValue(new Error('Database query failed'));

      const res = await request(app)
        .get('/api/notes')
        .query({ workspaceId: testData.testWorkspaceId, noteType: NoteType.CONTENT })
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    test('200 – get notes with query string covers all embedding and cosine similarity edge cases', async () => {
      // Mocked behavior: OpenAI embeddings API returns query embeddings, tests all cosine similarity paths
      // Input: workspaceId, noteType, and query string in query params with various note configurations
      // Expected status code: 200
      // Expected behavior: notes retrieved and ranked by cosine similarity, all edge cases handled
      // Expected output: array of notes sorted by relevance
      const mockQueryEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      // Create notes covering all edge cases:
      // 1. Normal notes with valid vectorData (for cosine similarity calculation)
      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: testData.testWorkspaceId,
        noteType: NoteType.CONTENT,
        tags: ['query-test-1'],
        fields: [{ fieldType: 'title', content: 'Query Test Note 1', _id: '1' }],
        vectorData: [0.15, 0.25, 0.35, 0.45, 0.55],
      });

      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: testData.testWorkspaceId,
        noteType: NoteType.CONTENT,
        tags: ['query-test-2'],
        fields: [{ fieldType: 'title', content: 'Query Test Note 2', _id: '2' }],
        vectorData: [0.2, 0.3, 0.4, 0.5, 0.6], // Different vector for ranking
      });

      // 2. Notes without vectorData (empty array)
      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: testData.testWorkspaceId,
        noteType: NoteType.CONTENT,
        tags: ['no-vector-test'],
        fields: [{ fieldType: 'title', content: 'No Vector Test', _id: '3' }],
        vectorData: [], // Empty vectorData array
      });

      // 3. Note with undefined vectorData (missing field)
      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: testData.testWorkspaceId,
        noteType: NoteType.CONTENT,
        tags: ['no-vector-test-2'],
        fields: [{ fieldType: 'title', content: 'No Vector Test 2', _id: '4' }],
        // vectorData not set, will be undefined
      });

      // 4. Note with zero-norm vector (covers normA === 0 || normB === 0 check)
      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: testData.testWorkspaceId,
        noteType: NoteType.CONTENT,
        tags: ['zero-norm-test'],
        fields: [{ fieldType: 'title', content: 'Zero Norm Test', _id: '5' }],
        vectorData: [0, 0, 0, 0, 0], // Zero norm vector
      });
      
      // Test 1: Normal query embedding (covers normal cosine similarity calculation)
      const mockClient1 = {
        embeddings: {
          create: jest.fn().mockResolvedValueOnce({
            data: [{ embedding: mockQueryEmbedding }],
          }),
        },
      };
      
      // Mock getClient BEFORE resetting client to ensure mock is in place
      const getClientSpy1 = jest.spyOn(noteService as any, 'getClient').mockReturnValue(mockClient1);
      (noteService as any).client = null;

      const res1 = await request(app)
        .get('/api/notes')
        .query({ 
          workspaceId: testData.testWorkspaceId, 
          noteType: NoteType.CONTENT,
          query: 'test query'
        })
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.message).toBe('Notes retrieved successfully');
      expect(res1.body.data.notes).toBeDefined();
      expect(Array.isArray(res1.body.data.notes)).toBe(true);
      expect(res1.body.data.notes.length).toBeGreaterThanOrEqual(5);
      expect(mockClient1.embeddings.create).toHaveBeenCalledTimes(1);
      expect(mockClient1.embeddings.create).toHaveBeenCalledWith({
        model: "text-embedding-3-large",
        input: "test query",
      });

      // Restore the spy before next test
      getClientSpy1.mockRestore();

      // Test 2: Empty query embedding (covers len === 0 check in cosineSimilarity)
      // Create a note with vectorData to test the empty query embedding scenario
      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: testData.testWorkspaceId,
        noteType: NoteType.CONTENT,
        tags: ['empty-query-test'],
        fields: [{ fieldType: 'title', content: 'Empty Query Test', _id: '6' }],
        vectorData: [0.1, 0.2, 0.3, 0.4, 0.5],
      });
      
      const mockClient2 = {
        embeddings: {
          create: jest.fn().mockResolvedValueOnce({
            data: [{ embedding: [] }], // Empty embedding array (covers len === 0)
          }),
        },
      };
      
      // Mock getClient BEFORE resetting client
      const getClientSpy2 = jest.spyOn(noteService as any, 'getClient').mockReturnValue(mockClient2);
      (noteService as any).client = null;

      const res2 = await request(app)
        .get('/api/notes')
        .query({ 
          workspaceId: testData.testWorkspaceId, 
          noteType: NoteType.CONTENT,
          query: 'empty embedding test'
        })
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.message).toBe('Notes retrieved successfully');
      expect(res2.body.data.notes).toBeDefined();
      expect(Array.isArray(res2.body.data.notes)).toBe(true);
      expect(mockClient2.embeddings.create).toHaveBeenCalledWith({
        model: "text-embedding-3-large",
        input: "empty embedding test",
      });
      
      // Restore the spy
      getClientSpy2.mockRestore();
    });

    test('500 – find notes handles non-Error thrown value', async () => {
      // Mocked behavior: noteService.getNotes throws non-Error value (number)
      // Input: workspaceId and noteType in query params
      // Expected status code: 500
      // Expected behavior: error handled gracefully, falls back to generic message
      // Expected output: generic error message "Failed to retrieve notes"
      jest.spyOn(noteService, 'getNotes').mockRejectedValue(123);

      const res = await request(app)
        .get('/api/notes')
        .query({ workspaceId: testData.testWorkspaceId, noteType: NoteType.CONTENT })
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to retrieve notes');
    });

    test('500 – workspace findById returns null during getNotes (workspace not found)', async () => {
      // Mocked behavior: workspaceModel.findById returns null during getNotes
      // Input: workspaceId and noteType in query params
      // Expected status code: 500
      // Expected behavior: error message returned
      // Expected output: "Workspace not found"
      const findByIdSpy = jest.spyOn(workspaceModel, 'findById').mockResolvedValueOnce(null as any);

      const res = await request(app)
        .get('/api/notes')
        .query({ workspaceId: testData.testWorkspaceId, noteType: NoteType.CONTENT })
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Workspace not found');
      expect(findByIdSpy).toHaveBeenCalled();
      
      findByIdSpy.mockRestore();
    });

    test('cosineSimilarity handles sparse arrays with undefined values (lines 268-269)', async () => {
      // Input: note with sparse vector data (arrays with undefined values)
      // Expected behavior: .at() returns undefined for sparse array elements, ?? operator provides default 0
      // Expected output: notes returned with similarity scores
      // This tests lines 268-269 in notes.service.ts
      
      // Create a sparse array with undefined values
      const sparseArray = new Array(100);
      sparseArray[0] = 0.5;
      sparseArray[50] = 0.3;
      sparseArray[99] = 0.1;
      // Most elements are undefined (sparse array)

      // Create a note with sparse vector data
      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        noteType: NoteType.CONTENT,
        tags: ['sparse-test'],
        fields: [{ fieldType: 'title', content: 'Sparse Vector Note', _id: '1' }],
        vectorData: sparseArray,
      });

      // Mock OpenAI to return an embedding with undefined values too
      const mockEmbedding = new Array(100);
      mockEmbedding[10] = 0.2;
      mockEmbedding[60] = 0.4;
      
      jest.spyOn(noteService as any, 'getClient').mockReturnValue({
        embeddings: {
          create: jest.fn().mockResolvedValue({
            data: [{ embedding: mockEmbedding }],
          }),
        },
      });

      const res = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .query({ 
          workspaceId: testData.testWorkspaceId, 
          noteType: NoteType.CONTENT,
          query: 'test sparse'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBeDefined();
      expect(Array.isArray(res.body.data.notes)).toBe(true);
    });

    test('cosineSimilarity with arrays containing explicit undefined values', async () => {
      // Input: note with vector data containing explicit undefined
      // Expected behavior: handles undefined values gracefully via ?? operator
      // Expected output: returns notes with similarity scores
      const vectorWithUndefined = [0.1, undefined, 0.3, undefined, 0.5];
      
      await noteModel.create({
        userId: new mongoose.Types.ObjectId(testData.testUserId),
        workspaceId: new mongoose.Types.ObjectId(testData.testWorkspaceId),
        noteType: NoteType.CONTENT,
        tags: ['undefined-test'],
        fields: [{ fieldType: 'title', content: 'Undefined Vector Note', _id: '1' }],
        vectorData: vectorWithUndefined as any,
      });

      const mockEmbeddingWithUndefined = [undefined, 0.2, undefined, 0.4, 0.6];

      jest.spyOn(noteService as any, 'getClient').mockReturnValue({
        embeddings: {
          create: jest.fn().mockResolvedValue({
            data: [{ embedding: mockEmbeddingWithUndefined }],
          }),
        },
      });

      const res = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .query({ 
          workspaceId: testData.testWorkspaceId, 
          noteType: NoteType.CONTENT,
          query: 'test undefined'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBeDefined();
    });
  });

  describe('GET /api/notes/:id/workspaces - Get Workspace for Note, with mocks', () => {
    let noteId: string;

    beforeEach(async () => {
      const create = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['mock-test'],
          fields: [{ fieldType: 'title', content: 'Mock Test Note', _id: '1' }],
        });
      noteId = create.body.data.note._id;
    }); 

    test('500 – get workspace for note handles service error', async () => {
      // Mocked behavior: noteService.getWorkspacesForNote throws database lookup error
      // Input: noteId in URL
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: None
      jest.spyOn(noteService, 'getWorkspacesForNote').mockRejectedValue(new Error('Database lookup failed'));

      const res = await request(app).get(`/api/notes/${noteId}/workspaces`).set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    test('500 – get workspace handles non-Error thrown value', async () => {
      // Mocked behavior: noteService.getWorkspacesForNote throws non-Error value (undefined)
      // Input: noteId in URL
      // Expected status code: 500
      // Expected behavior: error handled gracefully, falls back to generic message
      // Expected output: generic error message "Failed to retrieve workspace"
      jest.spyOn(noteService, 'getWorkspacesForNote').mockRejectedValue(undefined);

      const res = await request(app).get(`/api/notes/${noteId}/workspaces`).set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to retrieve workspace');
    });
  });

  describe('POST /api/notes/:id/share - Share Note to Workspace, with mocks', () => {
    let noteId: string;

    beforeEach(async () => {
      const create = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['mock-test'],
          fields: [{ fieldType: 'title', content: 'Mock Test Note', _id: '1' }],
        });
      noteId = create.body.data.note._id;
    });

    test('500 – share note handles service error', async () => {
      // Mocked behavior: noteService.shareNoteToWorkspace throws generic error
      // Input: noteId in URL, workspaceId in body
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: None
      jest.spyOn(noteService, 'shareNoteToWorkspace').mockRejectedValue(new Error('Unexpected service error'));

      const res = await request(app)
        .post(`/api/notes/${noteId}/share`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ workspaceId: testData.testWorkspaceId });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    test('500 – share note handles non-Error thrown value', async () => {
      // Mocked behavior: noteService.shareNoteToWorkspace throws non-Error value (string)
      // Input: noteId in URL, workspaceId in body
      // Expected status code: 500
      // Expected behavior: error handled gracefully, falls back to generic message
      // Expected output: generic error message "Failed to share note"
      jest.spyOn(noteService, 'shareNoteToWorkspace').mockRejectedValue('String error');

      const res = await request(app)
        .post(`/api/notes/${noteId}/share`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ workspaceId: testData.testWorkspaceId });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to share note');
    });

    test('404 – findOneAndUpdate returns null during share (note deleted mid-request)', async () => {
      // Mocked behavior: noteModel.findOneAndUpdate returns null (note deleted during request)
      // Input: noteId in URL, workspaceId in body
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: "Note not found"
      await workspaceModel.findByIdAndUpdate(testData.testWorkspace2Id, {
        $push: { members: new mongoose.Types.ObjectId(testData.testUserId) },
      });

      // Mock findOneAndUpdate to return null after initial checks pass
      const findOneAndUpdateSpy = jest.spyOn(noteModel, 'findOneAndUpdate').mockResolvedValueOnce(null as any);

      const res = await request(app)
        .post(`/api/notes/${noteId}/share`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ workspaceId: testData.testWorkspace2Id });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Note not found');
      expect(findOneAndUpdateSpy).toHaveBeenCalled();
      
      findOneAndUpdateSpy.mockRestore();
    });

    test('500 – workspace lookup throws during share', async () => {
      // Mocked behavior: workspaceModel.findById throws workspace service error
      // Input: noteId in URL, workspaceId in body
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: None
      jest.spyOn(workspaceModel, 'findById').mockImplementation(() => {
        throw new Error('Workspace service unavailable');
      });

      await workspaceModel.findByIdAndUpdate(testData.testWorkspace2Id, {
        $push: { members: new mongoose.Types.ObjectId(testData.testUserId) },
      });

      const res = await request(app)
        .post(`/api/notes/${noteId}/share`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ workspaceId: testData.testWorkspace2Id });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/notes/:id/copy - Copy Note to Workspace, with mocks', () => {
    let noteId: string;

    beforeEach(async () => {
      const create = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['mock-test'],
          fields: [{ fieldType: 'title', content: 'Mock Test Note', _id: '1' }],
        });
      noteId = create.body.data.note._id;
    });

    test('404 – copy note handles Note not found', async () => {
      // Mocked behavior: noteService.copyNoteToWorkspace throws "Note not found" error
      // Input: noteId in URL, workspaceId in body
      // Expected status code: 404
      // Expected behavior: error handled gracefully
      // Expected output: error message
      jest.spyOn(noteService, 'copyNoteToWorkspace').mockRejectedValue(new Error('Note not found'));

      const res = await request(app)
        .post(`/api/notes/${noteId}/copy`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ workspaceId: testData.testWorkspaceId });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Note not found');
    });

    test('500 – copy note handles service error', async () => {
      // Mocked behavior: noteService.copyNoteToWorkspace throws generic error
      // Input: noteId in URL, workspaceId in body
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: None
      jest.spyOn(noteService, 'copyNoteToWorkspace').mockRejectedValue(new Error('Unexpected service error'));

      const res = await request(app)
        .post(`/api/notes/${noteId}/copy`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ workspaceId: testData.testWorkspaceId });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    test('500 – copy note handles non-Error thrown value', async () => {
      // Mocked behavior: noteService.copyNoteToWorkspace throws non-Error value (string)
      // Input: noteId in URL, workspaceId in body
      // Expected status code: 500
      // Expected behavior: error handled gracefully, falls back to generic message
      // Expected output: generic error message "Failed to copy note"
      jest.spyOn(noteService, 'copyNoteToWorkspace').mockRejectedValue('String error');

      const res = await request(app)
        .post(`/api/notes/${noteId}/copy`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ workspaceId: testData.testWorkspaceId });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to copy note');
    });

    test('404 – findById returns null during copy (note not found)', async () => {
      // Mocked behavior: noteModel.findById returns null during copy
      // Input: noteId in URL, workspaceId in body
      // Expected status code: 404
      // Expected behavior: error message returned
      // Expected output: "Note not found"
      const findByIdSpy = jest.spyOn(noteModel, 'findById').mockResolvedValueOnce(null as any);

      const res = await request(app)
        .post(`/api/notes/${noteId}/copy`)
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .send({ workspaceId: testData.testWorkspaceId });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Note not found');
      expect(findByIdSpy).toHaveBeenCalled();
      
      findByIdSpy.mockRestore();
    });
  });

  describe('Notes routes - user authentication edge cases', () => {
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

    test('POST /api/notes - 401 when req.user is undefined (lines 10-11)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests lines 10-11 in notes.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .post('/api/notes')
        .set('Authorization', 'Bearer fake-token')
        .send({
          workspaceId: testData.testWorkspaceId,
          noteType: NoteType.CONTENT,
          tags: ['test'],
          fields: [{ fieldType: 'title', content: 'Test', _id: '1' }],
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('PUT /api/notes/:id - 401 when req.user is undefined (lines 35-36)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests lines 35-36 in notes.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .put(`/api/notes/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', 'Bearer fake-token')
        .send({ 
          tags: ['updated'],
          fields: [{ fieldType: 'title', content: 'Updated', _id: '1' }]
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('DELETE /api/notes/:id - 401 when req.user is undefined (lines 60-61)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests lines 60-61 in notes.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .delete(`/api/notes/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('GET /api/notes/:id - 401 when req.user is undefined (lines 81-82)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests lines 81-82 in notes.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .get(`/api/notes/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('POST /api/notes/:id/share - 401 when req.user is undefined (lines 107-108)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests lines 107-108 in notes.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .post(`/api/notes/${new mongoose.Types.ObjectId()}/share`)
        .set('Authorization', 'Bearer fake-token')
        .send({ workspaceId: testData.testWorkspaceId });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('POST /api/notes/:id/copy - 401 when req.user is undefined (lines 149-150)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests lines 149-150 in notes.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .post(`/api/notes/${new mongoose.Types.ObjectId()}/copy`)
        .set('Authorization', 'Bearer fake-token')
        .send({ workspaceId: testData.testWorkspaceId });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });

    test('GET /api/notes - 401 when req.user is undefined (lines 206-207)', async () => {
      // Input: request where authenticateToken passes but req.user is undefined
      // Expected status code: 401
      // Expected behavior: returns "User not authenticated" error
      // Expected output: error message
      // This tests lines 206-207 in notes.controller.ts
      const appInstance = await buildAppWithMockedAuth(undefined);

      const res = await request(appInstance)
        .get('/api/notes')
        .set('Authorization', 'Bearer fake-token')
        .query({ workspaceId: testData.testWorkspaceId, noteType: NoteType.CONTENT });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not authenticated');
    });
  });
});

