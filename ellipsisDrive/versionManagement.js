const https = require('https');
const fs = require('fs');

const VERSIONS = require('./versions').versions;

module.exports = {
    getPackageVersion: (package, ellipsisDriveVersion) => {
        let versions = VERSIONS.filter((x) => x.version <= ellipsisDriveVersion)
            .sort((a, b) => (a.version > b.version) ? 1 : ((b.version > a.version) ? -1 : 0))
            .reverse();

        for (let i = 0; i < versions.length; i++) {
            if (versions[i].images[package]) {
                return versions[i].images[package];
            }
        }
    },

    upgrade: async (oldEllipsisDriveVersion, newEllipsisDriveVersion) => {
        let versions = VERSIONS.filter((x) => x.version > oldEllipsisDriveVersion && x.version <= newEllipsisDriveVersion)
            .sort((a, b) => (a.version > b.version) ? 1 : ((b.version > a.version) ? -1 : 0));

        if (versions.length === 0) {
            console.log('no versions to upgrade');
            return;
        }

        for (let i = 0; i < versions.length; i++) {
            console.log(`upgrading to version ${versions[i].version}`)
            await versions[i].upgrade();
        }
    },

    pull: async () => {
        console.log('pull the new versions from the master branch of the git');

        let response = await fetch("https://raw.githubusercontent.com/ellipsis-drive/edk-cli/master/ellipsisDrive/versions.js");

        if (response.ok) {
            let body = await response.text();
            fs.promises.writeFile('./ellipsisDrive/versions.js', body, 'utf8');
        }
        else {
            throw (`Response status code was ${response.status}`);
        }
    },

    getQueries: (database, ellipsisDriveVersion) => {
        let versions = VERSIONS.filter((x) => x.version <= ellipsisDriveVersion)
            .sort((a, b) => (a.version > b.version) ? 1 : ((b.version > a.version) ? -1 : 0));

        let queries = ["-- Running database updates"];
        for (let i = 0; i < versions.length; i++) {
            if (versions[i].queries && versions[i].queries[database]) {
                queries.push(...versions[i].queries[database]);
            }
        }

        return queries
            .map((x) => `    ${x.trim()}`) // make sure the indents work in the configmap
            .join('\n');
    },

    versions: VERSIONS,
}