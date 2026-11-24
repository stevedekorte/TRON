import {CYCLE_FORMATION_TIMING} from '../simulation/config/light-cycles.js';
export const MP=Object.freeze({
 protocol:5,legacyProtocol:1,maxPlayers:12,maxCyclesPerTeam:3,maxConnections:64,tickHz:120,snapshotTicks:4,
 inputLeadTicks:0,maxFutureTicks:24,maxLateTicks:24,turnIntervalTicks:6,
 countdownSeconds:0,formationSeconds:CYCLE_FORMATION_TIMING.formationSeconds,materializationSeconds:CYCLE_FORMATION_TIMING.formationSeconds,launchHoldSeconds:CYCLE_FORMATION_TIMING.launchHoldSeconds,resultSeconds:10,maxMatchSeconds:180,maxTrails:2048,
 inputTimeoutTicks:120,heartbeatSeconds:10,connectionTimeoutSeconds:35,
 maxMessageBytes:512,maxMessagesPerSecond:80,maxBufferedBytes:512*1024,
 maxCatchupSteps:24,startFormationSpacingCells:1,
});
// Arena presence: menus and solo games learn how many humans are in the multiplayer
// arena without joining it. Watchers get {type:'arena',players} now and on every change.
export const MP_PRESENCE=Object.freeze({
 statusPath:'/api/multiplayer/status',watchPath:'/api/multiplayer/watch',
 maxWatchers:1000,          // presence sockets per arena; extra watchers fall back to polling
 pingSeconds:30,            // watcher keep-alive ('ping' -> 'pong', answered without waking the arena)
 reconnectSeconds:[2,5,15,30], // watcher reconnect backoff; each attempt also polls the status endpoint
});
export const presenceMessage=players=>JSON.stringify({type:'arena',players});
