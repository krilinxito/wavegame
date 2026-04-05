const lobbyHandlers = require('./lobby');
const roundHandlers = require('./round');
const powerHandlers = require('./powers');

function registerHandlers(io, socket) {
  lobbyHandlers(io, socket);
  roundHandlers(io, socket);
  powerHandlers(io, socket);
}

module.exports = { registerHandlers };
