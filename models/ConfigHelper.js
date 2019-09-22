let exec = require('child_process').exec;

const ipConfigTemplate = "ip rule del from 192.168.n1.100/32 table Modem1\n" +
    "ip route flush table Modem1\n" +
    "ip rule del from 192.168.n2.100/32 table Modem1\n" +
    "ip route flush table Modem2\n" +
    "ip rule del from 192.168.n3.100/32 table Modem1\n" +
    "ip route flush table Modem3\n" +
    "ip rule del from 192.168.n4.100/32 table Modem1\n" +
    "ip route flush table Modem4\n" +
    "ip rule del from 192.168.n5.100/32 table Modem1\n" +
    "ip route flush table Modem5\n" +
    "ip rule add from 192.168.n1.100/32 table Modem1\n" +
    "ip route add default via 192.168.n1.1 dev eth1 table Modem1\n" +
    "ip rule add from 192.168.n2.100/32 table Modem2\n" +
    "ip route add default via 192.168.n2.1 dev eth2 table Modem2\n" +
    "ip rule add from 192.168.n3.100/32 table Modem3\n" +
    "ip route add default via 192.168.n3.1 dev eth3 table Modem3\n" +
    "ip rule add from 192.168.n4.100/32 table Modem4\n" +
    "ip route add default via 192.168.n4.1 dev eth4 table Modem4\n" +
    "ip rule add from 192.168.n5.100/32 table Modem5\n" +
    "ip route add default via 192.168.n5.1 dev eth5 table Modem5\n";

class ConfigHelper {

    static rewriteIPConfig() {
        return new Promise((resolve, reject) => {
            exec("ifconfig | grep 'inet' | cut -d: -f2", function (err, stdout, stderr) {
                if (err) {
                    console.log(err);
                    console.log(stderr);
                    reject(stderr);
                }
                const ipRegex = /(\s+)(inet\s+)(\d{3}.\d{3}.)(\d)(.+)/gm;
                let interfaces = stdout.split(/\r?\n/);
                let networkAddresses = [];
                for (let i = 0; i < interfaces.length; i++) {
                    let str = interfaces[i];
                    networkAddresses[i] = str.replace(ipRegex, "\$4");
                }
                let commands = ipConfigTemplate;
                for (let i = 1; i < networkAddresses.length - 1; i++) {
                    let regex = new RegExp('(n' + i + ')', 'gm');
                    commands = commands.replace(regex, networkAddresses[i]);
                }
                //console.log(commands);
                exec(commands, function (err, stdout, stderr) {
                    if (err) {
                        console.log(err);
                        reject(stderr);
                    }
                    resolve(stdout);
                });
            });
        });
    }

    static getIPInterfaces() {
        return new Promise((resolve, reject) => {
            exec("ip -o addr show scope global | awk '{split($4, a, \"/\"); print $2\":\"a[1]}'", function (err, stdout) {
                if (err) reject(err);
                let interfaces = stdout.split(/\r?\n/);
                let networkInterfaces = {};
                for (let i = 0; i < interfaces.length; i++) {
                    let interfaceAndIP = interfaces[i].split(':');
                    networkInterfaces[interfaceAndIP[0]] = interfaceAndIP[1];
                }
                resolve(networkInterfaces);
            });
        });
    }
}

module.exports = ConfigHelper;
