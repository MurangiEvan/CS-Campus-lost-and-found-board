const app = require('./server');
const process = require('node:process');

const PORT = process.env.PORT || 3000;

// Add this new route for the homepage
app.get('/', (req, res) => {
  res.status(200).json({
    message: "Welcome to the CS Campus Lost and Found Board API!",
    endpoints: ["/health", "/api/v1/resource"]
  });
});



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
