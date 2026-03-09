const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

function initializePassport() {
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await User.findByEmail(email);
        
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        if (user.provider !== 'local') {
          return done(null, false, { 
            message: `This account uses ${user.provider} sign-in` 
          });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        if (!user.isActive) {
          return done(null, false, { message: 'Account is deactivated' });
        }

        user.lastLogin = new Date();
        await user.save();

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

  if (googleClientId && googleClientSecret) {
    passport.use(new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findByGoogleId(profile.id);

          if (user) {
            user.lastLogin = new Date();
            if (profile.photos && profile.photos[0]) {
              user.profileImage = profile.photos[0].value;
            }
            await user.save();
            return done(null, user);
          }

          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          
          if (email) {
            user = await User.findByEmail(email);
            if (user) {
              user.googleId = profile.id;
              user.provider = 'google';
              user.lastLogin = new Date();
              if (profile.photos && profile.photos[0]) {
                user.profileImage = profile.photos[0].value;
              }
              await user.save();
              return done(null, user);
            }
          }

          user = new User({
            googleId: profile.id,
            email: email,
            name: profile.displayName || 'User',
            provider: 'google',
            profileImage: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            lastLogin: new Date()
          });

          await user.save();
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    ));
    console.log('✅ Google OAuth configured');
  } else {
    console.log('⚠️ Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');
  }

  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

module.exports = { initializePassport };
