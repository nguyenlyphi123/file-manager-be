const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');

require('dotenv').config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      callbackURL: `${process.env.BA_ORIGIN}/api/authentication/google/callback`,
      scope: ['profile', 'email'],
      passReqToCallback: true,
    },
    (request, accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});
