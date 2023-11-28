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

router.use('/major', majorRouter);
router.use('/specialization', specializationRouter);
router.use('/authentication', authenticationRouter);
router.use('/folder', folderRouter);
router.use('/file', fileRouter);
router.use('/gc', gcRouter);
router.use('/class', classRouter);
router.use('/pupil', pupilRouter);
router.use('/lecturers', lecturersRouter);
router.use('/chat', chatRouter);
router.use('/message', messageRouter);
router.use('/account', accountRouter);
router.use('/require', requireRouter);
router.use('/search', searchRouter);
router.use('/information', informationRouter);

module.exports = router;
