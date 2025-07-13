const express = require('express')
const cors = require('cors')
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');
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
     const  paymentsCollection= client.db('CoinCrafter').collection('payment-history');
      const  submissionCollection= client.db('CoinCrafter').collection('submission');
 
      const withdrawalCollection = client.db("CoinCrafter").collection("withdrawals");

//  Approve a Withdrawal Request
app.patch("/withdrawals/approve/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const withdrawal = await withdrawalCollection.findOne({ _id: new ObjectId(id) });

    if (!withdrawal) {
      return res.status(404).send({ message: "Withdrawal request not found" });
    }

    const { worker_email, withdrawal_coin } = withdrawal;

    // 1. Update withdrawal status to "approved"
    const updateStatus = await withdrawalCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "approved" } }
    );

    // 2. Decrease coins from the worker's account
    const updateUser = await userCollection.updateOne(
      { email: worker_email },
      { $inc: { coin: -withdrawal_coin } }
    );

    res.send({
      success: true,
      message: "Withdrawal approved and user coin updated.",
      updateStatus,
      updateUser,
    });

  } catch (error) {
    console.error("Error approving withdrawal:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});
// Pending Withdrawals

app.get("/withdrawals/pending", async (req, res) => {
  try {
    const pendingWithdrawals = await withdrawalCollection
      .find({ status: "pending" })
      .toArray();

    res.send(pendingWithdrawals);
  } catch (error) {
    console.error("Error fetching pending withdrawals:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});


//  total payment 
app.get('/withdrawals/total-payment', async (req, res) => {
  try {
    const withdrawalCollection = client.db("CoinCrafter").collection("withdrawals");

    const result = await withdrawalCollection.aggregate([
      { $match: { status: "approved" } },
      {
        $group: {
          _id: null,
          totalApprovedPayment: { $sum: { $toDouble: "$withdrawal_amount" } }
        }
      }
    ]).toArray();

    const totalApprovedPayment = result.length > 0 ? result[0].totalApprovedPayment : 0;

    res.json({ totalApprovedPayment });
  } catch (error) {
    console.error("Error fetching total approved payments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



    //  admin states 

    app.get('/admin_stats', async (req, res) => {
  try {
    const userCollection = client.db('CoinCrafter').collection('register_user');

    // Aggregation pipeline
    const stats = await userCollection.aggregate([
      {
        $group: {
          _id: null,
          totalWorkers: {
            $sum: {
              $cond: [{ $eq: ['$role', 'worker'] }, 1, 0]
            }
          },
          totalBuyers: {
            $sum: {
              $cond: [{ $eq: ['$role', 'buyer'] }, 1, 0]
            }
          },
          totalCoins: {
            $sum: {
              $toDouble: "$coin"  // coin কে double এ convert করে যোগ করবে
            }
          }
        }
      }
    ]).toArray();

    if (stats.length === 0) {
      return res.json({
        totalWorkers: 0,
        totalBuyers: 0,
        totalCoins: 0,
      });
    }

    const { totalWorkers, totalBuyers, totalCoins } = stats[0];

    res.json({
      totalWorkers,
      totalBuyers,
      totalCoins,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




// Save withdrawal request
app.post("/withdrawals", async (req, res) => {
  try {
    const withdrawData = req.body;
    
    const result = await withdrawalCollection.insertOne(withdrawData);
    res.send(result);
  } catch (error) {
    console.error("Withdrawal error:", error);
    res.status(500).send({ message: "Failed to submit withdrawal request" });
  }
});



// Get all submissions by worker email
app.get("/submissions/worker/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const submissions = await submissionCollection
      .find({ worker_email: email })
      .toArray();

    // Add createdAt manually from ObjectId
    const submissionsWithTimestamp = submissions.map(sub => ({
      ...sub,
      createdAt: new Date(sub._id.getTimestamp()) // Real timestamp
    }));

    res.send(submissionsWithTimestamp);
  } catch (err) {
    console.error("Error fetching submissions:", err);
    res.status(500).send({ error: "Internal server error" });
  }
});




// Approve Submission Route

app.patch("/submissions/approve/:id", async (req, res) => {
  try {
    const submissionId = req.params.id;

    const submission = await submissionCollection.findOne({ _id: new ObjectId(submissionId) });
    if (!submission) return res.status(404).send({ success: false, message: "Submission not found" });

    const { worker_email, payable_amount, task_id } = submission;

    // Update submission status to "approved"
    await submissionCollection.updateOne(
      { _id: new ObjectId(submissionId) },
      { $set: { status: "approved" } }
    );

    // Decrease required_workers by 1 in bayer_task
    await bayerCollection.updateOne(
      { _id: new ObjectId(task_id) },
      { $inc: { required_workers: -1 } }
    );

    //  Increase coins in userCollection
    await userCollection.updateOne(
      { email: worker_email },
      { $inc: { coin: payable_amount } }
    );

    res.send({ success: true, message: "Submission approved and updated." });
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).send({ success: false, message: "Internal server error" });
  }
});

//  Reject Submission Route
app.patch("/submissions/reject/:id", async (req, res) => {
  try {
    const submissionId = req.params.id;

    const submission = await submissionCollection.findOne({ _id: new ObjectId(submissionId) });
    if (!submission) return res.status(404).send({ success: false, message: "Submission not found" });

    const { task_id } = submission;

    //  Update submission status to "rejected"
    await submissionCollection.updateOne(
      { _id: new ObjectId(submissionId) },
      { $set: { status: "rejected" } }
    );

    //  Increase required_workers by 1 in bayer_task
    await bayerCollection.updateOne(
      { _id: new ObjectId(task_id) },
      { $inc: { required_workers: 1 } }
    );

    res.send({ success: true, message: "Submission rejected and task updated." });
  } catch (err) {
    console.error("Rejection error:", err);
    res.status(500).send({ success: false, message: "Internal server error" });
  }
});







// Get all pending submissions for a buyer by buyer's email
app.get('/submissions/pending/:buyerEmail', async (req, res) => {
  try {
    const buyerEmail = req.params.buyerEmail;

    if (!buyerEmail) {
      return res.status(400).send({ message: 'Buyer email is required' });
    }

    // Find submissions with matching buyer_email and status 'pending'
    const submissions = await submissionCollection
      .find({ buyer_email: buyerEmail, status: "pending" })
      .toArray();

    res.send(submissions);
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).send({ message: 'Failed to fetch pending submissions' });
  }
});


      
// Get task details by ID
app.get('/tasks/:id', async (req, res) => {
  const id = req.params.id;
  const task = await bayerCollection.findOne({ _id: new ObjectId(id) });
  res.send(task);
});

// Save submission
app.post('/submissions', async (req, res) => {
  const submission = req.body;
  const result = await submissionCollection.insertOne(submission);
  res.send(result);
});



// all tasks


// Get all payments by email
app.get('/payments/:email', async (req, res) => {
  const email = req.params.email;
  const result = await paymentsCollection
    .find({ email })
    .sort({ date: -1 }) // latest first
    .toArray();
  res.send(result);
});



const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


// Save payment info
app.post('/payments', async (req, res) => {
  const payment = req.body;
  const result = await paymentsCollection.insertOne(payment);
  res.send(result);
});

// Update user coin balance
app.patch('/users/coins/:email', async (req, res) => {
  const email = req.params.email;
  const { coinToAdd } = req.body;
  const filter = { email };
  const updateDoc = {
    $inc: { coin: coinToAdd }
  };
  const result = await userCollection.updateOne(filter, updateDoc);
  res.send(result);
});



app.post('/create-payment-intent', async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // Amount in cents
      currency: 'usd',
      payment_method_types: ['card'],
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



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
// buyer-tasks by email
app.get('/my-tasks/:email', async (req, res) => {
  try {
    const email = req.params.email;

    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }

    // Find all tasks created by the user and sort them by completion_date DESC
    const tasks = await bayerCollection
      .find({ buyer_email: email })
      .sort({ completion_date: -1 })
      .toArray();

    res.send(tasks);
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).send({ message: 'Failed to fetch user tasks' });
  }
});

// delete



app.delete('/delete-task/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await bayerCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: 'Task not found' });
    }

    res.send({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).send({ message: 'Failed to delete task' });
  }
});


// coin update

app.patch('/refill-coins/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const { refill } = req.body;

    const result = await userCollection.updateOne(
      { email },
      { $inc: { coin: refill } }
    );

    if (result.modifiedCount > 0) {
      res.send({ message: 'Coins refunded successfully' });
    } else {
      res.status(404).send({ message: 'User not found or not updated' });
    }
  } catch (error) {
    console.error('Coin refill error:', error);
    res.status(500).send({ message: 'Failed to refund coins' });
  }
});

// UPDATE TASK BY ID


app.patch('/update-task/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updatedTask = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid task ID' });
    }

    const result = await bayerCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedTask }
    );

    if (result.matchedCount > 0) {
      res.send({ message: 'Task update attempted (matched).' }); // Updated or not, it’s fine
    } else {
      res.status(404).send({ message: 'Task not found' });
    }
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).send({ message: 'Failed to update task' });
  }
});





// bayer data by id 


app.get('/task/:id', async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid task ID' });
    }

    const task = await bayerCollection.findOne({ _id: new ObjectId(id) });

    if (!task) {
      return res.status(404).send({ message: 'Task not found' });
    }

    res.send(task);
  } catch (error) {
    console.error('Error fetching task by ID:', error);
    res.status(500).send({ message: 'Failed to fetch task' });
  }
});


    app.get('/alluser', async (req, res) => {
  try {
    
    const tasks = await userCollection.find({}).toArray();
    res.send(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Failed to get tasks' });
  }
});

// delete user 

app.delete('/delete-user/:email', async (req, res) => {
  const email = req.params.email;
  const result = await userCollection.deleteOne({ email });
  res.send(result);
});


//change role

app.patch('/update-role/:email', async (req, res) => {
  const email = req.params.email;
  const { role } = req.body;

  const result = await userCollection.updateOne(
    { email },
    { $set: { role } }
  );

  res.send(result);
});

// all task

app.get('/alltasks', async (req, res) => {
  try {
  
    const tasks = await bayerCollection.find({}).toArray();
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

    const userCollection = client.db('CoinCrafter').collection('register_user'); 
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
