const app = require('./server');
const process = require('node:process');

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Lost and Found Board API' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
