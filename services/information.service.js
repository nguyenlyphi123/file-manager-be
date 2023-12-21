const { getInformationById } = require('../helpers/information.helper');
const {
  InternalServerError,
  BadRequestError,
  NotFoundError,
} = require('../core/error.response');
const {
  getGroupedInformationList,
  getMentorsInformationWithSpecId,
} = require('../helpers/information.helper');
const Information = require('../models/Information');

class InformationService {
  constructor({
    account_id,
    name,
    email,
    image,
    major,
    specialization,
    _class,
    mentor,
    createAt,
    modifiedAt,
  }) {
    this.account_id = account_id;
    this.name = name;
    this.email = email;
    this.image = image;
    this.major = major;
    this.specialization = specialization;
    this.class = _class;
    this.mentor = mentor;
    this.createAt = createAt;
    this.modifiedAt = modifiedAt;
  }

  async getInformationById() {
    try {
      const information = await getInformationById(this.account_id);

      if (!information) {
        throw new NotFoundError('Information not found');
      }

      return information;
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error getting information by id', error);
    }
  }

  async getGroupedInformationListByManager() {
    try {
      const user = await Information.findOne({
        account_id: this.account_id,
      }).select('major');

      const information = await getGroupedInformationList(user.major);
      return information;
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error getting grouped information', error);
    }
  }

  async getGroupedInformationListByAdmin() {
    try {
      const information = await getGroupedInformationList();
      return information;
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error getting grouped information', error);
    }
  }

  async getListMentorsInformationWithSpecId(specId) {
    try {
      const information = await getMentorsInformationWithSpecId(specId);
      return information;
    } catch (error) {
      console.log(error);
      throw new InternalServerError(
        'Error getting list mentor information',
        error,
      );
    }
  }

  async assignMentor({ mentor_id, member_id, major_id, spec_id }) {
    try {
      if (!mentor_id || !member_id || !major_id || !spec_id) {
        throw new BadRequestError('Missing required fields');
      }

      const information = await Information.findOneAndUpdate(
        { account_id: member_id },
        { mentor: mentor_id, major: major_id, specialization: spec_id },
        { new: true, returnOriginal: false },
      );

      return information;
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error assigning mentor', error);
    }
  }

  async assignRole() {
    try {
      if (!this.major || this.specialization.length === 0) {
        throw new BadRequestError('Missing required fields');
      }

      const information = await Information.findOneAndUpdate(
        { account_id: this.account_id },
        { major: this.major, specialization: this.specialization },
        { new: true, returnOriginal: false },
      );

      return information;
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error assigning role', error);
    }
  }
}

module.exports = InformationService;
