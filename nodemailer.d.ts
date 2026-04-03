declare module "nodemailer" {
  const nodemailer: {
    createTransport: (options: unknown) => {
      sendMail: (message: unknown) => Promise<unknown>;
    };
  };

  export default nodemailer;
}
