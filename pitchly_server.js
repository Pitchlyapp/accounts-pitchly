// the fields available to logged in users about themselves, and fields visible to others
// we want to make accessToken available, but not refreshToken, so calls can be made to the Pitchly API
const loggedInUserFields = ['id', 'name', 'email', 'picture', 'organizationId', 'accessToken', 'accessTokenExpiresAt', 'updatedAt'];
const otherUserFields = ['id', 'name', 'picture', 'organizationId'];

// defines which fields are automatically published when the autopublish package is added
Accounts.addAutopublishFields({
  forLoggedInUser: loggedInUserFields.map((prop) => 'services.pitchly.' + prop),
  forOtherUsers: otherUserFields.map((prop) => 'services.pitchly.' + prop)
});

// when autopublish isn't added, we need to manually publish fields about the current user
// passing null as first parameter makes this automatically publish without the client needing to subscribe
Meteor.publish(null, function() {
  if (this.userId) {
    const fields = {};
    for (let i = 0; i < loggedInUserFields.length; i++) {
      fields['services.pitchly.' + loggedInUserFields[i]] = 1;
    }
    return Meteor.users.find({ _id: this.userId }, { fields });
  } else {
    this.ready();
  }
});

Meteor.methods({
  // Refreshes access token and service data for the currently logged in user.
  // Optionally accepts an object with optional properties: { userId, force },
  // where "userId" is the ID of an alternative user to refresh data for (only
  // works when this method is called from the server), and "force" can be set
  // to false to only refresh if the access token is set to expire within 10
  // minutes (default = true).
  // This method returns an object containing info about the current access
  // token and a boolean value indicating whether a new access token was
  // acquired or not: { refreshed, accessToken, accessTokenExpiresIn }. If
  // refresh was skipped because "force" was set to false and the access token
  // does not expire within the next 10 minutes, "refreshed" will be false.
  // "accessTokenExpiresIn" is the number of seconds until the access token
  // expires. (Note that it may be an approximation since the server stores
  // the timestamp with millisecond precision).
  // Inspired by: https://github.com/percolatestudio/meteor-google-api/blob/master/google-api-methods.js
  'Pitchly.refreshAccessToken'(data) {
    // By default, force refresh each time this method is called. But if
    // "force" is set to false, only refresh if near the expiration time.
    let force = true;
    if (typeof data==="object" && !Array.isArray(data) && data!==null) {
      if (typeof data.force==="boolean") {
        force = data.force;
      }
    }
    // assume by default that we're refreshing the access token for the
    // current user, unless this method is being called from the server
    // and is passed the ID of a specific user via data.userId
    let userId = this.userId;
    if (!this.connection) {
      // method call is originating from server
      if (typeof data==="object" && !Array.isArray(data) && data!==null) {
        // data is a plain object
        if (typeof data.userId==="string") {
          // data contains a string userId
          userId = data.userId;
        }
      }
    }
    if (!userId) {
      throw new Meteor.Error("logged-out", "You must be logged in.");
    }
    const user = Meteor.users.findOne({ _id: userId }, { fields: { "services.pitchly": 1 } });
    if (!user) {
      throw new Meteor.Error("user-not-found", "User not found.");
    }
    if (!user.services || !user.services.pitchly || !user.services.pitchly.refreshToken) {
      throw new Meteor.Error("refresh-token-not-found", "Refresh token not found.");
    }
    const config = ServiceConfiguration.configurations.findOne({ service: "pitchly" });
    if (!config) {
      throw new Meteor.Error("service-not-configured", "Pitchly service not configured.");
    }
    if (!force) {
      // only refresh if within 10 minutes of expiring, unless force is set to true
      if (user.services.pitchly.accessTokenExpiresAt && user.services.pitchly.accessTokenExpiresAt > Date.now() + 600000) {
        // return existing access token
        return {
          refreshed: false, // indicates a new access token was not fetched
          accessToken: user.services.pitchly.accessToken,
          accessTokenExpiresIn: Math.floor((user.services.pitchly.accessTokenExpiresAt - Date.now()) / 1000) // seconds until access token expires
        };
      }
    }
    let userAgent = 'Meteor';
    if (Meteor.release) userAgent += `/${Meteor.release}`;
    // exchange current refresh token for a new access token and refresh token
    const tokenResponse = (function() {
      let response;
      try {
        const params = {
          grant_type: 'refresh_token',
          client_id: config.clientId,
          client_secret: OAuth.openSecret(config.secret),
          refresh_token: OAuth.openSecret(user.services.pitchly.refreshToken)
        };
        // If accessTokenScope is configured in pitchly's service configuration,
        // make sure every access token that's automatically generated possesses
        // the defined scope.
        if (typeof config.accessTokenScope=="string") {
          params.scope = config.accessTokenScope;
        } else if (Array.isArray(config.accessTokenScope)) {
          params.scope = config.accessTokenScope.join(" ");
        }
        const content = new URLSearchParams(params);
        const request = fetch(`${config.origin || 'https://platform.pitchly.com'}/api/oauth/token`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'User-Agent': userAgent
          },
          body: content
        }).await();
        response = request.json().await();
      } catch (e) {
        // const code = e.response ? e.response.statusCode : 500;
        throw new Meteor.Error("request-failed", "Unable to exchange refresh token.", e.response);
      }
      if (response.error) {
        throw new Meteor.Error("request-failed", "Unable to exchange refresh token.", response);
      } else {
        Meteor.users.update(user._id, {
          $set: {
            'services.pitchly.accessToken': OAuth.sealSecret(response.access_token),
            'services.pitchly.accessTokenExpiresAt': Date.now() + (1000 * parseInt(response.expires_in, 10)),
            'services.pitchly.refreshToken': OAuth.sealSecret(response.refresh_token),
            'services.pitchly.updatedAt': Date.now()
          }
        });
        return response;
      }
    })();
    // update profile info about this user while we're at it (not mission critical if this fails)
    (function(accessToken) {
      let response;
      try {
        const request = fetch(`${config.origin || 'https://platform.pitchly.com'}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': userAgent,
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            query: `{
              viewer {
                person {
                  id
                  name
                  email
                  image
                }
              }
            }`
          })
        }).await();
        response = request.json().await();
      } catch (e) {}
      // passively fail on error
      if (response.data) {
        Meteor.users.update(user._id, {
          $set: {
            'services.pitchly.name': response.data.viewer.person.name,
            'services.pitchly.email': response.data.viewer.person.email,
            'services.pitchly.picture': response.data.viewer.person.image,
            'services.pitchly.updatedAt': Date.now()
          }
        });
        return response.data;
      }
    })(tokenResponse.access_token);
    // return new access token
    return {
      refreshed: true, // indicates this access token is newly acquired
      accessToken: tokenResponse.access_token,
      accessTokenExpiresIn: tokenResponse.expires_in // seconds until access token expires
    };
  },
  'Pitchly.getTokenDataFromUrl'(token) {
    console.log('token', token);
  }
});

