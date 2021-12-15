Package.describe({
  summary: 'Login service for Pitchly accounts',
  version: '1.0.0',
});

Package.onUse(api => {
  api.use('ecmascript');
  api.use('accounts-base', ['client', 'server']);
  // Export Accounts (etc) to packages using this one.
  api.imply('accounts-base', ['client', 'server']);

  api.use('accounts-oauth', ['client', 'server']);
  api.use('pitchly-oauth');
  api.imply('pitchly-oauth');

  api.use(
    ['accounts-ui', 'pitchly-config-ui'],
    ['client', 'server'],
    { weak: true }
  );
  
  api.use('service-configuration', ['client', 'server']);
  api.use('oauth2', ['client', 'server']);
  api.use('oauth', ['client', 'server']);
  api.use('fetch', 'server');
  
  api.addFiles('notice.js');
  api.addFiles('pitchly.js');
  
  api.addFiles('pitchly_client.js', 'client');
  api.addFiles('pitchly_server.js', 'server');
});
