'use strict';

const path = require('path');
const { createApp } = require('./std-platform/server');

// Ensure project-specific tables are created before the server starts
require('./db');

const app = createApp({
  publicDir:   path.join(__dirname, 'public'),
  spaFallback: true,
  routes: [
    // Add your project routes here, e.g.:
    // { path: '/api/widgets', router: require('./routes/widgets') },
    // { path: '/api/admin/my-feature', router: require('./routes/myFeature'), adminOnly: true },
  ],
});

if (require.main === module) {
  app.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => {
    console.log(`Notes running at http://localhost:${process.env.PORT || 3000}`);
  });
}

module.exports = app;
