const storage = require('../config/googleStorage');

const bucketName = process.env.GCLOUD_BUCKET_NAME;

class GcService {
  constructor() {
    this.storage = storage;
    this.bucketName = bucketName;
  }

  async uploadFile(destFileName) {
    return await this.storage
      .bucket(this.bucketName)
      .file(destFileName)
      .createWriteStream();
  }

  async downloadFile(srcFileName) {
    return await this.storage
      .bucket(this.bucketName)
      .file(srcFileName)
      .download();
  }

  async deleteFile(srcFileName) {
    return await this.storage
      .bucket(this.bucketName)
      .file(srcFileName)
      .delete();
  }

  async getFileMetadata(srcFileName) {
    return await this.storage
      .bucket(this.bucketName)
      .file(srcFileName)
      .getMetadata();
  }
}

module.exports = new GcService();
