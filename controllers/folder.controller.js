const { REDIS_FOLDERS_KEY } = require('../constants/redisKey');
const { SuccessResponse } = require('../core/success.response');
const redisClient = require('../modules/redis');
const FolderService = require('../services/folder.service');

class FolderController {
  // @route POST api/folder
  createFolder = async (req, res) => {
    const uid = req.user.id;

    try {
      const payload = {
        ...req.body,
        author: uid,
      };

      const result = await Promise.all([
        new FolderService(payload).createFolder(),
        redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${uid}`),
      ]);

      const folderData = result[0];

      res.json({
        success: true,
        message: 'Create folder successfully',
        data: folderData,
      });
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  };
  // @route POST api/folder/quick-access
  createAccessFolder = async (req, res) => {
    const uid = req.user.id;

    try {
      const payload = {
        ...req.body,
        author: uid,
        quickAccess: true,
      };

      const result = await Promise.all([
        new FolderService(payload).createFolder(),
        redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${uid}`),
      ]);

      const folderData = result[0];

      new SuccessResponse('Create folder successfully', folderData).send(res);
    } catch (error) {
      console.log(error);
    }
  };
  // @route POST api/folder/copy
  copyFolder = async (req, res) => {
    const uid = req.user.id;
    const email = req.user.email;

    const { data, desData } = req.body;

    try {
      const service = new FolderService(data);

      service.checkFolderPermission(uid, email, process.env.PERMISSION_EDIT);

      const result = await Promise.all([
        service.copyFolder(uid, desData),
        redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${uid}`),
      ]);

      const folderData = result[0];

      new SuccessResponse('Copy folder successfully', folderData).send(res);
    } catch (error) {
      console.log(error);
    }
  };
  // @route POST api/folder/move
  moveFolder = async (req, res) => {
    const uid = req.user.id;
    const email = req.user.email;

    const { data, desData } = req.body;

    const service = new FolderService(data);

    service.checkFolderPermission(uid, email, process.env.PERMISSION_EDIT);

    const result = await Promise.all([
      service.moveFolder(uid, desData),
      redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${uid}`),
    ]);

    const folderData = result[0];

    new SuccessResponse('Move folder successfully', folderData).send(res);
  };
  // @route DELETE api/folder/delete
  deleteFolder = async (req, res) => {
    const uid = req.user.id;
    const email = req.user.email;

    const folderId = req.body.folderId;

    const service = new FolderService({ _id: folderId });

    service.checkFolderPermission(uid, email, process.env.PERMISSION_EDIT);

    await Promise.all([
      service.deleteFolder(uid),
      redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${uid}`),
    ]);

    new SuccessResponse('Delete folder successfully').send(res);
  };
  // @route POST api/folder/multiple-delete
  deleteMultipleFolder = async (req, res) => {
    const uid = req.user.id;
    const email = req.user.email;

    const folders = req.body.folders;

    const folderIds = folders.map((f) => f._id);

    const service = new FolderService({});

    service.checkFolderPermission(uid, email, process.env.PERMISSION_EDIT);

    await Promise.all([
      service.deleteMultipleFolder(uid, folderIds),
      redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${uid}`),
    ]);

    new SuccessResponse('Delete folder successfully').send(res);
  };
}

module.exports = new FolderController();
