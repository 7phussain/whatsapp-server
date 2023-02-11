
const express = require('express')
const mongoose = require("mongoose");
const User = require("./signUpCollection");
const Message = require("./messagesCollection");
const jwt = require('jsonwebtoken');
var cookieParser = require('cookie-parser');
var secret = "MUHAMMADHUSSAINKHANLIVECHATAPPWHATSAPPCLONEWITHNEXTJSJWTAUTHENTICATION";
const DB = "mongodb+srv://Hussain:programmer%40hussain34@cluster0.dmbzqo8.mongodb.net/whatsappclone?retryWrites=true&w=majority";
const path = require("path")
const cors = require('cors');
const app = express()
const http = require('http');
const server = http.createServer(app);
const port = 5000;
const { Server } = require("socket.io");
const io = new Server(server);
// const io = new Server(server, {
//   cors: {
//     origin: "http://localhost:3001",
//     methods: ["GET", "POST"]
//   }
// });

app.use(cookieParser());

app.use(cors({ origin: true, credentials: true }));

app.use(express.json({ extended: false }));

mongoose.connect(DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(()=>{
  console.log("Connection Successfull")
}).catch((err)=>{
  console.log(err);
  console.log(err);
});
// mongoose.connect("mongodb://localhost:27017/Hussain", { useNewUrlParser: true, useUnifiedTopology: true }).then(() => { console.log("connection successful...") }).catch(() => { console.log("connection can't be established") });



app.get('/socket', middlewar, async (req, res) => {
  const CurrentUser = req.CurrentUser;
  // const userEmail = "7phussain@gmail.com";



  io.once('connection', socket => {
    console.log("i am called socket connection successful");



    const oneMessageChangeStream = Message.watch();
    oneMessageChangeStream.on("change", async (change) => {
      if (change.operationType == "update") {
        const user = await User.findOne({ userEmail: CurrentUser.userEmail });
        
        const chatId = await user.userContacts.filter((value) => {
          return value.chatId == change.documentKey._id;
        })
        if (chatId) {
          const newMessageFields = change.updateDescription.updatedFields;
          const Message = Object.keys(newMessageFields)[0];
          const newMessage = { message: newMessageFields[Message], chatId: chatId[0].chatId };
          io.emit("newMessage", newMessage);
          console.log("i am called newMessage");
        }
      }
    })


    const contactsChangeStream = User.watch();

    contactsChangeStream.on("change", (change) => {
      switch (change.operationType) {
        case "update":
          const newEntry = change.updateDescription.updatedFields;
          const userContact = Object.keys(newEntry)[0];


          if (change.documentKey._id == CurrentUser._id && typeof newEntry[userContact].contactEmail != "undefined" && newEntry[userContact].contactEmail != CurrentUser.userEmail) {

            io.emit("newEntry", newEntry[userContact]);
          }
          break;

      }
    });






  });
})



app.get('/contactApi', middlewar, async (req, res) => {
  if (req.user == "user not found") {
    return res.status(401).json({ message: "user not found" })
  }
  const CurrentUser = req.CurrentUser;
  let currentUser = await User.findOne({ userEmail: CurrentUser.userEmail });

  res.status(200).json(currentUser.userContacts);
})





app.get("/messageServer", middlewar, async (req, res) => {
  const CurrentUser = req.CurrentUser;
  const user = await User.findOne({ userEmail: CurrentUser.userEmail });
  const chatIdes = user.userContacts.map((value) => {
    return value.chatId;
  });


  let messages = new Array();
  for (let index = 0; index < chatIdes.length; index++) {
    const element = chatIdes[index];

    let ar = await Message.findOne({ _id: element });
    messages.push(ar);

  }

  res.status(200).json(messages);

})

app.get('/userServer', middlewar, (req, res) => {
  res.status(200).json(req.CurrentUser);
})



app.post("/loginForm", async (req, res) => {
  const { userEmail, userPassword } = req.body;
  const auth = await User.findOne({ $and: [{ userEmail: userEmail }, { userPassword: userPassword }] });
  // const user = {userName:"Hussain",userEmail:"7phussain@gmail.com"}
  if (auth) {

    const token = jwt.sign({
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      _id: auth._id,
      userEmail: auth.userEmail,
      userName: auth.userName
    }, secret
    );



    res.cookie("liveChatToken", token);

    res.status(200).json({ message: "success!" });

  } else {

    res.status(401).json({ message: "invalid credentials!" })
  }
})

app.get("/app", middlewar, (req, res) => {
  if (req.user == "user not found") {
    res.status(404).json({ message: "User not found" });
  } else {
    res.status(200).json({ message: "User founded" });
  }
})

app.post("/form", middlewar, async (req, res) => {
  const CurrentUser = req.CurrentUser;
  const body = req.body

  const { chatId, userEmail, currentMsg } = body;

  if (!currentMsg) {
    // Sends a HTTP bad request error code
    console.log("i am called error")
    return res.status(400).json({ data: 'First or last name not found' })
  }

  function time() {
    const msgTime = new Date;
    return (msgTime.toLocaleTimeString().slice(0, -6)).concat((msgTime.toLocaleTimeString().slice(-2)));
  }

  await Message.updateOne(
    { _id: chatId },
    {
      $push: {
        messages: {
          'sender': CurrentUser.userEmail,
          'message': currentMsg,
          'date': time()
        }
      }
    }
  )
  res.status(200).json({ data: `${body}` })
})

app.post("/addContactApi", middlewar, async (req, res) => {
  const CurrentUser = req.CurrentUser;
  const { contactName, contactEmail } = req.body;

  if (!req.body) {
    return res.status(400).json({ data: 'Data is not found' });
  }

  let currentUser = await Message.findOne({ $and: [{ $or: [{ user1: CurrentUser.userEmail }, { user2: CurrentUser.userEmail }] }, { $or: [{ user1: contactEmail }, { user2: contactEmail }] }] });


  if (!currentUser) {

    const message = new Message({
      user1: CurrentUser.userEmail,
      user2: contactEmail
    });
    await message.save();
  }




  currentUser = await Message.findOne({ $and: [{ $or: [{ user1: CurrentUser.userEmail }, { user2: CurrentUser.userEmail }] }, { $or: [{ user1: contactEmail }, { user2: contactEmail }] }] });



  const isUser = await mongoose.model('User').findOne({ userEmail: CurrentUser.userEmail });
  const isContact = await mongoose.model('User').findOne({ userEmail: contactEmail });

  if (isContact) {
    const isPresentContact = await isUser.userContacts.find(e => e.contactEmail == contactEmail);
    if (!isPresentContact) {
      await mongoose.model('User').updateOne(
        { userEmail: CurrentUser.userEmail },
        {
          $push: {
            userContacts: {
              'contactName': contactName,
              'contactEmail': contactEmail,
              'chatId': currentUser._id
            }
          }
        }
      )

      await mongoose.model('User').updateOne(
        { userEmail: contactEmail },
        {
          $push: {
            userContacts: {
              'contactName': CurrentUser.userName,
              'contactEmail': CurrentUser.userEmail,
              'chatId': currentUser._id
            }
          }
        }
      )

      {
        acknowledged: true;
        insertedId: null;
        matchedCount: 1;
        modifiedCount: 1;
        upsertedCount: 0
      }
    }
  } else {
    return res.status(422).json({ message: "This contact not using live-chat" });
  }


  // Found the name.
  // Sends a HTTP success code
  res.status(200).json({ data: 'hello' });
})


app.post("/signUpForm", async (req, res) => {
  const { userName, userEmail, userPassword } = req.body;
  if (!userName || !userEmail || !userPassword) {

    return res.status(422).json({ error: `please fill the fields` });
  }

  const userExist = await User.findOne({ userEmail: userEmail });
  if (userExist) {
    return res.status(422).json({ error: "email is already exist" });
  }

  const user = new User({
    userName,
    userEmail,
    userPassword
  })
  user.save().then(() => {
    return res.redirect(307, '/')
  }).catch((err) => {
    return res.status(422).json(err)
  })
})

app.post("/clearChatApi",async(req,res)=>{
  await Message.updateOne({_id:req.body._id}, { $set : {"messages": [] }} );
  res.status(200).json({message:"Successfully cleared"});
})







async function middlewar(req, res, next) {
  const cookie = await req.cookies.liveChatToken;
  if (cookie) {
    const verifyToken = await jwt.verify(cookie, secret);
    req.id = verifyToken._id;
    req.CurrentUser = { _id: verifyToken._id, userName: verifyToken.userName, userEmail: verifyToken.userEmail };
    next();
  } else {
    req.user = "user not found";
    next();
  }



}

















server.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})