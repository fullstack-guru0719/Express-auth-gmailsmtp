var userProfile; // profile information
const port = process.env.PORT || 3000;
require("dotenv").config();

const { emailWhiteList } = require("./mock-db"); // user email list
const { emailDestination } = require("./mock-db"); // email array to send email to

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // google oauth client id
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET; // google oauth client secret
const OAUTH_CALLBACKURL = process.env.CALLBACKURL; // google oauth callback url
const GMAILAPP_MAIL = process.env.GMAILAPP_MAIL; // gmail account mail address to use gmail smtp
const GMAILAPP_PASS = process.env.GMAILAPP_PASS; // gmail app password to use gmail smtp

/****************** Express Server Configuration ********************/
const express = require("express");
const app = express();
const passport = require("passport"); // oauth authentication
const session = require("express-session");
const bodyParser = require("body-parser"); // form parser
const nodemailer = require("nodemailer"); // mailer

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(
  session({
    resave: false,
    saveUninitialized: true,
    secret: "SECRET",
  })
);
app.use(passport.initialize());
app.use(passport.session());

/* ========= Routers ========== */
app.get("/", function (req, res) {
  res.render("pages/auth");
});
app.get("/error", (req, res) => res.send("error logging in"));
app.post("/sendCode", (req, res) => {
  const code = req.body.code; // code for the account from the user list
  const email = req.body.email; // account email
  const userID = req.body.userID; // account id

  let mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAILAPP_MAIL,
      pass: GMAILAPP_PASS,
    },
  });

  let mailDetails = {
    from: email,
    to: emailDestination,
    subject: "Test mail",
    text: `discount code from ${email} (id is ${userID}) is ${code}`,
  };

  mailTransporter.sendMail(mailDetails, function (err, data) {
    if (err) {
      res.send("email send failed");
    } else {
      res.render("pages/send-success");
    }
  });
});

app.listen(port, () => console.log("App listening on port " + port)); // run server

/******************************  Google AUTH ******************************* */
passport.serializeUser(function (user, cb) {
  cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
  cb(null, obj);
});

const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackurl: OAUTH_CALLBACKURL,
    },
    function (accessToken, refreshToken, profile, done) {
      userProfile = profile;
      return done(null, userProfile);
    }
  )
);

/* =================== Google Auth callback router ================ */
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/error" }),
  function (req, res) {
    // Successful authentication, redirect success.
    const myVerifiedEmails = [];

    // logged in profile is empty or no email address is found
    if (!userProfile || !userProfile.emails) return res.send("not logged in");

    userProfile.emails.map(
      ({ value, verified }) => verified && myVerifiedEmails.push(value)
    );

    // there is no verified email in the logged in account
    if (!myVerifiedEmails.length)
      return res.send("logged in but cannot find any verified email address");

    const userEmailInWhiteList = []; // find if logged in email address is in the email user whitelist
    myVerifiedEmails.map((myEmail) => {
      const index = emailWhiteList.findIndex(({ email }) => email === myEmail);
      if (index !== -1) userEmailInWhiteList.push(emailWhiteList[index]);
    });

    // email is not in the whitelist
    if (!userEmailInWhiteList.length)
      return res.send("sorry, you weren't on the list, no sneaking in!");

    // email is in whitelist and render success page
    res.render("pages/success", {
      email: userEmailInWhiteList[0].email,
      code: userEmailInWhiteList[0].code,
    });
  }
);
