const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const  passport = require('passport');
const flash = require('connect-flash');
const session = require('express-session');
const config = require('./config/database');
const MongoStore = require('connect-mongo')(session);

const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const port = process.env.PORT || 3003;


mongoose.connect('mongodb+srv://liliachan:12345@cluster1-sgorx.mongodb.net/test', { useNewUrlParser: true, useUnifiedTopology: true});

//process.env.MONGODB_URI
//mongodb://localhost:27017/

let db = mongoose.connection;

db.once('open', function () {
    console.log('connected to Mongodb');
});

db.on('error', function (err) {
    console.log(err);
});


let Chat =  require('./models/chat');

app.use(express.static('public'));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');



//express session
// app.use(session({
//     store: new MongoStore({ mongooseConnection: mongoose.connection }),
//     resave: true,
//     secret: 'keyboard cat',
//     saveUninitialized: true
// }));


var sessionMiddleware = session({
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
    resave: true,
    secret: 'keyboard cat',
    saveUninitialized: true
});

io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});

app.use(sessionMiddleware);



//express messages midleware
app.use(require('connect-flash')());
app.use(function (req, res, next) {
    res.locals.messages = require('express-messages')(req, res);
    next();
});


//Passport Config
require('./config/passport')(passport);
//Passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.get('*', function (req, res, next) {
    res.locals.user = req.user || null;
    next();
});



app.get('/', function (req, res) {
    console.log(req.session.usernam);
    Chat.find({}, function (err, response) {
        if (err){
            console.log(err);
        }  else {

            res.render('index', {
                chats: response
            });
        }
    });
});

//routes
let users = require('./routes/users');
app.use('/users', users);

//Socket
conections = [];
io.on('connection', function (socket) {
    console.log('Успешное Соединение', socket.id);
    conections.push(socket);

    socket.on('disconnect', function (data) {
        conections.splice(conections.indexOf(socket), 1);
        console.log('Отключились');
    });


    socket.on('chat', function(data){
        if (socket.request.session.username){
            data.user = socket.request.session.username;
        } else {
            data.user = 'incognito';
        }
        io.sockets.emit('chat', data);

        let newChat = new Chat({
            author: data.user,
            message: data.message,
        });
        newChat.save();



        Chat.find({}).lean().exec(function(error, records) {
            console.log(records.length);
            if (records.length > 2) {
                Chat.deleteOne({_id: records[0]}, function (err) {
                    if (err) return handleError(err);
                    else console.log('ok');
                });
            }
        });

    });
});


server.listen(port);

