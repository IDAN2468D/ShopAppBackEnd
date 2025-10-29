const Bull = require('bull');
const Redis = require('ioredis');
const Image = require('../models/Image');
const { processAndUploadImage } = require('../utils/imageProcessingUtils');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const imageQueue = new Bull('imageProcessing', { redis: redisConfig });

imageQueue.process('processImage', async (job) => {
  const { imageId, fileBuffer, mimetype } = job.data;
  let image;

  try {
    image = await Image.findById(imageId);
    if (!image) {
      throw new Error(`Image with ID ${imageId} not found.`);
    }

    await processAndUploadImage(image, fileBuffer, mimetype);

    image.processingStatus = 'completed';
    await image.save();
    console.log(`Image ${imageId} processed and uploaded successfully.`);
  } catch (error) {
    console.error(`שגיאה בעיבוד תמונה ${imageId}:`, error);
    if (image) {
      image.processingStatus = 'failed';
      await image.save();
    }
    throw error; // Re-throw to trigger retry logic
  }
});

imageQueue.on('failed', async (job, err) => {
  console.error(`Job ${job.id} failed with error ${err.message}. Attempts made: ${job.attemptsMade}`);
  // Implement retry logic here if needed, Bull already has built-in retry options
  // For example, if you want to update the image status after all retries fail
  if (job.attemptsMade >= job.opts.attempts) {
    const imageId = job.data.imageId;
    const image = await Image.findById(imageId);
    if (image) {
      image.processingStatus = 'failed';
      await image.save();
      console.log(`Image ${imageId} failed after all retries.`);
    }
  }
});

const setupQueue = () => {
  console.log('Bull Queue initialized.');
};

module.exports = { imageQueue, setupQueue };
