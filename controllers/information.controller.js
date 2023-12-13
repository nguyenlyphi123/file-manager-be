const { SuccessResponse } = require('../core/success.response');
const AccountService = require('../services/account.service');
const InformationService = require('../services/information.service');

class InformationController {
  // @route GET api/information/details/:id
  getInformationById = async (req, res) => {
    const id = req.params.id;

    const service = new InformationService({ account_id: id });

    const information = await service.getInformationById();

    new SuccessResponse('Get information successfully', information).send(res);
  };
  // @route GET api/information/list-grouped-manager
  getGroupedInformationListByManager = async (req, res) => {
    const uid = req.user.id;

    const service = new InformationService({ account_id: uid });

    const information = await service.getGroupedInformationListByManager();

    new SuccessResponse('Get list information successfully', information).send(
      res,
    );
  };
  // @route GET api/information/list-grouped-admin
  getGroupedInformationListByAdmin = async (req, res) => {
    const uid = req.user.id;

    const service = new InformationService({ account_id: uid });

    const information = await service.getGroupedInformationListByManager();

    new SuccessResponse('Get list information successfully', information).send(
      res,
    );
  };
  // @route GET api/information/list-mentor/:specId
  getListMentorInfomationWithSpecId = async (req, res) => {
    const uid = req.user.id;

    const specId = req.params.specId;

    const service = new InformationService({ account_id: uid });

    const information = await service.getListMentorsInformationWithSpecId(
      specId,
    );

    new SuccessResponse('Get list information successfully', information).send(
      res,
    );
  };
  // @route PUT api/information/assign-mentor
  assignMentor = async (req, res) => {
    const uid = req.user.id;

    const payload = req.body;

    const service = new InformationService({ account_id: uid });

    const information = await service.assignMentor(payload);

    new SuccessResponse('Assign mentor successfully', information).send(res);
  };
  // @route PUT api/information/assign-role
  assignRole = async (req, res) => {
    const { member_id, major_id, spec_id, permission } = req.body;

    const accountService = new AccountService({
      _id: member_id,
      permission: permission,
    });

    const informationService = new InformationService({
      account_id: member_id,
      major: major_id,
      specialization: spec_id,
    });

    const [information] = await Promise.all([
      informationService.assignRole(),
      accountService.updatePermission(),
    ]);

    new SuccessResponse('Assign role successfully', information).send(res);
  };
}

module.exports = new InformationController();
