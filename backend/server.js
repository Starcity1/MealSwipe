const express = require('express');
const cors = require('cors');  // Import CORS middleware

const app = express();

app.use(cors());  // Enable CORS

app.get("/api", (req, res) => {
    res.json({"restaurants" : ["resOne", "resTwo"]});
});

app.listen(5001, () => console.log("Server started on port 5001"));
