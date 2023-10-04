const Folder = require('../models/Folder');

const IncFolderSize = async (folderId, size) => {
  const currentFolder = await Folder.findById(folderId);

  currentFolder.size += size;
  await currentFolder.save();

  if (currentFolder.parent_folder) {
    await IncFolderSize(currentFolder.parent_folder, size);
  }

  return;
};

const DescFolderSize = async (folderId, size) => {
  const currentFolder = await Folder.findById(folderId);

  currentFolder.size -= size;

  await currentFolder.save();

  if (currentFolder.parent_folder) {
    await DescFolderSize(currentFolder.parent_folder, size);
  }

  return;
};

module.exports = {
  IncFolderSize,
  DescFolderSize,
};
