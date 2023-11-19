const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// Configuration de MongoDB (assurez-vous que MongoDB est installé localement ou configurez une base de données en ligne)
mongoose.connect('mongodb://localhost:27017/votre_base_de_donnees', { useNewUrlParser: true, useUnifiedTopology: true });

const nombreSchema = new mongoose.Schema({
  valeur: Number
});

const Nombre = mongoose.model('Nombre', nombreSchema);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/enregistrerNombre', (req, res) => {
  const nombre = req.body.nombre;

  // Vérifie si le nombre est supérieur à 8
  if (nombre > 8) {
    const nouveauNombre = new Nombre({ valeur: nombre });

    // Enregistre le nombre dans la base de données
    nouveauNombre.save((err) => {
      if (err) {
        return res.status(500).send(err);
      }

      return res.status(200).send('Nombre enregistré avec succès !');
    });
  } else {
    return res.status(200).send('Le nombre n\'est pas supérieur à 8, donc non enregistré.');
  }
});

app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur le port ${port}`);
});
