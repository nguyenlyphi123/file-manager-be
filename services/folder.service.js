const {
  BadRequestError,
  InternalServerError,
} = require('../core/error.response');
const {
  incFolderSize,
  descFolderSize,
  findAllSubFolder,
  findAllSubFolderWithFolderIds,
} = require('../helpers/folder.helper');
const Folder = require('../models/Folder');
const File = require('../models/File');
const GcService = require('./gc.service');
const {
  findAllFiles,
  findAllFileWithFolderIds,
} = require('../helpers/file.helper');

class FolderService {
  constructor({
    _id,
    name,
    author,
    owner,
    parent_folder,
    sub_folders,
    files,
    isStar,
    isDelete,
    isRequireFolder,
    quickAccess,
    size,
    permission,
    sharedTo,
  }) {
    this._id = _id;
    this.name = name;
    this.author = author;
    this.owner = owner;
    this.parent_folder = parent_folder;
    this.sub_folders = sub_folders;
    this.files = files;
    this.isStar = isStar;
    this.isDelete = isDelete;
    this.isRequireFolder = isRequireFolder;
    this.quickAccess = quickAccess;
    this.size = size;
    this.permission = permission;
    this.sharedTo = sharedTo;
  }

  checkFolderPermission(uid, email, permission) {
    if (
      this.author !== uid &&
      (!this.sharedTo ||
        !this.permission ||
        !this.sharedTo.includes(email) ||
        !this.permission.includes(permission))
    )
      return new BadRequestError('You do not have permission to do this');
  }

  async createFolder(des) {
    if (!this.name || this.name === '') {
      throw new BadRequestError('Name is required');
    }

    try {
      const newFolder = await Folder.create({
        ...this,
        owner: this.parent_folder.owner ?? this.author,
        parent_folder: des ? des._id : this.parent_folder._id ?? null,
      });

      if (this.parent_folder) {
        await Folder.updateOne(
          { _id: this.parent_folder._id },
          {
            $push: { sub_folder: newFolder._id },
            $set: { modifiedAt: Date.now() },
          },
        );
      }

      return newFolder;
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error creating folder', error);
    }
  }

  async copyFolder(uid, des) {
    if (!uid || !des) throw new BadRequestError('Missing required fields');

    const { _id, sharedTo, permission, ...copyData } = this;

    try {
      let promises = [
        Folder.create({
          ...copyData,
          author: uid,
          owner: des ? des.owner : uid,
          parent_folder: des ? des._id : null,
        }),
      ];

      if (des)
        promises.push(
          Folder.updateOne(
            { _id: des._id },
            {
              $push: { sub_folder: _id },
              $set: { modifiedAt: Date.now() },
            },
          ),
          incFolderSize(des._id, copyData.size),
        );

      const result = await Promise.all(promises);

      const copiedFolder = result[0];

      return copiedFolder;
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error copying folder', error);
    }
  }

  async moveFolder(uid, des) {
    if (!uid || !des) throw new BadRequestError('Missing required fields');

    try {
      await Folder.deleteOne({
        _id: this._id,
        author: uid,
      });

      const createFolderPromise = this.createFolder(des);

      const promises = [createFolderPromise];

      if (this.parent_folder) {
        promises.push(
          Folder.updateOne(
            { _id: this.parent_folder._id },
            {
              $pull: { sub_folder: this._id },
              $set: { modifiedAt: Date.now() },
            },
          ),
          descFolderSize(this.parent_folder._id, this.size),
        );
      }

      if (des) {
        promises.push(
          Folder.updateOne(
            { _id: des._id },
            {
              $push: { sub_folder: this._id },
              $set: { modifiedAt: Date.now() },
            },
          ),
          incFolderSize(des._id, this.size),
        );
      }

      const results = await Promise.all(promises);

      const movedFolder = results[0];

      return movedFolder;
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error moving folder', error);
    }
  }

