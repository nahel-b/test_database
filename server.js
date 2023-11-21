const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'votre_cle_secrete', resave: true, saveUninitialized: true }));
app.set('view engine', 'ejs');

// Database setup
const db = new sqlite3.Database('utilisateurs.db');

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS utilisateurs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT)');
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
  res.render('login', { erreur: null }); // Assurez-vous que 'erreur' est défini
});

// Route pour gérer la connexion
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Vérifiez les informations d'identification dans la base de données
  const utilisateur = await chercherUtilisateur(username);

  if (utilisateur && await bcrypt.compare(password, utilisateur.password)) {
    req.session.utilisateur = { id: utilisateur.id, username: utilisateur.username };
    res.redirect('/');
  } else {
    res.render('login', { erreur: 'Nom d\'utilisateur ou mot de passe incorrect' });
  }
});



// Route pour la page d'inscription
app.get('/signup', (req, res) => {
  res.render('signup');
});

// Route pour gérer l'inscription
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  // Hachez le mot de passe avant de le stocker dans la base de données
  const hash = await bcrypt.hash(password, 10);

  // Enregistrez les nouvelles informations d'identification dans la base de données
  db.run('INSERT INTO utilisateurs (username, password) VALUES (?, ?)', [username, hash], (err) => {
    if (err) {
      res.render('signup', { erreur: 'Erreur lors de l\'inscription' });
    } else {
      res.redirect('/login');
    }
  });
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

// Fonction pour chercher un utilisateur dans la base de données
function chercherUtilisateur(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM utilisateurs WHERE username = ?', [username], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

