import { app } from './app.js';
import dotenv from 'dotenv';
dotenv.config();

const port = parseInt(process.env.API_PORT || '4000', 10);

app.listen(port, () => {
  console.log(`ForestWatch AI API running at http://localhost:${port}/api/v1`);
  console.log(`Health check at: http://localhost:${port}/api/v1/health`);
});
