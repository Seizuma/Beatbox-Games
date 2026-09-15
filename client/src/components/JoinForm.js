import React from 'react';

function JoinForm({ pseudo, setPseudo, room, setRoom, handleJoin, joining, error }) {
    return (
        <div className="card join-card bg-zinc-800 rounded-2xl p-8 shadow-xl flex flex-col items-center max-w-md w-full mx-auto mt-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-7 text-cyan-400 flex items-center gap-2">
                <span role="img" aria-label="casque">🎧</span> Blind Test
            </h1>
            <input
                type="text"
                placeholder="Pseudo"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                className="w-full p-3 mb-4 rounded-md bg-zinc-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
            />
            <input
                type="text"
                placeholder="Code de partie"
                value={room}
                onChange={(e) => setRoom(e.target.value.toUpperCase())}
                className="w-full p-3 mb-6 rounded-md bg-zinc-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
            />
            <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-3 rounded-md bg-cyan-400 text-zinc-900 font-bold text-lg hover:bg-cyan-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {joining ? 'Connexion...' : 'Rejoindre'}
            </button>
            {error && (
                <p className="error mt-3 text-red-400 font-semibold text-center">
                    {error.toLowerCase().includes("room inconnue")
                        ? "La partie n'existe plus ou a été fermée. Rejoins ou crée une nouvelle partie."
                        : error}
                </p>
            )}
        </div>
    );
}

export default JoinForm;
