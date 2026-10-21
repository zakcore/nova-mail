// npm run db:init [-- --sans-creation]
// Runs script_mysql.sql, then replaces the placeholder hashes with bcrypt('Nova2026!').
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../src/config');

const SCRIPT = path.join(__dirname, 'script_mysql.sql');
const DEMO_PASSWORD = 'Nova2026!';
const TABLES = ['pieces_jointes', 'messages', 'contacts', 'dossiers', 'utilisateurs'];

function preparerScript(nomBase, sansCreation) {
  let sql = fs.readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n');
  if (nomBase !== 'messagerie_web') {
    sql = sql.replace(/messagerie_web/g, nomBase);
  }
  if (sansCreation) {
    sql = sql
      .split('\n')
      .filter((line) => !/^\s*(DROP DATABASE|CREATE DATABASE|USE)\b/i.test(line))
      .join('\n')
      .replace(
        'SET FOREIGN_KEY_CHECKS = 0;',
        `SET FOREIGN_KEY_CHECKS = 0;\n${TABLES.map((t) => `DROP TABLE IF EXISTS ${t};`).join('\n')}`
      );
  }
  return sql;
}

async function initialiser({
  nomBase = config.db.database,
  rounds = config.bcryptRounds,
  silencieux = false,
  sansCreation = false,
} = {}) {
  if (!/^[A-Za-z0-9_]+$/.test(nomBase)) {
    throw new Error(`Nom de base invalide : ${nomBase}`);
  }
  const log = silencieux ? () => {} : console.log;
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: sansCreation ? nomBase : undefined,
    ssl: config.db.sslOptions,
    multipleStatements: true,
    charset: 'utf8mb4',
    timezone: 'Z',
  });

  try {
    await conn.query("SET time_zone = '+00:00'");
    log(`Exécution du script sur la base « ${nomBase} »…`);
    await conn.query(preparerScript(nomBase, sansCreation));
    if (!sansCreation) await conn.query(`USE \`${nomBase}\``);

    const hash = await bcrypt.hash(DEMO_PASSWORD, rounds);
    await conn.query('UPDATE utilisateurs SET mot_de_passe_hash = ?', [hash]);

    const [[comptes]] = await conn.query(
      `SELECT
         (SELECT COUNT(*) FROM utilisateurs) AS utilisateurs,
         (SELECT COUNT(*) FROM contacts) AS contacts,
         (SELECT COUNT(*) FROM dossiers) AS dossiers,
         (SELECT COUNT(*) FROM messages WHERE direction = 'recu') AS recus,
         (SELECT COUNT(*) FROM messages WHERE direction = 'envoye') AS envoyes`
    );
    log(
      `Contrôle : ${comptes.utilisateurs} utilisateurs, ${comptes.contacts} contacts, ` +
        `${comptes.dossiers} dossiers, ${comptes.recus} reçus, ${comptes.envoyes} envoyés.`
    );
    log(`Mot de passe des comptes de démonstration : ${DEMO_PASSWORD}`);
    return comptes;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  initialiser({ sansCreation: process.argv.includes('--sans-creation') })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`Échec de l'initialisation : ${err.message}`);
      process.exit(1);
    });
}

module.exports = { initialiser };
