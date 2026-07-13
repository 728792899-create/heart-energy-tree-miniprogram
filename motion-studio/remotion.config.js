const { Config } = require('@remotion/cli/config');

// Replace previous generated artifacts without an interactive confirmation.
Config.setOverwriteOutput(true);
