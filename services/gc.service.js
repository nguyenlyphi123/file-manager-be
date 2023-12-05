const storage = require('../config/googleStorage');

const bucket = storage.bucket(process.env.GCLOUD_BUCKET_NAME);

class GcService {
  constructor() {}

  async deleteFile(fileName) {
    try {
      await bucket.file(`files/${fileName}`).delete();
    } catch (error) {
      throw error;
    }
  }
}

module.exports = GcService;
