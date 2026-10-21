const config = require('./config');
const app = require('./app');

app.listen(config.port, () => {
  console.log(`Nova Mail : http://localhost:${config.port}`);
});
