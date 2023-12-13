const { BadRequestError } = require('../core/error.response');
const Account = require('../models/Account');

class AccountService {
  constructor({ _id, username, password, permission, info }) {
    this._id = _id;
    this.username = username;
    this.password = password;
    this.permission = permission;
    this.info = info;
  }

  async updatePermission() {
    try {
      if (!this._id || !this.permission) {
        throw new BadRequestError('Missing required fields');
      }

      const account = await Account.findOneAndUpdate(
        { _id: this._id },
        { permission: this.permission },
        { new: true },
      );

      return account;
    } catch (error) {
      console.log(error);
      throw new InternalServerError('Error updating account permission', error);
    }
  }
}

module.exports = AccountService;
