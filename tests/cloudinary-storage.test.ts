import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const { upload, end, once } = vi.hoisted(() => ({ upload: vi.fn(), end: vi.fn(), once: vi.fn() }));
vi.mock('cloudinary', () => ({ v2: { uploader: { upload_stream: upload } } }));
import { createImageStorage } from '../apps/api/src/image-storage';
const cloud = {
  UPLOAD_STORAGE: 'cloudinary',
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-key',
  CLOUDINARY_API_SECRET: 'test-secret',
  CLOUDINARY_UPLOAD_PRESET: 'crowd-products',
};
afterEach(() => vi.resetAllMocks());
describe('image storage', () => {
  it('persists local bytes under a unique public URL', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'crowd-upload-test-'));
    const bytes = Buffer.from('already-optimized-image');
    const url = await createImageStorage({}, directory)(bytes);
    expect(url).toMatch(/^\/uploads\/[a-f\d-]{36}\.webp$/);
    const path = resolve(directory, url.split('/').at(-1)!);
    try {
      expect(await readFile(path)).toEqual(bytes);
    } finally {
      await unlink(path);
      await rmdir(directory);
    }
    expect(upload).not.toHaveBeenCalled();
  });
  it('sends optimized bytes with server credentials and returns the secure CDN URL', async () => {
    upload.mockReturnValue({ once, end });
    const bytes = Buffer.from('optimized-webp');
    const pending = createImageStorage(cloud)(bytes);
    expect(end).toHaveBeenCalledWith(bytes);
    const [options, callback] = upload.mock.calls[0];
    expect(options).toEqual(
      expect.objectContaining({
        cloud_name: 'test-cloud',
        api_key: 'test-key',
        api_secret: 'test-secret',
        upload_preset: 'crowd-products',
        secure: true,
        resource_type: 'image',
        type: 'upload',
        public_id: expect.stringMatching(/^crowd\/products\/[a-f\d-]{36}$/),
        allowed_formats: ['webp'],
        overwrite: false,
        timeout: 20000,
      }),
    );
    callback(undefined, {
      secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/photo.webp',
    });
    const url = await pending;
    expect(url).toBe('https://res.cloudinary.com/test-cloud/image/upload/v1/photo.webp');
    expect(url).not.toContain('test-secret');
  });
  it('fails closed for missing credentials or an invalid provider', () => {
    expect(() => createImageStorage({ UPLOAD_STORAGE: 'cloudinary' })).toThrow(
      'CLOUDINARY_CLOUD_NAME',
    );
    expect(() => createImageStorage({ ...cloud, CLOUDINARY_API_SECRET: '' })).toThrow(
      'CLOUDINARY_API_SECRET',
    );
    expect(() => createImageStorage({ UPLOAD_STORAGE: 'wrong' })).toThrow('UPLOAD_STORAGE');
  });
  it('rejects provider failures without leaking errors or falling back to local disk', async () => {
    upload.mockReturnValue({ once, end });
    const pending = createImageStorage(cloud)(Buffer.from('image'));
    upload.mock.calls[0][1]({ message: 'Potentially sensitive provider error' });
    await expect(pending).rejects.toThrow('Cloudinary upload failed');
  });
  it('rejects an incomplete or insecure provider response', async () => {
    upload.mockReturnValue({ once, end });
    const pending = createImageStorage(cloud)(Buffer.from('image'));
    upload.mock.calls[0][1](undefined, { secure_url: 'http://example.test/image.webp' });
    await expect(pending).rejects.toThrow('secure image URL');
  });
  it('handles stream errors rather than leaving an upload pending', async () => {
    upload.mockReturnValue({ once, end });
    const pending = createImageStorage(cloud)(Buffer.from('image'));
    expect(once.mock.calls[0][0]).toBe('error');
    once.mock.calls[0][1](new Error('Connection failed'));
    await expect(pending).rejects.toThrow('Connection failed');
  });
});
