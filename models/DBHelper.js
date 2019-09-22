let SQLite = require('sqlite3');
let path = require('path');
let DB = new SQLite.Database(path.join(__dirname, '..', 'database', '.proxy_machine'));
const MODEMS_TABLE = 'modems';

class DBHelper {

    static init() {
        DB.serialize(function() {

            let checkSQL = "SELECT name FROM sqlite_master WHERE type='table' AND name='modems';";
            DB.get(checkSQL, function (err, row) {
                if (!row) {
                    let createSQL = "CREATE TABLE modems (IMEI NUMERIC, DHCPAddress TEXT, ProxySOCKSPort NUMERIC, ProxyHTTPPort NUMERIC, Interface TEXT, LastUpdateDate TEXT, NetworkMode TEXT)";
                    DB.run(createSQL);
                    DB.close();
                } else if (!err && row.name === "modems") {

                } else {
                    throw new SQLException();
                }
            });

            // DB.run("CREATE TABLE lorem (info TEXT)");
            //
            // var stmt = DB.prepare("INSERT INTO lorem VALUES (?)");
            // for (var i = 0; i < 10; i++) {
            //     stmt.run("Ipsum " + i);
            // }
            // stmt.finalize();
            //
            // DB.each("SELECT rowid AS id, info FROM lorem", function(err, row) {
            //     console.log(row.id + ": " + row.info);
            // });
        });


    }
}

module.exports = DBHelper;
