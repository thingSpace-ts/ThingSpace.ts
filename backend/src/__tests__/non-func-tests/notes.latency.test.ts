/// <reference types="jest" />
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as fs from 'fs';
import * as path from 'path';

import { NoteType } from '../../notes/notes.types';
import { noteService } from '../../notes/notes.service';
import { createTestApp, setupTestDatabase, TestData } from '../test-utils/test-helpers';

jest.setTimeout(60000);

// Load notes data from JSON file
function loadNotesData(): any[] {
  const jsonPath = path.join(__dirname, '../../../../scripts/500_notes.json');
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(jsonContent);
  return data.notes || [];
}

// Convert JSON note data to CreateNoteRequest format
function convertToNoteRequest(noteData: any, workspaceId: string): any {
  const fields: any[] = [];
  
  // Add title field
  if (noteData.title) {
    fields.push({
      _id: new mongoose.Types.ObjectId().toString(),
      fieldType: 'text',
      label: 'Title',
      required: true,
      placeholder: 'Enter title',
      maxLength: 100,
      content: noteData.title,
    });
  }
  
  // Add description field
  if (noteData.description) {
    fields.push({
      _id: new mongoose.Types.ObjectId().toString(),
      fieldType: 'text',
      label: 'Description',
      required: false,
      placeholder: 'Enter description',
      maxLength: 500,
      content: noteData.description,
    });
  }
  
  // Add date field if present
  if (noteData.date) {
    fields.push({
      _id: new mongoose.Types.ObjectId().toString(),
      fieldType: 'datetime',
      label: 'Date',
      required: false,
      minDate: null,
      maxDate: null,
      content: noteData.date,
    });
  }
  
  // Add number field if present
  if (noteData.number !== undefined) {
    fields.push({
      _id: new mongoose.Types.ObjectId().toString(),
      fieldType: 'number',
      label: 'Number',
      required: false,
      min: 0,
      max: 100,
      content: noteData.number,
    });
  }
  
  // Build tags array
  const tags: string[] = [];
  tags.push(noteData.tag);

  
  return {
    workspaceId,
    noteType: NoteType.CONTENT,
    tags,
    fields,
  };
}

// ---------------------------
// Test suite
// ---------------------------
describe('Notes API – Search Latency Test (Non-Functional Requirement)', () => {
  let mongo: MongoMemoryServer;
  let testData: TestData;
  let app: ReturnType<typeof createTestApp>;
  const notesData = loadNotesData();

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

  // Fresh DB state and note creation before each test
  beforeEach(async () => {
    testData = await setupTestDatabase(app);
    // Clean up any previous mocks
    jest.restoreAllMocks();
    
    // Mock OpenAI client to avoid actual API calls during latency testing
    const mockEmbedding = Array(3072).fill(0).map(() => Math.random() * 0.1 - 0.05); // Simulate embedding vector (3072 dimensions for text-embedding-3-large)
    const mockClient = {
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: mockEmbedding }],
        }),
      },
    };
    
    // Mock getClient to return our mock client
    jest.spyOn(noteService as any, 'getClient').mockReturnValue(mockClient);
    
    // Setup: Create 400 notes in the database
    // Use direct service calls instead of HTTP to avoid memory leaks from 400 supertest agents
    const notesToCreate = notesData.slice(0, 400);
    const createdNotes: any[] = [];
    
    console.log(`Creating ${notesToCreate.length} notes...`);
    const createStartTime = Date.now();
    
    for (const noteData of notesToCreate) {
      const noteRequest = convertToNoteRequest(noteData, testData.testWorkspaceId);
      try {
        // Call service directly to avoid HTTP overhead and memory leaks
        const note = await noteService.createNote(
          new mongoose.Types.ObjectId(testData.testUserId),
          noteRequest
        );
        createdNotes.push(note);
      } catch (error) {
        console.error(`Failed to create note: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    const createEndTime = Date.now();
    const createDuration = createEndTime - createStartTime;
    console.log(`Created ${createdNotes.length} notes in ${createDuration}ms`);
    
    // Verify we created the expected number of notes
    expect(createdNotes.length).toBe(400);
  });

  describe('GET /api/notes - Search Latency Test', () => {
    test('Search query latency should be under 5 seconds with 400 notes', async () => {
      // Test: Run 3 different search queries and measure average latency
      const searchQueries = ['food recipe cooking', 'study session homework', 'travel trip vacation'];
      const searchLatencies: number[] = [];
      
      console.log(`Running 3 different search queries...`);
      
      for (let i = 0; i < 3; i++) {
        const searchQuery = searchQueries[i];
        console.log(`\nSearch ${i + 1}: "${searchQuery}"`);
        
        const searchStartTime = Date.now();
        let res;
        try {
          res = await request(app)
            .get('/api/notes')
            .query({
              workspaceId: testData.testWorkspaceId,
              noteType: NoteType.CONTENT,
              query: searchQuery,
            })
            .set('Authorization', `Bearer ${testData.testUserToken}`);
        } catch (error) {
          throw new Error(`Search ${i + 1} failed with error: ${(error as Error).message}`);
        }
        
        const searchEndTime = Date.now();
        const searchLatency = searchEndTime - searchStartTime;
        searchLatencies.push(searchLatency);
        
        console.log(`Search ${i + 1} completed in ${searchLatency}ms`);
        
        // Log error if status is not 200
        if (res.status !== 200) {
          throw new Error(
            `Search ${i + 1} failed with status ${res.status}: ${JSON.stringify(res.body)}`
          );
        }
        // Assertions for each search
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Notes retrieved successfully');
        expect(res.body.data).toBeDefined();
        expect(res.body.data.notes).toBeDefined();
        expect(Array.isArray(res.body.data.notes)).toBe(true);
        
        
      }
      
      // Calculate average latency
      const avgLatency = searchLatencies.reduce((sum, latency) => sum + latency, 0) / searchLatencies.length;
      console.log(`\nSearch latencies: ${searchLatencies.join('ms, ')}ms`);
      console.log(`Average search latency: ${avgLatency.toFixed(2)}ms`);
      
      // Non-functional requirement: average latency should be under 5 seconds
      expect(avgLatency).toBeLessThan(5000);
      
      console.log(`Search latency test passed: average ${avgLatency.toFixed(2)}ms < 5000ms`);
    });
  });
});

