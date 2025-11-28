/// <reference types="jest" />
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { mediaService } from '../../media/media.service';
import { IMAGES_DIR } from '../../utils/constants';
import { createTestApp, setupTestDatabase, TestData } from '../test-utils/test-helpers';

// ---------------------------
// Test suite
// ---------------------------
describe('Media API – Mocked Tests (Jest Mocks)', () => {
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

  describe('POST /api/media/upload - Upload Image, with mocks', () => {
    test('500 – returns 500 when MediaService.saveImage throws error', async () => {
      // Mocked behavior: MediaService.saveImage throws error
      // Input: image file
      // Expected status code: 500
      // Expected behavior: error handled gracefully
      // Expected output: error message
      jest.spyOn(mediaService, 'saveImage').mockRejectedValue(new Error('Failed to save image'));

      const testImagePath = path.resolve(IMAGES_DIR, 'test-upload.png');
      // Ensure directory exists
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
      }
      fs.writeFileSync(testImagePath, Buffer.from('fake-image-data'));

      const res = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .attach('media', testImagePath);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Failed to save image');

      // Clean up
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    test('500 – returns 500 with fallback message when error has no message', async () => {
      // Mocked behavior: MediaService.saveImage throws error with empty message
      // Input: image file
      // Expected status code: 500
      // Expected behavior: error handled gracefully with fallback message
      // Expected output: error message "Failed to upload profile picture"
      const errorWithoutMessage = new Error('');
      jest.spyOn(mediaService, 'saveImage').mockRejectedValue(errorWithoutMessage);

      const testImagePath = path.resolve(IMAGES_DIR, 'test-upload.png');
      // Ensure directory exists
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
      }
      fs.writeFileSync(testImagePath, Buffer.from('fake-image-data'));

      const res = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .attach('media', testImagePath);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Failed to upload profile picture');

      // Clean up
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    test('500 – handles non-Error thrown value', async () => {
      // Mocked behavior: MediaService.saveImage throws non-Error value
      // Input: image file
      // Expected status code: 500 or handled by error handler
      // Expected behavior: next(error) called
      // Expected output: error handled by error handler
      jest.spyOn(mediaService, 'saveImage').mockRejectedValue('String error');

      const testImagePath = path.resolve(IMAGES_DIR, 'test-upload.png');
      // Ensure directory exists
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
      }
      fs.writeFileSync(testImagePath, Buffer.from('fake-image-data'));

      const res = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${testData.testUserToken}`)
        .attach('media', testImagePath);

      expect(res.status).toBeGreaterThanOrEqual(500);

      // Clean up
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    test('200 – recreates images directory when missing before upload route is registered', async () => {
      // Mocked behavior: IMAGES_DIR does not exist when storage module initializes
      // Input: image upload request with directory removed before re-importing storage module
      // Expected status code: 200
      // Expected behavior: storage.ts creates directory via fs.mkdirSync and upload succeeds
      // Expected output: upload succeeds and mkdirSync invoked with IMAGES_DIR

      const originalExistsSync = fs.existsSync.bind(fs);
      const originalMkdirSync = fs.mkdirSync.bind(fs);

      if (fs.existsSync(IMAGES_DIR)) {
        fs.rmSync(IMAGES_DIR, { recursive: true, force: true });
      }

      const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(targetPath => {
        if (targetPath === IMAGES_DIR) {
          return false;
        }
        return originalExistsSync(targetPath as any);
      });
      const mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation((targetPath, options) => {
        return originalMkdirSync(targetPath as any, options as any);
      });

      try {
        jest.isolateModules(() => {
          // Re-require storage module so the top-level directory creation runs with our spies
          require('../../utils/storage');
        });

        // Check spy calls before restoring
        expect(existsSyncSpy).toHaveBeenCalledWith(IMAGES_DIR);
        expect(mkdirSyncSpy).toHaveBeenCalledWith(IMAGES_DIR, { recursive: true });
        
        // Restore spies so we can check the real directory state
        existsSyncSpy.mockRestore();
        mkdirSyncSpy.mockRestore();
        
        expect(fs.existsSync(IMAGES_DIR)).toBe(true);

        const tmpFilePath = path.join(os.tmpdir(), `storage-recreate-${Date.now()}.png`);
        fs.writeFileSync(tmpFilePath, Buffer.from('fake-image-data'));

        try {
          const res = await request(app)
            .post('/api/media/upload')
            .set('Authorization', `Bearer ${testData.testUserToken}`)
            .attach('media', tmpFilePath);

          expect(res.status).toBe(200);
        } finally {
          if (fs.existsSync(tmpFilePath)) {
            fs.unlinkSync(tmpFilePath);
          }
        }
      } catch (error) {
        // Ensure spies are restored even if test fails
        existsSyncSpy.mockRestore();
        mkdirSyncSpy.mockRestore();
        throw error;
      }
    });
  });

  describe('DELETE /api/user/profile - User Deletion Media Cleanup, with mocks', () => {
    test('200 – user deletion succeeds when deleteAllUserImages encounters readdirSync error', async () => {
      // Input: authenticated user deletion request, fs.readdirSync fails
      // Expected status code: 200
      // Expected behavior: Error is caught and logged (media.service.ts lines 124-126)
      // Expected output: User deleted successfully, error logged
      // This tests the catch block in deleteAllUserImages via API
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const readdirSyncSpy = jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
        throw new Error('readdirSync failed');
      });

      try {
        const res = await request(app)
          .delete('/api/user/profile')
          .set('Authorization', `Bearer ${testData.testUserToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('User deleted successfully');
        
        // Verify error was logged - media.service.ts line 125
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete user images:', expect.any(Error));
      } finally {
        readdirSyncSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }
    });

    test('200 – user deletion succeeds when deleteImage encounters unlinkSync error', async () => {
      // Input: authenticated user deletion request with user images, fs.unlinkSync fails
      // Expected status code: 200
      // Expected behavior: Error is caught and logged (media.service.ts lines 100-102)
      // Expected output: User deleted successfully, error logged
      // This tests the catch block in deleteImage via API
      
      // Create test image files for this user
      const userId = testData.testUserId;
      const file1 = path.resolve(IMAGES_DIR, `${userId}-test1.png`);
      
      // Ensure IMAGES_DIR exists
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
      }
      fs.writeFileSync(file1, Buffer.from('test1'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock unlinkSync to fail only for our test file
      const originalUnlinkSync = fs.unlinkSync.bind(fs);
      const unlinkSyncSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes(userId)) {
          throw new Error('Unlink failed');
        }
        return originalUnlinkSync(filePath);
      });

      try {
        const res = await request(app)
          .delete('/api/user/profile')
          .set('Authorization', `Bearer ${testData.testUserToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('User deleted successfully');
        
        // Verify error was logged - media.service.ts line 101
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete old profile picture:', expect.any(Error));
      } finally {
        unlinkSyncSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        // Clean up if file still exists
        if (fs.existsSync(file1)) {
          try { fs.unlinkSync(file1); } catch { /* ignore */ }
        }
      }
    });
  });

  describe('POST /api/media/upload - Upload Image Error Paths, with mocks', () => {
    test('500 – returns 500 and cleans up file when rename fails', async () => {
      // Input: valid image file upload, but fs.renameSync fails
      // Expected status code: 500
      // Expected behavior: File cleanup branch executed (media.service.ts lines 76-79)
      // Expected output: Error message, original file cleaned up
      // This tests saveImage catch block cleanup via API
      
      const testImagePath = path.resolve(IMAGES_DIR, 'test-rename-fail.png');
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
      }
      fs.writeFileSync(testImagePath, Buffer.from('fake-image-data'));

      // Mock fs.renameSync to throw error
      const renameSyncSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw new Error('Rename failed');
      });

      try {
        const res = await request(app)
          .post('/api/media/upload')
          .set('Authorization', `Bearer ${testData.testUserToken}`)
          .attach('media', testImagePath);

        expect(res.status).toBe(500);
        expect(res.body.message).toContain('Failed to save profile picture');
      } finally {
        renameSyncSpy.mockRestore();
        // Clean up
        if (fs.existsSync(testImagePath)) {
          fs.unlinkSync(testImagePath);
        }
      }
    });
  });

  describe('POST /api/user/profile - Edge Cases', () => {
    test('401 – upload fails when authentication middleware sets undefined user', async () => {
      const { MediaController } = require('../../media/media.controller');
      const controller = new MediaController();

      const req = {
        file: { path: '/tmp/test.png' },
        user: undefined,
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as any;
      const next = jest.fn();

      await controller.uploadImage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not authenticated' });
    });
  });

  describe('Media Service - Path Validation Security', () => {
    test('500 – file system operations reject paths outside allowed directory', () => {
      const service = mediaService as any;
      
      const result = service.safeExistsSync('/etc/passwd', true);
      expect(result).toBe(false);
    });

    test('500 – file deletion rejects invalid paths when validation enabled', () => {
      const service = mediaService as any;
      
      expect(() => {
        service.safeUnlinkSync('/etc/passwd', true);
      }).toThrow('Invalid file path for deletion');
    });

    test('500 – file rename rejects invalid destination paths', () => {
      const service = mediaService as any;
      
      expect(() => {
        service.safeRenameSync('/tmp/source', '/etc/invalid', true);
      }).toThrow('Invalid destination path');
    });

    test('500 – save image validates destination path is within allowed directory', async () => {
      const service = mediaService as any;
      const originalValidatePath = service.validatePath.bind(service);
      
      service.validatePath = jest.fn().mockReturnValue(false);
      
      try {
        await expect(
          mediaService.saveImage('/tmp/test.png', 'user123')
        ).rejects.toThrow('Invalid file path');
      } finally {
        service.validatePath = originalValidatePath;
      }
    });

    test('500 – save image handles non-Error exceptions during file operations', async () => {
      const service = mediaService as any;
      const originalSafeRenameSync = service.safeRenameSync.bind(service);
      
      service.safeRenameSync = jest.fn().mockImplementation(() => {
        throw 'string error';
      });
      
      try {
        await expect(
          mediaService.saveImage('/tmp/test.png', 'user123')
        ).rejects.toThrow('Failed to save profile picture: string error');
      } finally {
        service.safeRenameSync = originalSafeRenameSync;
      }
    });

    test('200 – delete image handles paths outside allowed directory gracefully', async () => {
      await expect(mediaService.deleteImage('/etc/passwd')).resolves.toBeUndefined();
    });

    test('200 – deleteAllUserImages returns early when IMAGES_DIR does not exist', async () => {
      const service = mediaService as any;
      const originalSafeExistsSync = service.safeExistsSync.bind(service);
      
      // Mock safeExistsSync to return false (directory doesn't exist)
      service.safeExistsSync = jest.fn().mockReturnValue(false);
      
      try {
        // This should return early without error
        await expect(mediaService.deleteAllUserImages('user123')).resolves.toBeUndefined();
      } finally {
        service.safeExistsSync = originalSafeExistsSync;
      }
    });
  });
});
