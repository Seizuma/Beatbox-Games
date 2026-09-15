import getEmoji from '../utils/getEmoji';

function GameScreen({
    pseudo, currentLevel, countdownVisible, countdownText,
    canAnswer, submitted, timeLeft, hasScored, answer,
    setAnswer, handleSubmit, result, scores, lastAnswers
}) {
    return (
        <div className="card game-card bg-zinc-800 rounded-2xl p-8 shadow-xl flex flex-col items-center max-w-md w-full mx-auto mt-10">
            <div className="w-full mb-5 relative flex flex-col items-center">
                <h2 className="text-3xl md:text-4xl font-bold text-cyan-400 text-center leading-tight">
                    Bienvenue<br />{pseudo}
                </h2>
                <span
                    className="absolute right-8 top-1/2 transform -translate-y-1/2 text-4xl"
                    role="img"
                    aria-label="micro"
                >🎤</span>
            </div>


            {currentLevel !== null && (
                <p className="mb-3 text-lg text-yellow-400 font-semibold text-center">Niveau actuel : {currentLevel}</p>
            )}

            {countdownVisible && (
                <div className="countdown-overlay">
                    <div className="countdown-text">{countdownText}</div>
                </div>
            )}

            {canAnswer && !submitted && timeLeft !== null && (
                <div
                    className={`font-bold text-2xl mb-3 ${timeLeft < 10 ? "text-red-400" : "text-cyan-300"}`}
                >
                    ⏳ Temps restant : {timeLeft}s
                </div>
            )}

            {hasScored ? (
                <p className="text-green-400 font-semibold mb-4 text-center">✅ Tu as déjà trouvé la bonne réponse</p>
            ) : canAnswer && !submitted ? (
                <>
                    <input
                        type="text"
                        placeholder="Votre réponse"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter") handleSubmit();
                        }}
                        className="w-full p-3 mb-4 rounded-md bg-zinc-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
                    />
                    <button
                        onClick={handleSubmit}
                        className="w-full py-3 rounded-md bg-cyan-400 text-zinc-900 font-bold text-lg hover:bg-cyan-300 transition"
                    >
                        Envoyer
                    </button>
                </>
            ) : submitted ? (
                <p className="text-cyan-400 font-medium mb-4 text-center">✅ Réponse envoyée</p>
            ) : (
                <p className="text-gray-400 mb-4 text-center">🎧 En attente d’autorisation…</p>
            )}

            {result && (
                <div className="result-block mt-5 text-lg font-semibold text-cyan-300 text-center">
                    <strong>{result}</strong>
                </div>
            )}

            {Object.entries(scores).length > 0 && (
                <div className="scoreboard mt-7 w-full bg-[#202040] p-5 rounded-xl flex flex-col items-center">
                    <h3 className="text-yellow-300 mb-4 text-xl font-bold text-center flex items-center gap-2 justify-center">
                        <span role="img" aria-label="trophy">🏆</span> Scores :
                    </h3>
                    <div className="w-full flex flex-col items-center">
                        {Object.entries(scores)
                            .sort(([, a], [, b]) => b - a)
                            .map(([name, pts]) => (
                                <p key={name}
                                    className={
                                        `mb-2 text-base flex items-center justify-center gap-2` +
                                        (name === pseudo ? ' font-bold text-cyan-400' : ' text-gray-100')
                                    }
                                >
                                    <span>{name} : {pts} pts</span>
                                    <span>{getEmoji(name, lastAnswers)}</span>
                                </p>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default GameScreen;
