const express = require('express')
const cors = require('cors')
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(cors());
app.use(express.json());

// mongodb added start




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vbsgl0h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const  userCollection = client.db('CoinCrafter').collection('register_user');



    app.get('/alluser', async (req, res) => {
  try {
    const tasksCollection = client.db('CoinCrafter').collection('tasks');  // তোমার কালেকশন নাম ঠিক করো
    const tasks = await tasksCollection.find({}).toArray();
    res.send(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Failed to get tasks' });
  }
});
// user info  by filter
// /user?email=user@example.com  এর মাধ্যমে ইউজার ডাটা আনবে
app.get('/user', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).send({ message: 'Email query param missing' });
    }

    const userCollection = client.db('CoinCrafter').collection('register_user'); // তোমার কালেকশন নাম ঠিক করো
    const user = await userCollection.findOne({ email: email });

    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    res.send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Failed to fetch user' });
  }
});


    // register user


    app.post('/register-user', async (req, res) => {
  try {
    const user = req.body;
    const { email, role } = user;

    // Check if user already exists
    const existingUser = await userCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).send({ message: 'User already exists' });
    }

    // Set coin based on role
    if (role === 'worker') {
      user.coin = 10;
    } else if (role === 'buyer') {
      user.coin = 50;
    } else {
      user.coin = 0; // fallback if role is unknown
    }

    const result = await userCollection.insertOne(user);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'Something went wrong during registration' });
  }
});

//  sign in  user with google 

// Server-side route: POST /google-signin

app.post('/google-signin', async (req, res) => {
  try {
    const user = req.body;
    const { email, name, photoURL } = user;

    // Check if user already exists
    const existingUser = await userCollection.findOne({ email });

    if (existingUser) {
      return res.status(200).send({ message: 'User already exists', user: existingUser });
    }

    // Default role: worker, default coin: 10
    const newUser = {
      name,
      email,
      photoURL,
      role: 'worker',
      coin: 10,
    };

    const result = await userCollection.insertOne(newUser);
    res.status(201).send({ message: 'New user created', result });

  } catch (error) {
    console.error('Google Signin Error:', error);
    res.status(500).send({ error: 'Something went wrong during Google Sign-In' });
  }
});





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


// mongodb added end

app.get('/',(req, res)=>{
    res.send('CoinCrafter  server is runnig')
})

app.listen(port, ()=>{
    console.log(`CoinCrafter is on port ${port}`)
})
