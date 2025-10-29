const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const uploadToCloudinary = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: `shopapp/${folder}` },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

const deleteFromCloudinary = async (publicIds) => {
  try {
    const result = await cloudinary.api.delete_resources(publicIds);
    console.log('נמחקו תמונות מקלאודניירי:', result);
    return result;
  } catch (error) {
    console.error('שגיאה במחיקת תמונות מקלאודניירי:', error);
    throw error;
  }
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };
