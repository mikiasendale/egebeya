import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import apiRoutes from './src/api';

const app = express();
const PORT = 3000;

app.use(helmet({ contentSecurityPolicy: false })); // Disabled for Puck/Vite dev
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

async function startServer() {
  const uploadsPath = path.join(process.cwd(), 'dist', 'uploads');
  app.use('/uploads', express.static(uploadsPath));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/uploads', express.static(path.join(distPath, 'uploads')));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
