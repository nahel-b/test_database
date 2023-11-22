const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }));
app.set('view engine', 'ejs');

// Connecter à MongoDB Atlas
const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
let db;

client.connect()
  .then(() => {
    console.log('Connecté à MongoDB Atlas');
    db = client.db();
  })
  .catch(err => console.error('Erreur de connexion à MongoDB Atlas', err));

function log(string ) {
  console.log("[APP]" + string);  
}


const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15* 60 * 1000, // 15 minutes
  max: 20, // 50 tentatives maximum par fenêtre
  handler: (req, res) => {
    if (req.session.utilisateur) {
      log("[LIMITE!] " + req.session.utilisateur.username + " a dépassé la limite de tentatives de connexion");
    }
    else {
      log("[LIMITE!] Quelqu'un a dépassé la limite de tentatives de connexion");
    }
    res.status(429).json({
      error: 'Trop de tentatives à partir de cette adresse IP. Veuillez réessayer après 15 minutes.'
    });
  }
});


// Route pour la page d'accueil
app.get('/', (req, res) => {
  if (req.session.utilisateur) {
    res.render('accueil', { username: req.session.utilisateur.username });
  } else {
    res.redirect('/login');
  }
});

// Route pour la page de connexion
app.get('/login', (req, res) => {
  res.render('login', { erreur: null });
});

// Route pour gérer la connexion
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Vérifiez les informations d'identification dans la base de données
  const usernameNormalized = req.body.username.toLowerCase();
  const utilisateur = await chercherUtilisateur(usernameNormalized);

  if (utilisateur && await bcrypt.compare(password, utilisateur.password)) {
    req.session.utilisateur = { id: utilisateur._id, username: utilisateur.username };
    res.redirect('/');
  } else {
    res.render('login', { erreur: 'Nom d\'utilisateur ou mot de passe incorrect' });
  }
});

app.get('/admin', async (req, res) => {

  if (req.session.utilisateur) {
 
  // Vérifiez les informations d'identification dans la base de données
  const usernameNormalized = req.session.utilisateur.username.toLowerCase();
  console.log("a :" + usernameNormalized)
  const utilisateur = await chercherAdmin(usernameNormalized);

  if (utilisateur && utilisateur._id == req.session.utilisateur.id )
 {
   
    if(utilisateur)
    {
      console.log("b :" + utilisateur)
      log("[ADMIN] " + usernameNormalized + " a accéder à /admin");

      const collection = db.collection('admin')
      collection.find({}).toArray((err,admins) => {

          if(err)
          {
            console.error('Erreur lors de la récuperation des admins :',err)
            res.status(500).send('Erreur serveur');
            return;
          }
          res.render('admin', {admins});
        }
      )
      
    }
    else 
    {
      if (req.session.utilisateur) {
        log("[INTRU] " + req.session.utilisateur.username + " a éssayé d'accéder à /admin");
      }
      else {
        log("[INTRU] Quelqu'un a éssayé d'accéder à /admin");
      }
    }
  } else {
    if (req.session.utilisateur) {
      log("[INTRU] " + req.session.utilisateur.username + " a éssayé d'accéder à /admin avec un mauvais id");
    }
    else {
      log("[INTRU] Quelqu'un a éssayé d'accéder à /admin avec un mauvais id");
    }
  }

} else {

  res.redirect('/login');
}

});

app.post('/addAdmin', async (req, res) => {

  if (req.session.utilisateur && req.body.adminUsername) {
 
    // Vérifiez les informations d'identification dans la base de données
    const usernameNormalized = req.session.utilisateur.username.toLowerCase();
    const adminToAdd= req.body.adminUsername.toLowerCase();
    const utilisateur = await chercherAdmin(usernameNormalized);

  
    if ( utilisateur && utilisateur._id == req.session.utilisateur.id ) {
     
      if(utilisateur)
    {
      
      const collection = db.collection('admin');
      collection.insertOne({username : adminToAdd});
      log("[ADMIN] " + usernameNormalized + " a ajouter un amdin : " + adminToAdd + "(/addAdmin)");

    }
    else 
    {
      if (req.session.utilisateur) {
        log("[INTRU] " + req.session.utilisateur.username + " a éssayé d'accéder à /addAdmin");
      }
      else {
        log("[INTRU] Quelqu'un a éssayé d'accéder à /addAdmin");
      }
    }
    } else {
      if (req.session.utilisateur) {
        log("[INTRU] " + req.session.utilisateur.username + " a éssayé d'accéder à /admin avec un mauvais id");
      }
      else {
        log("[INTRU] Quelqu'un a éssayé d'accéder à /admin avec un mauvais id");
      }
    }
  
  } else {
  
    res.redirect('/login');
  }

});





// Route pour la page d'inscription
app.get('/signup', (req, res) => {
  res.render('signup', { erreur: null });
});

app.get('/fb', (req, res) => 
{
  res.render('test_flappy_bird');
});

// Route pour gérer l'inscription
app.post('/signup',limiter, async (req, res) => {
  const { username, password,nom, prenom } = req.body;


  // Vérifiez si l'utilisateur existe déjà dans la base de données
  const usernameNormalized = req.body.username.toLowerCase();
  const utilisateur = await chercherUtilisateur(usernameNormalized);
  if(utilisateur) {
    return res.render('signup', { erreur: 'Nom d\'utilisateur déjà utilisé' });
  }

  // Hachez le mot de passe avant de le stocker dans la base de données
  const hash = await bcrypt.hash(password, 10);

  // Enregistrez les nouvelles informations d'identification dans la base de données
  await db.collection('utilisateurs').insertOne({ username : usernameNormalized, password: hash,nom,prenom });
  log("[Inscription] Nouvel utilisateur: " + usernameNormalized);
  res.redirect('/login');
});

// Route pour la déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Écoutez le port
app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});


function chercherAdmin(username)
{
  return db.collection('admin').findOne({ username });
}

// Fonction pour chercher un utilisateur dans la base de données
function chercherUtilisateur(username) {
  return db.collection('utilisateurs').findOne({ username });
}
