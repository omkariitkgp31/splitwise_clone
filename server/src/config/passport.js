const bcrypt = require("bcryptjs");
const passport = require("passport");
const { Strategy: LocalStrategy } = require("passport-local");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const prisma = require("./db");

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          return done(null, false, { message: "Invalid email or password." });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
          return done(null, false, { message: "Invalid email or password." });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: process.env.GOOGLE_CALLBACK_URL,
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         const email = profile.emails?.[0]?.value;

//         if (!email) {
//           return done(null, false, { message: "Google account email is required." });
//         }

//         const user = await prisma.user.upsert({
//           where: { email },
//           update: {
//             googleId: profile.id,
//             imageURI: profile.photos?.[0]?.value || null,
//           },
//           create: {
//             email,
//             googleId: profile.id,
//             name: profile.displayName || email,
//             imageURI: profile.photos?.[0]?.value || null,
//           },
//         });

//         return done(null, user);
//       } catch (error) {
//         return done(error);
//       }
//     }
//   )
// );

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;
