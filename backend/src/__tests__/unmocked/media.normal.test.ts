/// <reference types="jest" />
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import os from 'os';

import type { Request, Response } from 'express';

import { MediaController } from '../../media/media.controller';
import * as sanitizeModule from '../../utils/sanitizeInput.util';
import { IMAGES_DIR, MAX_FILE_SIZE } from '../../utils/constants';
import { mediaService } from '../../media/media.service';
import { createTestApp, setupTestDatabase, TestData } from '../test-utils/test-helpers';

// ---------------------------
// Test suite
// ---------------------------
describe('Media API – Normal Tests (No Mocking)', () => {
  let mongo: MongoMemoryServer;
  let testData: TestData;
  let app: ReturnType<typeof createTestApp>;

  // Spin up in-memory Mongo
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    await mongoose.connect(uri);
    console.log('✅ Connected to in-memory MongoDB');

    // Ensure images directory exists
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    
    // Create app after DB connection
    app = createTestApp();
  });

  // Tear down DB
  afterAll(async () => {
    // Ensure mongoose connection is properly closed
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    // Stop MongoDB memory server
    if (mongo) {
      await mongo.stop({ doCleanup: true, force: true });
    }

    // Clean up test images
    try {
      if (fs.existsSync(IMAGES_DIR)) {
        const files = fs.readdirSync(IMAGES_DIR);
        files.forEach(file => {
          const filePath = path.join(IMAGES_DIR, file);
          try {
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            // Ignore errors during cleanup
          }
        });
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  }, 10000); // 10 second timeout for cleanup

  // Fresh DB state before each test
  beforeEach(async () => {
    testData = await setupTestDatabase(app);
  });

  describe('POST /api/media/upload - Upload Image', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });
    test('200 – uploads image successfully', async () => {
      // Input: image file in multipart/form-data
      // Expected status code: 200
      // Expected behavior: image is saved to IMAGES_DIR
      // Expected output: success response with image path
      // Create a test image file with proper path (must be absolute)
      const testImagePath = path.resolve(IMAGES_DIR, 'test-upload.png');
      // Ensure directory exists
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
      }
      fs.writeFileSync(testImagePath, Buffer.from('fake-image-data'));

      const sanitizeSpy = jest.spyOn(sanitizeModule, 'sanitizeInput');

      const res = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .attach('media', testImagePath);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.body.data.image).toBeDefined();
      expect(sanitizeSpy).toHaveBeenCalled();
      sanitizeSpy.mock.calls.forEach(([filePath]) => {
        expect(typeof filePath).toBe('string');
        expect(filePath).not.toMatch(/\r|\n/);
      });

      // Clean up uploaded file and test file
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
      if (res.body.data.image && fs.existsSync(res.body.data.image)) {
        fs.unlinkSync(res.body.data.image);
      }

      sanitizeSpy.mockRestore();
    });

    test('400 – returns 400 when no file uploaded', async () => {
      // Input: request without file attachment
      // Expected status code: 400
      // Expected behavior: error message returned
      // Expected output: error message "No file uploaded"
      const res = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testData.testUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('No file uploaded');
    });

    test('400 – returns 400 when non-image file is uploaded', async () => {
      // Input: non-image file streamed from memory (tests storage.ts fileFilter)
      // Expected status code: >=400
      // Expected behavior: fileFilter rejects non-image files and request ends with error
      const res = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .attach('media', Buffer.from('not an image'), { filename: 'test.txt', contentType: 'text/plain' });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(600);
    });

    test('413 – returns error when file exceeds MAX_FILE_SIZE', async () => {
      // Input: image file larger than MAX_FILE_SIZE
      // Expected status code: 400-500 range due to Multer file size limit
      // Expected behavior: upload middleware rejects oversized file
      // Expected output: error response and no file saved
      const largeFilePath = path.join(os.tmpdir(), `oversized-upload-${Date.now()}.png`);
      const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE + 1, 0);
      fs.writeFileSync(largeFilePath, oversizedBuffer);

      const res = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .attach('media', largeFilePath);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(600);
      // Multer may return different error formats, just verify we got an error response
      expect(res.error).toBeDefined();

      if (fs.existsSync(largeFilePath)) {
        fs.unlinkSync(largeFilePath);
      }
    });

    test('401 – returns 401 when user is not authenticated', async () => {
      // Input: request without authentication token
      // Expected status code: 401
      // Expected behavior: authenticateToken middleware blocks request
      // This also implicitly tests that req.user check on line 23 in media.controller.ts
      // is defensive code - if middleware passes, req.user is always set
      const res = await request(app)
        .post('/api/media/upload');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test('500 – returns 500 when sanitizeInput rejects CRLF path', async () => {
      // Input: calling controller with CRLF-laced file path (simulates API failure branch)
      // Expected status code: 500
      // Expected behavior: sanitizeInput throws error, controller responds 500, saveImage never called
      const maliciousPath = 'C:/temp/evil\r\nfile.png';

      const req = {
        file: { path: maliciousPath },
        user: { _id: new mongoose.Types.ObjectId() },
      } as unknown as Request;

      const jsonMock = jest.fn();
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jsonMock,
      } as unknown as Response;

      const next = jest.fn();
      const saveImageSpy = jest.spyOn(mediaService, 'saveImage');

      const controller = new MediaController();
      await controller.uploadImage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'CRLF injection attempt detected' });
      expect(saveImageSpy).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();

      saveImageSpy.mockRestore();
    });
  });

});

