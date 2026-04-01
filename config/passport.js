const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userRepository = require('../repositories/userRepository');

function normalizePassportError(error) {
  if (!error) return null;
  if (error instanceof Error) return error;
  const message = error.message || error.details || JSON.stringify(error);
  return new Error(message);
}

function initializePassport() {
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await userRepository.findByEmail(email);
        
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
        return done(normalizePassportError(error));
      }
    }
  ));

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
     const isProduction = process.env.NODE_ENV === 'production';
  const googleCallbackUrl = isProduction
    ? process.env.GOOGLE_CALLBACK_URL
    : `http://localhost:${process.env.PORT || 3000}/api/auth/google/callback`;

  if (googleClientId && googleClientSecret) {
    passport.use(new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await userRepository.findByGoogleId(profile.id);

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
            user = await userRepository.findByEmail(email);
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

          user = userRepository.create({
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
          return done(normalizePassportError(error));
        }
      }
    ));
    console.log('✅ Google OAuth configured');
  } else {
    console.log('⚠️ Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');
  }

  passport.serializeUser((user, done) => {
    done(null, userRepository.getId(user));
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await userRepository.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

module.exports = { initializePassport };
