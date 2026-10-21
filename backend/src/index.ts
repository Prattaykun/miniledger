import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`MiniLedger API listening on http://localhost:${config.port}`);
  console.log('OTP codes are printed in this terminal when a phone requests one.');
});
