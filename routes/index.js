const express = require('express');
const router = express.Router();

const majorRouter = require('./major_routes');
const specializationRouter = require('./specialization_routes');
const authenticationRouter = require('./authentication_routes');
const folderRouter = require('./folder_routes');
const fileRouter = require('./file_routes');
const gcRouter = require('./gc_routes');
const classRouter = require('./class_routes');
const pupilRouter = require('./pupil_routes');
const lecturersRouter = require('./lecturers_routes');
const chatRouter = require('./chat_routes');
const messageRouter = require('./message_routes');
const accountRouter = require('./account_routes');
const requireRouter = require('./require_routes');
const searchRouter = require('./search_routes');
const informationRouter = require('./information_routes');

router.use('/api/major', majorRouter);
router.use('/api/specialization', specializationRouter);
router.use('/api/authentication', authenticationRouter);
router.use('/api/folder', folderRouter);
router.use('/api/file', fileRouter);
router.use('/api/gc', gcRouter);
router.use('/api/class', classRouter);
router.use('/api/pupil', pupilRouter);
router.use('/api/lecturers', lecturersRouter);
router.use('/api/chat', chatRouter);
router.use('/api/message', messageRouter);
router.use('/api/account', accountRouter);
router.use('/api/require', requireRouter);
router.use('/api/search', searchRouter);
router.use('/api/information', informationRouter);

module.exports = router;
