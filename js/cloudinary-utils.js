export const cloudinaryConfig = window.CLOUDINARY_CONFIG || {
  cloudName: 'dkv7a8rcm',
  uploadPreset: 'my_silvertechelectrical_preset'
};

export const FOLDERS = {
  MARKETING: 'marketing',
  SERVICE_DOCUMENTATION: 'service-documentation'
};

export async function uploadToCloudinary(file, folder = FOLDERS.SERVICE_DOCUMENTATION) {
  if (!file) {
    throw new Error('No file provided for Cloudinary upload.');
  }

  if (!cloudinaryConfig.cloudName || !cloudinaryConfig.uploadPreset) {
    throw new Error('Cloudinary configuration is missing.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);
  formData.append('folder', folder);
  formData.append('resource_type', 'auto');

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || 'Cloudinary upload failed.');
  }

  return result;
}
