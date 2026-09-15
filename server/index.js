const app = require('./server');
const process = require('node:process');

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Status: ok!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
