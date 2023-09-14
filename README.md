# accounts-pitchly

Use this Meteor package to log a Pitchly user into your app via `Meteor.loginWithPitchly()`.

## Installation

Copy this repo into the `packages` directory of your Meteor app or add this package into your app using [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules):

```
cd packages
git submodule add https://github.com/Pitchlyapp/accounts-pitchly
```

If you haven't already, you will also need to add the [`pitchly-oauth` package](https://github.com/Pitchlyapp/pitchly-oauth), since this package depends on it.

```
git submodule add https://github.com/Pitchlyapp/pitchly-oauth
```

In your app's settings file, add the following, replacing `clientId` with your **App ID** and `secret` with your **App Secret**:

```json
{
  "packages": {
    "service-configuration": {
      "pitchly": {
        "loginStyle": "redirect",
        "clientId": "app*****************",
        "secret": "plys_*******************************************"
      }
    }
  }
}
```

Install this package via your terminal in your app directory:

```
meteor add pitchly:accounts-pitchly
```

## Usage

To log the user in, call this on the client side:

```js
if (Accounts.loginServicesConfigured()) {
  Meteor.loginWithPitchly();
}
```

It's important to always wrap `Meteor.loginWithPitchly()` in the predicating `if` condition, otherwise Meteor may not be ready to initiate the login flow.

## Docs

By default, this package automatically refreshes the user's access token before it expires whenever the user is connected to your app. It also automatically publishes the user's access token and basic profile info so that authenticated calls can be made to the Pitchly GraphQL API from the client side.

Once the user is logged in, calling `Meteor.user()` on the client side will return:

```json
{
  "_id": "MztaG3HNXuEtnWBjY",
  "services": {
    "pitchly": {
      "accessToken": "plyu_7Xhuc_p1z0j2KFJ1W9GBoyHRHA4D1LG67z2DpTCJ4qn",
      "accessTokenExpiresAt": 1639496919877,
      "email": "john.doe@example.com",
      "id": "psnXhJbDnRNqHmNhBYL5",
      "name": "John Doe",
      "organizationId": "org44xgwQKnMNGJFPFdB",
      "picture": "https://s.gravatar.com/avatar/f97f7ddd815a6b07368693e189b163e7?s=480&d=identicon",
      "updatedAt": 1639493320918
    }
  }
}
```

Note that `_id` is not the user's ID in Pitchly but rather the user's ID locally within your app. The user's Pitchly ID is instead located in `Meteor.user().services.pitchly.id`. Also note that each user only belongs to exactly one organization. So a real life person may have multiple accounts to different organizations, but each one is considered a separate user that exists in only one organization.

### Making API requests with GraphQL

Authenticated requests to Pitchly's GraphQL API require you to pass the user's access token as a Bearer token via the Authorization header:

```js
const token = Meteor.user()?.services?.pitchly?.accessToken;
headers.authorization = token ? `Bearer ${token}` : "";
```

Although you could add this to requests yourself, the recommended approach is to use [Apollo Client](https://www.apollographql.com/docs/react/get-started/) and to add the Authorization header via an Apollo Link. Here is a [full example showing how to do that](https://gist.github.com/michaelcbrook/ae3a0b6c9aed7536460f188a2ff86cc1).

### Refreshing access tokens

This package automatically refreshes a user's access token when it is within 10 minutes of expiring as long as the user is using your app. But if you want to manually refresh their access token or refresh their token on the server while the user is _not_ actively using your app, you can call the `Pitchly.refreshAccessToken` Meteor method from either the client or server. (Note that this method also updates the user's profile info)

```js
Meteor.call("Pitchly.refreshAccessToken");
```

This method supports two optional arguments:

```js
// Set "force" to false to only refresh if access token is within 10
// minutes of expiring, otherwise refresh every time (default = true)
Meteor.call("Pitchly.refreshAccessToken", { force: false });

// Set "userId" to refresh the access token for a specific user other
// than the current one (only works on server)
Meteor.call("Pitchly.refreshAccessToken", { userId: "SOME_OTHER_USER_ID" });
```

If successful, this method will return an object containing three properties:

```js
{
  refreshed: true, // true if access token was refreshed, false if not
  accessToken: "plyu_...", // new access token or current access token if token was not refreshed
  accessTokenExpiresIn: 3600 // seconds until access token expires (typically one hour)
}
```

### Settings file

Below are all the available properties that can be provided in your app's settings file to configure Pitchly login. This package uses Meteor's built-in [service configuration](https://docs.meteor.com/api/accounts.html#service-configuration) to store app credentials. Note that if your app uses < Meteor 2.5, you will need to [set your service configuration manually](https://docs.meteor.com/api/accounts.html#service-configuration).

```json
{
  "packages": {
    "service-configuration": {
      "pitchly": {
        "loginStyle": "redirect",
        "clientId": "app*****************",
        "secret": "plys_*******************************************",
        "accessTokenScope": ["workspace_members:read", "teams:read"],
        "origin": "https://platform.pitchly.com",
        "apiOrigin": "https://main--pitchly.apollographos.net"
      }
    }
  }
}
```

`accessTokenScope` will cause the access token saved for the user to be downscoped to at most the provided permissions. By default, the access token will possess the maximum permissions allowed to this app. This setting is ideal for situations where you want the app to have elevated permissions, but you don't want the client to have those permissions directly. This list of permissions may be provided as an array or space-delimited string.

`origin` is the origin for OAuth requests. `apiOrigin` is the origin for API requests. These can be customized depending on environment, but above are the defaults.

### loginWithPitchly options

Below are all the available options that can be passed to `Meteor.loginWithPitchly()`. See the [Meteor docs](https://docs.meteor.com/api/accounts.html#Meteor-loginWith%3CExternalService%3E) for details on each option.

```js
Meteor.loginWithPitchly({
  loginStyle: "popup",
  redirectUrl: "/after-login-path",
  popupOptions: {
    width: 800,
    height: 750
  }
});
```

While we recommend using the "redirect" `loginStyle`, if `loginStyle` is set to "popup", `popupOptions` specifies the dimensions of the popup window.

## References

[Meteor Accounts](https://docs.meteor.com/api/accounts.html)<br>
[Meteor.loginWith\<ExternalService\>](https://docs.meteor.com/api/accounts.html#Meteor-loginWith%3CExternalService%3E)<br>
[Service Configuration](https://docs.meteor.com/api/accounts.html#service-configuration)<br>
[Apollo Client Getting Started Guide](https://www.apollographql.com/docs/react/get-started/)<br>
[Pitchly Apollo Client Example](https://gist.github.com/michaelcbrook/ae3a0b6c9aed7536460f188a2ff86cc1)