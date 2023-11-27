const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
require('dotenv').config();


const { auth_voir_admin,auth_changer_authLevel, auth_supprimer_admin,auth_ajouter_admin } = require('./config.json');


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
app.get('/', async (req, res) => {

  if (req.session.utilisateur) {
    const auth = await verifAuthLevel(req,res,"accueil")
    res.render('accueil', { username: req.session.utilisateur.username, current_authLevel: auth, auth_voir_admin} );
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

    const randomId = crypto.randomBytes(16).toString('hex'); // Génère un ID aléatoire

    await db.collection('utilisateurs').updateOne(
      { username: usernameNormalized },
      { $set: { session_id: randomId } }
    );

    req.session.utilisateur = { session_id: randomId, username: utilisateur.username };

    res.redirect('/');
  } else {
    res.render('login', { erreur: 'Nom d\'utilisateur ou mot de passe incorrect' });
  }
});

app.get('/admin', async (req, res) => {

  const auth = await verifAuthLevel(req,res,"admin")

  if (req.session.utilisateur) {
 
  // Vérifiez les informations d'identification dans la base de données
  const usernameNormalized = req.session.utilisateur.username.toLowerCase();

  if ( auth >= auth_voir_admin )
 {
      log("[ADMIN] " + usernameNormalized + " a accéder à /admin");
      
      const admins = await getAdmins()

      res.render('admin', { admins, auth_changer_authLevel, auth_supprimer_admin, current_authLevel: auth,auth_ajouter_admin,erreur: null });
      
  } else {
    if (req.session.utilisateur) {
      log("[INTRU] " + req.session.utilisateur.username + " a éssayé d'accéder à /admin");
    }
    else {
      log("[INTRU] Quelqu'un a éssayé d'accéder à /admin");
    }
  }
} 

});

async function getAdmins() {
  return db.collection('utilisateurs').find({ authLevel: { $gt: 0 } }).toArray();
}




// app.post('/addAdmin', async (req, res) => {

//   if (req.session.utilisateur) {
 
//     // Vérifiez les informations d'identification dans la base de données
//     const usernameNormalized = req.session.utilisateur.username.toLowerCase();
//     console.log("a :" + usernameNormalized)
//     const utilisateur = await chercherUtilisateur(usernameNormalized);
  
//     if(utilisateur){
  
//       const authLevel = await getAuthLevel(usernameNormalized)
  
//     if ( authLevel > 0 && utilisateur.session_id === req.session.utilisateur.session_id )
//    {
     
     
      
//       const collection = db.collection('admin');
//       collection.insertOne({username : adminToAdd});
//       log("[ADMIN] " + usernameNormalized + " a ajouter un amdin : " + adminToAdd + "(/addAdmin)");

//    }else {
//         if (req.session.utilisateur) {
//           log("[INTRU] " + req.session.utilisateur.username + " a éssayé d'accéder à /admin");
//         }
//         else {
//           log("[INTRU] Quelqu'un a éssayé d'accéder à /admin");
//         }
//       }
    
//     } }
    
//     else {
    
//       res.redirect('/login');
//     }

// });

app.post('/deleteAdmin', async (req, res) => {

  const auth = await verifAuthLevel(req,res,"admin")

      if (req.session.utilisateur) {
      
      const usernameNormalized = req.session.utilisateur.username.toLowerCase();
      let { usernameAdminToDelete } = req.body;
      if (!usernameAdminToDelete) {
        log(`[INTRU] ${usernameNormalized} a tenté de supprimer un admin sans spécifier de nom`);
        return;
      }
 


        if ( auth >= auth_supprimer_admin )
        {
          
          usernameAdminToDelete = usernameAdminToDelete.toLowerCase();
          const collection = db.collection('utilisateurs');
          const result = await collection.updateOne(
            { username : usernameAdminToDelete },
            { $set: { authLevel: 0 } }
          );

          if (result.modifiedCount > 0) {
            log(`[ADMIN] ${usernameNormalized} a mis à jour l'authLevel de ${usernameAdminToDelete} à 0`);
            res.redirect('/admin'); // Redirigez après la mise à jour
          } else {
            log(`[ERREUR] L'authLevel de l'admin ${usernameAdminToDelete} n'a pas pu être mis à jour`);
            res.status(500).send('Erreur serveur');
          }
    } else 
    {
      log(`[INTRU] ${usernameNormalized} a tenté de supprimer un admin (${usernameAdminToDelete} ) sans autorisation`);
      res.status(403).send('Accès interdit'); // 403 Forbidden
    }
  } else {
    res.redirect('/login');
  }
});


