import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { uploadsDirectory } from './config.js';

/** Only server code receives storage credentials. Uploads always pass through staff auth. */
export function createImageStorage(env: NodeJS.ProcessEnv, directory = uploadsDirectory) {
  const provider = env.UPLOAD_STORAGE || 'local';
  if (provider === 'local') {
    return async (image: Buffer): Promise<string> => {
      const name = `${randomUUID()}.webp`;
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, name), image, { flag: 'wx' });
      return `/uploads/${name}`;
    };
  }
  if (provider !== 'cloudinary') throw new Error('UPLOAD_STORAGE must be local or cloudinary');
  for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    if (!env[key]?.trim()) throw new Error(`Set ${key} when UPLOAD_STORAGE=cloudinary`);
  }
  // Keep configuration per upload, rather than mutating the SDK's shared globals.
  const credentials = {
    cloud_name: env.CLOUDINARY_CLOUD_NAME!,
    api_key: env.CLOUDINARY_API_KEY!,
    api_secret: env.CLOUDINARY_API_SECRET!,
    upload_preset: env.CLOUDINARY_UPLOAD_PRESET || undefined,
  };
  return (image: Buffer): Promise<string> =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          ...credentials,
          secure: true,
          resource_type: 'image',
          type: 'upload',
          public_id: `crowd/products/${randomUUID()}`,
          asset_folder: 'crowd/products',
          allowed_formats: ['webp'],
          overwrite: false,
          timeout: 20000,
        },
        (error, result) => {
          if (error) {
            reject(new Error('Cloudinary upload failed'));
            return;
          }
          if (!result?.secure_url?.startsWith('https://')) {
            reject(new Error('Cloudinary did not return a secure image URL'));
            return;
          }
          resolve(result.secure_url);
        },
      );
      stream.once('error', reject);
      stream.end(image);
    });
}

export const storeImage = createImageStorage(process.env);
