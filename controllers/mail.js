const nodemailer = require('nodemailer');
const Mailgen = require('mailgen');

require('dotenv').config();

const sendMail = (sender, receivers, title, message, note) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_AUTH_USER,
      pass: process.env.MAIL_AUTH_PASS,
    },
  });

  const MailGenerator = new Mailgen({
    theme: 'default',
    product: {
      name: 'BanaFile',
      link: 'https://file-manager-fe.vercel.app',
      copyright: 'Copyright © 2023 Nguyễn Lý Phi. All rights reserved.',
    },
  });

  let body = {
    name: null,
    intro: [
      `${sender} has sent you a requirement "${title}"`,
      message,
      note ? `Note: ${note}` : null,
    ],
  };

  let mailMessage = {
    from: `BanaFile <${process.env.MAIL_AUTH_USER}>`,
    to: null,
    html: null,
    subject: `You have received a request from ${sender}`,
  };

  const promises = receivers.map((receiver) => {
    const mail = {
      body: {
        ...body,
        name: receiver.name,
      },
    };

    const mailBody = MailGenerator.generate(mail);

    return transporter.sendMail({
      ...mailMessage,
      to: receiver.email,
      html: mailBody,
    });
  });

  return Promise.all(promises);
};

module.exports = {
  sendMail,
};
