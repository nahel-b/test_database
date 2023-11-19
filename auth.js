const bcrypt = require('bcrypt');
const User = require('./models/user'); // Assurez-vous que le chemin est correct

const login = async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.user = user;
    res.redirect('/dashboard');
  } else {
    res.status(401).send('Identifiants incorrects');
  }
};

module.exports = { login };
