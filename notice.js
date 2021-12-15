if (Package['accounts-ui']
    && !Package['service-configuration']
    && !Object.prototype.hasOwnProperty.call(Package, 'pitchly-config-ui')) {
  console.warn(
    "Note: You're using accounts-ui and accounts-pitchly,\n" +
    "but didn't install the configuration UI for the Pitchly\n" +
    "OAuth. You can install it with:\n" +
    "\n" +
    "    meteor add pitchly-config-ui" +
    "\n"
  );
}
