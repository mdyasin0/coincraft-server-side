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
     const  bayerCollection = client.db('CoinCrafter').collection('bayer_task');

// bayer new task


app.post('/tasks', async (req, res) => {
  try {
    const taskData = req.body;
    const bayerCollection = client.db('CoinCrafter').collection('bayer_task');
    const result = await bayerCollection.insertOne(taskData);
    res.status(201).send(result);
  } catch (error) {
    console.error('Error posting task:', error);
    res.status(500).send({ message: 'Failed to post task' });
  }
});

// update data by coin

app.patch('/coins/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const { coinToDeduct } = req.body;

    const result = await userCollection.updateOne(
      { email },
      { $inc: { coin: -coinToDeduct } }
    );

    if (result.modifiedCount > 0) {
      res.send({ message: 'Coin deducted successfully' });
    } else {
      res.status(404).send({ message: 'User not found or coin not updated' });
    }

  } catch (error) {
    console.error('Coin update error:', error);
    res.status(500).send({ message: 'Failed to update coin' });
  }
});


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



// bayer states by email
app.get('/buyer-stats/:email', async (req, res) => {
  try {
    const email = req.params.email;

    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }

    // Filter tasks by buyer email
    const buyerTasks = await bayerCollection.find({ buyer_email: email }).toArray();

    // Calculate total task count
    const totalTaskCount = buyerTasks.length;

    // Sum of all required_workers (Pending)
    const pendingTaskCount = buyerTasks.reduce((sum, task) => sum + (task.required_workers || 0), 0);

    // Sum of all payment (required_workers * payable_amount)
    const totalPayment = buyerTasks.reduce((sum, task) => {
      const workers = task.required_workers || 0;
      const amount = task.payable_amount || 0;
      return sum + (workers * amount);
    }, 0);

    res.send({
      totalTaskCount,
      pendingTaskCount,
      totalPayment,
    });

  } catch (error) {
    console.error('Error in /buyer-stats/:email route:', error);
    res.status(500).send({ message: 'Failed to calculate buyer stats' });
  }
});







// user info  by filter email

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


app.get('/user/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const userCollection = client.db('CoinCrafter').collection('register_user');
    const user = await userCollection.findOne({ email });

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
