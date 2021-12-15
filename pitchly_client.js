const loginWithPitchly = (options, callback) => {
  // support a callback without options
  if (! callback && typeof options === "function") {
    callback = options;
    options = null;
  }
  const credentialRequestCompleteCallback = Accounts.oauth.credentialRequestCompleteHandler(callback);
  Pitchly.requestCredential(options, credentialRequestCompleteCallback);
};
Accounts.registerClientLoginFunction('pitchly', loginWithPitchly);
Meteor.loginWithPitchly = 
  (...args) => Accounts.applyLoginFunction('pitchly', args);

// Automatically refresh the current user's access token and service data when
// the token is about to expire. Since the token's expiration is relative to
// the server's time, just call the refresh method every 6 minutes with the
// "force" argument set to false. This will cause the method to only refresh
// the token and service data if the token is within 10 minutes of expiring.

// Since the browser halts setTimeout when the tab loses focus or when the
// computer sleeps, it's not an accurate way to refresh every 6 minutes, so
// instead, call the refresh function every 1 second, and check the current
// time against the last refresh time to determine truly if 6 minutes has
// passed since the last refresh. If the request fails, try it again in
// another second.

let lastRefreshedAt = 0;

const refreshAccessToken = () => {
  // executes every 6 minutes that have passed, so it runs 10 times per hour
  if (lastRefreshedAt < Date.now() - 360000) {
    Meteor.call("Pitchly.refreshAccessToken", { force: false }, (error) => {
      if (!error) {
        lastRefreshedAt = Date.now();
      }
      Meteor.setTimeout(refreshAccessToken, 1000);
    });
  } else {
    Meteor.setTimeout(refreshAccessToken, 1000);
  }
};

refreshAccessToken();