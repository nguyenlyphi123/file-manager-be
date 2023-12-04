class SuccessResponse {
  constructor(message, data) {
    this.success = true;
    this.message = message;
    this.data = data;
  }

  send(res, header = {}) {
    return res.set(header).json(this);
  }
}

module.exports = {
  SuccessResponse,
};
