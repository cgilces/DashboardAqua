const xmlrpc = require("xmlrpc");
require("dotenv").config();

const {
  ODOO_URL,
  ODOO_DB,
  ODOO_USER,
  ODOO_API_KEY
} = process.env;

// Cliente común
const common = xmlrpc.createClient({
  url: `${ODOO_URL}/xmlrpc/2/common`
});

// Cliente de objetos
const object = xmlrpc.createClient({
  url: `${ODOO_URL}/xmlrpc/2/object`
});

// 🔐 Login
const loginOdoo = () => {
  return new Promise((resolve, reject) => {
    common.methodCall(
      "authenticate",
      [ODOO_DB, ODOO_USER, ODOO_API_KEY, {}],
      (err, uid) => {
        if (err || !uid) {
          return reject("❌ Error autenticando con Odoo");
        }
        resolve(uid);
      }
    );
  });
};

module.exports = {
  object,
  loginOdoo
};
