const sharp = require('sharp');
const { uploadToCloudinary } = require('./cloudinaryUtils');

const processAndUploadImage = async (image, fileBuffer, mimetype) => {
  const imageSharp = sharp(fileBuffer);
  const metadata = await imageSharp.metadata();

  image.dimensions = { width: metadata.width, height: metadata.height };

  const variants = {};
  const uploadPromises = [];

  // Original image upload
  const originalUpload = await uploadToCloudinary(fileBuffer, 'original');
  image.originalUrl = originalUpload.secure_url;
  variants.original = originalUpload.secure_url;

  // Define variant sizes and qualities
  const sizes = {
    thumbnail: 300,
    small: 600,
    medium: 1200,
    large: 1920,
  };

  for (const [name, size] of Object.entries(sizes)) {
    const processedBuffer = await imageSharp
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .toFormat('webp', { quality: 80 })
      .toBuffer();

    const uploadResult = await uploadToCloudinary(processedBuffer, name);
    variants[name] = uploadResult.secure_url;
  }

  image.variants = variants;
  // Removed image.save() as product document will be updated separately
  return variants;
};

module.exports = { processAndUploadImage };
