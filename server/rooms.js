const fs = require('fs');
const path = require('path');

const rooms = {};

function updateRemainingRounds(room, io) {
    const r = rooms[room];
    if (!r) return;
    const dir = path.join(__dirname, 'public', 'audio');
    fs.readdir(dir, (err, files) => {
        if (err || !files) return;
        const level1 = files.filter(f => f.startsWith('Level 1 -'));
        const total = level1.length;
        const remaining = total - r.playedArtists.length;
        io.to(room).emit('update-remaining-rounds', { total, remaining });
    });
}

module.exports = { rooms, updateRemainingRounds };
