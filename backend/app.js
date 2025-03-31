// const { spawn } = require('child_process');
// const path = require('path');
//
// // Ścieżka do wirtualnego środowiska i LibreTranslate
// const venvPath = path.join(__dirname, 'venv', 'Scripts', 'python');
// const libretranslatePath = path.join(__dirname, 'venv', 'Lib', 'site-packages', 'libretranslate', '__main__.py');
//
// try {
//   const libreTranslate = spawn(venvPath, [libretranslatePath]);
//
//   libreTranslate.stdout.on('data', (data) => {
//     console.log(`LibreTranslate stdout: ${data}`);
//   });
//
//   libreTranslate.stderr.on('data', (data) => {
//     console.error(`LibreTranslate stderr: ${data}`);
//   });
//
//   libreTranslate.on('close', (code) => {
//     console.log(`LibreTranslate exited with code ${code}`);
//   });
// } catch (error) {
//   console.error('Error starting LibreTranslate:', error);
// }

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
require('dotenv').config();
var session = require('express-session');
// const MongoStore = require('connect-mongo');
// const mongoose = require('mongoose');
const axios = require('axios'); // Make sure you have axios installed

var logger = require('morgan');
var cors = require('cors');  // Importujemy pakiet cors
const WebSocket = require('ws'); // Import WebSocket

// var indexRouter = require('./routes/index');
// var usersRouter = require('./routes/users');
var apiRouter = require('./routes/api');

//var { setupWebSocket } = require('./websocket'); // Importujemy konfigurację WebSocket

var app = express();

// Dodajemy konfigurację CORS
// app.use(cors({
//   origin: [
//     'https://gordon-trade.webflow.io',
//     'make.com',
//     'integromat.com'
//   ],
//   methods: ['GET', 'POST', 'PUT', 'DELETE'], // Zezwalamy na te metody
//   credentials: true, // Umożliwiamy wysyłanie ciasteczek z żądaniami
// }));

app.use(function (req, res, next) {

  // Website you wish to allow to connect
  // res.setHeader('Access-Control-Allow-Origin', 'https://gordon-trade.webflow.io');
  res.setHeader('Access-Control-Allow-Origin', 'https://www.gordontrade.pl');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});

app.use(cookieParser(process.env.SESSION_SECRET));

// Ustawienia sesji
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  // store: MongoStore.create({
  //   mongoUrl: 'mongodb://localhost:27017/session-store', // Adres MongoDB
  //   collectionName: 'sessions', // Nazwa kolekcji w MongoDB, gdzie będą przechowywane sesje
  // }),
  cookie: {
    maxAge: 3600000,
    secure: true,
    httpOnly: false,
    sameSite: 'strict'
    // sameSite: 'none'
  }
}));

// Middleware cart session
app.use((req, res, next) => {
  console.log('Session ID:', req.sessionID);
  if (!req.session.cart) {
    req.session.cart = []; // Inicjalizacja pustego koszyka w sesji
    // console.log('Koszyk został zainicjalizowany:', req.session.cart);
  } else {
    console.log('Koszyk istnieje:', req.session.cart);
  }
  next();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('trust proxy', 1); // Jeśli używasz HTTPS, ustaw secure cookies

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Root route handler to prevent 404 errors when pinging the server
app.get('/', (req, res) => {
  res.status(200).send('Server is active');
});

// app.use('/', indexRouter);
// app.use('/users', usersRouter);

// API routes
app.use('/api', apiRouter);

// Endpoint zwracający plik products.xml
app.get('/products.xml', (req, res) => {
  // Ważne: ścieżka musi być taka sama, jak ta, gdzie faktycznie zapisywany jest plik.
  // Z logów widać, że jest to /opt/render/project/src/backend/exports/products.xml
  // ale najlepiej użyj path.join w taki sam sposób, jak w generowaniu pliku:

  const filePath = path.join(__dirname, '../exports/products.xml');
  // lub na sztywno: const filePath = '/opt/render/project/src/backend/exports/products.xml';

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Błąd wysyłania pliku products.xml:', err);
      res.status(err.status).end();
    }
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// Self-referencing reloader to prevent instance spin-down
// const url = `https://gordon-trade.onrender.com`; // Replace with your Render URL
const url = `https://koszyk.gordontrade.pl`; // Replace with your Render URL
const interval = 30000; // Interval in milliseconds (30 seconds)

function reloadWebsite() {
  axios.get(url)
      .then(response => {
        console.log(`Reloaded at ${new Date().toISOString()}: Status Code ${response.status}`);
      })
      .catch(error => {
        console.error(`Error reloading at ${new Date().toISOString()}:`, error.message);
      });
}

setInterval(reloadWebsite, interval);

module.exports = app;