app.post('/authAdmin', async (req, res) => {


  const auth = await verifAuthLevel(req,res,"admin")

  if (req.session.utilisateur) {
  
  const usernameNormalized = req.session.utilisateur.username.toLowerCase();
  
  let { authVal, usernameToChangeAuthLevel } = req.body; // nouvelle auth
  

  if (!authVal) {
    log(`[INTRU] ${usernameNormalized} a tenté de supprimer un admin sans spécifier de auth (/authAdmin))`);
    return;
  }
  if(!usernameToChangeAuthLevel  ) {
    log(`[INTRU] ${usernameNormalized} a tenté de supprimer un admin sans spécifier de nom (/authAdmin))`);
    return;
  }
  
  const ut = await chercherUtilisateur(usernameToChangeAuthLevel)
  if (!ut) 
  {
    req.session.erreurMessage = 'Cet utilisateur n\'existe pas';
    res.redirect('/admin');
  }
  const authLevel = parseInt(authVal);
  usernameToChangeAuthLevel = usernameToChangeAuthLevel.toLowerCase();

    if ( auth >= auth_changer_authLevel )
    {
      
      // Mise à jour de l'authLevel dans la base de données
      const result = await db.collection('utilisateurs').updateOne(
        { username: usernameToChangeAuthLevel },
        { $set: { authLevel: authLevel } }
      );

      if (result.modifiedCount > 0) {
        log(`[ADMIN] ${usernameNormalized} a mis à jour le authLevel de ${usernameToChangeAuthLevel} à ${authLevel}`);
        res.redirect('/admin'); // Redirection après la mise à jour
      } else {
        log(`[ERREUR] L'authLevel de ${usernameToChangeAuthLevel} n'a pas pu être mis à jour`);
        res.status(500).send('Erreur serveur');
      }


} else 
{
  log(`[INTRU] ${usernameNormalized} a tenté de changer l'authLevel de (${usernameToChangeAuthLevel} ) sans autorisation`);
  res.status(403).send('Accès interdit'); // 403 Forbidden
}
} else {
res.redirect('/login');
}



});



//app.post('/changeAuthLevel', async (req, res) => {


// Route pour la page d'inscription
app.get('/signup', (req, res) => {
  res.render('<h1>Creation de compte impossible, contacter nahel</h1>')
  //res.render('signup', { erreur: null });
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
  await db.collection('utilisateurs').insertOne({ username : usernameNormalized, password: hash,nom,prenom, authLevel : 0 });
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


async function verifAuthLevel(req,res,str = "?")
{
  if (req.session.utilisateur) {
 
    const usernameNormalized = req.session.utilisateur.username.toLowerCase();
    const utilisateur = await chercherUtilisateur(usernameNormalized);
  
    if(utilisateur){
  
      const authLevel = await getAuthLevelDb(usernameNormalized)
  
    if ( utilisateur.session_id === req.session.utilisateur.session_id )
   {
  
       
  
        return authLevel;
        
      
    } else {
      if (req.session.utilisateur) {
        log("[INTRU] " + req.session.utilisateur.username + " a éssayé d'accéder à /" + str + " avec un faux username");
        
      }
      else {
        log("[INTRU] Quelqu'un a éssayé d'accéder à /" + str + " avec un faux username");
      }
      return -1
      }
  
    } 
  res.redirect('/login');
  return -1;
  }
  
  else {
  
    res.redirect('/login');
    return -1;
  }
  res.redirect('/login');
  return -1;
}

async function getAuthLevelDb(username)
{
  const u = await chercherUtilisateur(username)
  if(u)
  {
    return u.authLevel
  }
  return 0
}


// Fonction pour chercher un utilisateur dans la base de données
function chercherUtilisateur(username) {
  return db.collection('utilisateurs').findOne({ username });
}
