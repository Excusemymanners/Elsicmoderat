import express from 'express';
import cors from 'cors';
import emailRouter from './server/routes/email.js';

const app = express();
const PORT = 5000;

// Configure CORS
const corsOptions = {
  origin: 'http://localhost:5173',
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({limit: '100mb'}));
app.use(express.urlencoded({limit: '100mb', extended: true}));
app.use('/api', emailRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});