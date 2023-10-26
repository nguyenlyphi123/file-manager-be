const origin =
  process.env.NODE_ENV === 'production'
    ? 'https://file-manager-fe.vercel.app'
    : 'http://localhost:3000';

module.exports = {
  origin,
};