  async deleteFolder(uid) {
    if (!uid || !this._id) {
      throw new BadRequestError('Missing required fields');
    }

    try {
      const gcService = new GcService();

      // Find folder, sub_folders and files to delete
      const [subFolders, files] = await Promise.allSettled([
        findAllSubFolder(this._id),
        findAllFiles(this._id),
      ]);

      const folderDeletedResult = await Promise.allSettled([
        Folder.findOneAndDelete({
          _id: this._id,
          author: uid,
        }),
        File.deleteOne({ parent_folder: this._id }),
      ]);

      const folderDeleted = folderDeletedResult[0].value;

      if (!folderDeleted) {
        throw new BadRequestError(
          'Folder not exist or you do not have permission to delete it',
        );
      }

      // Delete all folders and associated files from database
      const subPromises = [
        subFolders.value.length > 0 &&
          Folder.deleteMany({
            _id: { $in: subFolders.value.map((s) => s._id) },
          }),
        files.value.length > 0 &&
          File.deleteMany({ _id: { $in: files.value.map((f) => f._id) } }),
      ];

      if (folderDeleted.parent_folder) {
        subPromises.push(
          Folder.updateOne(
            { _id: folderDeleted.parent_folder },
            {
              $pull: { sub_folder: folderDeleted._id },
              $set: { modifiedAt: Date.now() },
            },
          ),
          descFolderSize(folderDeleted.parent_folder, folderDeleted.size),
        );
      }

      await Promise.allSettled(subPromises);

      // Delete all files from Google Cloud Storage
      if (files.value.length > 0) {
        Promise.allSettled(
          files.value.map((file) => {
            const gcFileName = `${file.name}_${uid}_${folderDeleted._id}`;
            return gcService.deleteFile(gcFileName);
          }),
        );
      }

      return;
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error deleting folder', error);
    }
  }

  async deleteMultipleFolder(uid, folderIds) {
    if (!uid || !folderIds || folderIds.length === 0) {
      throw new BadRequestError('Missing required fields');
    }

    try {
      const gcService = new GcService();

      const deleteSubFolders = async () => {
        // Find sub_folders and files to delete
        const [subFolders, files] = await Promise.all([
          findAllSubFolderWithFolderIds(folderIds),
          findAllFileWithFolderIds(folderIds),
        ]);

        // Delete all sub_folders and associated files from database
        await Promise.all([
          subFolders.length > 0 &&
            Folder.deleteMany({
              _id: { $in: subFolders.map((s) => s._id) },
            }),
          files.length > 0 &&
            File.deleteMany({ _id: { $in: files.map((f) => f._id) } }),
        ]);

        // Delete all files from Google Cloud Storage
        if (files.value.length > 0) {
          await Promise.all(
            files.value.map((file) => {
              const gcFileName = `${file.name}_${uid}_${folderDeleted._id}`;
              return gcService.deleteFile(gcFileName);
            }),
          );
        }
      };

      const deleteFolder = async () => {
        // Delete all folders from database
        await Promise.all(
          folderIds.map(async (folderId) => {
            const foldersDeletedResult = await Promise.all([
              Folder.findOneAndDelete({
                _id: folderId,
                author: uid,
              }),
              File.deleteOne({ parent_folder: folderId }),
            ]);
            const folderDeleted = foldersDeletedResult[0]?.value;
            if (folderDeleted?.parent_folder) {
              await Promise.all([
                Folder.updateOne(
                  { _id: folderDeleted.parent_folder },
                  {
                    $pull: { sub_folder: folderDeleted._id },
                    $set: { modifiedAt: Date.now() },
                  },
                ),
                descFolderSize(folderDeleted.parent_folder, folderDeleted.size),
              ]);
            }
          }),
        );
      };

      await Promise.allSettled([deleteSubFolders(), deleteFolder()]);
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error deleting multiple folders', error);
    }
  }
}

module.exports = FolderService;
